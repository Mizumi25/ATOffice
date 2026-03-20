# ⛩ ATOffice — Art Transcendence AI Office

> A 5-agent autonomous AI startup office with a Japanese pixel art environment.
> One command. Five agents. Real AI. Full roleplay. 🎮

---

## 🏢 What Is This?

ATOffice is a fully autonomous multi-agent AI system that looks like a **GBA Pokémon-style Japanese office**. Give it one high-level command, and watch five AI agents break it down, discuss it, assign subtasks, and execute — all while joking, holding standups, and roleplaying as coworkers.

### The Team

| Sprite | Name | Role | Model | Personality |
|--------|------|------|-------|-------------|
| 👨‍💼 | **Haruto** | Project Manager | Gemini 2.0 Flash | Calm, strategic, uses Japanese phrases |
| 👩‍🎨 | **Yuki** | Designer | Gemini 2.0 Flash | Creative, poetic, Shinkai-inspired |
| 👨‍💻 | **Ren** | Frontend Dev | Gemini 2.0 Flash | Energetic, animation-obsessed |
| 👩‍💻 | **Sora** | Backend Dev | Llama 4 Scout (Groq) | Methodical, green tea drinker |
| 🔍 | **Mei** | QA Engineer | DeepSeek R1 (OpenRouter) | Meticulous, bug hunter |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- Free API keys (see below)

### 1. Get API Keys (all free tier)

| Agent | Service | Get Key At |
|-------|---------|-----------|
| PM + Designer + Frontend | Google Gemini | https://aistudio.google.com/apikey |
| Backend | Groq (Llama 4) | https://console.groq.com |
| QA | OpenRouter (DeepSeek R1) | https://openrouter.ai/keys |

> **Tip:** Create 2-3 Gemini accounts for rotation (free tier = 1500 req/day per key)

### 2. Configure
```bash
cd ATOffice
cp .env.example .env
# Edit .env and add your API keys
nano .env
```

### 3. Start
```bash
chmod +x start.sh
./start.sh
```
Then open `http://localhost:3000` in your browser.

### Termux (Android)
```bash
chmod +x start_termux.sh
./start_termux.sh
```

---

## 📁 Project Structure

```
ATOffice/
│
├── backend/
│   ├── server.py        # FastAPI async server + WebSocket
│   ├── agent.py         # Agent class, API rotation, personality
│   ├── tasks.py         # Task lifecycle management
│   ├── db.py            # SQLite schema + helpers
│   ├── db.sqlite        # Created on first run
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Main app, layout, modals
│   │   ├── components/
│   │   │   ├── PixelOffice.jsx  # Canvas renderer (GBA-style office)
│   │   │   ├── AgentDialogues.jsx # Dialogue bubbles with typewriter
│   │   │   ├── MessageFeed.jsx  # Chat log sidebar
│   │   │   ├── Modals.jsx       # Leaderboard, tasks, agent profile
│   │   │   └── HUD.jsx          # Top bar, notifications
│   │   ├── store/
│   │   │   └── officeStore.js   # Zustand state + WS + API calls
│   │   └── index.css            # Pixel art styles + animations
│   └── package.json
│
├── prompts/
│   └── agent_prompts.md   # System prompts and task flow docs
│
├── logs/                  # Daily action logs (YYYY-MM-DD.log)
├── .env.example
├── start.sh
├── start_termux.sh
└── README.md
```

---

## 🎮 How To Use

### Give a Command
Type in the bottom command bar or click **📡 COMMAND** button:
```
Build a landing page for a Japanese ramen restaurant
```
Haruto (PM) will break it down and assign to the team automatically.

### Chat With Agents
Use the **right panel chat** to talk to the office:
- Select ALL to broadcast
- Click an emoji button to message a specific agent

### Click on Sprites
Click any agent sprite in the office to open their profile modal:
- See their status, salary, productivity points
- Ping them, ask for a joke, pause/resume

### Click the Whiteboard
Click the whiteboard on the wall to open the **Task Board** (kanban view).

### Continue From Yesterday
Click **☀ CONTINUE** to resume where you left off. Agents instantly jump back into their last tasks without re-analyzing.

---

## 💾 Database Schema

```sql
agents       -- id, name, role, status, salary, productivity_points, memory (JSON)
tasks        -- id, title, description, status, assigned_to, priority, output
messages     -- id, sender_id, receiver_id, content, message_type, task_id
meetings     -- id, title, attendees, summary, status
daily_logs   -- id, date, agent_id, action, detail
checkpoints  -- id, date, state (JSON snapshot), pending_tasks
```

---

## 🔁 API Key Rotation

Each agent has a priority-ordered list of API keys:
- If a key hits quota (429), it rotates to the next key automatically
- If ALL keys are exhausted → agent enters **rest mode** (💤)
- Resting agents resume automatically when quota resets (24h)
- PM reassigns their tasks to other available agents

---

## 🌸 Office Features

| Feature | Description |
|---------|-------------|
| **Pixel Art Office** | GBA-style Japanese office drawn entirely in canvas |
| **Dialogue Bubbles** | Typewriter-effect speech bubbles over agent sprites |
| **Status Orbs** | Color-coded status indicators above each agent |
| **Live Clock** | Real clock rendered on the office wall |
| **Lanterns** | Swaying paper lanterns with glow effects |
| **Cherry Blossoms** | Falling petal animations |
| **Whiteboard** | Clickable task board on the wall |
| **Bonsai + Bamboo** | Pixel art plants in the corners |
| **Agent Standups** | Auto team meetings every few minutes |
| **Jokes** | Agents randomly tell programmer jokes |
| **Agent Discussions** | Agents debate topics like "coffee vs tea" |

---

## 💴 Roleplay Features

- **Virtual Salaries**: Each agent earns ¥5,000–¥8,000/month (virtual)
- **Productivity Points**: +5 pts for task acceptance, +20 pts for completion
- **Leaderboard**: Monthly rankings by points, click 🏆 RANKS
- **Best Employee**: Top performer highlighted in gold
- **Memory**: Agents remember what they were doing and resume instantly
- **Checkpoint**: Daily state saved so "continue" works next day

---

## 🔧 Customization

### Add More API Keys
Edit `.env` and add `GEMINI_KEY_4`, `GROQ_KEY_3`, etc. Then update `_load_keys()` in `agent.py`.

### Change Agent Personalities
Edit `AGENT_PERSONALITIES` and `AGENT_SYSTEM_PROMPTS` in `backend/agent.py`.

### Adjust Office Timing
- `OFFICE_TICK_SECONDS=15` — how often random events happen
- Standup every ~5 mins, agent chat every ~1 min

### Add Custom Agent
1. Add row to `agents` table in `db.py`
2. Add personality + system prompt in `agent.py`
3. Add position to `DESK_POSITIONS` in `PixelOffice.jsx`

---

## 🐛 Troubleshooting

**Backend won't start**: `pip install fastapi uvicorn aiohttp`

**No agent responses**: Check `.env` has valid API keys. Demo mode works without keys (canned responses).

**WebSocket not connecting**: Make sure backend is running on port 8000 first.

**Termux CORS issues**: Use `localhost` not `127.0.0.1` in the browser.

---

## 📜 Tech Stack

- **Backend**: Python + FastAPI + aiohttp + SQLite
- **Frontend**: React 18 + Vite + Zustand + Canvas API
- **Styling**: CSS custom properties + DotGothic16 + Press Start 2P fonts
- **AI APIs**: Google Gemini, Groq (Llama 4), OpenRouter (DeepSeek R1)
- **Animations**: CSS animations + requestAnimationFrame canvas loop

---

*Designed with Art Transcendence philosophy: every detail is intentional, every pixel has purpose. 仕事* 🎨
