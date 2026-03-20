"""
ATOffice - Task Manager
Handles task lifecycle: create, assign, complete, fail
"""
import uuid
from datetime import datetime
from typing import Optional, List, Dict
from db import get_db, log_action


class TaskManager:
    def create_task(
        self,
        task_id: str = None,
        title: str = "",
        description: str = "",
        status: str = "pending",
        assigned_to: str = None,
        priority: str = "medium",
        parent_task_id: str = None,
        created_by: str = "system"
    ) -> str:
        if not task_id:
            task_id = str(uuid.uuid4())[:8]
        db = get_db()
        db.execute("""
            INSERT OR REPLACE INTO tasks
            (id, title, description, status, assigned_to, priority, parent_task_id, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (task_id, title, description, status, assigned_to, priority, parent_task_id, created_by))
        db.commit()
        db.close()
        log_action(assigned_to or "system", "task_created", f"{task_id}: {title}")
        return task_id

    def get_pending_tasks(self) -> List[Dict]:
        db = get_db()
        tasks = db.execute(
            "SELECT * FROM tasks WHERE status IN ('pending', 'assigned') ORDER BY created_at ASC LIMIT 10"
        ).fetchall()
        db.close()
        return [dict(t) for t in tasks]

    def get_agent_tasks(self, agent_id: str) -> List[Dict]:
        db = get_db()
        tasks = db.execute(
            "SELECT * FROM tasks WHERE assigned_to = ? ORDER BY created_at DESC LIMIT 20",
            (agent_id,)
        ).fetchall()
        db.close()
        return [dict(t) for t in tasks]

    def update_task_status(self, task_id: str, status: str):
        db = get_db()
        db.execute(
            "UPDATE tasks SET status=?, updated_at=datetime('now') WHERE id=?",
            (status, task_id)
        )
        db.commit()
        db.close()

    def complete_task(self, task_id: str, output: str = ""):
        db = get_db()
        db.execute(
            "UPDATE tasks SET status='completed', output=?, updated_at=datetime('now') WHERE id=?",
            (output[:2000], task_id)
        )
        db.commit()
        db.close()
        log_action("system", "task_completed", task_id)

    def fail_task(self, task_id: str, reason: str = ""):
        db = get_db()
        db.execute(
            "UPDATE tasks SET status='failed', output=?, updated_at=datetime('now') WHERE id=?",
            (f"FAILED: {reason}", task_id)
        )
        db.commit()
        db.close()

    def reassign_task(self, task_id: str, new_agent_id: str):
        db = get_db()
        db.execute(
            "UPDATE tasks SET assigned_to=?, status='assigned', updated_at=datetime('now') WHERE id=?",
            (new_agent_id, task_id)
        )
        db.commit()
        db.close()
        log_action(new_agent_id, "task_reassigned", task_id)

    def get_task(self, task_id: str) -> Optional[Dict]:
        db = get_db()
        task = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        db.close()
        return dict(task) if task else None
