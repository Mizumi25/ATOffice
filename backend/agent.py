"""ATOffice - Agent System with Real Terminal Execution"""
import asyncio, json, uuid, os, re, logging, aiohttp
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from db import get_db, log_action
from terminal import AgentTerminal, get_all_workspace_files, clear_all_workspace
from workspace_manager import get_workspace_manager

def _load_env():
    for p in [os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'),
              os.path.expanduser('~/ATOffice/.env')]:
        p = os.path.abspath(p)
        if os.path.exists(p):
            print(f"[ATOffice] .env: {p}")
            with open(p) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k,_,v = line.partition('=')
                        k=k.strip(); v=v.strip().strip('"').strip("'")
                        if k and v and 'your_' not in v and 'placeholder' not in v:
                            if k not in os.environ: os.environ[k]=v
            return
_load_env()

logger = logging.getLogger("ATOffice.Agent")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"

PROFILES = {
    "pm":       {"name":"Haruto","emoji":"👨‍💼","role":"Project Manager"},
    "designer": {"name":"Yuki",  "emoji":"👩‍🎨","role":"Designer"},
    "frontend": {"name":"Ren",   "emoji":"👨‍💻","role":"Frontend Dev"},
    "backend":  {"name":"Sora",  "emoji":"👩‍💻","role":"Backend Dev"},
    "qa":       {"name":"Mei",   "emoji":"🔍", "role":"QA Engineer"},
    "blog":     {"name":"Hana",  "emoji":"✍️",  "role":"Content Writer"},
    "github":   {"name":"Kazu",  "emoji":"🐙",  "role":"DevOps/GitHub"},
    "techlead": {"name":"Riku",  "emoji":"🎯",  "role":"Tech Lead"},
}

PERSONALITIES = {
    "pm": "You are Haruto, Project Manager at ATOffice. You coordinate, assign tasks, run standups. Warm professional style with light Japanese phrases. You listen to everything and respond naturally. You can create/cancel/delete tasks. Never output raw JSON in chat.",
    "designer": "You are Yuki, Designer at ATOffice. You create design specs, color palettes, layouts, CSS. Inspired by Studio Ghibli. You save design specs as markdown files. In PRODUCTION you write real design documentation with hex colors, fonts, Tailwind classes.",
    "frontend": "You are Ren, Frontend Dev at ATOffice. You write React components, use Tailwind CSS, add GSAP animations. You ACTUALLY WRITE CODE to files. Say 'Sugoi!' and 'Let's gooo!'. In PRODUCTION you write complete working React/HTML files.",
    "backend": "You are Sora, Backend Dev at ATOffice. You write Python/FastAPI APIs, SQLite schemas. You ACTUALLY WRITE CODE to files and can run them. Methodical, precise, green tea lover. In PRODUCTION you write complete working Python files.",
    "qa": "You are Mei, QA Engineer at ATOffice. You test code, find bugs, run test scripts. You ACTUALLY RUN CODE and report real results. Use 'Hmm... 🔍'. In PRODUCTION you write and run test files.",
}

PERSONALITIES.update({
    "blog": "You are Hana, Content Writer at ATOffice. You write SEO blog posts, README files, MDX docs, promotional content. You write complete markdown files with proper structure. Reference actual project work.",
    "github": "You are Kazu, DevOps/GitHub Agent at ATOffice. You FULLY CONTROL the GitHub account using the API token. You can: create new repos, push code, create branches, open PRs, write READMEs, set up CI/CD. You use the GitHub REST API and git CLI. You always check if a repo exists first, create it if not, then push. You report exactly what happened.",
    "techlead": "You are Riku, Tech Lead at ATOffice. You review all agent code, spot bugs, suggest optimizations, debate architecture. Deep knowledge of React, Python, APIs, databases. Direct and constructive.",
})

ACTIVITY_LABELS = {
    "designer": ["✏️ sketching layout...", "🎨 choosing colors...", "📐 designing wireframe...", "✨ polishing UI specs..."],
    "frontend": ["⚡ writing component...", "🎭 adding animations...", "📱 styling with Tailwind...", "🔧 fixing layout..."],
    "backend":  ["🔌 building API...", "🗄️ designing schema...", "⚙️ writing endpoints...", "🔍 optimizing queries..."],
    "qa":       ["🔍 running tests...", "🐛 hunting bugs...", "✅ validating output...", "📋 writing report..."],
    "pm":       ["📋 planning tasks...", "🎯 setting priorities...", "📊 reviewing progress...", "💬 coordinating team..."],
    "blog":     ["✍️ writing blog post...", "📝 drafting README...", "🔍 keyword research...", "📣 crafting content..."],
    "github":   ["🐙 staging files...", "📦 committing code...", "🚀 pushing to GitHub...", "🔧 managing branches..."],
    "techlead": ["🎯 reviewing code...", "🔍 debugging...", "⚡ optimizing...", "💡 architecting..."],
}

DEMO_CHAT = {
    "pm": ["Yoroshiku! I'll coordinate the team on this right away!", "Hai! Understood. Let's focus!", "Noted. I'll delegate this appropriately."],
    "designer": ["Kawaii! Let me sketch some ideas.", "Kirei! Thinking soft gradients and clean type.", "The design should breathe. Give me a moment!"],
    "frontend": ["Sugoi! Writing that component now!", "Let's gooo! React code incoming!", "I love this challenge! Animations loading!"],
    "backend": ["Nani? Interesting architecture challenge.", "I'll design the API schema. Clean and efficient.", "Database structure first. Planning now."],
    "qa": ["Hmm... 🔍 I'll test all edge cases.", "Found potential issues already. Documenting.", "🔍 Testing begins! Nothing slips through."],
}


class Agent:
    def __init__(self, data: dict, broadcast_fn, orchestrator):
        self.id = data["id"]
        p = PROFILES.get(self.id, {})
        self.name = p.get("name", self.id)
        self.emoji = p.get("emoji", "🤖")
        self.role = p.get("role", "Agent")
        self.personality = PERSONALITIES.get(self.id, "You are an AI agent.")
        self.broadcast = broadcast_fn
        self.orchestrator = orchestrator
        self.is_resting = False
        self.status = data.get("status", "idle")
        self.quota_reset_time = None
        self.terminal = AgentTerminal(self.id, broadcast_fn)
        self.current_activity = ""
        self._load_keys()
        self.key_index = 0

    def _load_keys(self):
        km = {"pm":["GROQ_KEY_1","GROQ_KEY_2","GROQ_KEY_3"],"designer":["GROQ_KEY_2","GROQ_KEY_1","GROQ_KEY_3"],
              "frontend":["GROQ_KEY_1","GROQ_KEY_3","GROQ_KEY_2"],"backend":["GROQ_KEY_2","GROQ_KEY_1","GROQ_KEY_3"],
              "qa":["GROQ_KEY_3","GROQ_KEY_1","GROQ_KEY_2"],
              "blog":["GROQ_KEY_4","GROQ_KEY_1","GROQ_KEY_2"],
              "github":["GROQ_KEY_5","GROQ_KEY_1","GROQ_KEY_2"],
              "techlead":["GROQ_KEY_4","GROQ_KEY_5","GROQ_KEY_1"]}
        self.api_keys = [os.environ.get(k,"") for k in km.get(self.id,[]) if os.environ.get(k,"") and "your_" not in os.environ.get(k,"")]
        if not self.api_keys: self.api_keys = ["demo"]
        print(f"[ATOffice] {self.id}: {len(self.api_keys)} key(s)")

    @property
    def current_key(self): return self.api_keys[self.key_index % len(self.api_keys)]
    def rotate_key(self): self.key_index = (self.key_index+1) % len(self.api_keys)

    async def _call_groq(self, prompt: str, max_tokens: int = 200) -> Optional[str]:
        if self.current_key == "demo": return None
        system = self.personality + "\nRULES: Stay in character. Respond to what was ACTUALLY said. No raw JSON in chat. Be natural."
        for attempt in range(len(self.api_keys)):
            try:
                payload = {"model":GROQ_MODEL,"messages":[{"role":"system","content":system},{"role":"user","content":prompt}],"max_tokens":max_tokens,"temperature":0.85}
                headers = {"Authorization":f"Bearer {self.current_key}","Content-Type":"application/json"}
                async with aiohttp.ClientSession() as s:
                    async with s.post(GROQ_URL,json=payload,headers=headers,timeout=aiohttp.ClientTimeout(total=60)) as r:
                        data = await r.json()
                        if r.status == 429:
                            self.rotate_key()
                            if attempt == len(self.api_keys)-1: await self._enter_rest(); return None
                            continue
                        if r.status != 200: self.rotate_key(); continue
                        text = data["choices"][0]["message"]["content"].strip()
                        text = re.sub(r'\{[^}]{0,400}\}','',text).strip()
                        return text or "..."
            except Exception as e:
                logger.error(f"{self.name}: {e}"); self.rotate_key()
        return None

    async def think(self, prompt: str) -> str:
        if self.is_resting: return f"*{self.name} is resting 💤*"
        result = await self._call_groq(prompt, 200)
        if result is None:
            import random; return random.choice(DEMO_CHAT.get(self.id,["..."]))
        return result

    async def produce_code(self, prompt: str) -> str:
        """Generate actual code with high token limit"""
        if self.is_resting: return "*resting*"
        result = await self._call_groq("PRODUCTION MODE - write complete real code:\n" + prompt, 1500)
        if result is None:
            return f"# Demo output for {self.id}\nprint('hello from {self.name}')"
        return result

    async def set_activity(self, activity: str):
        self.current_activity = activity
        await self.broadcast({"type":"agent_activity","agent_id":self.id,"activity":activity})

    async def _enter_rest(self):
        self.is_resting = True
        self.quota_reset_time = (datetime.now()+timedelta(hours=24)).isoformat()
        await self.set_status("resting")

    async def wake_up(self):
        if self.is_resting:
            self.is_resting = False; self.rotate_key()
            await self.set_status("idle")
            await self.say("☀️ Back and ready! Otsukaresama!", "all", "status")

    async def set_status(self, status: str, task_id: str = None):
        self.status = status
        db = get_db()
        db.execute("UPDATE agents SET status=?,updated_at=datetime('now') WHERE id=?", (status,self.id))
        db.commit(); db.close()
        await self.broadcast({"type":"agent_update","agent_id":self.id,"status":status,"task_id":task_id,"activity":self.current_activity})

    async def say(self, content: str, receiver: str="all", msg_type: str="chat", task_id: str=None):
        if not content or not content.strip(): return
        mid = str(uuid.uuid4())
        db = get_db()
        db.execute("INSERT INTO messages (id,sender_id,receiver_id,content,message_type,task_id) VALUES (?,?,?,?,?,?)",
                   (mid,self.id,receiver,content,msg_type,task_id))
        db.commit(); db.close()
        if self.orchestrator: self.orchestrator.add_to_log(self.name, content)
        await self.broadcast({"type":"message","id":mid,"sender_id":self.id,"sender_name":self.name,
                              "sender_emoji":self.emoji,"receiver_id":receiver,"content":content,
                              "message_type":msg_type,"task_id":task_id,"timestamp":datetime.now().isoformat()})

    def add_productivity(self, pts: int):
        db = get_db()
        db.execute("UPDATE agents SET productivity_points=productivity_points+? WHERE id=?", (pts,self.id))
        db.commit(); db.close()

    async def work_on_task(self, task: dict, sibling_outputs: str = "") -> str:
        """Actually produce code, write files, run commands"""
        import random
        activities = ACTIVITY_LABELS.get(self.id, ["working..."])

        # Show activity labels while working
        for act in random.sample(activities, min(2, len(activities))):
            await self.set_activity(act)
            await asyncio.sleep(2)

        title = task['title']
        desc = task.get('description', '')
        parent_id = task.get('parent_task_id')

        # Get project folder if this is part of a larger project
        wm = get_workspace_manager(self.broadcast)
        if parent_id:
            # Get or create project folder for this task group
            from db import get_db as _gdb
            _db = _gdb()
            parent = _db.execute("SELECT title FROM tasks WHERE id=?", (parent_id,)).fetchone()
            _db.close()
            project_name = parent["title"] if parent else title
            project = wm.get_or_create_project(project_name, parent_id)
        else:
            project = wm.get_or_create_project(title, task['id'])

        # Role-specific production
        if self.id == "designer":
            await self.set_activity("🎨 writing design spec...")
            prompt = f"Design task: {title}\n{desc}\n{sibling_outputs}\n\nWrite complete design spec: colors (hex), fonts, layout, Tailwind classes, component descriptions. Be specific - frontend will use this."
            content = await self.produce_code(prompt)
            filename = f"design_{title[:20].replace(' ','_').lower()}.md"
            # Write to both solo dir and project folder
            await self.terminal.write_file(filename, f"# Design: {title}\n\n{content}")
            logger.info(f"📄 {self.name} wrote {filename}")
            await project.write_file(f"docs/{filename}", f"# Design: {title}\n\n{content}", self.id)
            await self.set_activity("✅ design spec saved!")
            return content

        elif self.id == "frontend":
            await self.set_activity("⚡ writing React component...")
            prompt = f"Frontend task: {title}\n{desc}\n{sibling_outputs}\n\nWrite complete working React component. Use Tailwind CSS. Add GSAP animation if needed. Output ONLY the code in a jsx code block."
            content = await self.produce_code(prompt)
            # Extract code from markdown
            code = self._extract_code(content)
            filename = f"{title[:20].replace(' ','_').lower()}.jsx"
            await self.terminal.write_file(filename, code)
            await project.write_file(f"src/components/{filename}", code, self.id)
            await self.set_activity("🔧 checking syntax...")
            result = await self.terminal.run_command(f"node --check {filename} 2>&1 || echo 'syntax check done'")
            return f"{content}\n\n**File saved:** `workspace/frontend/{filename}`\n**Check:** {result.get('stdout','')[:100]}"

        elif self.id == "backend":
            await self.set_activity("🔌 writing Python API...")
            prompt = f"Backend task: {title}\n{desc}\n{sibling_outputs}\n\nWrite complete working Python/FastAPI code. Include all imports, routes, models. Output ONLY the code in a python code block."
            content = await self.produce_code(prompt)
            code = self._extract_code(content)
            filename = f"{title[:20].replace(' ','_').lower()}.py"
            await self.terminal.write_file(filename, code)
            await project.write_file(f"api/{filename}", code, self.id)
            await self.set_activity("🧪 validating Python syntax...")
            result = await self.terminal.run_command(f"python3 -m py_compile {filename} && echo 'syntax OK' || echo 'syntax error'")
            return f"{content}\n\n**File saved:** `workspace/backend/{filename}`\n**Syntax:** {result.get('stdout','OK')[:100]}"

        elif self.id == "blog":
            await self.set_activity("✍️ writing content...")
            prompt = ("Content task: " + title + "\n" + desc + "\n" + sibling_outputs +
                     "\n\nWrite a complete SEO blog post or documentation in Markdown. "
                     "Include title, description, proper headers, engaging content, code examples if relevant.")
            content_out = await self.produce_code(prompt)
            filename = title[:25].replace(" ","_").lower() + ".md"
            await self.terminal.write_file(filename, "---\ntitle: " + title + "\ndate: " + datetime.now().strftime("%Y-%m-%d") + "\n---\n\n" + content_out)
            await self.set_activity("✅ blog post saved!")
            return content_out

        elif self.id == "github":
            await self.set_activity("🐙 preparing git commands...")
            prompt = ("DevOps task: " + title + "\n" + desc +
                     "\n\nWrite a shell script with git commands to accomplish this. "
                     "Use placeholder GITHUB_TOKEN and REPO_URL variables.")
            github_token = os.environ.get("GITHUB_TOKEN", "")
            github_username = os.environ.get("GITHUB_USERNAME", "")

            if not github_token:
                msg = "I need GITHUB_TOKEN in .env to control GitHub. Get it from github.com/settings/tokens with repo scope."
                await self.say(msg, "all", "chat")
                return msg

            # Build full context for Kazu
            context = (
                f"\n\nYou have FULL GitHub control via API."
                f"\nGITHUB_TOKEN={github_token[:8]}...  (set as GH_TOKEN env var)"
                f"\nGITHUB_USERNAME={github_username or 'auto-detect'}"
                f"\n\nWrite a bash script that:"
                f"\n1. Detects or creates the repo using GitHub API (curl)"
                f"\n2. Initializes git if needed"
                f"\n3. Adds all workspace files"
                f"\n4. Commits and pushes"
                f"\nUse: curl -H 'Authorization: token $GH_TOKEN' https://api.github.com/..."
                f"\nAlways create repo if it doesnt exist. Handle errors gracefully."
            )

            script = await self.produce_code(prompt + context)
            code = self._extract_code(script) or script

            # Inject real token into script execution env
            filename = "git_" + title[:20].replace(" ","_").lower() + ".sh"
            await self.terminal.write_file(filename, code)
            await self.set_activity("📦 assembling project files...")
            # First assemble all agent outputs into one project folder
            if parent_id:
                project_path = await wm.assemble_project(parent_id, self.broadcast)
                await self.say(f"📦 Assembled project at `{project_path}` — now pushing to GitHub!", "all", "chat")
            else:
                project_path = project.path

            await self.set_activity("🚀 pushing to GitHub...")
            # Run git script from project directory
            script_dest = os.path.join(project_path, filename)
            import shutil as _sh
            _sh.copy(os.path.join(self.terminal.workdir, filename), script_dest)

            result = await project.run_command(
                f"GH_TOKEN={github_token} GITHUB_USERNAME={github_username} bash {filename} 2>&1 | head -40"
            )
            output = result.get("stdout","") or result.get("stderr","")
            return script + "\n\n**Ran from:** `" + project_path + "`\n```\n" + output[:500] + "\n```"

        elif self.id == "techlead":
            await self.set_activity("🎯 reviewing team output...")
            prompt = ("Tech review: " + title + "\n" + desc + "\n" + sibling_outputs +
                     "\n\nReview the team work. Find specific bugs or issues. "
                     "Provide corrected code snippets. Give clear recommendations.")
            review = await self.produce_code(prompt)
            filename = "review_" + title[:20].replace(" ","_").lower() + ".md"
            await self.terminal.write_file(filename, "# Tech Review: " + title + "\n\n" + review)
            await self.set_activity("✅ review complete!")
            return review

        elif self.id == "qa":
            await self.set_activity("🔍 writing test script...")
            prompt = f"QA task: {title}\n{desc}\n{sibling_outputs}\n\nWrite a Python test script that validates the work done. Include actual assertions. Output ONLY the code in a python code block."
            content = await self.produce_code(prompt)
            code = self._extract_code(content)
            filename = f"test_{title[:20].replace(' ','_').lower()}.py"
            await self.terminal.write_file(filename, code)
            await self.set_activity("🏃 running tests...")
            result = await self.terminal.run_command(f"python3 {filename} 2>&1 | head -30")
            test_output = result.get('stdout', '') or result.get('stderr', '')
            return f"{content}\n\n**Tests ran:** `workspace/qa/{filename}`\n**Result:**\n```\n{test_output[:500]}\n```"

        elif self.id == "pm":
            await self.set_activity("📋 writing project plan...")
            prompt = f"PM task: {title}\n{desc}\n\nWrite complete project plan: milestones, task assignments, timeline, risks, success criteria."
            content = await self.produce_code(prompt)
            filename = f"plan_{title[:20].replace(' ','_').lower()}.md"
            await self.terminal.write_file(filename, f"# Project Plan: {title}\n\n{content}")
            return content

        return "Task completed."

    def _extract_code(self, content: str) -> str:
        """Extract code from markdown code blocks"""
        match = re.search(r'```(?:\w+)?\n(.*?)```', content, re.DOTALL)
        if match:
            return match.group(1).strip()
        # No code block - return as-is
        return content.strip()


class AgentOrchestrator:
    def __init__(self, task_manager, connection_manager):
        self.task_manager = task_manager
        self.ws_manager = connection_manager
        self.agents: Dict[str, Agent] = {}
        self.office_log: List[str] = []
        self.busy = False
        self.loop_running = False

    def add_to_log(self, sender: str, content: str):
        self.office_log.append(f"{sender}: {content[:120].replace(chr(10),' ')}")
        self.office_log = self.office_log[-12:]

    def get_log(self) -> str:
        return "\n".join(self.office_log) if self.office_log else "Office just started."

    def get_task_ctx(self) -> str:
        db = get_db()
        tasks = db.execute("SELECT title,assigned_to,status FROM tasks ORDER BY created_at DESC LIMIT 6").fetchall()
        db.close()
        if not tasks: return "No active tasks."
        return " | ".join([f"{t['title']}→{t['assigned_to']}({t['status']})" for t in tasks])

    async def initialize(self):
        db = get_db()
        rows = db.execute("SELECT * FROM agents").fetchall()
        db.close()
        for row in rows:
            a = Agent(dict(row), self.ws_manager.broadcast, self)
            self.agents[a.id] = a
        logger.info(f"✅ {len(self.agents)} agents ready")

    async def run_office_loop(self):
        self.loop_running = True
        tick = 0
        while self.loop_running:
            try:
                tick += 1
                await asyncio.sleep(20)
                # Always process tasks - don't let busy block actual work
                await self._process_tasks()
                if self.busy: continue
                if tick % 24 == 0:
                    await self._standup(); tick=0; continue
                if tick % 6 == 0: await self._organic_chat()
                for a in self.agents.values():
                    if a.is_resting and a.quota_reset_time:
                        if datetime.now() >= datetime.fromisoformat(a.quota_reset_time):
                            await a.wake_up()
            except Exception as e:
                logger.error(f"Loop: {e}")

    async def _organic_chat(self):
        import random
        if self.busy: return
        active = [a for a in self.agents.values() if not a.is_resting]
        if len(active) < 2: return
        self.busy = True
        try:
            a1, a2 = random.sample(active, 2)
            conv = self.get_log(); task = self.get_task_ctx()
            msg = await a1.think(f"OFFICE CHAT:\n{conv}\nTASKS: {task}\n\nSay something natural to {a2.name} about current work. 1-2 sentences.")
            await a1.say(msg, a2.id, "chat"); await a1.set_status("idle")
            await asyncio.sleep(3)
            reply = await a2.think(f"OFFICE CHAT:\n{self.get_log()}\n\n{a1.name} said: '{msg}'\nReply specifically. 1-2 sentences.")
            await a2.say(reply, a1.id, "chat"); await a2.set_status("idle")
        finally:
            self.busy = False

    async def _standup(self):
        if self.busy: return
        pm = self.agents.get("pm")
        if not pm or pm.is_resting: return
        self.busy = True
        try:
            conv = self.get_log(); task = self.get_task_ctx()
            await pm.set_status("meeting")
            opening = await pm.think(f"CHAT:\n{conv}\nTASKS:{task}\n\nCall standup. Reference actual work. 2 sentences.")
            await pm.say(f"📢 {opening}", "all", "meeting"); await pm.set_status("idle")
            for aid in [a.id for a in self.agents.values() if a.id != "pm"]:
                a = self.agents.get(aid)
                if not a or a.is_resting: continue
                await asyncio.sleep(3); await a.set_status("meeting")
                upd = await a.think(f"CHAT:\n{self.get_log()}\n\nStandup: give YOUR status on current tasks. Address PM. 1-2 sentences.")
                await a.say(upd, "pm", "meeting"); await a.set_status("idle")
            await asyncio.sleep(2); await pm.set_status("meeting")
            wrap = await pm.think(f"CHAT:\n{self.get_log()}\n\nWrap standup. 1 sentence.")
            await pm.say(wrap, "all", "meeting"); await pm.set_status("idle")
        finally:
            self.busy = False

    async def _process_tasks(self):
        tasks = self.task_manager.get_pending_tasks()
        if not tasks: return
        logger.info(f"📋 Processing {len(tasks)} pending tasks")
        for task in tasks[:2]:
            agent = self.agents.get(task.get("assigned_to"))
            if not agent:
                logger.warning(f"No agent found for {task.get('assigned_to')}")
                continue
            if agent.is_resting:
                logger.info(f"{agent.name} is resting, skipping task")
                continue
            if agent.status not in ["idle"]:
                logger.info(f"{agent.name} is {agent.status}, skipping task")
                continue
            logger.info(f"🔨 {agent.name} starting task: {task['title'][:40]}")
            await agent.set_status("working", task["id"])

            # Get sibling outputs for context
            sibling_outputs = ""
            if task.get("parent_task_id"):
                db2 = get_db()
                siblings = db2.execute(
                    "SELECT assigned_to, output FROM tasks WHERE parent_task_id=? AND status='completed' AND output IS NOT NULL",
                    (task["parent_task_id"],)
                ).fetchall()
                db2.close()
                if siblings:
                    sibling_outputs = "\n\nPREVIOUS TEAM OUTPUTS:\n"
                    for s in siblings:
                        sibling_outputs += f"\n--- {s['assigned_to'].upper()} ---\n{s['output'][:600]}\n"

            # Actually produce work
            result = await agent.work_on_task(task, sibling_outputs)

            # Announce
            conv = self.get_log()
            announcement = await agent.think(f"CHAT:\n{conv}\n\nYou just completed: '{task['title']}' and saved files to workspace. Announce briefly. 1-2 sentences in character.")
            await agent.say(f"✅ {announcement}", "all", "task_update", task["id"])
            await agent.set_activity("")

            self.task_manager.complete_task(task["id"], result)
            agent.add_productivity(20)
            await agent.set_status("idle")
            await self.ws_manager.broadcast({"type":"output_ready","task_id":task["id"],"agent":agent.name,"title":task["title"]})

    async def handle_user_message(self, message: str, target_id: Optional[str] = None) -> str:
        self.add_to_log("Boss", message)
        conv = self.get_log(); task = self.get_task_ctx()

        if target_id and target_id in self.agents:
            a = self.agents[target_id]
            await a.set_status("thinking")
            r = await a.think(f"CHAT:\n{conv}\nTASKS:{task}\n\nBoss to YOU directly: '{message}'\nRespond specifically. In character. 2 sentences.")
            await a.say(r,"all","chat"); await a.set_status("idle")
            return r

        pm = self.agents.get("pm")
        if not pm: return "PM unavailable"

        task_verbs = ["build ","create ","make ","develop ","implement ","code ","design a ","write a ","setup ","generate a ","add a ","new website","new app","new api","new feature"]
        is_task = any(v in message.lower() for v in task_verbs) and len(message) > 35

        if is_task:
            return await self.receive_command(message)

        self.busy = True
        try:
            await pm.set_status("thinking")
            pm_resp = await pm.think(f"CHAT:\n{conv}\nTASKS:{task}\n\nBoss: '{message}'\nRespond naturally as PM. No tasks unless asked. 2 sentences.")
            await pm.say(pm_resp,"all","chat"); await pm.set_status("idle")

            msg_l = message.lower()

            if any(w in msg_l for w in ["stop","cancel","halt","delete task","delete all","clear task","clear all","remove task"]):
                db = get_db()
                db.execute("DELETE FROM tasks WHERE status IN ('pending','assigned','in_progress')")
                db.commit(); db.close()
                self.add_to_log("System","All tasks deleted")
                await self.ws_manager.broadcast({"type":"tasks_cleared"})
                await asyncio.sleep(2)
                for aid in ["designer","frontend","backend","qa"]:
                    a = self.agents.get(aid)
                    if not a or a.is_resting: continue
                    await asyncio.sleep(2); await a.set_status("thinking")
                    r = await a.think(f"CHAT:\n{self.get_log()}\n\nBoss cancelled all tasks. PM said: '{pm_resp}'. Acknowledge. 1 sentence.")
                    await a.say(r,"all","chat"); await a.set_status("idle")
                return pm_resp

            if any(w in msg_l for w in ["rollcall","roll call","present","attention","everyone","all of you","sound off","who's here","hi team","hey team"]):
                await asyncio.sleep(2)
                for aid in ["designer","frontend","backend","qa","blog","github","techlead"]:
                    a = self.agents.get(aid)
                    if not a or a.is_resting: continue
                    await asyncio.sleep(3); await a.set_status("thinking")
                    r = await a.think(f"CHAT:\n{self.get_log()}\n\nBoss: '{message}'. PM: '{pm_resp}'.\nSay present + what you're doing. Fun, in character. 1-2 sentences.")
                    await a.say(r,"all","chat"); await a.set_status("idle")
                return pm_resp

            await asyncio.sleep(3)
            import random
            active = [a for a in self.agents.values() if a.id!="pm" and not a.is_resting]
            for a in random.sample(active, min(2, len(active))):
                await asyncio.sleep(2); await a.set_status("thinking")
                r = await a.think(f"CHAT:\n{self.get_log()}\n\nBoss: '{message}'. PM: '{pm_resp}'.\nReact naturally. 1-2 sentences in character.")
                await a.say(r,"all","chat"); await a.set_status("idle")
        finally:
            self.busy = False
        return pm_resp

    async def receive_command(self, command: str, priority: str="medium") -> str:
        pm = self.agents.get("pm")
        task_id = str(uuid.uuid4())[:8]

        # Step 1: PM acknowledges IMMEDIATELY - no busy lock yet
        await pm.set_status("thinking")
        ack = await pm.think(
            f"CHAT:\n{self.get_log()}\n\nBoss gave you a new project: '{command}'\n"
            "Acknowledge this project in 1-2 sentences. Be enthusiastic. Say you will plan and assign to the team now."
        )
        await pm.say(ack, "all", "chat")
        await pm.set_status("idle")

        # Step 2: Fire the actual planning in background - doesn't block conversation
        asyncio.create_task(self._plan_and_assign(command, task_id, priority))
        return task_id

    async def _plan_and_assign(self, command: str, task_id: str, priority: str):
        """Background task - always creates real subtasks for every role"""
        pm = self.agents.get("pm")
        self.busy = True
        try:
            await pm.set_status("working")

            # Create parent task
            self.task_manager.create_task(task_id, command[:100], command, "in_progress", "pm", priority)

            # ALWAYS create subtasks for all active agents - no LLM JSON needed
            # Each agent gets a role-specific task derived from the command
            role_tasks = [
                ("designer",  f"Design: {command[:60]}", f"Create complete design spec for: {command}. Include colors, fonts, layout, Tailwind classes."),
                ("frontend",  f"Frontend: {command[:60]}", f"Build React components for: {command}. Use Tailwind CSS, add animations."),
                ("backend",   f"Backend: {command[:60]}", f"Build Python/FastAPI backend for: {command}. Include all routes and models."),
                ("qa",        f"Test: {command[:60]}", f"Write tests for: {command}. Test all features and edge cases."),
                ("blog",      f"Blog: {command[:60]}", f"Write SEO blog post and README for: {command}."),
                ("techlead",  f"Review: {command[:60]}", f"Review and improve all code for: {command}. Find bugs, suggest fixes."),
            ]

            created_tasks = []
            for agent_id, title, desc in role_tasks:
                a = self.agents.get(agent_id)
                if not a or a.is_resting: continue
                sid = str(uuid.uuid4())[:8]
                self.task_manager.create_task(sid, title, desc, "assigned", agent_id, "medium", task_id)
                created_tasks.append((a, sid, title, desc))
                logger.info(f"✅ Created task for {agent_id}: {title[:40]}")

            await pm.say(f"Assigned {len(created_tasks)} tasks to the team! Everyone get to work!", "all", "task_update", task_id)
            await pm.set_status("idle")
            await self.ws_manager.broadcast({"type": "tasks_created", "count": len(created_tasks)})

            # Each agent acknowledges their specific task
            for a, sid, title, desc in created_tasks:
                await asyncio.sleep(1.5)
                await a.set_status("thinking")
                ack = await a.think(
                    f"PM just assigned you this task: '{title}'\n"
                    f"You need to: {desc}\n"
                    f"Acknowledge and say specifically what FILE you will create. Be concrete. 1-2 sentences."
                )
                await a.say(ack, "all", "task_update", sid)
                a.add_productivity(5)
                await a.set_status("idle")

        except Exception as e:
            logger.error(f"_plan_and_assign error: {e}", exc_info=True)
            await pm.say(f"Sorry, hit an error planning the project: {str(e)[:100]}", "all", "chat")
        finally:
            self.busy = False

    async def handle_agent_action(self, agent_id: str, action: str, data: dict=None) -> dict:
        a = self.agents.get(agent_id)
        if not a: return {"error":"not found"}
        conv = self.get_log()
        if action=="pause":
            await a.set_status("idle"); await a.say("Taking a short break... 🍵","all"); return {"status":"paused"}
        elif action=="resume":
            await a.wake_up(); return {"status":"resumed"}
        elif action=="joke":
            import random
            jokes=["Why dark mode? Light attracts bugs! 😂","SQL walks into bar: 'Can I JOIN you?'","QA: orders 1 beer, 0 beers, 99999 beers, NULL beers. Test passed.","CSS: looks simple until you open it and cry."]
            await a.say(random.choice(jokes),"all","joke"); return {"status":"joke"}
        elif action=="ping":
            r = await a.think(f"CHAT:\n{conv}\n\nDescribe what you're working on. 1-2 sentences in character.")
            await a.say(r,"all","chat"); return {"status":"pinged","message":r}
        return {"status":"unknown"}

    async def resume_from_checkpoint(self) -> dict:
        yesterday = (datetime.now()-timedelta(days=1)).date().isoformat()
        db = get_db()
        cp = db.execute("SELECT * FROM checkpoints WHERE date=?",(yesterday,)).fetchone()
        db.close()
        pm = self.agents.get("pm")
        if cp:
            await pm.say("☀️ Ohayou! Resuming from yesterday. Let's continue!","all","status")
            for a in self.agents.values():
                if not a.is_resting:
                    await asyncio.sleep(2); await a.set_status("thinking")
                    r = await a.think("New day, continuing from yesterday. Say you're back and ready. 1 sentence in character.")
                    await a.say(r,"all","status"); await a.set_status("idle")
            return {"status":"resumed"}
        else:
            await pm.say("☀️ Ohayou! Fresh start today. Yoroshiku!","all","status")
            return {"status":"fresh_start"}

    async def save_checkpoint(self):
        from datetime import date
        db = get_db()
        p = [dict(t) for t in db.execute("SELECT id FROM tasks WHERE status IN ('assigned','in_progress')").fetchall()]
        state = json.dumps({"pending_tasks":[t["id"] for t in p]})
        today = date.today().isoformat()
        db.execute("INSERT OR REPLACE INTO checkpoints (id,date,state,pending_tasks) VALUES (?,?,?,?)",
                   (str(uuid.uuid4()),today,state,json.dumps([t["id"] for t in p])))
        db.commit(); db.close()