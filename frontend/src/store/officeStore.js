/**
 * officeStore.js — Zustand store for ATOffice
 *
 * IMPROVEMENTS:
 * - Project-aware: tracks active project, can switch between projects
 * - Walk event handling: relays agent_walk/standup events to PixelOffice
 * - Per-project file tree: files grouped by project, each collapsible
 * - Terminal tracks active project working directory
 * - agentMgr integration: pathfinding triggered from WS events
 */

import { create } from 'zustand'
import { agentMgr } from '../components/PixelOffice'

const API_BASE = 'http://localhost:8000'
const WS_URL   = 'ws://localhost:8000/ws'

export const useOfficeStore = create((set, get) => ({
  // ── CONNECTION ──────────────────────────────────────────────────────────
  ws: null,
  connected: false,

  // ── AGENTS ──────────────────────────────────────────────────────────────
  agents: {},                // { agentId: agentData }

  // ── MESSAGES ────────────────────────────────────────────────────────────
  messages: [],

  // ── TASKS ───────────────────────────────────────────────────────────────
  tasks: [],

  // ── PROJECTS ─────────────────────────────────────────────────────────────
  // activeProject: currently focused project (string name or null)
  // projects: array of { name, task_id, created, file_count }
  activeProject: null,
  projects: [],

  // ── UI STATE ─────────────────────────────────────────────────────────────
  selectedAgent: null,
  activeModal: null,
  notifications: [],
  commandInput: '',
  chatInput: '',
  chatTarget: null,
  showChat: true,
  petals: [],

  // ── STATS ────────────────────────────────────────────────────────────────
  stats: null,
  leaderboard: [],

  // ── EXTERNAL HANDLERS (registered by App.jsx) ───────────────────────────
  _terminalHandler: null,
  _activityHandler: null,
  _fileRefreshHandler: null,
  _outputReadyHandler: null,
  _walkHandler: null,

  registerHandlers: (onTerminal, onActivity, onFileRefresh, onOutputReady, onWalk) => {
    set({
      _terminalHandler: onTerminal,
      _activityHandler: onActivity,
      _fileRefreshHandler: onFileRefresh,
      _outputReadyHandler: onOutputReady,
      _walkHandler: onWalk,
    })
  },

  // ── ACTIONS ──────────────────────────────────────────────────────────────
  setCommandInput: (v) => set({ commandInput: v }),
  setChatInput:    (v) => set({ chatInput: v }),
  setChatTarget:   (v) => set({ chatTarget: v }),
  setSelectedAgent:(v) => set({ selectedAgent: v }),
  setActiveModal:  (v) => set({ activeModal: v }),
  setActiveProject:(v) => {
    set({ activeProject: v })
    // Notify terminal to cd into this project
    const state = get()
    if (state._terminalHandler) state._terminalHandler({ type: 'project_switch', project: v })
  },

  // ── WEBSOCKET ────────────────────────────────────────────────────────────
  connectWS: () => {
    const ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      const wasConnected = get().connected
      set({ connected: true })
      if (!wasConnected) get().addNotification('ATOffice connected ✓', 'success')
    }

    ws.onclose = () => {
      set({ connected: false })
      setTimeout(() => get().connectWS(), 3000)
    }

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        get().handleWSMessage(data)
      } catch {}
    }

    set({ ws })
  },

  handleWSMessage: (data) => {
    const { type } = data
    const state = get()

    if (type === 'init') {
      const agentMap = {}
      data.agents.forEach(a => agentMap[a.id] = a)
      const seen = new Set()
      const deduped = (data.messages || []).filter(m => {
        if (seen.has(m.id)) return false
        seen.add(m.id); return true
      })
      set({ agents: agentMap, messages: deduped })
      // Init agent manager with agent ids
      agentMgr.init(agentMap)
      return
    }

    if (type === 'terminal_event') {
      if (state._terminalHandler) state._terminalHandler(data)
      return
    }

    if (type === 'agent_activity') {
      if (state._activityHandler) state._activityHandler(data)
      return
    }

    if (type === 'refresh_files') {
      if (state._fileRefreshHandler) state._fileRefreshHandler(data)
      // Also refresh project list
      get().fetchProjects()
      return
    }

    // ── WALK EVENT: trigger pathfinding animation ──────────────────────
    if (type === 'agent_walk') {
      // mover walks to target's position
      if (agentMgr && data.from && data.to) {
        agentMgr.walkToAgent(data.from, data.to)
      }
      if (state._walkHandler) state._walkHandler(data)
      return
    }

    if (type === 'agent_return_home') {
      const ids = data.agents || []
      ids.forEach(id => agentMgr.returnHome(id))
      return
    }

    // ── STANDUP: everyone walks to PM ──────────────────────────────────
    if (type === 'standup_start') {
      const agentIds = Object.keys(get().agents).filter(id => id !== 'pm')
      agentIds.forEach(id => agentMgr.walkToAgent(id, 'pm'))
      return
    }

    if (type === 'standup_end') {
      Object.keys(get().agents).forEach(id => agentMgr.returnHome(id))
      return
    }

    // ── PROJECT CREATED ────────────────────────────────────────────────
    if (type === 'project_created') {
      get().addNotification(`📁 New project: ${data.project_name}`, 'info')
      get().fetchProjects()
      // Auto-focus the new project
      set({ activeProject: data.project_name })
      return
    }

    if (type === 'message') {
      set(state => {
        const exists = state.messages.some(m => m.id && m.id === data.id)
        if (exists) return state
        return { messages: [...state.messages.slice(-100), data] }
      })
      if (data.sender_id && data.sender_id !== 'user') {
        set(state => ({
          agents: {
            ...state.agents,
            [data.sender_id]: {
              ...state.agents[data.sender_id],
              lastMessage: data.content,
              lastMessageTime: Date.now(),
            }
          }
        }))
      }
      return
    }

    if (type === 'agent_update') {
      set(state => ({
        agents: {
          ...state.agents,
          [data.agent_id]: {
            ...state.agents[data.agent_id],
            status: data.status,
            current_task_id: data.task_id || state.agents[data.agent_id]?.current_task_id,
          }
        }
      }))
      return
    }

    if (type === 'output_ready') {
      get().fetchTasks()
      get().fetchProjects()
      const h = get()._outputReadyHandler
      if (h) h(data)
      return
    }

    if (type === 'task_deleted') {
      set(state => ({ tasks: state.tasks.filter(t => t.id !== data.task_id) }))
      return
    }

    if (type === 'tasks_cleared') {
      set({ tasks: [] })
      get().addNotification('🗑️ All tasks cleared', 'info')
      return
    }
  },

  // ── COMMANDS & CHAT ──────────────────────────────────────────────────────
  sendCommand: async (command) => {
    try {
      const res = await fetch(`${API_BASE}/task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      })
      const data = await res.json()
      get().addNotification(`📋 Dispatched: ${command.slice(0, 40)}...`, 'success')
      set({ commandInput: '' })
      return data
    } catch (e) {
      get().addNotification('❌ Failed to send command', 'error')
    }
  },

  sendChat: async (message, agentId = null) => {
    const { ws } = get()
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'chat', text: message, agent_id: agentId }))
      set({ chatInput: '' })
    } else {
      try {
        await fetch(`${API_BASE}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, agent_id: agentId }),
        })
        set({ chatInput: '' })
      } catch {}
    }
  },

  // ── DATA FETCHING ────────────────────────────────────────────────────────
  fetchStats: async () => {
    try {
      const [statsRes, lbRes] = await Promise.all([
        fetch(`${API_BASE}/stats`),
        fetch(`${API_BASE}/leaderboard`),
      ])
      const stats = await statsRes.json()
      const leaderboard = await lbRes.json()
      set({ stats, leaderboard })
    } catch {}
  },

  fetchTasks: async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks`)
      const tasks = await res.json()
      set({ tasks })
    } catch {}
  },

  /**
   * Fetch the list of projects from workspace.
   * Projects are now top-level folders under workspace/projects/.
   */
  fetchProjects: async () => {
    try {
      const res = await fetch(`${API_BASE}/workspace/projects`)
      const projects = await res.json()
      set({ projects: Array.isArray(projects) ? projects : [] })
    } catch {}
  },

  /**
   * Fetch files for a specific project.
   * Returns files grouped by agent role.
   */
  fetchProjectFiles: async (taskId) => {
    try {
      const res = await fetch(`${API_BASE}/workspace/projects/${taskId}/files`)
      return await res.json()
    } catch {
      return { files: [] }
    }
  },

  /**
   * Fetch ALL workspace files (flat list, for legacy file tree).
   */
  fetchWorkspaceFiles: async () => {
    try {
      const res = await fetch(`${API_BASE}/workspace/files`)
      return await res.json()
    } catch {
      return []
    }
  },

  /**
   * Assemble a project (trigger Kazu to collect all outputs).
   */
  assembleProject: async (taskId) => {
    try {
      const res = await fetch(`${API_BASE}/workspace/projects/${taskId}/assemble`, { method: 'POST' })
      const data = await res.json()
      get().addNotification(`📦 Project assembled!`, 'success')
      get().fetchProjects()
      return data
    } catch {
      get().addNotification('❌ Assembly failed', 'error')
    }
  },

  continueWork: async () => {
    try {
      await fetch(`${API_BASE}/office/continue`, { method: 'POST' })
      get().addNotification('☀️ Resuming from checkpoint!', 'success')
    } catch {}
  },

  agentAction: async (agentId, action) => {
    try {
      await fetch(`${API_BASE}/agent/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, action }),
      })
    } catch {}
  },

  // ── NOTIFICATIONS ────────────────────────────────────────────────────────
  addNotification: (message, type = 'info') => {
    const id = Date.now()
    set(state => {
      if (state.notifications.some(n => n.message === message)) return state
      const trimmed = state.notifications.slice(-2)
      return { notifications: [...trimmed, { id, message, type }] }
    })
    setTimeout(() => {
      set(state => ({ notifications: state.notifications.filter(n => n.id !== id) }))
    }, 5000)
  },

  spawnPetal: () => {
    const id = Date.now()
    const petal = {
      id,
      x: Math.random() * 100,
      duration: 8 + Math.random() * 6,
      delay: Math.random() * 3,
      rotation: Math.random() * 360,
    }
    set(state => ({ petals: [...state.petals.slice(-10), petal] }))
    setTimeout(() => {
      set(state => ({ petals: state.petals.filter(p => p.id !== id) }))
    }, (petal.duration + petal.delay) * 1000)
  },
}))