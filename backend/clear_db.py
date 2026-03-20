#!/usr/bin/env python3
"""Clear ATOffice database - fresh start"""
import sqlite3, os, shutil

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db.sqlite")
WORKSPACE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "workspace")

print("🗑️  Clearing ATOffice database...")

conn = sqlite3.connect(DB)
tables = ["tasks", "messages", "meetings", "daily_logs", "checkpoints"]
for t in tables:
    try:
        count = conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        conn.execute(f"DELETE FROM {t}")
        print(f"  ✓ Cleared {t} ({count} rows)")
    except Exception as e:
        print(f"  ⚠ {t}: {e}")

conn.commit()
conn.close()

# Also clear workspace files
if os.path.exists(WORKSPACE):
    shutil.rmtree(WORKSPACE)
    print(f"  ✓ Cleared workspace/")

# Recreate workspace dirs
for d in ["design", "frontend", "backend", "qa", "shared"]:
    os.makedirs(os.path.join(WORKSPACE, d), exist_ok=True)
print(f"  ✓ Recreated workspace dirs")

print("\n✅ Fresh start! Run ./start.sh to restart ATOffice.")