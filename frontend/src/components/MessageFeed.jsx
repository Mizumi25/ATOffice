import React, { useEffect, useRef } from 'react'

const TYPE_COLORS = {
  chat: '#c8a035',
  task_update: '#33cc88',
  joke: '#ff6699',
  meeting: '#66aaff',
  status: '#9988dd',
  dialogue: '#c8a035',
}

const AGENT_COLORS = {
  pm: '#6688ff',
  designer: '#ff66aa',
  frontend: '#44dd88',
  backend: '#44aadd',
  qa: '#ffaa44',
  user: '#ffffff',
  system: '#888888',
}

export default function MessageFeed({ messages, agents }) {
  const feedRef = useRef(null)

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div
      ref={feedRef}
      className="message-feed"
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: '8px 6px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      {messages.length === 0 && (
        <div style={{
          color: '#554466',
          fontSize: 9,
          fontFamily: '"DotGothic16", monospace',
          textAlign: 'center',
          paddingTop: 20,
        }}>
          Waiting for agents...<br />
          <span style={{ color: '#443355' }}>[ office is quiet ]</span>
        </div>
      )}
      {messages.map((msg, i) => (
        <MessageRow key={msg.id || i} msg={msg} agents={agents} />
      ))}
    </div>
  )
}

function MessageRow({ msg, agents }) {
  const sender = agents[msg.sender_id]
  const senderColor = AGENT_COLORS[msg.sender_id] || '#888888'
  const typeColor = TYPE_COLORS[msg.message_type] || '#c8a035'
  const time = msg.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    : ''

  const cleanContent = msg.content
    ?.replace(/\*\*(.*?)\*\*/g, '$1')  // strip bold
    ?.slice(0, 500)

  const icon = msg.message_type === 'joke' ? '😂' :
               msg.message_type === 'meeting' ? '📢' :
               msg.message_type === 'task_update' ? '⚙️' :
               msg.sender_id === 'user' ? '🫵' : sender?.emoji || '●'

  return (
    <div style={{
      background: msg.sender_id === 'user' ? 'rgba(100,80,200,0.15)' : 'rgba(20,15,40,0.7)',
      border: `1px solid ${msg.sender_id === 'user' ? 'rgba(100,80,200,0.4)' : 'rgba(60,40,80,0.5)'}`,
      padding: '5px 7px',
      borderRadius: 1,
      fontSize: 10,
      fontFamily: '"DotGothic16", monospace',
      lineHeight: 1.4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        <span style={{ fontSize: 11 }}>{icon}</span>
        <span style={{ color: senderColor, fontWeight: 'bold', fontSize: 9 }}>
          {sender?.name || msg.sender_id || 'System'}
        </span>
        {msg.message_type && msg.message_type !== 'chat' && (
          <span style={{
            background: typeColor + '22',
            color: typeColor,
            fontSize: 7,
            padding: '0 4px',
            border: `1px solid ${typeColor}44`,
            fontFamily: '"Press Start 2P", monospace',
          }}>
            {msg.message_type.toUpperCase().replace('_', '-')}
          </span>
        )}
        <span style={{ color: '#443355', fontSize: 8, marginLeft: 'auto' }}>{time}</span>
      </div>
      <div style={{ color: '#d0c8b0', fontSize: 10, paddingLeft: 15 }}>
        {cleanContent}
      </div>
    </div>
  )
}