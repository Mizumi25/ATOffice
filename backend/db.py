"""
ATOffice - Database Layer
SQLite persistence for agents, tasks, messages
"""
import sqlite3
import os
import json
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "db.sqlite")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()

    c.executescript("""
    CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        emoji TEXT NOT NULL,
        status TEXT DEFAULT 'idle',       -- idle, working, resting, meeting, thinking
        current_task_id TEXT,
        salary INTEGER DEFAULT 5000,       -- virtual salary in ¥
        productivity_points INTEGER DEFAULT 0,
        api_model TEXT,
        api_keys TEXT,                     -- JSON array of keys
        current_key_index INTEGER DEFAULT 0,
        quota_reset_time TEXT,             -- ISO timestamp
        mood TEXT DEFAULT 'neutral',       -- happy, focused, tired, joking
        memory TEXT DEFAULT '{}',          -- JSON: last state, context
        position_x INTEGER DEFAULT 0,
        position_y INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',     -- pending, assigned, in_progress, reviewing, completed, failed
        priority TEXT DEFAULT 'medium',    -- low, medium, high, critical
        assigned_to TEXT,
        created_by TEXT,
        parent_task_id TEXT,
        output TEXT,                       -- final output/code/result
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(assigned_to) REFERENCES agents(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sender_id TEXT,                    -- agent id or 'user' or 'system'
        receiver_id TEXT,                  -- agent id or 'all' or 'user'
        content TEXT NOT NULL,
        message_type TEXT DEFAULT 'chat',  -- chat, task_update, joke, meeting, status, dialogue
        task_id TEXT,
        metadata TEXT DEFAULT '{}',        -- JSON extra data
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS meetings (
        id TEXT PRIMARY KEY,
        title TEXT,
        attendees TEXT,                    -- JSON array of agent ids
        summary TEXT,
        status TEXT DEFAULT 'scheduled',   -- scheduled, in_progress, done
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_logs (
        id TEXT PRIMARY KEY,
        date TEXT,
        agent_id TEXT,
        action TEXT,
        detail TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS checkpoints (
        id TEXT PRIMARY KEY,
        date TEXT UNIQUE,
        state TEXT,                        -- JSON snapshot of all agent states
        pending_tasks TEXT,                -- JSON array of task ids
        created_at TEXT DEFAULT (datetime('now'))
    );
    """)

    # Seed agents if not exist
    agents = [
        {
            "id": "pm",
            "name": "Haruto",
            "role": "Project Manager",
            "emoji": "👨‍💼",
            "position_x": 400, "position_y": 200,
            "api_model": "gemini-2.5-flash",
            "salary": 8000,
            "mood": "focused"
        },
        {
            "id": "designer",
            "name": "Yuki",
            "role": "Designer",
            "emoji": "👩‍🎨",
            "position_x": 150, "position_y": 300,
            "api_model": "gemini-2.5-flash",
            "salary": 7000,
            "mood": "creative"
        },
        {
            "id": "frontend",
            "name": "Ren",
            "role": "Frontend Dev",
            "emoji": "👨‍💻",
            "position_x": 650, "position_y": 300,
            "api_model": "gemini-2.5-flash",
            "salary": 7500,
            "mood": "focused"
        },
        {
            "id": "backend",
            "name": "Sora",
            "role": "Backend Dev",
            "emoji": "👩‍💻",
            "position_x": 150, "position_y": 500,
            "api_model": "llama-4-scout",
            "salary": 7500,
            "mood": "neutral"
        },
        {
            "id": "qa",
            "name": "Mei",
            "role": "QA Engineer",
            "emoji": "🔍",
            "position_x": 650, "position_y": 500,
            "api_model": "llama-3.3-70b-versatile",
            "salary": 6500,
            "mood": "analytical"
        },
        {
            "id": "blog",
            "name": "Hana",
            "role": "Content Writer",
            "emoji": "✍️",
            "position_x": 200, "position_y": 400,
            "api_model": "llama-3.3-70b-versatile",
            "salary": 6000,
            "mood": "creative"
        },
        {
            "id": "github",
            "name": "Kazu",
            "role": "DevOps/GitHub",
            "emoji": "🐙",
            "position_x": 600, "position_y": 400,
            "api_model": "llama-3.3-70b-versatile",
            "salary": 7000,
            "mood": "focused"
        },
        {
            "id": "techlead",
            "name": "Riku",
            "role": "Tech Lead",
            "emoji": "🎯",
            "position_x": 400, "position_y": 350,
            "api_model": "llama-3.3-70b-versatile",
            "salary": 9000,
            "mood": "analytical"
        }
    ]

    for a in agents:
        existing = c.execute("SELECT id FROM agents WHERE id = ?", (a["id"],)).fetchone()
        if not existing:
            c.execute("""
                INSERT INTO agents (id, name, role, emoji, position_x, position_y,
                    api_model, salary, mood, api_keys, memory)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                a["id"], a["name"], a["role"], a["emoji"],
                a["position_x"], a["position_y"],
                a["api_model"], a["salary"], a["mood"],
                json.dumps([]),  # keys loaded from env
                json.dumps({})
            ))

    conn.commit()
    conn.close()
    print("✅ Database initialized")


def log_action(agent_id: str, action: str, detail: str):
    import uuid
    from datetime import date
    conn = get_db()
    conn.execute(
        "INSERT INTO daily_logs (id, date, agent_id, action, detail) VALUES (?, ?, ?, ?, ?)",
        (str(uuid.uuid4()), date.today().isoformat(), agent_id, action, detail)
    )
    conn.commit()
    conn.close()
    # Also write to file log
    log_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../logs", f"{date.today().isoformat()}.log")
    os.makedirs(os.path.dirname(log_file), exist_ok=True)
    with open(log_file, "a") as f:
        f.write(f"[{datetime.now().isoformat()}] [{agent_id}] {action}: {detail}\n")