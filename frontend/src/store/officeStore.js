import { create } from 'zustand'

const API_BASE = 'http://localhost:8000'
const WS_URL = 'ws://localhost:8000/ws'

export const useOfficeStore = create((set, get) => ({
  // WebSocket
  ws: null,
  connected: false,

  // Agents
  agents: {},

  // Messages
  messages: [],

  // Tasks
  tasks: [],

  // UI State
  selectedAgent: null,
  activeModal: null, // 'whiteboard', 'task', 'leaderboard', 'logs', 'settings'
  notifications: [],
  commandInput: '',
  chatInput: '',
  chatTarget: null, // null = all, agentId = specific agent
  showChat: true,
  petals: [],

  // Stats
  stats: null,
  leaderboard: [],

  // Actions
  setCommandInput: (v) => set({ commandInput: v }),
  setChatInput: (v) => set({ chatInput: v }),
  setChatTarget: (v) => set({ chatTarget: v }),
  setSelectedAgent: (v) => set({ selectedAgent: v }),
  setActiveModal: (v) => set({ activeModal: v }),

  connectWS: () => {
    const ws = new WebSocket(WS_URL)
    ws.onopen = () => {
      const wasConnected = get().connected
      set({ connected: true })
      if (!wasConnected) get().addNotification('ATOffice connected', 'success')
    }
    ws.onclose = () => {
      set({ connected: false })
      // Reconnect after 3s
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

  // External handlers registered by App.jsx - survives reconnects
  _terminalHandler: null,
  _activityHandler: null,
  _fileRefreshHandler: null,
  _outputReadyHandler: null,
  registerHandlers: (onTerminal, onActivity, onFileRefresh, onOutputReady) => {
    set({ _terminalHandler: onTerminal, _activityHandler: onActivity, _fileRefreshHandler: onFileRefresh, _outputReadyHandler: onOutputReady })
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
    } else if (type === 'terminal_event') {
      if (state._terminalHandler) state._terminalHandler(data)
      return
    } else if (type === 'agent_activity') {
      if (state._activityHandler) state._activityHandler(data)
      return
    } else if (type === 'refresh_files') {
      if (state._fileRefreshHandler) state._fileRefreshHandler(data)
      return
    } else if (type === 'message') {
      set(state => {
        const exists = state.messages.some(m => m.id && m.id === data.id)
        if (exists) return state
        return { messages: [...state.messages.slice(-100), data] }
      })
      // Update agent dialogue
      if (data.sender_id && data.sender_id !== 'user') {
        set(state => ({
          agents: {
            ...state.agents,
            [data.sender_id]: {
              ...state.agents[data.sender_id],
              lastMessage: data.content,
              lastMessageTime: Date.now()
            }
          }
        }))
      }
    } else if (type === 'agent_update') {
      set(state => ({
        agents: {
          ...state.agents,
          [data.agent_id]: {
            ...state.agents[data.agent_id],
            status: data.status,
            current_task_id: data.task_id || state.agents[data.agent_id]?.current_task_id,
            lastMessage: data.message || state.agents[data.agent_id]?.lastMessage,
          }
        }
      }))
    } else if (type === 'output_ready') {
      get().fetchTasks()
      const h = get()._outputReadyHandler
      if (h) h(data)
    } else if (type === 'task_deleted') {
      set(state => ({ tasks: state.tasks.filter(t => t.id !== data.task_id) }))
    } else if (type === 'tasks_cleared') {
      set({ tasks: [] })
      get().addNotification('🗑️ All tasks cleared!', 'info')
    } else if (type === 'chat_response') {
      get().addNotification(`💬 ${data.text?.slice(0, 60)}...`, 'info')
    }
  },

  sendCommand: async (command) => {
    try {
      const res = await fetch(`${API_BASE}/task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      })
      const data = await res.json()
      get().addNotification(`📋 Task dispatched: ${command.slice(0, 40)}...`, 'success')
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
        const res = await fetch(`${API_BASE}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, agent_id: agentId })
        })
        set({ chatInput: '' })
      } catch {}
    }
  },

  fetchStats: async () => {
    try {
      const [statsRes, lbRes] = await Promise.all([
        fetch(`${API_BASE}/stats`),
        fetch(`${API_BASE}/leaderboard`)
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

  continueWork: async () => {
    try {
      const res = await fetch(`${API_BASE}/office/continue`, { method: 'POST' })
      get().addNotification('☀️ Resuming from checkpoint!', 'success')
    } catch {}
  },

  agentAction: async (agentId, action) => {
    try {
      await fetch(`${API_BASE}/agent/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, action })
      })
    } catch {}
  },

  addNotification: (message, type = 'info') => {
    const id = Date.now()
    set(state => {
      // Dedupe: don't add if same message already showing
      if (state.notifications.some(n => n.message === message)) return state
      // Cap at 3 notifications max
      const trimmed = state.notifications.slice(-2)
      return { notifications: [...trimmed, { id, message, type }] }
    })
    setTimeout(() => {
      set(state => ({
        notifications: state.notifications.filter(n => n.id !== id)
      }))
    }, 5000)
  },

  spawnPetal: () => {
    const id = Date.now()
    const petal = {
      id,
      x: Math.random() * 100,
      duration: 8 + Math.random() * 6,
      delay: Math.random() * 3,
      rotation: Math.random() * 360
    }
    set(state => ({ petals: [...state.petals.slice(-10), petal] }))
    setTimeout(() => {
      set(state => ({ petals: state.petals.filter(p => p.id !== id) }))
    }, (petal.duration + petal.delay) * 1000)
  }
}))