"""
ATOffice — Workspace Manager  (improved)

IMPROVEMENTS OVER ORIGINAL:
- Every task gets its OWN named project folder (not a flat workspace dump)
- Project name derived from command, not random UUID
- Files organized by agent role within the project
- list_projects() reads from filesystem (no stale in-memory state)
- get_workspace_manager() always passes broadcast_fn correctly (no singleton leak)
- Structured JSON output: files written with exact paths from agent response
- Project manifest tracks agent contributions with timestamps
- assemble_project() properly walks sub-task outputs into correct paths
"""

import os, shutil, json, asyncio, re
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


# ─────────────────────────────────────────────────────────────────────────────
# PROJECT CLASS
# ─────────────────────────────────────────────────────────────────────────────
class Project:
    """
    A single project folder.
    Structure:
      workspace/projects/{name}/
        .atoffice.json       — manifest
        src/                 — frontend code (designer, frontend)
        api/                 — backend code (backend)
        tests/               — test files (qa)
        docs/                — documentation (blog, pm, techlead)
        scripts/             — DevOps scripts (github)
    """

    ROLE_FOLDERS = {
        "designer":  "src/",
        "frontend":  "src/",
        "backend":   "api/",
        "qa":        "tests/",
        "blog":      "docs/",
        "pm":        "docs/",
        "techlead":  "docs/review/",
        "github":    "scripts/",
    }

    def __init__(self, name: str, task_id: str, command: str = "", broadcast_fn=None):
        self.name = self._sanitize(name)
        self.task_id = task_id
        self.command = command
        self._broadcast_fn = broadcast_fn
        self.path = os.path.join(PROJECTS, self.name)
        self.lock = get_project_lock(task_id)
        self.manifest_path = os.path.join(self.path, ".atoffice.json")
        os.makedirs(self.path, exist_ok=True)
        # Create standard subfolders
        for folder in ["src", "api", "tests", "docs", "scripts"]:
            os.makedirs(os.path.join(self.path, folder), exist_ok=True)
        self._init_manifest()

    def _sanitize(self, name: str) -> str:
        s = re.sub(r'[^a-z0-9\-_]', '-', name.lower().strip())
        s = re.sub(r'-+', '-', s)
        return s[:50].strip('-') or "project"

    def _init_manifest(self):
        if not os.path.exists(self.manifest_path):
            self._write_manifest({
                "task_id": self.task_id,
                "name": self.name,
                "command": self.command,
                "created": datetime.now().isoformat(),
                "files": {},
                "agents": {},
            })

    def _read_manifest(self) -> dict:
        try:
            with open(self.manifest_path) as f:
                return json.load(f)
        except:
            return {}

    def _write_manifest(self, data: dict):
        with open(self.manifest_path, 'w') as f:
            json.dump(data, f, indent=2)

    async def write_file(self, subpath: str, content: str, agent_id: str,
                         broadcast_fn=None) -> str:
        """
        Write a file. Deduplicates path segments, emits terminal_event.
        """
        # Fix double-path bug: strip duplicated consecutive path segments
        parts = subpath.replace('\\', '/').split('/')
        deduped = [parts[0]]
        for p in parts[1:]:
            if p and p != deduped[-1]:
                deduped.append(p)
        subpath = '/'.join(deduped)

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
                "written": datetime.now().isoformat(),
            }
            m.setdefault("agents", {}).setdefault(agent_id, [])
            if subpath not in m["agents"][agent_id]:
                m["agents"][agent_id].append(subpath)
            self._write_manifest(m)

            # Emit terminal_event so Activity panel shows live file writes
            _bfn = broadcast_fn or getattr(self, '_broadcast_fn', None)
            if _bfn:
                try:
                    import asyncio as _asyncio
                    _coro = _bfn({
                        "type": "terminal_event",
                        "agent_id": agent_id,
                        "event": "file_written",
                        "filename": subpath,
                        "size": len(content),
                        "preview": content[:300],
                        "ts": datetime.now().isoformat()
                    })
                    if _asyncio.iscoroutine(_coro):
                        _asyncio.create_task(_coro)
                except Exception:
                    pass

            return full

    async def write_files_from_structured(self, file_list: list, agent_id: str) -> list:
        """
        Write multiple files from structured agent output.
        file_list: [{"filename": "...", "path": "...", "content": "..."}]
        Returns list of written subpaths.
        """
        written = []
        for f in file_list:
            folder = f.get("path", self.ROLE_FOLDERS.get(agent_id, f"{agent_id}/"))
            if not folder.endswith("/"):
                folder += "/"
            subpath = f"{folder}{f['filename']}"
            await self.write_file(subpath, f["content"], agent_id)
            written.append(subpath)
        return written

    async def read_file(self, subpath: str) -> str | None:
        full = os.path.join(self.path, subpath)
        if os.path.exists(full):
            with open(full) as f:
                return f.read()
        return None

    async def read_file_for_patch(self, subpath: str) -> str | None:
        """Read an existing file so an agent can patch it."""
        full = os.path.join(self.path, subpath)
        if os.path.exists(full):
            with open(full, encoding='utf-8', errors='ignore') as f:
                return f.read()
        return None

    def get_project_context(self, max_file_chars: int = 600) -> str:
        """Compact snapshot of every written file — agents read this for context."""
        lines = ["PROJECT FILES ALREADY WRITTEN:"]
        for root, dirs, filenames in os.walk(self.path):
            dirs[:] = [d for d in dirs if d not in
                       ['node_modules', '__pycache__', '.git', 'venv', 'dist', '.next']]
            for fname in filenames:
                if fname in ('.atoffice.json', '.gitignore', '.DS_Store'): continue
                fpath = os.path.join(root, fname)
                rel = os.path.relpath(fpath, self.path)
                try:
                    size = os.path.getsize(fpath)
                    with open(fpath, encoding='utf-8', errors='ignore') as f:
                        snippet = f.read(max_file_chars)
                    trunc = "..." if size > max_file_chars else ""
                    lines.append(f"\n── {rel} ({size}b) ──\n{snippet}{trunc}")
                except Exception:
                    pass
        return "\n".join(lines) if len(lines) > 1 else ""

    def list_files(self) -> list:
        files = []
        skip = {'node_modules', '__pycache__', '.git', 'venv', '.atoffice.json'}
        for root, dirs, filenames in os.walk(self.path):
            dirs[:] = [d for d in dirs if d not in skip]
            for fname in filenames:
                if fname in skip:
                    continue
                fpath = os.path.join(root, fname)
                rel = os.path.relpath(fpath, self.path)
                try:
                    size = os.path.getsize(fpath)
                    mtime = os.path.getmtime(fpath)
                    # Determine which agent wrote this
                    m = self._read_manifest()
                    agent = m.get("files", {}).get(rel, {}).get("agent", "unknown")
                    files.append({
                        "name": fname,
                        "path": rel,
                        "size": size,
                        "modified": datetime.fromtimestamp(mtime).isoformat(),
                        "agent": agent,
                    })
                except:
                    pass
        return sorted(files, key=lambda x: x["modified"], reverse=True)

    def get_manifest(self) -> dict:
        return self._read_manifest()

    def get_summary(self) -> dict:
        m = self._read_manifest()
        files = self.list_files()
        return {
            "name": self.name,
            "task_id": self.task_id,
            "command": m.get("command", ""),
            "created": m.get("created", ""),
            "path": self.path,
            "file_count": len(files),
            "agents_contributed": list(m.get("agents", {}).keys()),
            "files_by_agent": {
                agent: [f for f in files if f.get("agent") == agent]
                for agent in m.get("agents", {}).keys()
            }
        }

    async def run_command(self, cmd: str, timeout: int = 60) -> dict:
        import subprocess
        try:
            result = subprocess.run(
                cmd, shell=True, capture_output=True, text=True,
                timeout=timeout, cwd=self.path
            )
            return {
                "stdout": result.stdout[:3000],
                "stderr": result.stderr[:500],
                "returncode": result.returncode,
                "success": result.returncode == 0,
            }
        except subprocess.TimeoutExpired:
            return {"stdout": "", "stderr": "Timed out", "returncode": -1, "success": False}
        except Exception as e:
            return {"stdout": "", "stderr": str(e), "returncode": -1, "success": False}


# ─────────────────────────────────────────────────────────────────────────────
# WORKSPACE MANAGER
# ─────────────────────────────────────────────────────────────────────────────
class WorkspaceManager:
    """
    Manages all projects. Each project is an isolated folder.
    No more flat workspace dump.
    """

    def __init__(self, broadcast_fn=None):
        self.broadcast = broadcast_fn
        self._broadcast_fn = broadcast_fn   # alias used by Project.write_file
        self._active_projects: dict[str, Project] = {}

    def get_or_create_project(self, name: str, task_id: str, command: str = "") -> Project:
        if task_id not in self._active_projects:
            p = Project(name, task_id, command, broadcast_fn=getattr(self,'_broadcast_fn',None))
            self._active_projects[task_id] = p
        return self._active_projects[task_id]

    def get_project(self, task_id: str) -> Project | None:
        # Check in-memory first
        if task_id in self._active_projects:
            return self._active_projects[task_id]
        # Try to find by scanning filesystem
        for folder in os.listdir(PROJECTS):
            manifest_path = os.path.join(PROJECTS, folder, ".atoffice.json")
            if os.path.exists(manifest_path):
                try:
                    with open(manifest_path) as f:
                        m = json.load(f)
                    if m.get("task_id") == task_id:
                        p = Project.__new__(Project)
                        p.name = folder
                        p.task_id = task_id
                        p.command = m.get("command", "")
                        p._broadcast_fn = self._broadcast_fn
                        p.path = os.path.join(PROJECTS, folder)
                        p.lock = get_project_lock(task_id)
                        p.manifest_path = manifest_path
                        self._active_projects[task_id] = p
                        return p
                except:
                    pass
        return None

    def list_projects(self) -> list:
        """
        Read all projects from filesystem. Always fresh — no stale in-memory state.
        """
        projects = []
        if not os.path.exists(PROJECTS):
            return []
        for folder in sorted(os.listdir(PROJECTS), reverse=True):
            ppath = os.path.join(PROJECTS, folder)
            if not os.path.isdir(ppath):
                continue
            manifest_path = os.path.join(ppath, ".atoffice.json")
            try:
                with open(manifest_path) as f:
                    m = json.load(f)
                file_count = max(0, sum(len(fs) for _,_,fs in os.walk(ppath)) - 1)
                projects.append({
                    "name": folder,
                    "path": ppath,
                    "task_id": m.get("task_id", folder),
                    "command": m.get("command", ""),
                    "created": m.get("created", ""),
                    "file_count": file_count,
                    "agents": list(m.get("agents", {}).keys()),
                })
            except:
                projects.append({
                    "name": folder,
                    "path": ppath,
                    "file_count": 0,
                    "agents": [],
                })
        return projects

    async def assemble_project(self, task_id: str, broadcast_fn=None) -> str:
        """
        Collect all sub-task outputs into the project folder.
        Uses structured JSON output from agents (not regex on markdown).
        """
        from db import get_db
        db = get_db()

        parent = db.execute("SELECT title, description FROM tasks WHERE id=?", (task_id,)).fetchone()
        db.close()

        project_name = parent["title"][:40] if parent else f"project-{task_id}"
        project_name = re.sub(r'[^a-z0-9\-]', '-', project_name.lower())
        project_name = re.sub(r'-+', '-', project_name).strip('-') or "project"
        command = parent["description"] if parent else ""

        project = self.get_or_create_project(project_name, task_id, command)

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

            # Try to parse as structured JSON first (new format)
            try:
                parsed = json.loads(output)
                if isinstance(parsed, dict) and "files" in parsed:
                    for f in parsed["files"]:
                        folder = f.get("path", Project.ROLE_FOLDERS.get(agent_id, f"{agent_id}/"))
                        if not folder.endswith("/"): folder += "/"
                        subpath = f"{folder}{f['filename']}"
                        await project.write_file(subpath, f["content"], agent_id)
                        assembled.append(subpath)
                    continue
            except (json.JSONDecodeError, TypeError):
                pass

            # Fallback: extract code blocks from markdown
            code_blocks = re.findall(r'```(\w*)\n(.*?)```', output, re.DOTALL)
            if code_blocks:
                for lang, code in code_blocks:
                    ext_map = {
                        "jsx": "jsx", "tsx": "tsx", "js": "js", "ts": "ts",
                        "py": "py", "css": "css", "html": "html",
                        "json": "json", "sh": "sh", "md": "md", "yaml": "yaml", "yml": "yml"
                    }
                    ext = ext_map.get(lang, "txt")
                    slug = s["title"][:20].replace(" ", "_").lower()
                    folder = Project.ROLE_FOLDERS.get(agent_id, f"{agent_id}/")
                    subpath = f"{folder}{slug}.{ext}"
                    await project.write_file(subpath, code.strip(), agent_id)
                    assembled.append(subpath)
            else:
                # Plain text → save as markdown
                slug = s["title"][:20].replace(" ", "_").lower()
                folder = Project.ROLE_FOLDERS.get(agent_id, f"{agent_id}/")
                subpath = f"{folder}{slug}.md"
                await project.write_file(subpath, output, agent_id)
                assembled.append(subpath)

        # Generate package.json if frontend files exist
        has_frontend = any("src/" in f for f in assembled)
        if has_frontend:
            pkg = json.dumps({
                "name": project.name,
                "version": "1.0.0",
                "private": True,
                "scripts": {"dev": "vite", "build": "vite build", "preview": "vite preview"},
                "dependencies": {"react": "^18.3.0", "react-dom": "^18.3.0"},
                "devDependencies": {
                    "vite": "^5.0.0",
                    "@vitejs/plugin-react": "^4.0.0",
                    "tailwindcss": "^3.4.0",
                    "typescript": "^5.0.0",
                    "@types/react": "^18.0.0",
                }
            }, indent=2)
            await project.write_file("package.json", pkg, "system")

        # Generate .gitignore
        gitignore = "node_modules/\n__pycache__/\n.env\n*.pyc\ndist/\n.DS_Store\nvenv/\n"
        await project.write_file(".gitignore", gitignore, "system")

        if broadcast_fn:
            await broadcast_fn({
                "type": "project_assembled",
                "task_id": task_id,
                "project_name": project.name,
                "path": project.path,
                "files": assembled,
            })

        return project.path

    def get_project_path(self, task_id: str) -> str | None:
        p = self.get_project(task_id)
        return p.path if p else None

    def all_project_files(self) -> list:
        """For the file tree UI — returns all files across all active projects."""
        all_files = []
        for task_id, project in self._active_projects.items():
            for f in project.list_files():
                f["project"] = project.name
                f["task_id"] = task_id
                all_files.append(f)
        return all_files


# ─────────────────────────────────────────────────────────────────────────────
# SINGLETON — but no broadcast_fn caching bug
# ─────────────────────────────────────────────────────────────────────────────
_wm: WorkspaceManager = None

def get_workspace_manager(broadcast_fn=None) -> WorkspaceManager:
    global _wm
    if _wm is None:
        _wm = WorkspaceManager(broadcast_fn)
    if broadcast_fn is not None:
        _wm.broadcast = broadcast_fn
        _wm._broadcast_fn = broadcast_fn  # keep alias in sync
    return _wm