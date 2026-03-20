"""
ATOffice - Workspace Manager
Assembles agent outputs into proper project folders.
Each project gets a lock so agents don't interfere with each other.
"""
import os, shutil, json, asyncio
from datetime import datetime
from pathlib import Path

WORKSPACE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "workspace")
PROJECTS  = os.path.join(WORKSPACE, "projects")

os.makedirs(PROJECTS, exist_ok=True)

# Per-project async locks — prevents agents writing simultaneously
_project_locks: dict = {}

def get_project_lock(project_id: str) -> asyncio.Lock:
    if project_id not in _project_locks:
        _project_locks[project_id] = asyncio.Lock()
    return _project_locks[project_id]


class Project:
    """A single assembled project folder"""

    def __init__(self, name: str, task_id: str):
        self.name = self._sanitize(name)
        self.task_id = task_id
        self.path = os.path.join(PROJECTS, self.name)
        self.lock = get_project_lock(task_id)
        self.manifest_path = os.path.join(self.path, ".atoffice.json")
        os.makedirs(self.path, exist_ok=True)
        self._init_manifest()

    def _sanitize(self, name: str) -> str:
        import re
        s = re.sub(r'[^a-z0-9\-_]', '-', name.lower().strip())
        return re.sub(r'-+', '-', s)[:40] or "project"

    def _init_manifest(self):
        if not os.path.exists(self.manifest_path):
            self._write_manifest({"task_id": self.task_id, "name": self.name,
                                   "created": datetime.now().isoformat(), "files": {}})

    def _read_manifest(self) -> dict:
        try:
            with open(self.manifest_path) as f: return json.load(f)
        except: return {}

    def _write_manifest(self, data: dict):
        with open(self.manifest_path, 'w') as f: json.dump(data, f, indent=2)

    async def write_file(self, subpath: str, content: str, agent_id: str) -> str:
        """Write a file - acquires lock so only one agent writes at a time"""
        async with self.lock:
            full = os.path.join(self.path, subpath)
            os.makedirs(os.path.dirname(full), exist_ok=True)
            with open(full, 'w', encoding='utf-8') as f:
                f.write(content)
            # Update manifest
            m = self._read_manifest()
            m.setdefault("files", {})[subpath] = {
                "agent": agent_id,
                "size": len(content),
                "written": datetime.now().isoformat()
            }
            self._write_manifest(m)
            return full

    async def read_file(self, subpath: str) -> str | None:
        full = os.path.join(self.path, subpath)
        if os.path.exists(full):
            with open(full) as f: return f.read()
        return None

    def list_files(self) -> list:
        files = []
        for root, dirs, filenames in os.walk(self.path):
            dirs[:] = [d for d in dirs if d not in ['node_modules','__pycache__','.git','venv']]
            for fname in filenames:
                if fname == '.atoffice.json': continue
                fpath = os.path.join(root, fname)
                rel = os.path.relpath(fpath, self.path)
                try:
                    size = os.path.getsize(fpath)
                    mtime = os.path.getmtime(fpath)
                    files.append({"name": fname, "path": rel, "size": size,
                                  "modified": datetime.fromtimestamp(mtime).isoformat()})
                except: pass
        return sorted(files, key=lambda x: x["modified"], reverse=True)

    def get_manifest(self) -> dict:
        return self._read_manifest()

    async def run_command(self, cmd: str, timeout: int = 60) -> dict:
        """Run command in project directory"""
        import subprocess
        try:
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True,
                                    timeout=timeout, cwd=self.path)
            return {"stdout": result.stdout[:3000], "stderr": result.stderr[:500],
                    "returncode": result.returncode, "success": result.returncode == 0}
        except subprocess.TimeoutExpired:
            return {"stdout": "", "stderr": "Timed out", "returncode": -1, "success": False}
        except Exception as e:
            return {"stdout": "", "stderr": str(e), "returncode": -1, "success": False}


class WorkspaceManager:
    """Manages all projects, coordinates agent writes"""

    def __init__(self, broadcast_fn=None):
        self.broadcast = broadcast_fn
        self._active_projects: dict[str, Project] = {}

    def get_or_create_project(self, name: str, task_id: str) -> Project:
        if task_id not in self._active_projects:
            p = Project(name, task_id)
            self._active_projects[task_id] = p
        return self._active_projects[task_id]

    def get_project(self, task_id: str) -> Project | None:
        return self._active_projects.get(task_id)

    def list_projects(self) -> list:
        projects = []
        for d in os.listdir(PROJECTS):
            ppath = os.path.join(PROJECTS, d)
            manifest_path = os.path.join(ppath, ".atoffice.json")
            if os.path.isdir(ppath):
                try:
                    with open(manifest_path) as f:
                        m = json.load(f)
                    file_count = len([x for x in os.walk(ppath)])
                    projects.append({
                        "name": d, "path": ppath,
                        "task_id": m.get("task_id"),
                        "created": m.get("created"),
                        "file_count": len(m.get("files", {})),
                    })
                except:
                    projects.append({"name": d, "path": ppath})
        return sorted(projects, key=lambda x: x.get("created",""), reverse=True)

    async def assemble_project(self, task_id: str, broadcast_fn=None) -> str:
        """
        Called by Kazu - assembles all agent outputs for a task_id
        into one project folder, safely with locking
        """
        from db import get_db
        db = get_db()

        # Get project name from parent task
        parent = db.execute(
            "SELECT title FROM tasks WHERE id=?", (task_id,)
        ).fetchone()
        db.close()

        project_name = parent["title"] if parent else f"project-{task_id}"
        project = self.get_or_create_project(project_name, task_id)

        # Get all sibling task outputs
        db = get_db()
        siblings = db.execute(
            "SELECT assigned_to, title, output FROM tasks WHERE parent_task_id=? AND output IS NOT NULL",
            (task_id,)
        ).fetchall()
        db.close()

        assembled = []
        for s in siblings:
            agent_id = s["assigned_to"]
            output = s["output"] or ""

            # Map agent to folder structure
            folder_map = {
                "designer":  "docs",
                "frontend":  "src/components",
                "backend":   "api",
                "qa":        "tests",
                "blog":      "docs/blog",
                "pm":        "docs",
                "techlead":  "docs/review",
            }
            folder = folder_map.get(agent_id, agent_id)

            # Extract code blocks and write as files
            import re
            code_blocks = re.findall(r'```(\w*)\n(.*?)```', output, re.DOTALL)

            if code_blocks:
                for lang, code in code_blocks:
                    ext_map = {"jsx":"jsx","js":"js","py":"py","css":"css",
                               "html":"html","json":"json","sh":"sh","md":"md","ts":"ts"}
                    ext = ext_map.get(lang, "txt")
                    slug = s["title"][:20].replace(" ","_").lower()
                    subpath = f"{folder}/{slug}.{ext}"
                    await project.write_file(subpath, code.strip(), agent_id)
                    assembled.append(subpath)
            else:
                # Plain text output (design specs, plans etc)
                slug = s["title"][:20].replace(" ","_").lower()
                subpath = f"{folder}/{slug}.md"
                await project.write_file(subpath, output, agent_id)
                assembled.append(subpath)

        # Generate package.json if frontend files exist
        has_frontend = any("src/" in f for f in assembled)
        if has_frontend:
            pkg = json.dumps({
                "name": project.name,
                "version": "1.0.0",
                "scripts": {"dev":"vite","build":"vite build"},
                "dependencies": {"react":"^18.0.0","react-dom":"^18.0.0"},
                "devDependencies": {"vite":"^5.0.0","@vitejs/plugin-react":"^4.0.0"}
            }, indent=2)
            await project.write_file("package.json", pkg, "system")

        # Generate .gitignore
        gitignore = "node_modules/\n__pycache__/\n.env\n*.pyc\ndist/\n.DS_Store\n"
        await project.write_file(".gitignore", gitignore, "system")

        if broadcast_fn:
            await broadcast_fn({
                "type": "project_assembled",
                "task_id": task_id,
                "project_name": project.name,
                "path": project.path,
                "files": assembled
            })

        return project.path

    def get_project_path(self, task_id: str) -> str | None:
        p = self._active_projects.get(task_id)
        return p.path if p else None

    def all_project_files(self) -> list:
        """For the file tree UI"""
        all_files = []
        for task_id, project in self._active_projects.items():
            for f in project.list_files():
                f["project"] = project.name
                f["task_id"] = task_id
                all_files.append(f)
        return all_files


# Global singleton
_wm: WorkspaceManager = None

def get_workspace_manager(broadcast_fn=None) -> WorkspaceManager:
    global _wm
    if _wm is None:
        _wm = WorkspaceManager(broadcast_fn)
    return _wm