#!/usr/bin/env python3
"""
ATOffice — Database Reset Script
Run this when:
  - Agents show "stuck 480min" warnings
  - Tasks from old sessions are blocking new ones
  - You want a completely fresh start

Usage:
  python3 clear_db.py         # reset tasks + messages, keep agents
  python3 clear_db.py --full  # nuke everything including agents (full reseed)
"""
import sys, os, sqlite3

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'db.sqlite')

if not os.path.exists(DB):
    print("No db.sqlite found — nothing to reset")
    sys.exit(0)

full = '--full' in sys.argv

conn = sqlite3.connect(DB)
if full:
    conn.executescript("""
        DELETE FROM tasks;
        DELETE FROM messages;
        DELETE FROM agents;
        DELETE FROM meetings;
        DELETE FROM daily_logs;
        DELETE FROM checkpoints;
    """)
    print("✅ Full reset — database cleared (agents will reseed on restart)")
else:
    conn.executescript("""
        DELETE FROM tasks;
        DELETE FROM messages;
        DELETE FROM meetings;
        DELETE FROM checkpoints;
        UPDATE agents SET status='idle', current_task_id=NULL,
               quota_reset_time=NULL, updated_at=datetime('now');
    """)
    print("✅ Soft reset — tasks + messages cleared, agents kept + set to idle")

conn.commit()
conn.close()

# Also clear workspace projects
workspace = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'workspace', 'projects')
if os.path.exists(workspace) and '--full' in sys.argv:
    import shutil
    shutil.rmtree(workspace)
    os.makedirs(workspace)
    print("✅ Workspace projects cleared")

print("\nRestart the server now: python3 server.py")