"""
ATOffice Backend - Main Async Server
Art Transcendence AI Office System
"""
import asyncio
import json
import sqlite3
import os
import time
import logging
from datetime import datetime, date
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
import uvicorn

from agent import AgentOrchestrator
from terminal import get_all_workspace_files, get_file_content, clear_all_workspace, WORKSPACE_ROOT
from workspace_manager import get_workspace_manager
from tasks import TaskManager
from db import init_db, get_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ATOffice")

# WebSocket connections manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        dead = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                dead.append(connection)
        for c in dead:
            self.active_connections.remove(c)

manager = ConnectionManager()
orchestrator: AgentOrchestrator = None
task_manager: TaskManager = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global orchestrator, task_manager
    init_db()
    task_manager = TaskManager()
    orchestrator = AgentOrchestrator(task_manager, manager)
    await orchestrator.initialize()
    asyncio.create_task(orchestrator.run_office_loop())
    logger.info("🏢 ATOffice backend started!")
    yield
    logger.info("🏢 ATOffice backend shutting down...")

app = FastAPI(title="ATOffice API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Models ---
class TaskRequest(BaseModel):
    command: str
    priority: Optional[str] = "medium"

class ChatMessage(BaseModel):
    message: str
    agent_id: Optional[str] = None  # None = broadcast to all

class AgentAction(BaseModel):
    agent_id: str
    action: str  # pause, resume, fire (kick), assign
    data: Optional[dict] = None

# --- Routes ---
@app.get("/")
async def root():
    return {"status": "ATOffice running", "version": "1.0.0"}

@app.get("/agents")
async def get_agents():
    db = get_db()
    agents = db.execute("SELECT * FROM agents").fetchall()
    result = []
    for a in agents:
        result.append(dict(a))
    db.close()
    return result

@app.get("/agents/{agent_id}")
async def get_agent(agent_id: str):
    db = get_db()
    agent = db.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)).fetchone()
    db.close()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return dict(agent)

@app.get("/tasks")
async def get_tasks(status: Optional[str] = None):
    db = get_db()
    if status:
        tasks = db.execute("SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC LIMIT 50", (status,)).fetchall()
    else:
        tasks = db.execute("SELECT * FROM tasks ORDER BY created_at DESC LIMIT 50").fetchall()
    db.close()
    return [dict(t) for t in tasks]

@app.get("/messages")
async def get_messages(limit: int = 50, agent_id: Optional[str] = None):
    db = get_db()
    if agent_id:
        msgs = db.execute(
            "SELECT * FROM messages WHERE sender_id = ? OR receiver_id = ? ORDER BY created_at DESC LIMIT ?",
            (agent_id, agent_id, limit)
        ).fetchall()
    else:
        msgs = db.execute(
            "SELECT * FROM messages ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
    db.close()
    return [dict(m) for m in reversed(msgs)]

@app.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    db = get_db()
    task = db.execute("SELECT id FROM tasks WHERE id=?", (task_id,)).fetchone()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.execute("DELETE FROM tasks WHERE id=?", (task_id,))
    db.commit(); db.close()
    # Notify frontend
    await manager.broadcast({"type": "task_deleted", "task_id": task_id})
    return {"deleted": task_id}

@app.delete("/tasks")
async def delete_all_tasks(status: str = None):
    db = get_db()
    if status:
        db.execute("DELETE FROM tasks WHERE status=?", (status,))
    else:
        db.execute("DELETE FROM tasks WHERE status IN ('pending','assigned','in_progress','failed')")
    db.commit(); db.close()
    await manager.broadcast({"type": "tasks_cleared"})
    return {"deleted": "all active tasks"}

@app.post("/task")
async def create_task(req: TaskRequest):
    task_id = await orchestrator.receive_command(req.command, req.priority)
    return {"task_id": task_id, "status": "dispatched", "command": req.command}

@app.post("/chat")
async def user_chat(msg: ChatMessage):
    """User sends a message into the office"""
    response = await orchestrator.handle_user_message(msg.message, msg.agent_id)
    return {"response": response}

@app.post("/agent/action")
async def agent_action(action: AgentAction):
    result = await orchestrator.handle_agent_action(action.agent_id, action.action, action.data)
    return result

@app.post("/office/continue")
async def continue_work():
    """Resume from yesterday - agents pick up where they left off"""
    result = await orchestrator.resume_from_checkpoint()
    return result

@app.get("/stats")
async def get_stats():
    db = get_db()
    today = date.today().isoformat()
    stats = {
        "total_tasks": db.execute("SELECT COUNT(*) FROM tasks").fetchone()[0],
        "completed_today": db.execute(
            "SELECT COUNT(*) FROM tasks WHERE status='completed' AND DATE(created_at)=?", (today,)
        ).fetchone()[0],
        "messages_today": db.execute(
            "SELECT COUNT(*) FROM messages WHERE DATE(created_at)=?", (today,)
        ).fetchone()[0],
        "agents": []
    }
    agents = db.execute("SELECT id, name, salary, productivity_points, status FROM agents").fetchall()
    for a in agents:
        stats["agents"].append(dict(a))
    db.close()
    return stats

@app.get("/leaderboard")
async def get_leaderboard():
    db = get_db()
    month = datetime.now().strftime("%Y-%m")
    board = db.execute("""
        SELECT a.id, a.name, a.role, a.emoji, a.productivity_points, a.salary,
               COUNT(t.id) as tasks_completed
        FROM agents a
        LEFT JOIN tasks t ON t.assigned_to = a.id AND t.status = 'completed'
            AND strftime('%Y-%m', t.updated_at) = ?
        GROUP BY a.id
        ORDER BY a.productivity_points DESC
    """, (month,)).fetchall()
    db.close()
    return [dict(b) for b in board]

@app.get("/logs")
async def get_logs(date_str: Optional[str] = None):
    if not date_str:
        date_str = date.today().isoformat()
    log_file = f"/home/claude/ATOffice/logs/{date_str}.log"
    if not os.path.exists(log_file):
        return {"logs": []}
    with open(log_file) as f:
        lines = f.readlines()
    return {"logs": lines[-200:]}

@app.get("/workspace/files")
async def workspace_files():
    return get_all_workspace_files()

@app.get("/workspace/file")
async def workspace_file(path: str):
    """
    Search for a file by its relative path.
    Checks:
      1. Legacy flat workspace (WORKSPACE_ROOT/path)
      2. All active projects (WORKSPACE_ROOT/projects/{name}/{path})
    """
    # 1. Legacy flat workspace
    content = get_file_content(path)
    if content is not None:
        return {"path": path, "content": content}

    # 2. Search all project folders
    import os
    projects_dir = os.path.join(WORKSPACE_ROOT, "projects")
    if os.path.exists(projects_dir):
        for project_name in os.listdir(projects_dir):
            project_path = os.path.join(projects_dir, project_name)
            if not os.path.isdir(project_path):
                continue
            full = os.path.join(project_path, path)
            if os.path.exists(full):
                try:
                    with open(full, 'r', encoding='utf-8', errors='ignore') as f:
                        return {"path": path, "content": f.read(), "project": project_name}
                except:
                    pass
            # Also try stripping leading folder components (e.g. "src/components/X.tsx" → find in project/src/components/X.tsx)
            # Already handled above. Try basename as fallback.
            basename = os.path.basename(path)
            for root, dirs, files in os.walk(project_path):
                dirs[:] = [d for d in dirs if d not in ['node_modules', '__pycache__', '.git']]
                if basename in files:
                    full2 = os.path.join(root, basename)
                    try:
                        with open(full2, 'r', encoding='utf-8', errors='ignore') as f:
                            return {"path": path, "content": f.read(), "project": project_name, "resolved": full2}
                    except:
                        pass

    raise HTTPException(status_code=404, detail=f"File not found: {path}")


@app.get("/workspace/projects/{task_id}/file")
async def project_file_direct(task_id: str, path: str):
    """Direct file access within a specific project."""
    wm = get_workspace_manager()
    project = wm.get_project(task_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    content = await project.read_file(path)
    if content is None:
        raise HTTPException(status_code=404, detail="File not found in project")
    return {"path": path, "content": content, "project": project.name}

@app.get("/workspace/projects")
async def list_projects():
    wm = get_workspace_manager()
    return wm.list_projects()

@app.get("/workspace/projects/{task_id}/files")
async def project_files(task_id: str):
    import os
    from workspace_manager import Project, PROJECTS
    # Try in-memory first (active session)
    wm = get_workspace_manager()
    p = wm.get_project(task_id)
    if not p:
        # Scan ALL project folders on disk — match by task_id in manifest OR folder name
        if os.path.exists(PROJECTS):
            for folder in os.listdir(PROJECTS):
                fpath = os.path.join(PROJECTS, folder)
                if not os.path.isdir(fpath): continue
                manifest_path = os.path.join(fpath, ".atoffice.json")
                # Match by folder name
                if folder == task_id:
                    p = Project(folder, task_id)
                    break
                # Match by task_id in manifest
                try:
                    with open(manifest_path) as mf:
                        import json as _j; m = _j.load(mf)
                    if m.get("task_id") == task_id:
                        p = Project(folder, task_id)
                        break
                except: pass
    if not p: raise HTTPException(status_code=404, detail="Project not found")
    try:
        files = p.list_files()
        manifest = p.get_manifest()
        return {"files": files, "manifest": manifest}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/workspace/projects/{project_name}/files-by-name")
async def project_files_by_name(project_name: str):
    """Fallback: load files by folder name regardless of task_id."""
    import os
    from workspace_manager import Project, PROJECTS
    ppath = os.path.join(PROJECTS, project_name)
    if not os.path.isdir(ppath):
        raise HTTPException(status_code=404, detail="Project folder not found")
    # Read manifest task_id if present
    manifest_path = os.path.join(ppath, ".atoffice.json")
    task_id = project_name
    try:
        with open(manifest_path) as f:
            import json as _json
            m = _json.load(f)
            task_id = m.get("task_id", project_name)
    except: pass
    p = Project(project_name, task_id)
    return {"files": p.list_files(), "manifest": p.get_manifest()}

@app.post("/workspace/projects/{task_id}/assemble")
async def assemble_project(task_id: str):
    wm = get_workspace_manager(manager.broadcast)
    path = await wm.assemble_project(task_id, manager.broadcast)
    return {"assembled": True, "path": path}

@app.delete("/workspace")
async def clear_workspace():
    clear_all_workspace()
    await manager.broadcast({"type": "workspace_cleared"})
    return {"status": "workspace cleared"}

@app.post("/terminal/run")
async def run_command(body: dict):
    agent_id = body.get("agent_id", "pm")
    cmd = body.get("cmd", "")
    from terminal import AgentTerminal
    term = AgentTerminal(agent_id, manager.broadcast)
    result = await term.run_command(cmd)
    return result

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    logger.info("🔌 WebSocket client connected")
    try:
        # Send current state on connect
        db = get_db()
        agents = [dict(a) for a in db.execute("SELECT * FROM agents").fetchall()]
        messages = [dict(m) for m in db.execute(
            "SELECT * FROM messages ORDER BY created_at DESC LIMIT 30"
        ).fetchall()]
        db.close()
        await websocket.send_json({
            "type": "init",
            "agents": agents,
            "messages": list(reversed(messages))
        })
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "chat":
                response = await orchestrator.handle_user_message(msg["text"], msg.get("agent_id"))
                await websocket.send_json({"type": "chat_response", "text": response})
            elif msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("🔌 WebSocket client disconnected")

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)