import React from 'react'

export function Notifications({ notifications }) {
  return (
    <div style={{
      position: 'fixed',
      top: 50,
      right: 12,
      zIndex: 300,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      pointerEvents: 'none',
    }}>
      {notifications.map(n => (
        <div
          key={n.id}
          style={{
            background: n.type === 'error' ? 'rgba(100,10,10,0.95)' :
                        n.type === 'success' ? 'rgba(10,60,30,0.95)' : 'rgba(10,10,40,0.95)',
            border: `1px solid ${n.type === 'error' ? '#cc3344' : n.type === 'success' ? '#33cc66' : '#4433aa'}`,
            color: '#f0e8d0',
            padding: '6px 12px',
            fontFamily: '"DotGothic16", monospace',
            fontSize: 10,
            maxWidth: 240,
            boxShadow: '2px 2px 0 rgba(0,0,0,0.8)',
            animation: 'notifIn 0.3s ease forwards',
          }}
        >
          {n.message}
        </div>
      ))}
    </div>
  )
}

export function TopBar({ connected, stats, onCommand, onLeaderboard, onContinue, onTasks, onOutputs }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: 38,
      background: 'rgba(8,5,18,0.97)',
      borderBottom: '2px solid #2d1f4d',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      gap: 12,
      zIndex: 100,
      userSelect: 'none',
    }}>
      {/* Logo */}
      <div style={{
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 9,
        color: '#c8a035',
        textShadow: '0 0 8px rgba(200,160,53,0.5)',
        letterSpacing: 2,
        whiteSpace: 'nowrap',
      }}>
        ⛩ AT<span style={{ color: '#9966ff' }}>OFFICE</span>
      </div>

      <div style={{ width: 1, height: 20, background: '#2d1f4d' }} />

      {/* Connection status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{
          width: 6, height: 6,
          background: connected ? '#33cc66' : '#cc3344',
          boxShadow: connected ? '0 0 6px #33cc66' : 'none',
          animation: connected ? 'workingPulse 2s infinite' : 'none',
        }} />
        <span style={{
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 7,
          color: connected ? '#33cc66' : '#cc3344',
        }}>
          {connected ? 'ONLINE' : 'OFFLINE'}
        </span>
      </div>

      <div style={{ width: 1, height: 20, background: '#2d1f4d' }} />

      {/* Stats */}
      {stats && (
        <div style={{
          display: 'flex',
          gap: 10,
          fontFamily: '"DotGothic16", monospace',
          fontSize: 10,
          color: '#8877aa',
        }}>
          <span>📋 {stats.total_tasks} tasks</span>
          <span>✓ {stats.completed_today} done</span>
          <span>💬 {stats.messages_today} msgs</span>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Action buttons */}
      <TopBtn onClick={onOutputs} color="#33cc88">💾 OUTPUTS</TopBtn>
      <TopBtn onClick={onContinue} color="#66aaff">☀ CONTINUE</TopBtn>
      <TopBtn onClick={onTasks} color="#c8a035">📋 TASKS</TopBtn>
      <TopBtn onClick={onLeaderboard} color="#ffcc44">🏆 RANKS</TopBtn>
      <TopBtn onClick={onCommand} color="#ff88aa">📡 COMMAND</TopBtn>
    </div>
  )
}

function TopBtn({ children, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: `1px solid ${color}44`,
        color,
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 7,
        padding: '4px 8px',
        cursor: 'pointer',
        transition: 'all 0.1s',
        whiteSpace: 'nowrap',
      }}
      onMouseOver={e => { e.target.style.background = color + '22'; e.target.style.borderColor = color }}
      onMouseOut={e => { e.target.style.background = 'transparent'; e.target.style.borderColor = color + '44' }}
    >
      {children}
    </button>
  )
}