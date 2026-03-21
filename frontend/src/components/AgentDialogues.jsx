/**
 * AgentDialogues.jsx — v3
 *
 * KEY FIX: Bubbles now follow the agent's ACTUAL walking position,
 * not their home tile. We read live positions from agentMgr every
 * animation frame via a prop, so a bubble stays glued above the
 * sprite no matter where it's walking.
 *
 * Also: dialogue bubble has a CSS triangle pointer aimed at the agent.
 */

import React, { useEffect, useState, useRef } from 'react'

const COLS = 44
const ROWS = 28
const SPR_W = 14 * 2   // sprite canvas px width
const SPR_H = 20 * 2   // sprite canvas px height

const AGENT_COLORS = {
  pm:'#4468c0', product:'#2060a0', architect:'#205080',
  designer:'#c04888', mobile:'#d06898',
  frontend:'#3898b0', perf:'#3070a8',
  backend:'#389060', platform:'#208858',
  data:'#507888', aiml:'#7040b0', analytics:'#306898',
  github:'#506898', infra:'#408080', security:'#905030',
  qa:'#a06030', sdet:'#806040',
  blog:'#c86878', growth:'#508840',
  techlead:'#985858', mizu:'#6040a8',
}

// Convert tile float → container pixel
function tileToContainer(px, py, canvasW, canvasH, containerW, containerH) {
  const tw = canvasW / COLS
  const th = canvasH / ROWS
  const sx = containerW / canvasW
  const sy = containerH / canvasH
  return {
    x: px * tw * sx,
    y: py * th * sy,
  }
}

export default function AgentDialogues({
  agents, messages, agentStates,
  canvasW, canvasH, containerW, containerH,
  agentActivities,
}) {
  const [bubbles, setBubbles] = useState({})

  useEffect(() => {
    if (!messages.length) return
    const latest = messages[messages.length - 1]
    if (!latest || !latest.sender_id) return
    const agentId = latest.sender_id
    if (agentId === 'user' || agentId === 'Boss') return

    const bubble = {
      content: latest.content,
      type: latest.message_type,
      id: latest.id || Date.now(),
      ts: Date.now(),
    }
    setBubbles(prev => ({ ...prev, [agentId]: bubble }))
    const timer = setTimeout(() => {
      setBubbles(prev => {
        const n = { ...prev }
        if (n[agentId]?.id === bubble.id) delete n[agentId]
        return n
      })
    }, 9000)
    return () => clearTimeout(timer)
  }, [messages])

  if (!containerW || !containerH || !canvasW || !canvasH) return null

  const spriteW = SPR_W * (containerW / canvasW)
  const spriteH = SPR_H * (containerH / canvasH)

  const agentArr = Object.values(agents || {})

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>

      {/* Activity labels — follow actual position */}
      {agentArr.map(agent => {
        const activity = agentActivities?.[agent.id]
        if (!activity || bubbles[agent.id]) return null
        const state = agentStates?.[agent.id]
        if (!state) return null
        const { x, y } = tileToContainer(state.px, state.py, canvasW, canvasH, containerW, containerH)
        const color = AGENT_COLORS[agent.id] || 'var(--text2)'
        return (
          <div key={`act-${agent.id}`} style={{
            position: 'absolute',
            left: x + spriteW + 2,
            top: y - spriteH - 2,
            fontSize: 9,
            fontWeight: 600,
            color,
            background: `${color}18`,
            border: `1px solid ${color}40`,
            padding: '1px 5px',
            borderRadius: 8,
            whiteSpace: 'nowrap',
            maxWidth: 110,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            pointerEvents: 'none',
          }}>
            {activity}
          </div>
        )
      })}

      {/* Speech bubbles — glued to actual walking position */}
      {Object.entries(bubbles).map(([agentId, bubble]) => {
        const agent = agents[agentId]
        if (!agent) return null
        const state = agentStates?.[agentId]
        if (!state) return null
        const { x, y } = tileToContainer(state.px, state.py, canvasW, canvasH, containerW, containerH)
        const color = AGENT_COLORS[agentId] || '#888'
        const clean = (bubble.content || '')
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\[To User\]\s*/g, '')
          .replace(/```[\s\S]*?```/g, '[code]')
          .slice(0, 150)
        const typeIcon = bubble.type === 'joke' ? '😂'
          : bubble.type === 'meeting' ? '📢'
          : bubble.type === 'task_update' ? '⚙️'
          : bubble.type === 'checkin' ? '🚶' : null
        return (
          <SpeechBubble
            key={`${agentId}-${bubble.id}`}
            x={x} y={y}
            spriteW={spriteW} spriteH={spriteH}
            content={clean}
            name={agent.name} emoji={agent.emoji}
            color={color} typeIcon={typeIcon}
            containerW={containerW}
          />
        )
      })}
    </div>
  )
}

function SpeechBubble({ x, y, spriteW, spriteH, content, name, emoji, color, typeIcon, containerW }) {
  const [displayed, setDisplayed] = useState('')
  const [opacity, setOpacity] = useState(0)
  const [phase, setPhase] = useState('in') // in | showing | out

  useEffect(() => {
    setDisplayed(''); setOpacity(0); setPhase('in')
    // Fade in
    const t1 = setTimeout(() => setOpacity(1), 30)
    let i = 0
    const iv = setInterval(() => {
      if (i < content.length) setDisplayed(content.slice(0, ++i))
      else clearInterval(iv)
    }, 16)
    // Fade out
    const t2 = setTimeout(() => setOpacity(0), 8200)
    return () => { clearTimeout(t1); clearInterval(iv); clearTimeout(t2) }
  }, [content])

  const bubbleW = Math.min(180, Math.max(90, content.length * 5 + 32))
  // Anchor at the center-top of the sprite
  const anchorX = x + spriteW / 2
  const anchorY = y - spriteH + 4

  // Bubble sits above anchor, pointer arrow points down to agent
  const bubbleH_est = 48 + Math.ceil(content.length / 22) * 14
  let bx = anchorX - bubbleW / 2
  let by = anchorY - bubbleH_est - 12

  // Keep on screen
  if (bx < 2) bx = 2
  if (bx + bubbleW > containerW - 2) bx = containerW - bubbleW - 2
  if (by < 2) by = 2

  // Triangle pointer x — clamped to bubble edges
  const triX = Math.max(bx + 8, Math.min(anchorX, bx + bubbleW - 8))

  return (
    <div style={{
      position: 'absolute',
      left: bx,
      top: by,
      width: bubbleW,
      opacity,
      transition: 'opacity 0.35s ease',
      pointerEvents: 'none',
    }}>
      {/* Bubble body */}
      <div style={{
        background: 'rgba(252,248,244,0.97)',
        border: `1.5px solid ${color}`,
        borderRadius: 10,
        padding: '5px 8px 6px',
        boxShadow: `0 2px 8px rgba(0,0,0,0.18)`,
        position: 'relative',
      }}>
        {/* Name row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          marginBottom: 3,
        }}>
          <span style={{ fontSize: 12 }}>{emoji}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color }}>{name}</span>
          {typeIcon && <span style={{ fontSize: 10, marginLeft: 2 }}>{typeIcon}</span>}
        </div>
        {/* Content */}
        <div style={{
          fontSize: 10,
          lineHeight: 1.5,
          color: '#2a1a10',
          fontFamily: 'DM Sans, sans-serif',
        }}>
          {displayed}
          {displayed.length < content.length && (
            <span style={{ opacity: 0.4 }}>▌</span>
          )}
        </div>
      </div>

      {/* Triangle pointer aimed at agent — positioned relative to bubble */}
      <div style={{
        position: 'absolute',
        left: triX - bx - 6,
        bottom: -8,
        width: 0,
        height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: `8px solid ${color}`,
      }} />
      {/* Inner white triangle */}
      <div style={{
        position: 'absolute',
        left: triX - bx - 4,
        bottom: -5,
        width: 0,
        height: 0,
        borderLeft: '4px solid transparent',
        borderRight: '4px solid transparent',
        borderTop: '6px solid rgba(252,248,244,0.97)',
      }} />
    </div>
  )
}