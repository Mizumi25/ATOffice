import React, { useState } from 'react'

const PixelBtn = ({ children, onClick, color = '#c8a035', small }) => (
  <button
    onClick={onClick}
    style={{
      background: 'transparent',
      border: `2px solid ${color}`,
      color,
      fontFamily: '"Press Start 2P", monospace',
      fontSize: small ? 7 : 8,
      padding: small ? '4px 8px' : '6px 12px',
      cursor: 'pointer',
      transition: 'all 0.1s',
      boxShadow: `2px 2px 0 rgba(0,0,0,0.8)`,
    }}
    onMouseOver={e => { e.target.style.background = color + '22' }}
    onMouseOut={e => { e.target.style.background = 'transparent' }}
  >
    {children}
  </button>
)

function ModalWindow({ title, onClose, children, width = 500 }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      zIndex: 200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
    onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        width,
        maxWidth: '95vw',
        maxHeight: '80vh',
        background: '#0d0a1a',
        border: '2px solid #3d2d5a',
        boxShadow: '0 0 0 1px #1a1230, 4px 4px 0 rgba(0,0,0,0.9), 0 0 40px rgba(100,50,200,0.2)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Title bar */}
        <div style={{
          background: 'linear-gradient(90deg, #1e1538, #2d1f4d)',
          borderBottom: '2px solid #4d3d6a',
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 9,
          color: '#c8a035',
          flexShrink: 0,
        }}>
          <span>[ {title} ]</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <div style={{ width: 10, height: 10, background: '#cc3333', cursor: 'pointer' }} onClick={onClose} />
          </div>
        </div>
        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── LEADERBOARD MODAL ──
export function LeaderboardModal({ onClose, leaderboard }) {
  const medals = ['🥇', '🥈', '🥉']
  return (
    <ModalWindow title="BEST EMPLOYEE" onClose={onClose} width={460}>
      <div style={{ fontFamily: '"DotGothic16", monospace' }}>
        <div style={{
          textAlign: 'center',
          color: '#c8a035',
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 10,
          marginBottom: 16,
        }}>
          ✨ MONTHLY LEADERBOARD ✨
        </div>
        {leaderboard.map((agent, i) => (
          <div key={agent.id} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 10px',
            marginBottom: 6,
            background: i === 0 ? 'rgba(200,160,53,0.1)' : 'rgba(30,20,50,0.7)',
            border: `1px solid ${i === 0 ? '#c8a035' : '#3d2d5a'}`,
          }}>
            <span style={{ fontSize: 18 }}>{medals[i] || `#${i + 1}`}</span>
            <span style={{ fontSize: 20 }}>{agent.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#f0e8d0', fontSize: 12 }}>{agent.name}</div>
              <div style={{ color: '#8877aa', fontSize: 10 }}>{agent.role}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#33cc88', fontSize: 11 }}>⭐ {agent.productivity_points || 0} pts</div>
              <div style={{ color: '#c8a035', fontSize: 10 }}>¥{(agent.salary || 0).toLocaleString()}</div>
              <div style={{ color: '#8877aa', fontSize: 9 }}>{agent.tasks_completed || 0} tasks</div>
            </div>
          </div>
        ))}
        <div style={{
          marginTop: 16,
          padding: 10,
          background: 'rgba(200,160,53,0.05)',
          border: '1px solid rgba(200,160,53,0.2)',
          color: '#8877aa',
          fontSize: 9,
          textAlign: 'center',
          fontFamily: '"DotGothic16", monospace',
        }}>
          💴 Salaries are virtual. All amounts in ¥. Paid monthly! 🎊
        </div>
      </div>
    </ModalWindow>
  )
}

// ── AGENT PROFILE MODAL ──
export function AgentProfileModal({ onClose, agent, onAction }) {
  const moodColors = {
    happy: '#ffcc44', focused: '#44ccff', tired: '#8877aa',
    creative: '#ff88cc', analytical: '#44ff88', neutral: '#888888'
  }
  const statusColors = {
    working: '#33cc66', idle: '#8888aa', resting: '#6644aa', meeting: '#cc8833'
  }

  return (
    <ModalWindow title={`${agent.emoji} ${agent.name?.toUpperCase()}`} onClose={onClose} width={360}>
      <div style={{ fontFamily: '"DotGothic16", monospace' }}>
        {/* Avatar area */}
        <div style={{
          display: 'flex',
          gap: 16,
          marginBottom: 16,
          padding: 12,
          background: 'rgba(30,20,50,0.7)',
          border: '1px solid #3d2d5a',
        }}>
          <div style={{ fontSize: 48, lineHeight: 1 }}>{agent.emoji}</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#c8a035', fontSize: 14, fontFamily: '"Press Start 2P", monospace' }}>
              {agent.name}
            </div>
            <div style={{ color: '#9988cc', fontSize: 10, marginTop: 4 }}>{agent.role}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{
                background: (statusColors[agent.status] || '#888888') + '22',
                color: statusColors[agent.status] || '#888888',
                border: `1px solid ${statusColors[agent.status] || '#888888'}44`,
                padding: '2px 6px',
                fontSize: 9,
              }}>
                ● {agent.status?.toUpperCase() || 'IDLE'}
              </span>
              <span style={{
                background: (moodColors[agent.mood] || '#888888') + '22',
                color: moodColors[agent.mood] || '#888888',
                border: `1px solid ${moodColors[agent.mood] || '#888888'}44`,
                padding: '2px 6px',
                fontSize: 9,
              }}>
                {agent.mood || 'neutral'}
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'SALARY', value: `¥${(agent.salary || 0).toLocaleString()}`, color: '#c8a035' },
            { label: 'POINTS', value: `${agent.productivity_points || 0} ⭐`, color: '#33cc88' },
            { label: 'MODEL', value: agent.api_model?.slice(0, 10) || 'N/A', color: '#66aaff' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'rgba(20,15,40,0.8)',
              border: '1px solid #3d2d5a',
              padding: '8px 10px',
              textAlign: 'center',
            }}>
              <div style={{ color: '#554466', fontSize: 7, fontFamily: '"Press Start 2P", monospace' }}>{s.label}</div>
              <div style={{ color: s.color, fontSize: 11, marginTop: 4 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Memory / last task */}
        {agent.current_task_id && (
          <div style={{
            background: 'rgba(20,15,40,0.6)',
            border: '1px solid rgba(100,80,200,0.3)',
            padding: 8,
            marginBottom: 16,
            fontSize: 10,
            color: '#9988cc',
          }}>
            📋 Current task: <span style={{ color: '#f0e8d0' }}>{agent.current_task_id}</span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <PixelBtn onClick={() => onAction('ping')} color="#66aaff" small>📣 PING</PixelBtn>
          <PixelBtn onClick={() => onAction('joke')} color="#ff6699" small>😂 JOKE</PixelBtn>
          {agent.status === 'resting'
            ? <PixelBtn onClick={() => onAction('resume')} color="#33cc88" small>▶ WAKE UP</PixelBtn>
            : <PixelBtn onClick={() => onAction('pause')} color="#cc8833" small>⏸ BREAK</PixelBtn>
          }
        </div>
      </div>
    </ModalWindow>
  )
}

// ── WHITEBOARD / TASK BOARD MODAL ──
export function WhiteboardModal({ onClose, tasks, onRefresh }) {
  const [localTasks, setLocalTasks] = React.useState(tasks)
  const [deleting, setDeleting] = React.useState(null)
  const [confirmAll, setConfirmAll] = React.useState(false)

  React.useEffect(() => { setLocalTasks(tasks) }, [tasks])

  const deleteTask = async (taskId) => {
    setDeleting(taskId)
    try {
      await fetch(`http://localhost:8000/tasks/${taskId}`, { method: 'DELETE' })
      setLocalTasks(prev => prev.filter(t => t.id !== taskId))
      if (onRefresh) onRefresh()
    } catch(e) {
      console.error(e)
    } finally {
      setDeleting(null)
    }
  }

  const deleteAll = async (statusFilter = null) => {
    const toDelete = statusFilter
      ? localTasks.filter(t => t.status === statusFilter)
      : localTasks.filter(t => ['pending','assigned','in_progress','failed'].includes(t.status))
    for (const t of toDelete) {
      await fetch(`http://localhost:8000/tasks/${t.id}`, { method: 'DELETE' })
    }
    setLocalTasks(prev => statusFilter
      ? prev.filter(t => t.status !== statusFilter)
      : prev.filter(t => !['pending','assigned','in_progress','failed'].includes(t.status))
    )
    setConfirmAll(false)
    if (onRefresh) onRefresh()
  }

  const cols = {
    pending:    { label: 'BACKLOG',     color: '#8877aa' },
    assigned:   { label: 'ASSIGNED',    color: '#cc8833' },
    in_progress:{ label: 'IN PROGRESS', color: '#66aaff' },
    completed:  { label: 'DONE ✓',      color: '#33cc88' },
    failed:     { label: 'FAILED',      color: '#cc3344' },
  }

  const grouped = {}
  Object.keys(cols).forEach(k => grouped[k] = [])
  localTasks.forEach(t => { if (grouped[t.status]) grouped[t.status].push(t) })
  const activeCount = localTasks.filter(t => ['pending','assigned','in_progress'].includes(t.status)).length

  return (
    <ModalWindow title="📋 TASK BOARD" onClose={onClose} width={720}>
      <div style={{ fontFamily: '"DotGothic16", monospace' }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center',
          padding: '6px 8px', background: 'rgba(20,15,40,0.6)',
          border: '1px solid #2d1f4d', flexWrap: 'wrap'
        }}>
          <span style={{ color: '#554466', fontSize: 9, fontFamily: '"Press Start 2P",monospace' }}>
            {localTasks.length} tasks total · {activeCount} active
          </span>
          <div style={{ flex: 1 }} />
          {confirmAll ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: '#cc3344', fontSize: 9 }}>Delete all active tasks?</span>
              <PixelBtn onClick={() => deleteAll()} color="#cc3344" small>YES DELETE</PixelBtn>
              <PixelBtn onClick={() => setConfirmAll(false)} color="#554466" small>CANCEL</PixelBtn>
            </div>
          ) : (
            <PixelBtn onClick={() => setConfirmAll(true)} color="#cc3344" small>🗑 DELETE ACTIVE</PixelBtn>
          )}
        </div>

        {/* Kanban columns */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          {Object.entries(cols).map(([status, { label, color }]) => (
            <div key={status} style={{ minWidth: 140, flex: 1 }}>
              <div style={{
                fontFamily: '"Press Start 2P", monospace', fontSize: 7, color,
                padding: '4px 6px', borderBottom: `2px solid ${color}`,
                marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <span>{label} ({grouped[status].length})</span>
                {['pending','assigned','in_progress','failed'].includes(status) && grouped[status].length > 0 && (
                  <span
                    onClick={() => deleteAll(status)}
                    style={{ cursor: 'pointer', color: '#cc3344', fontSize: 7, marginLeft: 4 }}
                    title={`Delete all ${label}`}
                  >🗑</span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {grouped[status].slice(0, 10).map(task => (
                  <TaskCard
                    key={task.id} task={task} color={color}
                    onDelete={() => deleteTask(task.id)}
                    isDeleting={deleting === task.id}
                  />
                ))}
                {grouped[status].length === 0 && (
                  <div style={{ color: '#332244', fontSize: 9, textAlign: 'center', padding: 8 }}>empty</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ModalWindow>
  )
}

function TaskCard({ task, color, onDelete, isDeleting }) {
  const [hover, setHover] = React.useState(false)
  const priorityColors = { high: '#cc3344', medium: '#cc8833', low: '#6688aa', critical: '#ff2222' }
  const canDelete = ['pending','assigned','in_progress','failed'].includes(task.status)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? 'rgba(30,20,55,0.9)' : 'rgba(20,15,40,0.8)',
        border: `1px solid ${hover ? color : color+'44'}`,
        padding: '6px 8px', fontSize: 9,
        fontFamily: '"DotGothic16", monospace',
        transition: 'all 0.1s', position: 'relative',
      }}>
      <div style={{ color: '#f0e8d0', marginBottom: 3, lineHeight: 1.3, paddingRight: canDelete ? 16 : 0 }}>
        {task.title?.slice(0, 48)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          color: priorityColors[task.priority] || '#888888',
          fontSize: 7,
          fontFamily: '"Press Start 2P", monospace',
        }}>
          {task.priority?.toUpperCase()}
        </span>
        <span style={{ color: '#554466', fontSize: 8 }}>#{task.id?.slice(0, 6)}</span>
      </div>
      {task.assigned_to && (
        <div style={{ color: '#6655aa', fontSize: 8, marginTop: 2 }}>→ {task.assigned_to}</div>
      )}
      {/* Delete button - shows on hover */}
      {canDelete && hover && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete && onDelete() }}
          disabled={isDeleting}
          style={{
            position: 'absolute', top: 4, right: 4,
            background: isDeleting ? 'rgba(100,30,30,0.6)' : 'rgba(200,50,50,0.8)',
            border: 'none', color: '#ffffff',
            fontFamily: '"Press Start 2P",monospace', fontSize: 7,
            padding: '2px 5px', cursor: isDeleting ? 'wait' : 'pointer',
            lineHeight: 1.5,
          }}
        >
          {isDeleting ? '...' : '🗑'}
        </button>
      )}
    </div>
  )
}

// ── COMMAND MODAL ──
export function CommandModal({ onClose, onSend }) {
  const [input, setInput] = useState('')
  const examples = [
    'Build a 5-section portfolio website with dark theme',
    'Create a REST API for a todo app with SQLite',
    'Design a landing page for a Japanese cafe',
    'Build a React dashboard with charts and animations',
  ]
  return (
    <ModalWindow title="📡 SEND COMMAND TO PM" onClose={onClose} width={480}>
      <div style={{ fontFamily: '"DotGothic16", monospace' }}>
        <div style={{ color: '#8877aa', fontSize: 10, marginBottom: 12 }}>
          Give Haruto (PM) a high-level task. He'll break it down and assign to the team.
        </div>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="e.g. Build a portfolio website with 5 sections..."
          style={{
            width: '100%',
            height: 80,
            background: '#0a0510',
            border: '2px solid #3d2d5a',
            color: '#f0e8d0',
            fontFamily: '"DotGothic16", monospace',
            fontSize: 11,
            padding: 8,
            resize: 'vertical',
            marginBottom: 10,
          }}
        />
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: '#554466', fontSize: 8, fontFamily: '"Press Start 2P", monospace', marginBottom: 6 }}>
            EXAMPLES:
          </div>
          {examples.map((ex, i) => (
            <div
              key={i}
              onClick={() => setInput(ex)}
              style={{
                padding: '4px 8px',
                marginBottom: 3,
                background: 'rgba(30,20,50,0.5)',
                border: '1px solid #3d2d5a',
                cursor: 'pointer',
                color: '#9988cc',
                fontSize: 10,
                transition: 'all 0.1s',
              }}
              onMouseOver={e => e.currentTarget.style.borderColor = '#c8a035'}
              onMouseOut={e => e.currentTarget.style.borderColor = '#3d2d5a'}
            >
              ▷ {ex}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <PixelBtn onClick={onClose} color="#664466" small>CANCEL</PixelBtn>
          <PixelBtn onClick={() => { if (input.trim()) { onSend(input); onClose() } }} color="#c8a035" small>
            📤 DISPATCH
          </PixelBtn>
        </div>
      </div>
    </ModalWindow>
  )
}