import React, { useEffect, useState } from 'react'
import { AGENT_HOME as DESK_POSITIONS } from './PixelOffice'

const AGENT_COLORS = {
  pm:'#4468c0', designer:'#c04888', frontend:'#3898b0', backend:'#389060', qa:'#a06030'
}

export default function AgentDialogues({ agents, messages, canvasW, canvasH, containerW, containerH, agentActivities }) {
  const [bubbles, setBubbles] = useState({})

  useEffect(() => {
    if (!messages.length) return
    const latest = messages[messages.length - 1]
    if (!latest || !DESK_POSITIONS[latest.sender_id]) return
    const agentId = latest.sender_id
    const pos = DESK_POSITIONS[agentId]
    const sx = containerW / canvasW
    const sy = containerH / canvasH
    const ax = canvasW * pos.x * sx
    const ay = canvasH * pos.y * sy
    const bubble = { content: latest.content, type: latest.message_type, x: ax, y: ay, id: latest.id || Date.now(), ts: Date.now() }
    setBubbles(prev => ({ ...prev, [agentId]: bubble }))
    const t = setTimeout(() => {
      setBubbles(prev => { const n={...prev}; if(n[agentId]?.id===bubble.id) delete n[agentId]; return n })
    }, 9000)
    return () => clearTimeout(t)
  }, [messages, canvasW, canvasH, containerW, containerH])

  const agentArr = Object.values(agents)

  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:10 }}>
      {/* Activity bubbles */}
      {agentArr.map(agent => {
        const activity = agentActivities?.[agent.id]
        if (!activity || bubbles[agent.id]) return null
        const pos = DESK_POSITIONS[agent.id]
        if (!pos) return null
        const sx = containerW / canvasW, sy = containerH / canvasH
        const ax = canvasW * pos.x * sx, ay = canvasH * pos.y * sy
        return (
          <div key={`act-${agent.id}`} className="activity-bubble"
            style={{ left: ax + 34, top: ay - 20, color: AGENT_COLORS[agent.id] || 'var(--text2)' }}>
            {activity}
          </div>
        )
      })}

      {/* Dialogue bubbles */}
      {Object.entries(bubbles).map(([agentId, bubble]) => {
        const agent = agents[agentId]
        if (!agent) return null
        const color = AGENT_COLORS[agentId] || 'var(--text2)'
        const clean = (bubble.content||'').replace(/\*\*(.*?)\*\*/g,'$1').replace(/\[To User\]\s*/g,'').slice(0,160)
        return (
          <DialogueBubble key={`${agentId}-${bubble.id}`}
            x={bubble.x} y={bubble.y} content={clean}
            name={agent.name} type={bubble.type} color={color} emoji={agent.emoji}
          />
        )
      })}
    </div>
  )
}

function DialogueBubble({ x, y, content, name, type, color, emoji }) {
  const [displayed, setDisplayed] = useState('')
  const [opacity, setOpacity] = useState(0)

  useEffect(() => {
    setDisplayed(''); setOpacity(1)
    let i = 0
    const iv = setInterval(() => {
      if (i < content.length) setDisplayed(content.slice(0, ++i))
      else clearInterval(iv)
    }, 20)
    const fade = setTimeout(() => setOpacity(0), 8200)
    return () => { clearInterval(iv); clearTimeout(fade) }
  }, [content])

  const typeLabel = type==='joke'?'😂':type==='meeting'?'📢':type==='task_update'?'⚙️':null

  return (
    <div className="dialogue-bubble" style={{ left: x+36, top: y-60, opacity, transition:'opacity 0.5s ease' }}>
      <div className="bubble-name" style={{ color }}>
        {emoji} {name} {typeLabel}
      </div>
      <span style={{ fontSize:11, lineHeight:1.5, color:'var(--text)' }}>{displayed}</span>
    </div>
  )
}