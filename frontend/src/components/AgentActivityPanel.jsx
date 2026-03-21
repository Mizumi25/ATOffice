/**
 * AgentActivityPanel.jsx
 *
 * Claude-style live activity panel. Shows per-agent work cards:
 * - Collapsible card per agent
 * - Files written with size + preview on click
 * - Pipeline stage progress bar across top
 * - Accumulates state in useRef so tab switching never resets it
 *
 * WS events consumed:
 *   terminal_event (event=file_written) → add file to agent card
 *   agent_task_start                    → mark agent working + task title
 *   agent_update (status=working/idle)  → update working state
 *   output_ready                        → mark agent complete
 *   project_created / tasks_cleared    → reset for new project
 *   agent_activity                      → update activity label
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown, ChevronRight, CheckCircle, Circle, Eye, X, Zap } from 'lucide-react'

const API = 'http://localhost:8000'

const AGENT_COLORS = {
  pm:'#6878c8', product:'#3068a8', architect:'#285878',
  designer:'#c05898', mobile:'#d07898',
  frontend:'#4898b8', perf:'#3878a8',
  backend:'#508870', platform:'#288860',
  data:'#508888', aiml:'#8048b8', analytics:'#387898',
  github:'#506898', infra:'#488888', security:'#a06040',
  qa:'#b07840', sdet:'#907850',
  blog:'#c86878', growth:'#609848',
  techlead:'#985858',
}

const EXT_COLORS = {
  tsx:'#3178c6',ts:'#3178c6',jsx:'#61dafb',js:'#f7df1e',
  py:'#3776ab',css:'#264de4',html:'#e34c26',md:'#4488cc',
  json:'#999',sh:'#44aa44',yml:'#cc8844',yaml:'#cc8844',
  sql:'#e88840',env:'#60b860',toml:'#9a6030',
}

const PIPELINE = [
  {stage:0, label:'PRD',      agents:['product']},
  {stage:1, label:'Arch',     agents:['architect']},
  {stage:2, label:'Design',   agents:['designer']},
  {stage:3, label:'Build',    agents:['frontend','backend']},
  {stage:4, label:'Platform', agents:['mobile','data']},
  {stage:5, label:'Plat+',    agents:['platform']},
  {stage:6, label:'AI',       agents:['aiml','analytics']},
  {stage:7, label:'QA/Perf',  agents:['qa','perf']},
  {stage:8, label:'E2E/Sec',  agents:['sdet','security']},
  {stage:9, label:'Deploy',   agents:['infra','github']},
  {stage:10,label:'Review',   agents:['techlead','blog']},
  {stage:11,label:'Launch',   agents:['growth']},
]

function ExtBadge({ filename }) {
  const ext = (filename||'').split('.').pop()?.toLowerCase()
  const color = EXT_COLORS[ext] || '#888'
  return (
    <span style={{
      fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:4,
      background:`${color}20`, color, fontFamily:'monospace',
      letterSpacing:0.3, flexShrink:0,
    }}>.{ext}</span>
  )
}

function FilePreviewModal({ filename, content, onClose }) {
  return (
    <div style={{
      position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',
      zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',
    }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{
        width:'88vw',maxWidth:860,height:'80vh',
        background:'#1a1218',borderRadius:16,
        border:'1px solid #3a2038',display:'flex',flexDirection:'column',
        overflow:'hidden',
      }}>
        <div style={{
          padding:'10px 16px',borderBottom:'1px solid #2a1a28',
          display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,
        }}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <ExtBadge filename={filename}/>
            <span style={{color:'#e8d8e8',fontSize:12,fontWeight:500,fontFamily:'monospace'}}>
              {filename}
            </span>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'#887898',padding:4}}>
            <X size={14}/>
          </button>
        </div>
        <div style={{flex:1,overflow:'auto',padding:'12px 16px'}}>
          <pre style={{
            margin:0,fontFamily:'JetBrains Mono,monospace',fontSize:11,
            lineHeight:1.7,color:'#e8d8e8',whiteSpace:'pre-wrap',wordBreak:'break-word',
          }}>{content||'(preview not available — file written to disk)'}</pre>
        </div>
      </div>
    </div>
  )
}

function PipelineBar({ agentStatuses }) {
  return (
    <div style={{
      display:'flex',gap:3,padding:'8px 12px',
      borderBottom:'0.5px solid var(--color-border-tertiary)',
      overflowX:'auto',flexShrink:0,scrollbarWidth:'none',
    }}>
      {PIPELINE.map(({stage,label,agents})=>{
        const allDone  = agents.every(a=>agentStatuses[a]==='complete')
        const anyWork  = agents.some(a=>agentStatuses[a]==='working')
        const anyDone  = agents.some(a=>agentStatuses[a]==='complete')
        const col = allDone?'#60b870':anyWork?'#4898b8':anyDone?'#b07840':'var(--color-border-secondary)'
        return (
          <div key={stage} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,minWidth:34}}>
            <div style={{width:'100%',height:5,borderRadius:3,background:col,transition:'background 0.4s'}}/>
            <span style={{fontSize:8,color:'var(--color-text-tertiary)',whiteSpace:'nowrap'}}>{label}</span>
          </div>
        )
      })}
    </div>
  )
}

function AgentCard({ agentId, agent, data }) {
  const [expanded, setExpanded] = useState(false)
  const [preview, setPreview] = useState(null)
  const color = AGENT_COLORS[agentId] || '#888'
  const { working, complete, activity, taskTitle, files, lastMsg } = data

  const statusIcon = working
    ? <span style={{width:10,height:10,borderRadius:'50%',background:color,
        boxShadow:`0 0 6px ${color}`,display:'inline-block',flexShrink:0,
        animation:'pulse 1.2s ease-in-out infinite'}}/>
    : complete
      ? <CheckCircle size={11} style={{color:'#60b870',flexShrink:0}}/>
      : <Circle size={11} style={{color:'var(--color-border-tertiary)',flexShrink:0}}/>

  const hasContent = files.length > 0 || lastMsg

  return (
    <>
      <div style={{
        border:`0.5px solid ${working?color+'50':'var(--color-border-tertiary)'}`,
        borderRadius:'var(--border-radius-md)',marginBottom:5,
        background:working?`${color}06`:'transparent',
        transition:'border-color 0.2s,background 0.2s',
        overflow:'hidden',
      }}>
        <div
          onClick={()=>hasContent&&setExpanded(e=>!e)}
          style={{
            display:'flex',alignItems:'center',gap:8,
            padding:'7px 10px',
            cursor:hasContent?'pointer':'default',
            userSelect:'none',
          }}
        >
          {statusIcon}
          <span style={{fontSize:16,flexShrink:0}}>{agent?.emoji||'🤖'}</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <span style={{fontSize:12,fontWeight:500,color:'var(--color-text-primary)'}}>
                {agent?.name||agentId}
              </span>
              {working&&(
                <span style={{
                  fontSize:10,color,background:`${color}18`,
                  padding:'1px 7px',borderRadius:10,fontWeight:500,flexShrink:0,
                }}>working</span>
              )}
              {complete&&!working&&(
                <span style={{
                  fontSize:10,color:'#60b870',background:'rgba(96,184,112,0.12)',
                  padding:'1px 7px',borderRadius:10,flexShrink:0,
                }}>done</span>
              )}
            </div>
            {(activity||taskTitle)&&(
              <div style={{
                fontSize:10,color:'var(--color-text-secondary)',
                marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
              }}>
                {activity||taskTitle}
              </div>
            )}
          </div>
          {files.length>0&&(
            <span style={{
              fontSize:10,color:'var(--color-text-tertiary)',
              background:'var(--color-background-tertiary)',
              padding:'1px 7px',borderRadius:8,flexShrink:0,
            }}>{files.length} file{files.length!==1?'s':''}</span>
          )}
          {hasContent&&(
            expanded
              ?<ChevronDown size={12} style={{color:'var(--color-text-tertiary)',flexShrink:0}}/>
              :<ChevronRight size={12} style={{color:'var(--color-text-tertiary)',flexShrink:0}}/>
          )}
        </div>

        {expanded&&(
          <div style={{borderTop:'0.5px solid var(--color-border-tertiary)',padding:'8px 10px'}}>
            {lastMsg&&(
              <div style={{
                fontSize:11,color:'var(--color-text-secondary)',
                marginBottom:files.length?10:0,lineHeight:1.5,
                borderLeft:`2px solid ${color}`,paddingLeft:8,fontStyle:'italic',
              }}>
                {lastMsg.slice(0,220)}{lastMsg.length>220?'…':''}
              </div>
            )}
            <div style={{display:'flex',flexDirection:'column',gap:2}}>
              {files.slice(-8).map((file,i)=>(
                <div key={i}
                  onClick={()=>setPreview(file)}
                  style={{
                    display:'flex',alignItems:'center',gap:7,
                    padding:'4px 8px',borderRadius:6,
                    background:'var(--color-background-secondary)',
                    cursor:'pointer',
                    transition:'opacity 0.15s',
                  }}
                  onMouseOver={e=>e.currentTarget.style.opacity='0.75'}
                  onMouseOut={e=>e.currentTarget.style.opacity='1'}
                >
                  <ExtBadge filename={file.filename}/>
                  <span style={{
                    flex:1,fontSize:11,color:'var(--color-text-primary)',
                    overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
                    fontFamily:'monospace',
                  }}>{file.filename}</span>
                  {file.size!=null&&(
                    <span style={{fontSize:9,color:'var(--color-text-tertiary)',flexShrink:0}}>
                      {file.size>1024?`${(file.size/1024).toFixed(1)}kb`:`${file.size}b`}
                    </span>
                  )}
                  {file.patched&&(
                    <span style={{fontSize:9,color:'#60b870',flexShrink:0}}>patched</span>
                  )}
                  <Eye size={10} style={{color:'var(--color-text-tertiary)',flexShrink:0}}/>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {preview&&(
        <FilePreviewModal
          filename={preview.filename}
          content={preview.content||preview.preview}
          onClose={()=>setPreview(null)}
        />
      )}
    </>
  )
}

export default function AgentActivityPanel({ agents, wsEvents, agentActivities, termEvents }) {
  // Use a ref to accumulate state — never lost on re-render or tab switch
  const stateRef = useRef({})   // agentId → {working,complete,activity,taskTitle,files,lastMsg}
  const [, forceUpdate] = useState(0)
  const [showRawLog, setShowRawLog] = useState(false)
  const lastEventIdx = useRef(-1)

  // Initialize ref entries for all agents
  useEffect(()=>{
    if(!agents) return
    let changed = false
    for(const id of Object.keys(agents)){
      if(!stateRef.current[id]){
        stateRef.current[id] = {working:false,complete:false,activity:'',taskTitle:'',files:[],lastMsg:''}
        changed = true
      }
    }
    if(changed) forceUpdate(n=>n+1)
  },[agents])

  // Process only NEW events (track last processed index)
  useEffect(()=>{
    if(!wsEvents||wsEvents.length===0) return
    let changed = false
    const startIdx = Math.max(0, lastEventIdx.current + 1)

    for(let i=startIdx; i<wsEvents.length; i++){
      const ev = wsEvents[i]
      if(!ev) continue
      lastEventIdx.current = i

      const ensure = (id)=>{
        if(!stateRef.current[id]){
          stateRef.current[id] = {working:false,complete:false,activity:'',taskTitle:'',files:[],lastMsg:''}
        }
        return stateRef.current[id]
      }

      if(ev.type==='terminal_event' && ev.event==='file_written'){
        const s = ensure(ev.agent_id)
        const isPatch = (ev.filename||'').startsWith('[patched]')
        const fname = isPatch ? ev.filename.replace('[patched] ','') : ev.filename
        const existing = s.files.findIndex(f=>f.filename===fname)
        const entry = {filename:fname, size:ev.size, content:ev.preview, patched:isPatch}
        if(existing>=0) s.files[existing]=entry
        else s.files.push(entry)
        changed = true
      }

      if(ev.type==='agent_task_start'){
        const s = ensure(ev.agent_id)
        s.working = true
        s.complete = false
        s.taskTitle = ev.task_title||''
        changed = true
      }

      if(ev.type==='agent_activity'){
        const s = ensure(ev.agent_id)
        s.activity = ev.activity||''
        changed = true
      }

      if(ev.type==='agent_update'){
        const s = ensure(ev.agent_id)
        const st = ev.status||'idle'
        s.working = st==='working'||st==='thinking'
        if(st==='idle'&&s.working) s.working = false
        changed = true
      }

      if(ev.type==='output_ready'){
        // Match by agent name
        const match = Object.entries(agents||{}).find(([,a])=>a.name===ev.agent)
        if(match){
          const s = ensure(match[0])
          s.working = false
          s.complete = true
          if(ev.output) s.lastMsg = ev.output.slice(0,300)
          changed = true
        }
      }

      if(ev.type==='message' && ev.sender_id && ev.sender_id!=='user'){
        const s = ensure(ev.sender_id)
        s.lastMsg = (ev.content||'').replace(/\*\*(.*?)\*\*/g,'$1').slice(0,200)
        changed = true
      }

      if(ev.type==='project_created'||ev.type==='tasks_cleared'){
        // Reset all for new project
        for(const id of Object.keys(stateRef.current)){
          stateRef.current[id] = {working:false,complete:false,activity:'',taskTitle:'',files:[],lastMsg:''}
        }
        lastEventIdx.current = i
        changed = true
      }
    }

    if(changed) forceUpdate(n=>n+1)
  },[wsEvents, agents])

  // Sync agentActivities prop into ref
  useEffect(()=>{
    if(!agentActivities) return
    let changed = false
    for(const [id,act] of Object.entries(agentActivities)){
      if(!stateRef.current[id]){
        stateRef.current[id] = {working:false,complete:false,activity:'',taskTitle:'',files:[],lastMsg:''}
      }
      if(stateRef.current[id].activity !== act){
        stateRef.current[id].activity = act
        changed = true
      }
    }
    if(changed) forceUpdate(n=>n+1)
  },[agentActivities])

  const agentArr = Object.values(agents||{})
  const agentStatuses = {}
  for(const [id,s] of Object.entries(stateRef.current)){
    agentStatuses[id] = s.complete?'complete':s.working?'working':'idle'
  }

  const activeCount = Object.values(stateRef.current).filter(s=>s.working).length
  const doneCount   = Object.values(stateRef.current).filter(s=>s.complete).length
  const hasAny      = agentArr.some(a=>stateRef.current[a.id]?.files?.length||stateRef.current[a.id]?.complete||stateRef.current[a.id]?.working)

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:'var(--color-background-primary)'}}>
      {/* Header */}
      <div style={{
        padding:'8px 12px',borderBottom:'0.5px solid var(--color-border-tertiary)',
        display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,
      }}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:12,fontWeight:500,color:'var(--color-text-primary)'}}>Activity</span>
          {activeCount>0&&(
            <span style={{
              fontSize:10,fontWeight:500,padding:'1px 8px',borderRadius:10,
              background:'var(--color-background-info)',color:'var(--color-text-info)',
            }}>{activeCount} working</span>
          )}
          {doneCount>0&&(
            <span style={{
              fontSize:10,padding:'1px 8px',borderRadius:10,
              background:'rgba(96,184,112,0.12)',color:'#60b870',
            }}>{doneCount} done</span>
          )}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <button
            onClick={()=>setShowRawLog(v=>!v)}
            style={{
              fontSize:10,padding:'2px 8px',borderRadius:8,cursor:'pointer',
              background:showRawLog?'var(--color-background-info)':'transparent',
              color:showRawLog?'var(--color-text-info)':'var(--color-text-tertiary)',
              border:`0.5px solid ${showRawLog?'var(--color-border-info)':'var(--color-border-tertiary)'}`,
            }}
          >
            {showRawLog?'Activity':'Raw logs'}
          </button>
          <span style={{fontSize:10,color:'var(--color-text-tertiary)'}}>{agentArr.length}</span>
        </div>
      </div>

      {/* Pipeline progress */}
      <PipelineBar agentStatuses={agentStatuses}/>

      {/* Raw terminal log view */}
      {showRawLog&&(
        <div style={{flex:1,overflowY:'auto',background:'#1a1218',padding:'8px 12px',fontFamily:'JetBrains Mono,monospace'}}>
          {!termEvents?.length?(
            <div style={{color:'#554468',fontSize:10,paddingTop:12}}>
              <span style={{color:'#887898'}}>$</span> waiting for agent commands...<span style={{color:'#f090b8'}}>_</span>
            </div>
          ):(termEvents||[]).map((e,i)=>{
            const ac={pm:'#6878c8',product:'#3068a8',architect:'#285878',designer:'#c05898',mobile:'#d07898',frontend:'#4898b8',perf:'#3878a8',backend:'#508870',platform:'#288860',data:'#508888',aiml:'#8048b8',analytics:'#387898',github:'#506898',infra:'#488888',security:'#a06040',qa:'#b07840',sdet:'#907850',blog:'#c86878',growth:'#609848',techlead:'#985858',mizu:'#6040a8'}[e.agent_id]||'#887898'
            const at=(e.agent_id||'??').slice(0,2).toUpperCase()
            return(
              <div key={i} style={{marginBottom:4}}>
                {e.event==='command_start'&&(
                  <div style={{display:'flex',gap:8}}>
                    <span style={{color:ac,fontSize:9,fontWeight:700,minWidth:18}}>{at}</span>
                    <span style={{color:'#f090b8',fontSize:10}}>$ {e.cmd}</span>
                  </div>
                )}
                {e.event==='command_done'&&(
                  <div style={{paddingLeft:26}}>
                    {e.stdout?.trim().split('\n').map((l,j)=><div key={j} style={{color:'#d8c8d8',fontSize:10,lineHeight:1.5}}>{l}</div>)}
                    {e.stderr?.trim()&&<div style={{color:'#f08080',fontSize:10}}>{e.stderr.slice(0,200)}</div>}
                    <div style={{color:e.returncode===0?'#60b870':'#f08080',fontSize:9}}>[{e.returncode===0?'ok':'err'} · {e.agent_id}]</div>
                  </div>
                )}
                {e.event==='file_written'&&(
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <span style={{color:ac,fontSize:9,fontWeight:700,minWidth:18}}>{at}</span>
                    <span style={{color:'#60b870',fontSize:10}}>+ {e.filename} ({e.size}b)</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Agent cards */}
      <div style={{flex:1,overflowY:'auto',padding:'8px 10px',display:showRawLog?'none':'block'}}>
        {!hasAny?(
          <div style={{textAlign:'center',padding:'32px 16px',color:'var(--color-text-tertiary)'}}>
            <Zap size={28} style={{margin:'0 auto 10px',display:'block',opacity:0.2}}/>
            <div style={{fontSize:12,marginBottom:4}}>Waiting for work</div>
            <div style={{fontSize:11}}>Give the team a project to start</div>
          </div>
        ):(
          agentArr.map(agent=>(
            <AgentCard
              key={agent.id}
              agentId={agent.id}
              agent={agent}
              data={stateRef.current[agent.id]||{working:false,complete:false,activity:'',taskTitle:'',files:[],lastMsg:''}}
            />
          ))
        )}
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  )
}