"""
ATOffice — Database Layer (19 agents)
"""
import sqlite3, os, json
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "db.sqlite")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    conn = get_db(); c = conn.cursor()
    c.executescript("""
    CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        emoji TEXT NOT NULL,
        status TEXT DEFAULT 'idle',
        current_task_id TEXT,
        salary INTEGER DEFAULT 7000,
        productivity_points INTEGER DEFAULT 0,
        api_model TEXT,
        api_keys TEXT,
        current_key_index INTEGER DEFAULT 0,
        quota_reset_time TEXT,
        mood TEXT DEFAULT 'focused',
        memory TEXT DEFAULT '{}',
        position_x INTEGER DEFAULT 0,
        position_y INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        priority TEXT DEFAULT 'medium',
        assigned_to TEXT,
        created_by TEXT,
        parent_task_id TEXT,
        output TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(assigned_to) REFERENCES agents(id)
    );
    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sender_id TEXT,
        receiver_id TEXT,
        content TEXT NOT NULL,
        message_type TEXT DEFAULT 'chat',
        task_id TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS meetings (
        id TEXT PRIMARY KEY,
        title TEXT,
        attendees TEXT,
        summary TEXT,
        status TEXT DEFAULT 'scheduled',
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
        state TEXT,
        pending_tasks TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
    """)

    # 10-agent merged roster
    agents = [
        {"id":"haruto","name":"Haruto","emoji":"👨‍💼","role":"Director / PM + Product",         "salary":11000,"mood":"focused",    "px":400,"py":200},
        {"id":"masa",  "name":"Masa",  "emoji":"🏗️", "role":"Architect + Data",                "salary":11000,"mood":"analytical","px":200,"py":180},
        {"id":"yuki",  "name":"Yuki",  "emoji":"✨",  "role":"Design + Frontend",               "salary":10000,"mood":"creative",  "px":600,"py":180},
        {"id":"ren",   "name":"Ren",   "emoji":"📱",  "role":"Mobile + Performance",            "salary":10000,"mood":"focused",   "px":150,"py":320},
        {"id":"sora",  "name":"Sora",  "emoji":"⚙️", "role":"Backend + Platform",              "salary":10500,"mood":"neutral",   "px":520,"py":320},
        {"id":"kaito", "name":"Kaito", "emoji":"🤖", "role":"AI/ML + Analytics",               "salary":10500,"mood":"creative",  "px":280,"py":320},
        {"id":"kazu",  "name":"Kazu",  "emoji":"🚀", "role":"DevOps + Infrastructure",         "salary":10000,"mood":"focused",   "px":150,"py":460},
        {"id":"nao",   "name":"Nao",   "emoji":"🛡️", "role":"Security + E2E Testing",          "salary":10000,"mood":"analytical","px":400,"py":460},
        {"id":"mei",   "name":"Mei",   "emoji":"🔍", "role":"QA + Docs",                       "salary":9500, "mood":"analytical","px":650,"py":460},
        {"id":"mizu",  "name":"Mizu",  "emoji":"🌊", "role":"Integration + TechLead + Growth", "salary":13000,"mood":"focused",   "px":400,"py":350},
    ]

    for a in agents:
        existing = c.execute("SELECT id FROM agents WHERE id=?", (a["id"],)).fetchone()
        if not existing:
            c.execute("""INSERT INTO agents (id,name,role,emoji,position_x,position_y,api_model,salary,mood,api_keys,memory)
                         VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (a["id"], a["name"], a["role"], a["emoji"],
                 a.get("px",400), a.get("py",400),
                 "llama-3.3-70b-versatile", a["salary"], a["mood"],
                 json.dumps([]), json.dumps({})))

    conn.commit(); conn.close()
    print(f"✅ Database initialized with {len(agents)} agents")


def log_action(agent_id: str, action: str, detail: str):
    import uuid
    from datetime import date
    conn = get_db()
    conn.execute("INSERT INTO daily_logs (id,date,agent_id,action,detail) VALUES (?,?,?,?,?)",
                 (str(uuid.uuid4()), date.today().isoformat(), agent_id, action, detail))
    conn.commit(); conn.close()
    log_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../logs", f"{date.today().isoformat()}.log")
    os.makedirs(os.path.dirname(log_file), exist_ok=True)
    with open(log_file, "a") as f:
        f.write(f"[{datetime.now().isoformat()}] [{agent_id}] {action}: {detail}\n")