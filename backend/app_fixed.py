#!/usr/bin/env python3
"""
Python 3.7 compatible FastAPI backend for Vibe Kanban
Falls back to Flask if FastAPI is not available
"""
import json
import uuid
import os
import threading
from datetime import datetime
from time import sleep
from typing import Dict, List, Optional
from dataclasses import dataclass, field

# Try FastAPI first, fall back to Flask
try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse
    from pydantic import BaseModel
    FASTAPI_AVAILABLE = True
    print("Using FastAPI backend")
except ImportError:
    try:
        from flask import Flask, jsonify, request
        from flask_cors import CORS
        FASTAPI_AVAILABLE = False
        print("FastAPI not available, using Flask backend")
    except ImportError:
        print("Neither FastAPI nor Flask available!")
        exit(1)

# Data models
@dataclass
class Task:
    id: str
    title: str
    description: str = ""
    
    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description
        }

# Pydantic models for FastAPI
if FASTAPI_AVAILABLE:
    class TaskCreate(BaseModel):
        title: str
        description: Optional[str] = ""
        column_id: str

    class TaskUpdate(BaseModel):
        title: str
        description: Optional[str] = ""

    class TaskMove(BaseModel):
        new_column_id: str
        new_index: int

# Database class
@dataclass
class Database:
    _tasks_db: Dict[str, Task] = field(default_factory=dict)
    _columns: Dict[str, List[Task]] = field(default_factory=dict)
    _has_changes: bool = False
    _backup_file: str = "database.json"
    _lock: threading.RLock = field(default_factory=threading.RLock)

    def __post_init__(self):
        # Initialize default columns
        self._columns = {
            "ideas": [],
            "selected": [],
            "in_progress": [],
            "parked": [],
            "done": []
        }
        
        # Try to load from backup file
        if not self.load_from_file():
            self._init_sample_data()

    def _init_sample_data(self):
        """Initialize with sample data"""
        sample_tasks = [
            Task(str(uuid.uuid4()), "Ask Claude AI to make Half-Life 3 as an easter egg", ""),
            Task(str(uuid.uuid4()), "Make the app web-scale", ""),
            Task(str(uuid.uuid4()), "Implement User accounts and Auth/Autz", ""),
        ]
        
        for task in sample_tasks:
            self.add(task, "ideas")
            
        # Add some to selected
        selected_tasks = [
            Task(str(uuid.uuid4()), "Re-design the API endpoints", ""),
            Task(str(uuid.uuid4()), "Holistically administrate exceptional synergies", ""),
        ]
        
        for task in selected_tasks:
            self.add(task, "selected")

    def add(self, task: Task, column_id: str):
        with self._lock:
            self._tasks_db[task.id] = task
            if column_id not in self._columns:
                self._columns[column_id] = []
            self._columns[column_id].append(task)
            self._mark_changed()

    def get(self, task_id: str) -> Task:
        with self._lock:
            if task_id not in self._tasks_db:
                raise KeyError(f"Task {task_id} not found")
            return self._tasks_db[task_id]

    def update_task(self, task_id: str, **kwargs):
        with self._lock:
            if task_id not in self._tasks_db:
                raise KeyError(f"Task {task_id} not found")
            task = self._tasks_db[task_id]
            for key, value in kwargs.items():
                if hasattr(task, key):
                    setattr(task, key, value)
            self._mark_changed()

    def move(self, task_id: str, to_column_id: str, to_index: int):
        with self._lock:
            if task_id not in self._tasks_db:
                raise KeyError(f"Task {task_id} not found")
            
            task = self._tasks_db[task_id]
            
            # Remove from current column
            for column_tasks in self._columns.values():
                if task in column_tasks:
                    column_tasks.remove(task)
                    break
            
            # Add to new column at specified index
            if to_column_id not in self._columns:
                self._columns[to_column_id] = []
            
            # Ensure index is within bounds
            max_index = len(self._columns[to_column_id])
            to_index = min(max(0, to_index), max_index)
            
            self._columns[to_column_id].insert(to_index, task)
            self._mark_changed()

    def delete(self, task_id: str):
        with self._lock:
            if task_id not in self._tasks_db:
                raise KeyError(f"Task {task_id} not found")
            
            task = self._tasks_db[task_id]
            del self._tasks_db[task_id]
            
            # Remove from columns
            for column_tasks in self._columns.values():
                if task in column_tasks:
                    column_tasks.remove(task)
                    break
            self._mark_changed()

    def empty_column(self, column_id: str):
        with self._lock:
            if column_id in self._columns:
                # Delete all tasks in the column
                for task in self._columns[column_id]:
                    if task.id in self._tasks_db:
                        del self._tasks_db[task.id]
                # Clear the column
                self._columns[column_id] = []
                self._mark_changed()

    def serialize(self) -> Dict[str, List[Dict]]:
        """Return tasks organized by columns as dictionaries"""
        with self._lock:
            result = {}
            for column_id, tasks in self._columns.items():
                result[column_id] = [task.to_dict() for task in tasks]
            return result

    def _mark_changed(self):
        self._has_changes = True

    def save_to_file(self):
        """Save database to JSON file"""
        with self._lock:
            if not self._has_changes:
                return False
            
            try:
                data = {
                    "tasks": {task_id: task.to_dict() for task_id, task in self._tasks_db.items()},
                    "columns": {col_id: [task.id for task in tasks] for col_id, tasks in self._columns.items()},
                    "backup_timestamp": datetime.now().isoformat()
                }
                
                with open(self._backup_file, 'w') as f:
                    json.dump(data, f, indent=2)
                
                self._has_changes = False
                print(f"Database saved to {self._backup_file}")
                return True
            except Exception as e:
                print(f"Failed to save database: {e}")
                return False

    def load_from_file(self):
        """Load database from JSON file"""
        with self._lock:
            if not os.path.exists(self._backup_file):
                print(f"No backup file found at {self._backup_file}")
                return False
            
            try:
                with open(self._backup_file, 'r') as f:
                    data = json.load(f)
                
                self._tasks_db.clear()
                self._columns.clear()
                
                # Restore tasks
                for task_id, task_data in data.get("tasks", {}).items():
                    task = Task(task_data["id"], task_data["title"], task_data.get("description", ""))
                    self._tasks_db[task_id] = task
                
                # Restore columns
                for column_id, task_ids in data.get("columns", {}).items():
                    self._columns[column_id] = []
                    for task_id in task_ids:
                        if task_id in self._tasks_db:
                            self._columns[column_id].append(self._tasks_db[task_id])
                
                print(f"Database loaded from {self._backup_file}")
                return True
            except Exception as e:
                print(f"Failed to load database: {e}")
                return False

# Initialize database
db = Database()

# Periodic backup
def periodic_backup():
    while True:
        try:
            db.save_to_file()
        except Exception as e:
            print(f"Periodic backup failed: {e}")
        sleep(60)

backup_thread = threading.Thread(target=periodic_backup, daemon=True)
backup_thread.start()

# API Implementation
if FASTAPI_AVAILABLE:
    # FastAPI implementation
    app = FastAPI()

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/tasks")
    async def get_tasks():
        """Get all tasks organized by columns"""
        return JSONResponse(content=db.serialize())

    @app.post("/api/tasks", status_code=201)
    async def create_task(task_data: TaskCreate):
        """Create a new task"""
        task_id = str(uuid.uuid4())
        new_task = Task(task_id, task_data.title, task_data.description or "")
        db.add(new_task, task_data.column_id)
        return JSONResponse(content=new_task.to_dict(), status_code=201)

    @app.put("/api/tasks/{task_id}")
    async def update_task(task_id: str, task_data: TaskUpdate):
        """Update an existing task"""
        try:
            db.update_task(task_id, title=task_data.title, description=task_data.description or "")
            task = db.get(task_id)
            return JSONResponse(content=task.to_dict())
        except KeyError:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    @app.post("/api/tasks/{task_id}/move")
    async def move_task(task_id: str, move_data: TaskMove):
        """Move a task to a new column and position"""
        try:
            db.move(task_id, move_data.new_column_id, move_data.new_index)
            task = db.get(task_id)
            return JSONResponse(content=task.to_dict())
        except KeyError:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    @app.delete("/api/tasks/{task_id}", status_code=204)
    async def delete_task(task_id: str):
        """Delete a task"""
        try:
            db.delete(task_id)
            return JSONResponse(content=None, status_code=204)
        except KeyError:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    @app.delete("/api/columns/{column_id}/empty", status_code=204)
    async def empty_column(column_id: str):
        """Empty all tasks in a column"""
        db.empty_column(column_id)
        return JSONResponse(content=None, status_code=204)

else:
    # Flask implementation
    flask_app = Flask(__name__)
    CORS(flask_app)

    @flask_app.route('/api/tasks', methods=['GET'])
    def get_tasks():
        """Get all tasks organized by columns"""
        return jsonify(db.serialize())

    @flask_app.route('/api/tasks', methods=['POST'])
    def create_task():
        """Create a new task"""
        data = request.get_json()
        task_id = str(uuid.uuid4())
        new_task = Task(task_id, data.get("title", ""), data.get("description", ""))
        db.add(new_task, data.get("column_id", "ideas"))
        return jsonify(new_task.to_dict()), 201

    @flask_app.route('/api/tasks/<task_id>', methods=['PUT'])
    def update_task(task_id):
        """Update an existing task"""
        try:
            data = request.get_json()
            db.update_task(task_id, title=data.get("title", ""), description=data.get("description", ""))
            task = db.get(task_id)
            return jsonify(task.to_dict())
        except KeyError:
            return jsonify({"error": f"Task {task_id} not found"}), 404

    @flask_app.route('/api/tasks/<task_id>/move', methods=['POST'])
    def move_task(task_id):
        """Move a task to a new column and position"""
        try:
            data = request.get_json()
            db.move(task_id, data.get("new_column_id"), data.get("new_index", 0))
            task = db.get(task_id)
            return jsonify(task.to_dict())
        except KeyError:
            return jsonify({"error": f"Task {task_id} not found"}), 404

    @flask_app.route('/api/tasks/<task_id>', methods=['DELETE'])
    def delete_task(task_id):
        """Delete a task"""
        try:
            db.delete(task_id)
            return '', 204
        except KeyError:
            return jsonify({"error": f"Task {task_id} not found"}), 404

    @flask_app.route('/api/columns/<column_id>/empty', methods=['DELETE'])
    def empty_column(column_id):
        """Empty all tasks in a column"""
        db.empty_column(column_id)
        return '', 204

    if __name__ == '__main__':
        print("Starting Flask server on http://localhost:8000")
        flask_app.run(host='0.0.0.0', port=8000, debug=True)
