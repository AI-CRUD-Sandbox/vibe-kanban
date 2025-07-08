#!/usr/bin/env python3
"""
Modern FastAPI backend for Vibe Kanban - Python 3.13 compatible
Includes all required endpoints with proper error handling
"""
import json
import uuid
import os
import threading
from datetime import datetime
from time import sleep
from typing import Dict, List, Optional
from dataclasses import dataclass, field

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Pydantic models for request/response validation
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

class TaskResponse(BaseModel):
    id: str
    title: str
    description: str

# Data models
@dataclass
class Task:
    id: str
    title: str
    description: str = ""
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description
        }

# Database class with thread safety and project support
@dataclass
class Database:
    _tasks_db: Dict[str, Task] = field(default_factory=dict)
    _columns: Dict[str, List[Task]] = field(default_factory=dict)
    _has_changes: bool = False
    _backup_file: str = "database.json"
    _project_id: str = "default"
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

        # Set project-specific backup file
        self._backup_file = f"database_{self._project_id}.json"

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
                
                # Initialize columns first
                self._columns = {
                    "ideas": [],
                    "selected": [],
                    "in_progress": [],
                    "parked": [],
                    "done": []
                }
                
                # Restore tasks
                for task_id, task_data in data.get("tasks", {}).items():
                    task = Task(task_data["id"], task_data["title"], task_data.get("description", ""))
                    self._tasks_db[task_id] = task
                
                # Restore columns
                for column_id, task_ids in data.get("columns", {}).items():
                    if column_id in self._columns:  # Only restore known columns
                        for task_id in task_ids:
                            if task_id in self._tasks_db:
                                self._columns[column_id].append(self._tasks_db[task_id])
                
                print(f"Database loaded from {self._backup_file}")
                return True
            except Exception as e:
                print(f"Failed to load database: {e}")
                return False

# Project-aware database manager
class DatabaseManager:
    def __init__(self):
        self._databases: Dict[str, Database] = {}
        self._lock = threading.RLock()

    def get_database(self, project_id: str = "default") -> Database:
        with self._lock:
            if project_id not in self._databases:
                db = Database()
                db._project_id = project_id
                db._backup_file = f"database_{project_id}.json"
                db.__post_init__()  # Re-initialize with project-specific settings
                self._databases[project_id] = db
            return self._databases[project_id]

    def remove_database(self, project_id: str):
        with self._lock:
            if project_id in self._databases:
                del self._databases[project_id]

# Initialize database manager
db_manager = DatabaseManager()

# Get default database for backward compatibility
db = db_manager.get_database("default")

def periodic_backup():
    while True:
        try:
            # Backup all active databases
            for project_id, database in db_manager._databases.items():
                database.save_to_file()
        except Exception as e:
            print(f"Periodic backup failed: {e}")
        sleep(60)

backup_thread = threading.Thread(target=periodic_backup, daemon=True)
backup_thread.start()

# FastAPI app setup
app = FastAPI(title="Vibe Kanban API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Endpoints
@app.get("/api/tasks")
async def get_tasks(project_id: str = "default"):
    """Get all tasks organized by columns for a specific project"""
    try:
        project_db = db_manager.get_database(project_id)
        return JSONResponse(content=project_db.serialize())
    except Exception as e:
        print(f"Error getting tasks for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/tasks", status_code=201, response_model=TaskResponse)
async def create_task(task_data: TaskCreate, project_id: str = "default"):
    """Create a new task in a specific project"""
    try:
        project_db = db_manager.get_database(project_id)
        task_id = str(uuid.uuid4())
        new_task = Task(task_id, task_data.title, task_data.description or "")
        project_db.add(new_task, task_data.column_id)
        return JSONResponse(content=new_task.to_dict(), status_code=201)
    except Exception as e:
        print(f"Error creating task in project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to create task")

@app.put("/api/tasks/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, task_data: TaskUpdate, project_id: str = "default"):
    """Update an existing task in a specific project"""
    try:
        project_db = db_manager.get_database(project_id)
        project_db.update_task(task_id, title=task_data.title, description=task_data.description or "")
        task = project_db.get(task_id)
        return JSONResponse(content=task.to_dict())
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found in project {project_id}")
    except Exception as e:
        print(f"Error updating task {task_id} in project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update task")

@app.post("/api/tasks/{task_id}/move", response_model=TaskResponse)
async def move_task(task_id: str, move_data: TaskMove, project_id: str = "default"):
    """Move a task to a new column and position in a specific project"""
    try:
        project_db = db_manager.get_database(project_id)
        project_db.move(task_id, move_data.new_column_id, move_data.new_index)
        task = project_db.get(task_id)
        print(f"Successfully moved task {task_id} to {move_data.new_column_id} at index {move_data.new_index} in project {project_id}")
        return JSONResponse(content=task.to_dict())
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found in project {project_id}")
    except Exception as e:
        print(f"Error moving task {task_id} in project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to move task")

@app.delete("/api/tasks/{task_id}", status_code=204)
async def delete_task(task_id: str, project_id: str = "default"):
    """Delete a task from a specific project"""
    try:
        project_db = db_manager.get_database(project_id)
        project_db.delete(task_id)
        return JSONResponse(content=None, status_code=204)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found in project {project_id}")
    except Exception as e:
        print(f"Error deleting task {task_id} in project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete task")

@app.delete("/api/columns/{column_id}/empty", status_code=204)
async def empty_column(column_id: str, project_id: str = "default"):
    """Empty all tasks in a column for a specific project"""
    try:
        project_db = db_manager.get_database(project_id)
        project_db.empty_column(column_id)
        print(f"Successfully emptied column {column_id} in project {project_id}")
        return JSONResponse(content=None, status_code=204)
    except Exception as e:
        print(f"Error emptying column {column_id} in project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to empty column")

# Settings endpoints
@app.get("/api/settings")
async def get_settings():
    """Get application settings"""
    settings_file = "settings.json"
    try:
        if os.path.exists(settings_file):
            with open(settings_file, 'r') as f:
                settings = json.load(f)
            return JSONResponse(content=settings)
        else:
            # Return empty settings if file doesn't exist
            return JSONResponse(content={})
    except Exception as e:
        print(f"Error loading settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to load settings")

@app.post("/api/settings")
async def save_settings(settings: dict):
    """Save application settings"""
    settings_file = "settings.json"
    try:
        with open(settings_file, 'w') as f:
            json.dump(settings, f, indent=2)
        print(f"Settings saved to {settings_file}")
        return JSONResponse(content={"status": "success"})
    except Exception as e:
        print(f"Error saving settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to save settings")

# AI Session endpoints
@app.get("/api/ai/sessions")
async def get_ai_sessions(projectId: str = "default"):
    """Get all AI sessions for a project"""
    sessions_file = f"ai_sessions_{projectId}.json"
    try:
        if os.path.exists(sessions_file):
            with open(sessions_file, 'r') as f:
                sessions = json.load(f)
            return JSONResponse(content=sessions)
        else:
            return JSONResponse(content=[])
    except Exception as e:
        print(f"Error loading AI sessions: {e}")
        raise HTTPException(status_code=500, detail="Failed to load AI sessions")

@app.post("/api/ai/sessions")
async def create_ai_session(session: dict):
    """Create a new AI session"""
    try:
        project_id = session.get("projectId", "default")
        sessions_file = f"ai_sessions_{project_id}.json"

        # Load existing sessions
        sessions = []
        if os.path.exists(sessions_file):
            with open(sessions_file, 'r') as f:
                sessions = json.load(f)

        # Add new session
        sessions.append(session)

        # Save sessions
        with open(sessions_file, 'w') as f:
            json.dump(sessions, f, indent=2, default=str)

        print(f"AI session created: {session.get('id')}")
        return JSONResponse(content=session, status_code=201)
    except Exception as e:
        print(f"Error creating AI session: {e}")
        raise HTTPException(status_code=500, detail="Failed to create AI session")

@app.put("/api/ai/sessions/{session_id}")
async def update_ai_session(session_id: str, updates: dict):
    """Update an AI session"""
    try:
        project_id = updates.get("projectId", "default")
        sessions_file = f"ai_sessions_{project_id}.json"

        if not os.path.exists(sessions_file):
            raise HTTPException(status_code=404, detail="Sessions file not found")

        # Load sessions
        with open(sessions_file, 'r') as f:
            sessions = json.load(f)

        # Find and update session
        session_index = next((i for i, s in enumerate(sessions) if s.get("id") == session_id), None)
        if session_index is None:
            raise HTTPException(status_code=404, detail="Session not found")

        sessions[session_index].update(updates)

        # Save sessions
        with open(sessions_file, 'w') as f:
            json.dump(sessions, f, indent=2, default=str)

        return JSONResponse(content=sessions[session_index])
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating AI session: {e}")
        raise HTTPException(status_code=500, detail="Failed to update AI session")

@app.delete("/api/ai/sessions/{session_id}")
async def delete_ai_session(session_id: str, projectId: str = "default"):
    """Delete an AI session"""
    try:
        sessions_file = f"ai_sessions_{projectId}.json"

        if not os.path.exists(sessions_file):
            return JSONResponse(content={"status": "success"}, status_code=204)

        # Load sessions
        with open(sessions_file, 'r') as f:
            sessions = json.load(f)

        # Filter out the session to delete
        sessions = [s for s in sessions if s.get("id") != session_id]

        # Save sessions
        with open(sessions_file, 'w') as f:
            json.dump(sessions, f, indent=2, default=str)

        print(f"AI session deleted: {session_id}")
        return JSONResponse(content={"status": "success"}, status_code=204)
    except Exception as e:
        print(f"Error deleting AI session: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete AI session")

# AI Proxy endpoints (for secure API key handling)
@app.post("/api/ai/chat")
async def ai_chat_proxy(request: dict):
    """Proxy AI chat requests to avoid exposing API keys in frontend"""
    try:
        service = request.get("service", "openAI")
        message = request.get("message", "")

        if not message:
            raise HTTPException(status_code=400, detail="Message is required")

        # Load settings to get API keys
        settings_file = "settings.json"
        if not os.path.exists(settings_file):
            raise HTTPException(status_code=500, detail="AI services not configured")

        with open(settings_file, 'r') as f:
            settings = json.load(f)

        ai_services = settings.get("aiServices", {})
        service_config = ai_services.get(service, {})

        if not service_config.get("enabled") or not service_config.get("apiKey"):
            raise HTTPException(status_code=400, detail=f"{service} is not configured or enabled")

        # This is a simplified proxy - in production, you'd implement actual AI service calls
        # For now, return a mock response
        mock_response = {
            "id": f"ai_response_{int(datetime.now().timestamp())}",
            "content": f"This is a mock response from {service} for: {message}",
            "model": service_config.get("name", service),
            "usage": {
                "promptTokens": len(message.split()),
                "completionTokens": 20,
                "totalTokens": len(message.split()) + 20,
            },
            "metadata": {
                "processingTime": 1000,
                "cost": 0.001,
                "service": service,
            }
        }

        return JSONResponse(content=mock_response)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in AI chat proxy: {e}")
        raise HTTPException(status_code=500, detail="AI chat request failed")

# Project Management endpoints
@app.get("/api/projects")
async def get_projects():
    """Get all projects"""
    projects_file = "projects.json"
    try:
        if os.path.exists(projects_file):
            with open(projects_file, 'r') as f:
                projects = json.load(f)
            return JSONResponse(content=projects)
        else:
            # Create default project if none exist
            default_project = {
                "id": "default",
                "name": "My Kanban Board",
                "description": "Default project for task management",
                "color": "#3B82F6",
                "icon": "📋",
                "createdAt": datetime.now().isoformat(),
                "updatedAt": datetime.now().isoformat(),
                "isActive": True,
                "metadata": {
                    "taskCount": 0,
                    "completedTasks": 0,
                    "lastActivity": datetime.now().isoformat(),
                    "tags": []
                },
                "settings": {
                    "columns": [
                        {"id": "ideas", "name": "Ideas", "color": "blue", "isVisible": True},
                        {"id": "selected", "name": "Selected", "color": "yellow", "isVisible": True},
                        {"id": "in_progress", "name": "In Progress", "color": "orange", "limit": 3, "isVisible": True},
                        {"id": "parked", "name": "Parked", "color": "gray", "isVisible": True},
                        {"id": "done", "name": "Done", "color": "green", "isVisible": True}
                    ],
                    "aiSettings": {
                        "enabled": True,
                        "defaultService": "openAI",
                        "autoSuggestTasks": True,
                        "contextPrompt": "You are helping with project management tasks."
                    },
                    "workflow": {
                        "autoArchiveCompleted": False,
                        "autoArchiveDays": 30,
                        "requireTaskDescription": False,
                        "enableTimeTracking": False
                    },
                    "notifications": {
                        "enabled": True,
                        "dailyDigest": False,
                        "taskReminders": True,
                        "aiSuggestions": True
                    },
                    "integrations": {}
                }
            }

            with open(projects_file, 'w') as f:
                json.dump([default_project], f, indent=2)

            return JSONResponse(content=[default_project])
    except Exception as e:
        print(f"Error loading projects: {e}")
        raise HTTPException(status_code=500, detail="Failed to load projects")

@app.post("/api/projects")
async def create_project(project: dict):
    """Create a new project"""
    try:
        projects_file = "projects.json"

        # Load existing projects
        projects = []
        if os.path.exists(projects_file):
            with open(projects_file, 'r') as f:
                projects = json.load(f)

        # Add timestamps
        project["createdAt"] = datetime.now().isoformat()
        project["updatedAt"] = datetime.now().isoformat()

        # Add new project
        projects.append(project)

        # Save projects
        with open(projects_file, 'w') as f:
            json.dump(projects, f, indent=2)

        print(f"Project created: {project.get('name')}")
        return JSONResponse(content=project, status_code=201)
    except Exception as e:
        print(f"Error creating project: {e}")
        raise HTTPException(status_code=500, detail="Failed to create project")

@app.put("/api/projects/{project_id}")
async def update_project(project_id: str, updates: dict):
    """Update a project"""
    try:
        projects_file = "projects.json"

        if not os.path.exists(projects_file):
            raise HTTPException(status_code=404, detail="Projects file not found")

        # Load projects
        with open(projects_file, 'r') as f:
            projects = json.load(f)

        # Find and update project
        project_index = next((i for i, p in enumerate(projects) if p.get("id") == project_id), None)
        if project_index is None:
            raise HTTPException(status_code=404, detail="Project not found")

        # Update project
        projects[project_index].update(updates)
        projects[project_index]["updatedAt"] = datetime.now().isoformat()

        # Save projects
        with open(projects_file, 'w') as f:
            json.dump(projects, f, indent=2)

        return JSONResponse(content=projects[project_index])
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating project: {e}")
        raise HTTPException(status_code=500, detail="Failed to update project")

@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: str):
    """Delete a project and all its data"""
    try:
        projects_file = "projects.json"

        if not os.path.exists(projects_file):
            return JSONResponse(content={"status": "success"}, status_code=204)

        # Load projects
        with open(projects_file, 'r') as f:
            projects = json.load(f)

        # Filter out the project to delete
        projects = [p for p in projects if p.get("id") != project_id]

        # Save projects
        with open(projects_file, 'w') as f:
            json.dump(projects, f, indent=2)

        # Delete project-specific data files
        project_files = [
            f"database_{project_id}.json",
            f"ai_sessions_{project_id}.json",
            f"settings_{project_id}.json"
        ]

        for file_path in project_files:
            if os.path.exists(file_path):
                os.remove(file_path)
                print(f"Deleted project file: {file_path}")

        print(f"Project deleted: {project_id}")
        return JSONResponse(content={"status": "success"}, status_code=204)
    except Exception as e:
        print(f"Error deleting project: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete project")

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    import uvicorn
    print("Starting Vibe Kanban API server...")
    print("Available endpoints:")
    print("  Projects:")
    print("    GET    /api/projects")
    print("    POST   /api/projects")
    print("    PUT    /api/projects/{project_id}")
    print("    DELETE /api/projects/{project_id}")
    print("  Tasks (project-aware):")
    print("    GET    /api/tasks?project_id={project_id}")
    print("    POST   /api/tasks?project_id={project_id}")
    print("    PUT    /api/tasks/{task_id}?project_id={project_id}")
    print("    POST   /api/tasks/{task_id}/move?project_id={project_id}")
    print("    DELETE /api/tasks/{task_id}?project_id={project_id}")
    print("    DELETE /api/columns/{column_id}/empty?project_id={project_id}")
    print("  Settings:")
    print("    GET    /api/settings")
    print("    POST   /api/settings")
    print("  AI Integration:")
    print("    GET    /api/ai/sessions?projectId={project_id}")
    print("    POST   /api/ai/sessions")
    print("    PUT    /api/ai/sessions/{session_id}")
    print("    DELETE /api/ai/sessions/{session_id}")
    print("    POST   /api/ai/chat")
    print("  Health:")
    print("    GET    /health")
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
