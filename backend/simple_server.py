#!/usr/bin/env python3
"""
Simple Flask server to test the API endpoints
"""
import json
import uuid
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Simple in-memory database
tasks_db = {}
columns = {
    "ideas": [],
    "selected": [],
    "in_progress": [],
    "parked": [],
    "done": []
}

# Initialize with some sample data
def init_sample_data():
    # Ideas column
    task1 = {
        "id": str(uuid.uuid4()),
        "title": "Ask Claude AI to make Half-Life 3 as an easter egg in the app",
        "description": ""
    }
    task2 = {
        "id": str(uuid.uuid4()),
        "title": "Make the app web-scale",
        "description": ""
    }
    task3 = {
        "id": str(uuid.uuid4()),
        "title": "Implement User accounts and Auth/Autz",
        "description": ""
    }
    
    tasks_db[task1["id"]] = task1
    tasks_db[task2["id"]] = task2
    tasks_db[task3["id"]] = task3
    columns["ideas"] = [task1, task2, task3]
    
    # Selected column
    task4 = {
        "id": str(uuid.uuid4()),
        "title": "Re-design the API endpoints",
        "description": ""
    }
    task5 = {
        "id": str(uuid.uuid4()),
        "title": "Holistically administrate exceptional synergies",
        "description": ""
    }
    
    tasks_db[task4["id"]] = task4
    tasks_db[task5["id"]] = task5
    columns["selected"] = [task4, task5]

init_sample_data()

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    """Returns all tasks organized by columns"""
    return jsonify(columns)

@app.route('/api/tasks', methods=['POST'])
def create_task():
    """Create new task and return it as JSON"""
    data = request.get_json()
    
    task_id = str(uuid.uuid4())
    new_task = {
        "id": task_id,
        "title": data.get("title", ""),
        "description": data.get("description", "")
    }
    
    column_id = data.get("column_id", "ideas")
    
    # Add to database
    tasks_db[task_id] = new_task
    
    # Add to column
    if column_id not in columns:
        columns[column_id] = []
    columns[column_id].append(new_task)
    
    return jsonify(new_task), 201

@app.route('/api/tasks/<task_id>', methods=['PUT'])
def update_task(task_id):
    """Updates an existing task by its ID"""
    if task_id not in tasks_db:
        return jsonify({"error": f"Task with ID '{task_id}' not found"}), 404
    
    data = request.get_json()
    task = tasks_db[task_id]
    
    # Update task fields
    if "title" in data:
        task["title"] = data["title"]
    if "description" in data:
        task["description"] = data["description"]
    
    # Update in all columns
    for column_tasks in columns.values():
        for i, column_task in enumerate(column_tasks):
            if column_task["id"] == task_id:
                column_tasks[i] = task
                break
    
    return jsonify(task)

@app.route('/api/tasks/<task_id>/move', methods=['POST'])
def move_task(task_id):
    """Moves a task to a new column and updates its order"""
    if task_id not in tasks_db:
        return jsonify({"error": f"Task with ID '{task_id}' not found"}), 404
    
    data = request.get_json()
    new_column_id = data.get("new_column_id")
    new_index = data.get("new_index", 0)
    
    task = tasks_db[task_id]
    
    # Remove from current column
    for column_tasks in columns.values():
        for i, column_task in enumerate(column_tasks):
            if column_task["id"] == task_id:
                column_tasks.pop(i)
                break
    
    # Add to new column at specified index
    if new_column_id not in columns:
        columns[new_column_id] = []
    columns[new_column_id].insert(new_index, task)
    
    return jsonify(task)

@app.route('/api/tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    """Deletes a task by its ID"""
    if task_id not in tasks_db:
        return jsonify({"error": f"Task with ID '{task_id}' not found"}), 404
    
    # Remove from database
    del tasks_db[task_id]
    
    # Remove from columns
    for column_tasks in columns.values():
        for i, column_task in enumerate(column_tasks):
            if column_task["id"] == task_id:
                column_tasks.pop(i)
                break
    
    return '', 204

@app.route('/api/columns/<column_id>/empty', methods=['DELETE'])
def empty_column(column_id):
    """Empties all tasks in a column"""
    if column_id in columns:
        # Remove all tasks from database
        for task in columns[column_id]:
            if task["id"] in tasks_db:
                del tasks_db[task["id"]]
        # Clear the column
        columns[column_id] = []
    
    return '', 204

if __name__ == '__main__':
    print("Starting simple Flask server on http://localhost:8000")
    app.run(host='0.0.0.0', port=8000, debug=True)
