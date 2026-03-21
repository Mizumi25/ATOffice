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

    # All 19 agents + techlead
    agents = [
        # Leadership
        {"id":"pm",        "name":"Haruto",  "emoji":"👨‍💼","role":"Chief of Staff / PM",       "salary":9500,"mood":"focused",    "px":400,"py":200},
        {"id":"product",   "name":"Hiro",    "emoji":"📊", "role":"Product Manager",            "salary":9000,"mood":"analytical","px":200,"py":180},
        {"id":"architect", "name":"Masa",    "emoji":"🏗️", "role":"Solutions Architect",        "salary":9500,"mood":"focused",   "px":600,"py":180},
        # Design
        {"id":"designer",  "name":"Yuki",    "emoji":"👩‍🎨","role":"Design Lead",                "salary":8000,"mood":"creative",  "px":150,"py":320},
        {"id":"mobile",    "name":"Reo",     "emoji":"📱", "role":"Mobile Engineer",            "salary":8000,"mood":"focused",   "px":280,"py":320},
        # Frontend
        {"id":"frontend",  "name":"Ren",     "emoji":"👨‍💻","role":"Frontend Engineer",          "salary":8000,"mood":"focused",   "px":520,"py":320},
        {"id":"perf",      "name":"Kai",     "emoji":"⚡", "role":"Web Performance Engineer",   "salary":7500,"mood":"analytical","px":650,"py":320},
        # Backend
        {"id":"backend",   "name":"Sora",    "emoji":"👩‍💻","role":"Backend Engineer",           "salary":8000,"mood":"neutral",   "px":150,"py":460},
        {"id":"platform",  "name":"Kenta",   "emoji":"🔌", "role":"Platform Engineer",          "salary":8500,"mood":"focused",   "px":280,"py":460},
        # Data & AI
        {"id":"data",      "name":"Daisuke", "emoji":"🗄️", "role":"Data Engineer",              "salary":8500,"mood":"analytical","px":400,"py":460},
        {"id":"aiml",      "name":"Kaito",   "emoji":"🤖", "role":"AI/ML Engineer",             "salary":9000,"mood":"creative",  "px":520,"py":460},
        {"id":"analytics", "name":"Aiko",    "emoji":"📈", "role":"Analytics Engineer",         "salary":7500,"mood":"analytical","px":650,"py":460},
        # DevOps / Infra
        {"id":"github",    "name":"Kazu",    "emoji":"🐙", "role":"DevOps / CI-CD",             "salary":7500,"mood":"focused",   "px":150,"py":580},
        {"id":"infra",     "name":"Sota",    "emoji":"☁️", "role":"Cloud / Infrastructure",     "salary":8500,"mood":"focused",   "px":280,"py":580},
        {"id":"security",  "name":"Nao",     "emoji":"🔐", "role":"Security Engineer",          "salary":8000,"mood":"analytical","px":400,"py":580},
        # QA
        {"id":"qa",        "name":"Mei",     "emoji":"🔍", "role":"QA Lead",                   "salary":7000,"mood":"analytical","px":520,"py":580},
        {"id":"sdet",      "name":"Taro",    "emoji":"🧪", "role":"SDET / Automation",          "salary":7500,"mood":"focused",   "px":650,"py":580},
        # Content
        {"id":"blog",      "name":"Hana",    "emoji":"✍️", "role":"Technical Writer",           "salary":6500,"mood":"creative",  "px":340,"py":680},
        {"id":"growth",    "name":"Yuna",    "emoji":"🌱", "role":"Growth / SEO",               "salary":7000,"mood":"creative",  "px":460,"py":680},
        # Tech Lead
        {"id":"techlead",  "name":"Riku",    "emoji":"🎯", "role":"Tech Lead / Architect",      "salary":9500,"mood":"analytical","px":400,"py":350},
        {"id":"mizu",      "name":"Mizu",    "emoji":"🌊", "role":"Staff Integration Engineer",  "salary":11000,"mood":"focused",   "px":400,"py":420},
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