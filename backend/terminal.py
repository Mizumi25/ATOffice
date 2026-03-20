"""
ATOffice - Agent Terminal & File System
Agents can write files, run commands, see output, fix errors
"""
import asyncio
import os
import subprocess
import shutil
from datetime import datetime
from pathlib import Path

WORKSPACE_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "workspace")

AGENT_DIRS = {
    "designer":  os.path.join(WORKSPACE_ROOT, "design"),
    "frontend":  os.path.join(WORKSPACE_ROOT, "frontend"),
    "backend":   os.path.join(WORKSPACE_ROOT, "backend"),
    "qa":        os.path.join(WORKSPACE_ROOT, "qa"),
    "pm":        os.path.join(WORKSPACE_ROOT, "shared"),
    "shared":    os.path.join(WORKSPACE_ROOT, "shared"),
}

def ensure_dirs():
    for d in AGENT_DIRS.values():
        os.makedirs(d, exist_ok=True)

ensure_dirs()


class AgentTerminal:
    """Each agent gets their own terminal context"""

    def __init__(self, agent_id: str, broadcast_fn=None):
        self.agent_id = agent_id
        self.broadcast = broadcast_fn
        self.workdir = AGENT_DIRS.get(agent_id, WORKSPACE_ROOT)
        self.history = []

    async def _emit(self, event_type: str, data: dict):
        if self.broadcast:
            await self.broadcast({
                "type": "terminal_event",
                "agent_id": self.agent_id,
                "event": event_type,
                **data,
                "ts": datetime.now().isoformat()
            })

    async def write_file(self, filename: str, content: str) -> str:
        """Write a file to agent's workspace"""
        # Sanitize filename
        filename = os.path.basename(filename)
        filepath = os.path.join(self.workdir, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        await self._emit("file_written", {
            "filename": filename,
            "path": filepath,
            "size": len(content),
            "preview": content[:200]
        })
        # Also tell frontend to refresh file tree
        if self.broadcast:
            await self.broadcast({"type": "refresh_files", "agent_id": self.agent_id, "filename": filename})
        return filepath

    async def read_file(self, filename: str) -> str:
        """Read a file from workspace"""
        filepath = os.path.join(self.workdir, filename)
        if not os.path.exists(filepath):
            # Try shared dir
            filepath = os.path.join(AGENT_DIRS["shared"], filename)
        if os.path.exists(filepath):
            with open(filepath) as f:
                return f.read()
        return None

    async def run_command(self, cmd: str, timeout: int = 30) -> dict:
        """Run a shell command and return output"""
        await self._emit("command_start", {"cmd": cmd, "cwd": self.workdir})
        try:
            result = subprocess.run(
                cmd, shell=True, capture_output=True, text=True,
                timeout=timeout, cwd=self.workdir,
                env={**os.environ, "PATH": os.environ.get("PATH", "") + ":/usr/local/bin:/usr/bin"}
            )
            output = {
                "cmd": cmd,
                "stdout": result.stdout[:2000],
                "stderr": result.stderr[:500],
                "returncode": result.returncode,
                "success": result.returncode == 0
            }
        except subprocess.TimeoutExpired:
            output = {"cmd": cmd, "stdout": "", "stderr": "Command timed out", "returncode": -1, "success": False}
        except Exception as e:
            output = {"cmd": cmd, "stdout": "", "stderr": str(e), "returncode": -1, "success": False}

        await self._emit("command_done", output)
        self.history.append(output)
        return output

    async def run_python(self, filename: str) -> dict:
        return await self.run_command(f"python3 {filename}")

    async def run_node(self, filename: str) -> dict:
        return await self.run_command(f"node {filename}")

    async def install_package(self, package: str, manager: str = "pip") -> dict:
        if manager == "pip":
            return await self.run_command(f"pip install {package} --break-system-packages -q")
        elif manager == "npm":
            return await self.run_command(f"npm install {package} --save 2>/dev/null")
        return {"success": False, "stderr": "Unknown manager"}

    def list_files(self, subdir: str = None) -> list:
        """List files in workspace"""
        target = os.path.join(self.workdir, subdir) if subdir else self.workdir
        if not os.path.exists(target):
            return []
        files = []
        for root, dirs, filenames in os.walk(target):
            # Skip node_modules etc
            dirs[:] = [d for d in dirs if d not in ['node_modules', '__pycache__', '.git', 'venv']]
            for fname in filenames:
                fpath = os.path.join(root, fname)
                rel = os.path.relpath(fpath, self.workdir)
                try:
                    size = os.path.getsize(fpath)
                    mtime = os.path.getmtime(fpath)
                    files.append({
                        "name": fname,
                        "path": rel,
                        "size": size,
                        "modified": datetime.fromtimestamp(mtime).isoformat(),
                        "agent": self.agent_id
                    })
                except:
                    pass
        return sorted(files, key=lambda x: x["modified"], reverse=True)

    async def delete_file(self, filename: str) -> bool:
        filepath = os.path.join(self.workdir, filename)
        if os.path.exists(filepath):
            os.remove(filepath)
            await self._emit("file_deleted", {"filename": filename})
            return True
        return False

    async def clear_workspace(self):
        """Clear all files in agent workspace"""
        if os.path.exists(self.workdir):
            shutil.rmtree(self.workdir)
        os.makedirs(self.workdir, exist_ok=True)
        await self._emit("workspace_cleared", {"workdir": self.workdir})


def get_all_workspace_files() -> list:
    """Get all files across all agent workspaces"""
    all_files = []
    for agent_id, dirpath in AGENT_DIRS.items():
        if agent_id == "shared":
            continue
        if not os.path.exists(dirpath):
            continue
        for root, dirs, filenames in os.walk(dirpath):
            dirs[:] = [d for d in dirs if d not in ['node_modules', '__pycache__', '.git']]
            for fname in filenames:
                fpath = os.path.join(root, fname)
                rel = os.path.relpath(fpath, WORKSPACE_ROOT)
                try:
                    size = os.path.getsize(fpath)
                    mtime = os.path.getmtime(fpath)
                    with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                    all_files.append({
                        "name": fname,
                        "path": rel,
                        "full_path": fpath,
                        "size": size,
                        "agent": agent_id,
                        "modified": datetime.fromtimestamp(mtime).isoformat(),
                        "content": content,
                        "ext": fname.rsplit('.', 1)[-1] if '.' in fname else 'txt'
                    })
                except:
                    pass
    return sorted(all_files, key=lambda x: x["modified"], reverse=True)


def get_file_content(filepath: str) -> str:
    """Read any workspace file by relative path"""
    full = os.path.join(WORKSPACE_ROOT, filepath)
    if os.path.exists(full):
        with open(full, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()
    return None


def clear_all_workspace():
    """Nuclear option - clear everything"""
    for dirpath in AGENT_DIRS.values():
        if os.path.exists(dirpath):
            shutil.rmtree(dirpath)
        os.makedirs(dirpath, exist_ok=True)