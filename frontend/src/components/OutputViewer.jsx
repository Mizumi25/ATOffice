import React, { useState, useEffect } from 'react'

const API = 'http://localhost:8000'

export default function OutputViewer({ onClose }) {
  const [tasks, setTasks] = useState([])
  const [selected, setSelected] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`${API}/tasks`)
      .then(r => r.json())
      .then(data => {
        const withOutput = data.filter(t => t.output && t.output.length > 10)
        setTasks(withOutput)
        if (withOutput.length > 0) setSelected(withOutput[0])
      })
      .catch(() => {})
  }, [])

  const copy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.75)',
      zIndex:200, display:'flex', alignItems:'center', justifyContent:'center'
    }} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{
        width:'92vw', maxWidth:900, height:'82vh',
        background:'#0d0a1a', border:'2px solid #3d2d5a',
        boxShadow:'4px 4px 0 rgba(0,0,0,0.9), 0 0 40px rgba(100,50,200,0.2)',
        display:'flex', flexDirection:'column', overflow:'hidden'
      }}>
        {/* Title bar */}
        <div style={{
          background:'linear-gradient(90deg,#1e1538,#2d1f4d)',
          borderBottom:'2px solid #4d3d6a',
          padding:'6px 14px', display:'flex',
          alignItems:'center', justifyContent:'space-between',
          fontFamily:'"Press Start 2P",monospace', fontSize:9, color:'#c8a035',
          flexShrink:0
        }}>
          <span>💾 AGENT OUTPUTS — CODE & RESULTS</span>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <span style={{color:'#554466',fontSize:7}}>{tasks.length} outputs</span>
            <div style={{width:10,height:10,background:'#cc3333',cursor:'pointer'}} onClick={onClose}/>
          </div>
        </div>

        <div style={{display:'flex',flex:1,overflow:'hidden'}}>
          {/* Left - task list */}
          <div style={{
            width:220,borderRight:'1px solid #2d1f4d',
            overflowY:'auto',flexShrink:0,
            background:'rgba(10,6,20,0.6)'
          }}>
            {tasks.length === 0 && (
              <div style={{
                padding:16, color:'#443355',
                fontFamily:'"DotGothic16",monospace', fontSize:10,
                textAlign:'center', marginTop:20
              }}>
                No outputs yet.<br/>
                <span style={{color:'#332244',fontSize:9}}>
                  Give the team a task first!
                </span>
              </div>
            )}
            {tasks.map(task => (
              <div key={task.id}
                onClick={() => setSelected(task)}
                style={{
                  padding:'8px 10px',
                  borderBottom:'1px solid #1d1030',
                  cursor:'pointer',
                  background: selected?.id===task.id ? 'rgba(100,50,200,0.2)' : 'transparent',
                  borderLeft: selected?.id===task.id ? '3px solid #c8a035' : '3px solid transparent',
                  transition:'all 0.1s'
                }}>
                <div style={{
                  color: statusColor(task.status),
                  fontFamily:'"Press Start 2P",monospace',
                  fontSize:6, marginBottom:3
                }}>
                  {statusIcon(task.status)} {task.status?.toUpperCase()}
                </div>
                <div style={{
                  color:'#d0c8b0',
                  fontFamily:'"DotGothic16",monospace',
                  fontSize:10, lineHeight:1.3
                }}>
                  {task.title?.slice(0,45)}
                </div>
                <div style={{color:'#554466',fontSize:8,marginTop:3,fontFamily:'"DotGothic16",monospace'}}>
                  → {task.assigned_to} · #{task.id?.slice(0,6)}
                </div>
              </div>
            ))}
          </div>

          {/* Right - output content */}
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
            {selected ? (
              <>
                {/* Header */}
                <div style={{
                  padding:'8px 14px',
                  borderBottom:'1px solid #2d1f4d',
                  flexShrink:0,
                  display:'flex', justifyContent:'space-between', alignItems:'center'
                }}>
                  <div>
                    <div style={{color:'#c8a035',fontFamily:'"Press Start 2P",monospace',fontSize:8}}>
                      {selected.title}
                    </div>
                    <div style={{color:'#554466',fontFamily:'"DotGothic16",monospace',fontSize:9,marginTop:2}}>
                      by {selected.assigned_to} · {selected.created_at?.slice(0,16)}
                    </div>
                  </div>
                  <button
                    onClick={() => copy(selected.output || '')}
                    style={{
                      background: copied ? 'rgba(50,200,100,0.2)' : 'rgba(200,160,53,0.15)',
                      border: `1px solid ${copied ? '#33cc66' : '#c8a035'}`,
                      color: copied ? '#33cc66' : '#c8a035',
                      fontFamily:'"Press Start 2P",monospace', fontSize:7,
                      padding:'5px 10px', cursor:'pointer'
                    }}
                  >
                    {copied ? '✓ COPIED' : '📋 COPY'}
                  </button>
                </div>

                {/* Output content */}
                <div style={{flex:1,overflow:'auto',padding:14}}>
                  <OutputContent content={selected.output || ''} />
                </div>

                {/* Description */}
                {selected.description && (
                  <div style={{
                    borderTop:'1px solid #2d1f4d', padding:'6px 14px',
                    flexShrink:0,
                    color:'#554466',fontFamily:'"DotGothic16",monospace',fontSize:9
                  }}>
                    📋 {selected.description?.slice(0,120)}
                  </div>
                )}
              </>
            ) : (
              <div style={{
                flex:1, display:'flex', alignItems:'center', justifyContent:'center',
                color:'#332244', fontFamily:'"DotGothic16",monospace', fontSize:11
              }}>
                Select a task to view its output
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function OutputContent({ content }) {
  // Detect if content has code blocks
  const hasCode = content.includes('```') || content.includes('    ') ||
                  content.includes('function') || content.includes('const ') ||
                  content.includes('def ') || content.includes('<div')

  if (hasCode) {
    // Split by code blocks
    const parts = content.split(/(```[\s\S]*?```)/g)
    return (
      <div style={{fontFamily:'"DotGothic16",monospace',fontSize:11,lineHeight:1.6}}>
        {parts.map((part, i) => {
          if (part.startsWith('```')) {
            const lines = part.split('\n')
            const lang = lines[0].replace('```','').trim() || 'code'
            const code = lines.slice(1, -1).join('\n')
            return (
              <div key={i} style={{
                background:'#060410', border:'1px solid #2d1f4d',
                borderLeft:'3px solid #c8a035',
                padding:'10px 12px', marginBottom:12,
                borderRadius:1, overflowX:'auto'
              }}>
                <div style={{
                  color:'#554466', fontSize:8,
                  fontFamily:'"Press Start 2P",monospace',
                  marginBottom:8
                }}>{lang.toUpperCase()}</div>
                <pre style={{
                  margin:0, color:'#88ccff',
                  fontFamily:'monospace', fontSize:11,
                  whiteSpace:'pre-wrap', wordBreak:'break-all'
                }}>{code}</pre>
              </div>
            )
          }
          return part ? (
            <p key={i} style={{color:'#d0c8b0',marginBottom:8,margin:'0 0 10px'}}>{part}</p>
          ) : null
        })}
      </div>
    )
  }

  return (
    <pre style={{
      color:'#d0c8b0', fontFamily:'"DotGothic16",monospace',
      fontSize:11, lineHeight:1.7, whiteSpace:'pre-wrap',
      wordBreak:'break-word', margin:0
    }}>{content}</pre>
  )
}

function statusColor(s) {
  return {completed:'#33cc88',failed:'#cc3344',in_progress:'#ffaa44',
          assigned:'#66aaff',pending:'#8888aa'}[s] || '#8888aa'
}
function statusIcon(s) {
  return {completed:'✓',failed:'✗',in_progress:'⚙',assigned:'→',pending:'○'}[s] || '·'
}