#!/usr/bin/env python3
"""
Simple HTTP server to mock the API endpoints for testing
"""
import json
import uuid
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import threading

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

class APIHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        """Handle GET requests"""
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/tasks':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(columns).encode())
        else:
            self.send_response(404)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b'Not Found')

    def do_POST(self):
        """Handle POST requests"""
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/tasks':
            # Create new task
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
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
            
            self.send_response(201)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(new_task).encode())
        else:
            self.send_response(404)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b'Not Found')

    def do_PUT(self):
        """Handle PUT requests"""
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps({"message": "PUT not implemented yet"}).encode())

    def do_DELETE(self):
        """Handle DELETE requests"""
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

    def log_message(self, format, *args):
        """Override to reduce logging noise"""
        print(f"{self.address_string()} - {format % args}")

def run_server():
    server_address = ('', 8000)
    httpd = HTTPServer(server_address, APIHandler)
    print(f"Mock API server running on http://localhost:8000")
    print("Available endpoints:")
    print("  GET  /api/tasks")
    print("  POST /api/tasks")
    httpd.serve_forever()

if __name__ == '__main__':
    run_server()
