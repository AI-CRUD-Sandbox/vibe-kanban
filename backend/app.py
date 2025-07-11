# Python 3.7 compatible FastAPI backend
try:
    from fastapi import FastAPI, Body, Path, HTTPException, Request
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse, JSONResponse
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    FASTAPI_AVAILABLE = True
except ImportError:
    print("FastAPI not available, falling back to Flask")
    FASTAPI_AVAILABLE = False

from typing import List, Optional, Dict
import uuid
from copy import deepcopy
import json
import os
from datetime import datetime
import threading
from time import sleep
from dataclasses import dataclass

if FASTAPI_AVAILABLE:
    app = FastAPI()

    # CORS middleware for development
    no_cors = os.getenv("DEV_NO_CORS")
    if no_cors:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

# Static file serving for React frontend
frontend_path = os.getenv("STATIC_DIR")


# Pydantic models for request bodies and responses (Python 3.7 compatible)
if FASTAPI_AVAILABLE:
    class TaskCreate(BaseModel):
        title: str
        description: Optional[str] = None
        column_id: str

    class TaskUpdate(BaseModel):
        title: str
        description: Optional[str] = None

    class TaskMove(BaseModel):
        new_column_id: str
        new_index: int

    class Task(BaseModel):  # Model for task representation, e.g., for GET response
        id: str
        title: str
        description: Optional[str] = None
else:
    # Simple dataclass for Flask fallback
    from dataclasses import dataclass

    @dataclass
    class Task:
        id: str
        title: str
        description: Optional[str] = None

        def model_dump(self):
            return {
                "id": self.id,
                "title": self.title,
                "description": self.description
            }


# Database with automatic backup functionality
if not FASTAPI_AVAILABLE:
    from dataclasses import dataclass

@dataclass
class Database:
    _tasks_db: Dict[str, Task] = None
    _columns: Dict[str, List[Task]] = None
    _has_changes: bool = False
    _backup_file: str = None
    _lock: threading.RLock = None

    def add(self, t: Task, column_id: str):
        with self._lock:
            self._tasks_db[t.id] = t
            if column_id not in self._columns:
                self._columns[column_id] = []
            self._columns[column_id].append(t)
            self._mark_changed()

    def get(self, id: str):
        with self._lock:
            return self._tasks_db[id]

    def move(self, id: str, to_column_id: str, to_index: int):
        with self._lock:
            task = self._tasks_db[id]  # Get task directly to avoid nested locking
            for task_list in self._columns.values():
                if task in task_list:
                    task_list.remove(task)
                    break
            if to_column_id not in self._columns:
                self._columns[to_column_id] = []
            self._columns[to_column_id].insert(to_index, task)
            self._mark_changed()

    def serialize(self):
        with self._lock:
            return deepcopy(self._columns)

    def delete(self, task_id: str):
        with self._lock:
            task = self._tasks_db[task_id]  # Will raise KeyError if not found
            del self._tasks_db[task_id]

            for task_list in self._columns.values():
                if task in task_list:
                    task_list.remove(task)
                    break
            self._mark_changed()

    def empty_column(self, column_id: str):
        with self._lock:
            if column_id in self._columns:
                # Delete all tasks in the column from the tasks database
                for task in self._columns[column_id]:
                    del self._tasks_db[task.id]
                # Clear the column
                self._columns[column_id] = []
                self._mark_changed()

    def update_task(self, task_id: str, **kwargs):
        with self._lock:
            task = self._tasks_db[task_id]  # Get task directly to avoid nested locking
            for key, value in kwargs.items():
                setattr(task, key, value)
            self._mark_changed()

    def _mark_changed(self):
        self._has_changes = True

    def export_to_json(self) -> dict:
        """Export database state to JSON-serializable format"""
        with self._lock:
            data = {
                "tasks": {
                    task_id: task.model_dump()
                    for task_id, task in self._tasks_db.items()
                },
                "columns": {},
            }
            for column_id, tasks in self._columns.items():
                data["columns"][column_id] = [task.id for task in tasks]
            return data

    def import_from_json(self, data: dict):
        """Import database state from JSON format"""
        with self._lock:
            self._tasks_db.clear()
            self._columns.clear()

            # Restore tasks
            for task_id, task_data in data.get("tasks", {}).items():
                task = Task(**task_data)
                self._tasks_db[task_id] = task

            # Restore column organization
            for column_id, task_ids in data.get("columns", {}).items():
                self._columns[column_id] = []
                for task_id in task_ids:
                    if task_id in self._tasks_db:
                        self._columns[column_id].append(self._tasks_db[task_id])

    def save_to_file(self):
        """Save database to JSON file if changes have been made"""
        with self._lock:
            if not self._has_changes:
                return False

            try:
                # Export data directly within the lock to avoid nested locking
                data = {
                    "tasks": {
                        task_id: task.model_dump()
                        for task_id, task in self._tasks_db.items()
                    },
                    "columns": {},
                }
                for column_id, tasks in self._columns.items():
                    data["columns"][column_id] = [task.id for task in tasks]

                data["backup_timestamp"] = datetime.now().isoformat()

                with open(self._backup_file, "w") as f:
                    json.dump(data, f, indent=2)

                self._has_changes = False
                print(f"Database backed up to {self._backup_file}")
                return True
            except Exception as e:
                print(f"Failed to save database: {e}")
                return False

    def load_from_file(self):
        """Load database from JSON file if it exists"""
        with self._lock:
            if not os.path.exists(self._backup_file):
                print(
                    f"No backup file found at {self._backup_file}, using default data"
                )
                return False

            try:
                with open(self._backup_file, "r") as f:
                    data = json.load(f)

                # Import data directly within the lock to avoid nested locking
                self._tasks_db.clear()
                self._columns.clear()

                # Restore tasks
                for task_id, task_data in data.get("tasks", {}).items():
                    task = Task(**task_data)
                    self._tasks_db[task_id] = task

                # Restore column organization
                for column_id, task_ids in data.get("columns", {}).items():
                    self._columns[column_id] = []
                    for task_id in task_ids:
                        if task_id in self._tasks_db:
                            self._columns[column_id].append(self._tasks_db[task_id])

                backup_time = data.get("backup_timestamp", "unknown")
                print(
                    f"Database restored from {self._backup_file} (backup from {backup_time})"
                )
                self._has_changes = False
                return True
            except Exception as e:
                print(f"Failed to load database: {e}")
                return False

    def __init__(self, backup_file: str = "database.json"):
        self._tasks_db = {}
        self._columns = {}
        self._has_changes = False
        self._backup_file = backup_file
        self._lock = threading.RLock()

        # Try to load from backup file first
        if not self.load_from_file():
            # If no backup exists, create default data
            # Ideas column
            self.add(
                Task(
                    id=str(uuid.uuid4()),
                    title="Ask Claude AI to make Half-Life 3 as an easter egg in the app",
                    description="",
                ),
                "ideas",
            )
            self.add(
                Task(
                    id=str(uuid.uuid4()), title="Make the app web-scale", description=""
                ),
                "ideas",
            )
            self.add(
                Task(
                    id=str(uuid.uuid4()),
                    title="Implement User accounts and Auth/Autz",
                    description="",
                ),
                "ideas",
            )

            # Selected column
            self.add(
                Task(
                    id=str(uuid.uuid4()),
                    title="Re-design the API endpoints",
                    description="",
                ),
                "selected",
            )
            self.add(
                Task(
                    id=str(uuid.uuid4()),
                    title="Holistically administrate exceptional synergies",
                    description="",
                ),
                "selected",
            )

            # In Progress column
            self.add(
                Task(
                    id=str(uuid.uuid4()),
                    title="Update the README with a screenshot",
                    description="",
                ),
                "in_progress",
            )

            # Parked column
            self.add(
                Task(id=str(uuid.uuid4()), title="Take over the world", description=""),
                "parked",
            )
            self.add(
                Task(id=str(uuid.uuid4()), title="Review the code", description=""),
                "parked",
            )

            # Done column
            self.add(
                Task(
                    id=str(uuid.uuid4()), title="Add data persistence", description=""
                ),
                "done",
            )
            self.add(
                Task(
                    id=str(uuid.uuid4()),
                    title="Write Infrastructure scaffolding for deployment",
                    description="",
                ),
                "done",
            )

            self._has_changes = True


# Initialize database with persistent storage
data_dir = os.getenv("DATA_DIR", "")  # Default to current directory for development
backup_file_path = os.path.join(data_dir, "database.json")

db = Database(backup_file=backup_file_path)


# Periodic backup system
def periodic_backup():
    """Function to run periodic backups every minute"""
    while True:
        try:
            db.save_to_file()
        except Exception as e:
            print(f"Periodic backup failed: {e}")
        sleep(60)  # Wait for 60 seconds


# Start the backup thread
backup_thread = threading.Thread(target=periodic_backup, daemon=True)
backup_thread.start()

# --- Endpoints Implementation ---

@app.get("/api/tasks")
async def get_tasks():
    """Returns all tasks organized by columns"""
    columns_data = db.serialize()
    # Convert Task objects to dictionaries for JSON serialization
    serialized_columns = {}
    for column_id, tasks in columns_data.items():
        serialized_columns[column_id] = [task.model_dump() for task in tasks]

    return JSONResponse(
        content=serialized_columns,
        media_type="application/json"
    )

    @app.post("/api/tasks", status_code=201)
    async def create_task(task_data: TaskCreate):
        """Create new task and return it as JSON"""
        task_id = str(uuid.uuid4())
        new_task = Task(
            id=task_id,
            title=task_data.title,
            description=task_data.description
        )
        db.add(new_task, task_data.column_id)
        return JSONResponse(
            content=new_task.model_dump(),
            media_type="application/json",
            status_code=201
        )

    # Add CORS middleware always for development
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )



@app.put("/api/tasks/{task_id}", response_model=Task)
async def update_task(
    task_id: str = Path(..., description="The ID of the task to update"),
    task_data: TaskUpdate = Body(..., description="The updated task details"),
):
    """
    Updates an existing task by its ID.
    """
    try:
        task = db.get(task_id)
    except KeyError:
        raise HTTPException(
            status_code=404, detail=f"Task with ID '{task_id}' not found"
        )

    # Update only the fields that are provided in the request body
    update_data = task_data.model_dump(exclude_unset=True)
    db.update_task(task_id, **update_data)

    return task


@app.post("/api/tasks/{task_id}/move", response_model=Task)
async def move_task(
    task_id: str = Path(..., description="The ID of the task being moved"),
    move_data: TaskMove = Body(..., description="The new column ID and index"),
):
    """
    Moves a task to a new column and updates its order.
    """
    try:
        task = db.get(task_id)
    except KeyError:
        raise HTTPException(
            status_code=404, detail=f"Task with ID '{task_id}' not found"
        )

    print("Moving task", task_id)
    db.move(task_id, move_data.new_column_id, move_data.new_index)

    return task


# 5. DELETE /api/tasks/{taskId}
@app.delete(
    "/api/tasks/{taskId}", status_code=204
)  # 204 No Content for successful deletion
async def delete_task(
    taskId: str = Path(..., description="The ID of the task to delete")
):
    """
    Deletes a task by its ID.
    """
    try:
        db.delete(taskId)
    except KeyError:
        raise HTTPException(
            status_code=404, detail=f"Task with ID '{taskId}' not found"
        )

    return None


@app.delete("/api/columns/{column_id}/empty", status_code=204)
async def empty_column(
    column_id: str = Path(..., description="The ID of the column to empty")
):
    """
    Empties all tasks in a column.
    """
    db.empty_column(column_id)
    return None


# Only enable static file serving if STATIC_DIR is configured
if FASTAPI_AVAILABLE and frontend_path:

    @app.get("/")
    async def serve_root():
        """Serve the React app at the root URL."""
        index_path = os.path.join(frontend_path, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        else:
            raise HTTPException(status_code=404, detail="Frontend not found")

    app.mount(
        "/assets",
        StaticFiles(directory=os.path.join(frontend_path, "assets")),
        name="assets",
    )

    # FastAPI server startup
    if __name__ == '__main__':
        import uvicorn
        print("Starting FastAPI server on http://localhost:8000")
        uvicorn.run(app, host="0.0.0.0", port=8000)

# Flask fallback for Python 3.7 compatibility
if not FASTAPI_AVAILABLE:
    try:
        from flask import Flask, jsonify, request
        from flask_cors import CORS

        flask_app = Flask(__name__)
        CORS(flask_app)  # Enable CORS for all routes

        @flask_app.route('/api/tasks', methods=['GET'])
        def get_tasks_flask():
            """Returns all tasks organized by columns"""
            columns_data = db.serialize()
            # Convert Task objects to dictionaries for JSON serialization
            serialized_columns = {}
            for column_id, tasks in columns_data.items():
                serialized_columns[column_id] = [task.model_dump() for task in tasks]
            return jsonify(serialized_columns)

        @flask_app.route('/api/tasks', methods=['POST'])
        def create_task_flask():
            """Create new task and return it as JSON"""
            data = request.get_json()

            task_id = str(uuid.uuid4())
            new_task = Task(
                id=task_id,
                title=data.get("title", ""),
                description=data.get("description", "")
            )
            db.add(new_task, data.get("column_id", "ideas"))
            return jsonify(new_task.model_dump()), 201

        @flask_app.route('/api/tasks/<task_id>', methods=['PUT'])
        def update_task_flask(task_id):
            """Updates an existing task by its ID"""
            try:
                task = db.get(task_id)
            except KeyError:
                return jsonify({"error": f"Task with ID '{task_id}' not found"}), 404

            data = request.get_json()
            update_data = {k: v for k, v in data.items() if v is not None}
            db.update_task(task_id, **update_data)
            return jsonify(task.model_dump())

        @flask_app.route('/api/tasks/<task_id>/move', methods=['POST'])
        def move_task_flask(task_id):
            """Moves a task to a new column and updates its order"""
            try:
                task = db.get(task_id)
            except KeyError:
                return jsonify({"error": f"Task with ID '{task_id}' not found"}), 404

            data = request.get_json()
            db.move(task_id, data.get("new_column_id"), data.get("new_index", 0))
            return jsonify(task.model_dump())

        @flask_app.route('/api/tasks/<task_id>', methods=['DELETE'])
        def delete_task_flask(task_id):
            """Deletes a task by its ID"""
            try:
                db.delete(task_id)
            except KeyError:
                return jsonify({"error": f"Task with ID '{task_id}' not found"}), 404
            return '', 204

        @flask_app.route('/api/columns/<column_id>/empty', methods=['DELETE'])
        def empty_column_flask(column_id):
            """Empties all tasks in a column"""
            db.empty_column(column_id)
            return '', 204

        if __name__ == '__main__':
            print("Starting Flask server on http://localhost:8000")
            flask_app.run(host='0.0.0.0', port=8000, debug=True)

    except ImportError:
        print("Neither FastAPI nor Flask available. Please install one of them.")
        print("For Python 3.7: pip install flask flask-cors")
        print("For Python 3.8+: pip install fastapi uvicorn")
