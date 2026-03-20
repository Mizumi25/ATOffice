import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  Wifi, WifiOff, ClipboardList, Trophy, Terminal, FolderOpen,
  Send, RefreshCw, X, Copy, Check, ChevronRight,
  FileCode, Folder, Moon, Sun, Sunrise, Sunset,
  Music, Play, Pause, Volume2, Users, MessageSquare, Zap
} from 'lucide-react'
import { useOfficeStore } from './store/officeStore'
import PixelOffice, { useOfficeTime } from './components/PixelOffice'
import AgentDialogues from './components/AgentDialogues'

const API = 'http://localhost:8000'
const AGENT_COLORS = {
  pm:'#6878c8',designer:'#c05898',frontend:'#4898b8',
  backend:'#508870',qa:'#b07840',blog:'#c86878',
  github:'#506898',techlead:'#985858'
}

function TimeIcon({ hour }) {
  const h = hour||9
  if(h>=5&&h<7)  return <Sunrise size={13}/>
  if(h>=7&&h<18) return <Sun size={13}/>
  if(h>=18&&h<20)return <Sunset size={13}/>
  return <Moon size={13}/>
}

function FileIconC({ name }) {
  const ext = name?.split('.').pop()?.toLowerCase()
  const colors={jsx:'#61dafb',js:'#f7df1e',py:'#3776ab',md:'#4488cc',css:'#264de4',html:'#e34c26',json:'#888',sh:'#44aa44',ts:'#3178c6'}
  return <FileCode size={13} style={{color:colors[ext]||'#b090a8',flexShrink:0}}/>
}

// ── FILE TREE ─────────────────────────────────────────────────────────────
function FileTree({ onSelectFile, selectedFile, refreshTick }) {
  const [files,setFiles]=useState([])
  const [loading,setLoading]=useState(false)
  const refresh=useCallback(async()=>{
    setLoading(true)
    try{const r=await fetch(`${API}/workspace/files`);const d=await r.json();setFiles(Array.isArray(d)?d:[])}catch{}
    setLoading(false)
  },[])
  useEffect(()=>{refresh()},[refreshTick])
  useEffect(()=>{refresh()},[])
  if(!files.length&&!loading) return(
    <div style={{padding:'28px 16px',textAlign:'center',color:'var(--text3)'}}>
      <FolderOpen size={30} style={{margin:'0 auto 10px',display:'block',opacity:0.3}}/>
      <div style={{fontSize:12,marginBottom:4}}>No files yet</div>
      <div style={{fontSize:11}}>Give the team a task!</div>
    </div>
  )
  const byAgent={}
  files.forEach(f=>{(byAgent[f.agent]=byAgent[f.agent]||[]).push(f)})
  return(
    <div style={{height:'100%',display:'flex',flexDirection:'column'}}>
      <div style={{padding:'8px 12px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <span style={{fontSize:11,color:'var(--text3)',fontWeight:500}}>{files.length} files</span>
        <button className="btn btn-ghost btn-xs" onClick={refresh} style={{padding:'3px 8px'}}>
          <RefreshCw size={11} style={{color:loading?'var(--accent)':'var(--text3)',animation:loading?'spin 1s linear infinite':'none'}}/>
        </button>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'6px 0'}}>
        {Object.entries(byAgent).map(([agent,agentFiles])=>(
          <div key={agent}>
            <div style={{padding:'5px 12px 3px',display:'flex',alignItems:'center',gap:6}}>
              <Folder size={11} style={{color:AGENT_COLORS[agent]||'var(--text3)',flexShrink:0}}/>
              <span style={{fontSize:10,fontWeight:700,color:AGENT_COLORS[agent]||'var(--text3)',textTransform:'uppercase',letterSpacing:0.5}}>{agent}</span>
            </div>
            {agentFiles.map(f=>(
              <div key={f.path} className={`file-row ${selectedFile?.path===f.path?'selected':''}`}
                onClick={()=>onSelectFile(f)} style={{paddingLeft:24}}>
                <FileIconC name={f.name}/>
                <div style={{flex:1,overflow:'hidden'}}>
                  <div style={{fontSize:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.name}</div>
                  <div style={{fontSize:9,color:'var(--text3)',marginTop:1}}>{(f.size/1024).toFixed(1)}kb · {f.modified?.slice(11,16)}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── CODE VIEWER ───────────────────────────────────────────────────────────
function CodeViewer({ file, onClose }) {
  const [content,setContent]=useState(file.content||'')
  const [copied,setCopied]=useState(false)
  useEffect(()=>{
    if(!file.content){
      fetch(`${API}/workspace/file?path=${encodeURIComponent(file.path)}`).then(r=>r.json()).then(d=>setContent(d.content||'')).catch(()=>{})
    }
  },[file])
  const copy=()=>{navigator.clipboard.writeText(content);setCopied(true);setTimeout(()=>setCopied(false),2000)}
  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:'90vw',maxWidth:820,height:'82vh'}}>
        <div className="modal-title">
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <FileIconC name={file.name}/>
            <div><div style={{fontWeight:600}}>{file.name}</div><div style={{fontSize:10,color:'var(--text3)',fontWeight:400}}>{file.path}</div></div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-secondary btn-sm" onClick={copy}>{copied?<Check size={12}/>:<Copy size={12}/>}{copied?'Copied':'Copy'}</button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={14}/></button>
          </div>
        </div>
        <div style={{flex:1,overflow:'auto',background:'#1a1218',borderRadius:'0 0 20px 20px'}}>
          <pre style={{margin:0,padding:16,fontFamily:'JetBrains Mono,monospace',fontSize:11,lineHeight:1.7,color:'#e8d8e8',whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{content}</pre>
        </div>
      </div>
    </div>
  )
}

// ── TERMINAL ──────────────────────────────────────────────────────────────
function TerminalPanel({ events }) {
  const ref=useRef(null)
  useEffect(()=>{if(ref.current)ref.current.scrollTop=ref.current.scrollHeight},[events])
  return(
    <div style={{height:'100%',display:'flex',flexDirection:'column',background:'#1a1218'}}>
      <div style={{padding:'8px 12px',borderBottom:'1px solid #2a1a28',display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
        <div style={{display:'flex',gap:5}}>
          {['#f08080','#e0c040','#60b870'].map(c=><div key={c} style={{width:9,height:9,borderRadius:'50%',background:c}}/>)}
        </div>
        <span style={{color:'#887898',fontSize:10,fontFamily:'JetBrains Mono',marginLeft:4}}>atoffice — terminal</span>
      </div>
      <div ref={ref} style={{flex:1,overflowY:'auto',padding:'8px 12px'}}>
        {!events.length?(
          <div style={{color:'#554468',fontFamily:'JetBrains Mono',fontSize:10,paddingTop:12}}>
            <span style={{color:'#887898'}}>$</span> waiting for agent commands...<span style={{color:'#f090b8'}}>_</span>
          </div>
        ):events.map((e,i)=>{
          const ac=AGENT_COLORS[e.agent_id]||'#887898'
          const at=(e.agent_id||'??').slice(0,2).toUpperCase()
          return(
            <div key={i} style={{marginBottom:5,fontFamily:'JetBrains Mono'}}>
              {e.event==='command_start'&&(
                <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                  <span style={{color:ac,fontSize:9,fontWeight:700,minWidth:18,flexShrink:0}}>{at}</span>
                  <span style={{color:'#f090b8',fontSize:10}}>$ {e.cmd}</span>
                </div>
              )}
              {e.event==='command_done'&&(
                <div style={{paddingLeft:26}}>
                  {e.stdout?.trim().split('\n').map((l,j)=><div key={j} style={{color:'#d8c8d8',fontSize:10,lineHeight:1.5}}>{l}</div>)}
                  {e.stderr?.trim()&&<div style={{color:'#f08080',fontSize:10}}>{e.stderr.slice(0,200)}</div>}
                  <div style={{color:e.returncode===0?'#60b870':'#f08080',fontSize:9,marginTop:1}}>[{e.returncode===0?'ok':'err'} · {e.agent_id}]</div>
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
    </div>
  )
}

// ── CHAT ──────────────────────────────────────────────────────────────────
function ChatPanel({ messages, agents, chatInput, setChatInput, chatTarget, setChatTarget, onSend }) {
  const feedRef=useRef(null)
  useEffect(()=>{if(feedRef.current)feedRef.current.scrollTop=feedRef.current.scrollHeight},[messages])
  const agentArr=[null,...Object.values(agents)]
  const typeTag=t=>{
    if(t==='joke')return <span className="tag tag-joke">joke</span>
    if(t==='meeting')return <span className="tag tag-meeting">standup</span>
    if(t==='task_update')return <span className="tag tag-task">task</span>
    return null
  }
  return(
    <div style={{height:'100%',display:'flex',flexDirection:'column'}}>
      {/* Horizontal scroll target selector - single line */}
      <div style={{padding:'6px 8px',borderBottom:'1px solid var(--border)',display:'flex',gap:4,flexShrink:0,overflowX:'auto',overflowY:'hidden',scrollbarWidth:'none',alignItems:'center'}}>
        <style>{`.target-scroll::-webkit-scrollbar{display:none}`}</style>
        {agentArr.map(a=>{
          const isActive=chatTarget===(a?.id||null)
          const color=a?AGENT_COLORS[a.id]||'var(--text3)':'var(--text2)'
          return(
            <button key={a?.id||'all'} onClick={()=>setChatTarget(a?.id||null)}
              style={{padding:'3px 10px',borderRadius:20,flexShrink:0,border:isActive?`1.5px solid ${color}`:'1.5px solid var(--border)',background:isActive?`${color}15`:'transparent',color:isActive?color:'var(--text3)',fontSize:11,cursor:'pointer',fontWeight:isActive?600:400,transition:'all 0.15s',whiteSpace:'nowrap'}}>
              {a?a.name:'All'}
            </button>
          )
        })}
      </div>
      {/* Messages */}
      <div ref={feedRef} style={{flex:1,overflowY:'auto',padding:'6px 4px',minHeight:0}}>
        {messages.map((m,i)=>{
          const sender=agents[m.sender_id]
          const isUser=m.sender_id==='user'||m.sender_id==='Boss'
          const color=AGENT_COLORS[m.sender_id]||(isUser?'var(--accent4)':'var(--text3)')
          const clean=(m.content||'').replace(/\[To User\]\s*/g,'').replace(/\*\*(.*?)\*\*/g,'$1')
          return(
            <div key={m.id||i} className={`msg-row ${isUser?'from-user':''}`}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                <span style={{fontSize:15}}>{sender?.emoji||(isUser?'🫵':'💬')}</span>
                <span style={{color,fontWeight:600,fontSize:11}}>{sender?.name||m.sender_id}</span>
                {typeTag(m.message_type)}
                <span style={{color:'var(--text3)',fontSize:10,marginLeft:'auto'}}>
                  {m.timestamp?new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):''}
                </span>
              </div>
              <div style={{color:'var(--text)',fontSize:12,paddingLeft:22,lineHeight:1.55}}>{clean}</div>
            </div>
          )
        })}
        {!messages.length&&(
          <div style={{textAlign:'center',padding:'28px 12px',color:'var(--text3)'}}>
            <MessageSquare size={28} style={{margin:'0 auto 10px',display:'block',opacity:0.3}}/>
            <div style={{fontSize:12}}>Office is quiet...</div>
            <div style={{fontSize:11,marginTop:4}}>Say hi to the team!</div>
          </div>
        )}
      </div>
      {/* Input */}
      <div style={{padding:'8px',borderTop:'1px solid var(--border)',flexShrink:0}}>
        {chatTarget&&<div style={{fontSize:10,color:'var(--accent)',marginBottom:4,display:'flex',alignItems:'center',gap:4}}><ChevronRight size={10}/>{agents[chatTarget]?.name}</div>}
        <div style={{display:'flex',gap:6}}>
          <input value={chatInput} onChange={e=>setChatInput(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&chatInput.trim())onSend(chatInput,chatTarget)}}
            placeholder={chatTarget?`Message ${agents[chatTarget]?.name}...`:'Message the office...'}
            style={{flex:1,fontSize:12}}/>
          <button className="btn btn-primary btn-sm" onClick={()=>chatInput.trim()&&onSend(chatInput,chatTarget)} style={{padding:'7px 12px',borderRadius:10}}>
            <Send size={13}/>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PIXEL MUSIC BOX ───────────────────────────────────────────────────────
function PixelMusicBox() {
  const [open,setOpen]=useState(false)
  const [playing,setPlaying]=useState(false)
  const [trackName,setTrackName]=useState('')
  const [volume,setVolume]=useState(0.5)
  const [beat,setBeat]=useState(0)
  const audioRef=useRef(null)
  const fileRef=useRef(null)
  const canvasRef=useRef(null)
  useEffect(()=>{if(audioRef.current)audioRef.current.volume=volume},[volume])
  useEffect(()=>{
    if(!playing)return
    const iv=setInterval(()=>setBeat(b=>(b+1)%4),300)
    return()=>clearInterval(iv)
  },[playing])
  useEffect(()=>{
    const c=canvasRef.current;if(!c)return
    const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false
    ctx.clearRect(0,0,52,52)
    // Body
    ctx.fillStyle='#e8a8c8';ctx.fillRect(6,16,40,26)
    ctx.fillStyle='#f0c0d8';ctx.fillRect(6,16,40,4)
    ctx.fillStyle='#c880a8';ctx.fillRect(6,38,40,4)
    // Lid
    ctx.fillStyle='#d898b8';ctx.fillRect(4,12,44,6)
    ctx.fillStyle='#f4d0e8';ctx.fillRect(4,12,44,2)
    // Speaker
    for(let i=0;i<5;i++){ctx.fillStyle='#b868a0';ctx.fillRect(10+i*5,22,3,12)}
    // Knob
    ctx.fillStyle=playing?['#f8e040','#ffe060','#f8c020','#fff080'][beat]:'#c0a0b8'
    ctx.fillRect(38,18,6,6);ctx.fillStyle='rgba(255,255,255,0.5)';ctx.fillRect(39,19,2,2)
    // Notes
    if(playing){
      const noteColors=['#f8b8e0','#e890c8','#ffc8e8','#e878b8']
      ctx.fillStyle=noteColors[beat];ctx.font='9px serif'
      ctx.fillText(['♪','♫','♩','♬'][beat],7,34)
    }
    // Legs
    ctx.fillStyle='#c880a8';ctx.fillRect(10,42,4,6);ctx.fillRect(38,42,4,6)
  },[playing,beat])
  const handleFile=e=>{
    const f=e.target.files[0];if(!f)return
    const url=URL.createObjectURL(f)
    if(audioRef.current){audioRef.current.src=url;audioRef.current.play();setPlaying(true)}
    setTrackName(f.name.replace(/\.[^.]+$/,''))
  }
  const toggle=()=>{if(!audioRef.current)return;if(playing){audioRef.current.pause();setPlaying(false)}else{audioRef.current.play();setPlaying(true)}}
  return(
    <>
      <audio ref={audioRef} loop/>
      <div style={{position:'absolute',bottom:10,right:10,zIndex:15,cursor:'pointer'}} onClick={()=>setOpen(o=>!o)} title="Music Box">
        <canvas ref={canvasRef} width={52} height={52} style={{imageRendering:'pixelated',filter:playing?'drop-shadow(0 0 8px rgba(232,120,180,0.9))':'drop-shadow(0 2px 4px rgba(160,80,120,0.3))',transition:'filter 0.4s'}}/>
      </div>
      {open&&(
        <div style={{position:'absolute',bottom:70,right:10,zIndex:50,width:210,background:'var(--card)',borderRadius:16,border:'1.5px solid var(--glass-border)',boxShadow:'var(--neu-card)',overflow:'hidden'}}>
          <div style={{padding:'10px 14px',background:'linear-gradient(135deg,rgba(232,120,160,0.08),rgba(160,96,192,0.06))',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}><Music size={13} style={{color:'var(--accent)'}}/><span style={{fontWeight:600,fontSize:12}}>Lo-Fi Player</span></div>
            <button onClick={()=>setOpen(false)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)'}}><X size={13}/></button>
          </div>
          <div style={{padding:14}}>
            <div style={{padding:'7px 10px',background:'var(--bg2)',borderRadius:8,marginBottom:10,fontSize:11,color:trackName?'var(--text)':'var(--text3)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',boxShadow:'var(--neu-in)'}}>
              {trackName||'No track selected'}{playing&&<span style={{marginLeft:6,color:'var(--pink)',fontWeight:700}}>♪</span>}
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'center',marginBottom:12}}>
              <button className="btn btn-secondary btn-sm" onClick={()=>fileRef.current?.click()}><FolderOpen size={12}/> Pick</button>
              {trackName&&<button className={`btn btn-sm ${playing?'btn-primary':'btn-secondary'}`} onClick={toggle}>{playing?<Pause size={12}/>:<Play size={12}/>}</button>}
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <Volume2 size={11} style={{color:'var(--text3)',flexShrink:0}}/>
              <input type="range" min="0" max="1" step="0.05" value={volume} onChange={e=>setVolume(parseFloat(e.target.value))} style={{flex:1,accentColor:'var(--pink)'}}/>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="audio/*" style={{display:'none'}} onChange={handleFile}/>
        </div>
      )}
    </>
  )
}

// ── MAIN APP ──────────────────────────────────────────────────────────────
export default function App() {
  const { connected,agents,messages,tasks,leaderboard,stats,notifications,commandInput,chatInput,chatTarget,selectedAgent,activeModal,connectWS,setCommandInput,setChatInput,setChatTarget,setSelectedAgent,setActiveModal,sendCommand,sendChat,fetchStats,fetchTasks,continueWork,agentAction,addNotification } = useOfficeStore()
  const containerRef=useRef(null)
  const [canvasSize,setCanvasSize]=useState({w:800,h:500})
  const [time,setTime]=useState(0)
  const animRef=useRef(null)
  const officeHour=useOfficeTime()
  const [rightTab,setRightTab]=useState('chat')
  const [selectedFile,setSelectedFile]=useState(null)
  const [termEvents,setTermEvents]=useState([])
  const [agentActivities,setAgentActivities]=useState({})
  const [showCommand,setShowCommand]=useState(false)
  const [refreshTick,setRefreshTick]=useState(0)
  const [petals,setPetals]=useState([])

  useEffect(()=>{
    let last=0
    const loop=ts=>{setTime(t=>t+(ts-last)/1000);last=ts;animRef.current=requestAnimationFrame(loop)}
    animRef.current=requestAnimationFrame(loop)
    return()=>cancelAnimationFrame(animRef.current)
  },[])

  useEffect(()=>{
    const measure=()=>{if(!containerRef.current)return;const{width,height}=containerRef.current.getBoundingClientRect();setCanvasSize({w:Math.round(width),h:Math.round(height)})}
    measure();const ro=new ResizeObserver(measure);if(containerRef.current)ro.observe(containerRef.current)
    return()=>ro.disconnect()
  },[])

  useEffect(()=>{connectWS();fetchStats();fetchTasks();const iv=setInterval(()=>{fetchStats();fetchTasks()},30000);return()=>clearInterval(iv)},[])

  useEffect(()=>{
    const store=useOfficeStore.getState();const orig=store.handleWSMessage
    useOfficeStore.setState({handleWSMessage:(data)=>{
      if(data.type==='terminal_event'){setTermEvents(ev=>[...ev.slice(-150),data]);return}
      if(data.type==='agent_activity'){setAgentActivities(prev=>({...prev,[data.agent_id]:data.activity}));return}
      if(data.type==='refresh_files'){setRefreshTick(t=>t+1);return}
      if(data.type==='output_ready'){setRefreshTick(t=>t+1);setRightTab('files');addNotification(`${data.agent} finished: ${(data.title||'').slice(0,30)}`,'success')}
      orig(data)
    }})
  },[agents])

  useEffect(()=>{
    const iv=setInterval(()=>{
      if(Math.random()>0.5){const p={id:Date.now(),x:Math.random()*100,duration:6+Math.random()*6,rotation:Math.random()*360};setPetals(prev=>[...prev.slice(-8),p])}
    },3000)
    return()=>clearInterval(iv)
  },[])

  const agentArr=Object.values(agents)

  return(
    <div style={{width:'100vw',height:'100vh',display:'flex',flexDirection:'column',background:'var(--bg)',overflow:'hidden'}}>
      {/* TOP BAR */}
      <div className="topbar">
        <div className="topbar-logo">ATOffice</div>
        <div style={{width:1,height:20,background:'var(--border)',margin:'0 4px'}}/>
        <div style={{display:'flex',alignItems:'center',gap:5}}>
          {connected?<Wifi size={13} style={{color:'var(--working)'}}/>:<WifiOff size={13} style={{color:'var(--resting)'}}/>}
          <span style={{fontSize:11,color:connected?'var(--working)':'var(--resting)',fontWeight:500}}>{connected?'Online':'Offline'}</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:4,color:'var(--text3)',fontSize:11}}>
          <TimeIcon hour={officeHour}/><span>{String(Math.floor(officeHour)).padStart(2,'0')}:00</span>
        </div>
        {stats&&(
          <div style={{display:'flex',gap:10,color:'var(--text3)',fontSize:11}}>
            <span style={{display:'flex',alignItems:'center',gap:3}}><ClipboardList size={11}/>{stats.total_tasks}</span>
            <span style={{display:'flex',alignItems:'center',gap:3}}><Check size={11}/>{stats.completed_today}</span>
            <span style={{display:'flex',alignItems:'center',gap:3}}><MessageSquare size={11}/>{stats.messages_today}</span>
          </div>
        )}
        <div style={{flex:1}}/>
        <button className="btn btn-ghost btn-sm" onClick={()=>{setRightTab('files');setRefreshTick(t=>t+1)}}><FolderOpen size={13}/>Files</button>
        <button className="btn btn-ghost btn-sm" onClick={()=>setRightTab('terminal')}><Terminal size={13}/>Terminal</button>
        <button className="btn btn-ghost btn-sm" onClick={continueWork}><Zap size={13}/>Continue</button>
        <button className="btn btn-ghost btn-sm" onClick={()=>{fetchTasks();setActiveModal('whiteboard')}}><ClipboardList size={13}/>Tasks</button>
        <button className="btn btn-ghost btn-sm" onClick={()=>{fetchStats();setActiveModal('leaderboard')}}><Trophy size={13}/>Ranks</button>
        <button className="btn btn-primary btn-sm" onClick={()=>setShowCommand(true)}><Send size={12}/>Command</button>
      </div>

      {/* MAIN */}
      <div className="main-layout" style={{flex:1,display:'flex',overflow:'hidden',minHeight:0}}>
        {/* Canvas */}
        <div className="office-area" ref={containerRef} style={{flex:1,position:'relative',overflow:'hidden',minHeight:200}}>
          <PixelOffice W={canvasSize.w} H={canvasSize.h} agents={agents} selectedAgent={selectedAgent} time={time} officeHour={officeHour}
            onAgentClick={id=>{if(id==='whiteboard'){fetchTasks();setActiveModal('whiteboard')}else{setSelectedAgent(id);setActiveModal('agent')}}}
            agentActivities={agentActivities}/>
          <AgentDialogues agents={agents} messages={messages} canvasW={canvasSize.w} canvasH={canvasSize.h} containerW={canvasSize.w} containerH={canvasSize.h} agentActivities={agentActivities}/>
          {petals.map(p=>(
            <div key={p.id} style={{
              position:'absolute',
              left:`${p.x}%`,
              top:0,
              width:7,height:9,
              background:'linear-gradient(135deg,#f8b8d8,#e890b8)',
              borderRadius:'50% 0 50% 0',
              animation:`petalDrop ${p.duration}s linear forwards`,
              pointerEvents:'none',zIndex:5,opacity:0.75,
            }}/>
          ))}
          <PixelMusicBox/>
        </div>

        {/* Right Panel */}
        <div className="right-panel">
          <div className="panel-tabs">
            {[['chat',<MessageSquare size={11}/>,'Chat'],['files',<FolderOpen size={11}/>,'Files'],['terminal',<Terminal size={11}/>,'Terminal']].map(([id,icon,label])=>(
              <div key={id} className={`panel-tab ${rightTab===id?'active':''}`} onClick={()=>setRightTab(id)}>
                <span style={{display:'flex',alignItems:'center',gap:5}}>{icon}{label}</span>
              </div>
            ))}
          </div>
          <div style={{flex:1,overflow:'hidden',minHeight:0}}>
            {rightTab==='chat'&&<ChatPanel messages={messages} agents={agents} chatInput={chatInput} setChatInput={setChatInput} chatTarget={chatTarget} setChatTarget={setChatTarget} onSend={sendChat}/>}
            {rightTab==='files'&&<FileTree onSelectFile={setSelectedFile} selectedFile={selectedFile} refreshTick={refreshTick}/>}
            {rightTab==='terminal'&&<TerminalPanel events={termEvents}/>}
          </div>
        </div>
      </div>

      {/* AGENT STRIP */}
      <div className="agent-strip">
        {agentArr.map(a=>(
          <div key={a.id} className={`agent-chip ${selectedAgent===a.id?'selected':''}`} onClick={()=>{setSelectedAgent(a.id);setActiveModal('agent')}}>
            <span style={{fontSize:17,flexShrink:0}}>{a.emoji}</span>
            <div style={{minWidth:0}}>
              <div style={{display:'flex',alignItems:'center',gap:5}}>
                <span className="chip-name">{a.name}</span>
                <div className={`status-dot ${a.status||'idle'}`}/>
              </div>
              <div className="chip-sub">{agentActivities[a.id]||a.status||'idle'}</div>
            </div>
          </div>
        ))}
        <div style={{flex:1}}/>
        <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0,paddingLeft:10,borderLeft:'1px solid var(--border)'}}>
          <input value={commandInput} onChange={e=>setCommandInput(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'&&commandInput.trim()){sendCommand(commandInput);setCommandInput('')}}}
            placeholder="Assign project to team... (Enter)" style={{width:220,fontSize:11}}/>
          <button className="btn btn-primary btn-sm" onClick={()=>{if(commandInput.trim()){sendCommand(commandInput);setCommandInput('')}}}><Send size={12}/></button>
        </div>
      </div>

      {/* NOTIFICATIONS */}
      <div style={{position:'fixed',top:60,right:12,zIndex:300,display:'flex',flexDirection:'column',gap:6,pointerEvents:'none'}}>
        {notifications.map(n=><div key={n.id} className={`notif ${n.type||''}`}>{n.message}</div>)}
      </div>

      {selectedFile&&<CodeViewer file={selectedFile} onClose={()=>setSelectedFile(null)}/>}
      {activeModal==='leaderboard'&&<LeaderboardModal leaderboard={leaderboard} onClose={()=>setActiveModal(null)}/>}
      {activeModal==='agent'&&selectedAgent&&agents[selectedAgent]&&(
        <AgentProfileModal agent={agents[selectedAgent]} onClose={()=>setActiveModal(null)} onAction={action=>{agentAction(selectedAgent,action);setActiveModal(null)}}/>
      )}
      {activeModal==='whiteboard'&&<WhiteboardModal tasks={tasks} onClose={()=>setActiveModal(null)} onRefresh={fetchTasks}/>}
      {showCommand&&<CommandModal onClose={()=>setShowCommand(false)} onSend={cmd=>{sendCommand(cmd);setShowCommand(false)}}/>}
    </div>
  )
}

function LeaderboardModal({onClose,leaderboard}){
  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:420}}>
        <div className="modal-title"><div style={{display:'flex',alignItems:'center',gap:8}}><Trophy size={16} style={{color:'var(--accent3)'}}/> Rankings</div><button className="btn btn-ghost btn-xs" onClick={onClose}><X size={14}/></button></div>
        <div className="modal-body">
          {leaderboard.map((a,i)=>(
            <div key={a.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 8px',borderRadius:10,background:i===0?'rgba(212,96,122,0.06)':'transparent',marginBottom:4}}>
              <span style={{fontSize:18}}>{['🥇','🥈','🥉'][i]||`#${i+1}`}</span>
              <span style={{fontSize:20}}>{a.emoji}</span>
              <div style={{flex:1}}><div style={{fontWeight:600}}>{a.name}</div><div style={{fontSize:11,color:'var(--text3)'}}>{a.role}</div></div>
              <div style={{textAlign:'right'}}><div style={{color:'var(--green)',fontWeight:600}}>{a.productivity_points||0} pts</div><div style={{fontSize:11,color:'var(--accent3)'}}>¥{(a.salary||0).toLocaleString()}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AgentProfileModal({agent,onClose,onAction}){
  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:340}}>
        <div className="modal-title"><span>{agent.emoji} {agent.name}</span><button className="btn btn-ghost btn-xs" onClick={onClose}><X size={14}/></button></div>
        <div className="modal-body">
          <div style={{display:'flex',gap:12,marginBottom:16,padding:12,background:'var(--bg2)',borderRadius:12,boxShadow:'var(--neu-in)'}}>
            <div style={{fontSize:44}}>{agent.emoji}</div>
            <div><div style={{fontWeight:700,fontSize:16}}>{agent.name}</div><div style={{color:'var(--text3)',fontSize:12}}>{agent.role}</div><div style={{marginTop:6}}><span className={`badge badge-${agent.status||'idle'}`}><div className={`status-dot ${agent.status||'idle'}`} style={{marginRight:4}}/>{agent.status||'idle'}</span></div></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:16}}>
            {[['Salary',`¥${(agent.salary||0).toLocaleString()}`,'var(--accent3)'],['Points',`${agent.productivity_points||0}`,'var(--green)'],['Status',agent.status||'idle','var(--blue)']].map(([l,v,c])=>(
              <div key={l} style={{background:'var(--bg2)',borderRadius:10,padding:'8px 10px',textAlign:'center',boxShadow:'var(--neu-in)'}}>
                <div style={{fontSize:9,color:'var(--text3)',textTransform:'uppercase',letterSpacing:0.5,marginBottom:3}}>{l}</div>
                <div style={{color:c,fontWeight:700,fontSize:12}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <button className="btn btn-secondary btn-sm" onClick={()=>onAction('ping')}><Zap size={12}/>Ping</button>
            <button className="btn btn-secondary btn-sm" onClick={()=>onAction('joke')}><MessageSquare size={12}/>Joke</button>
            {agent.status==='resting'?<button className="btn btn-primary btn-sm" onClick={()=>onAction('resume')}><Play size={12}/>Wake Up</button>:<button className="btn btn-secondary btn-sm" onClick={()=>onAction('pause')}><Pause size={12}/>Break</button>}
          </div>
        </div>
      </div>
    </div>
  )
}

function WhiteboardModal({tasks,onClose,onRefresh}){
  const [local,setLocal]=useState(tasks)
  const [deleting,setDeleting]=useState(null)
  const [confirmAll,setConfirmAll]=useState(false)
  useEffect(()=>setLocal(tasks),[tasks])
  const del=async id=>{setDeleting(id);try{await fetch(`${API}/tasks/${id}`,{method:'DELETE'});setLocal(p=>p.filter(t=>t.id!==id));onRefresh?.()}finally{setDeleting(null)}}
  const delAll=async status=>{await fetch(status?`${API}/tasks?status=${status}`:`${API}/tasks`,{method:'DELETE'});setLocal(p=>status?p.filter(t=>t.status!==status):p.filter(t=>t.status==='completed'));setConfirmAll(false);onRefresh?.()}
  const cols={pending:'Backlog',assigned:'Assigned',in_progress:'In Progress',completed:'Done',failed:'Failed'}
  const colColors={pending:'var(--text3)',assigned:'var(--accent)',in_progress:'var(--thinking)',completed:'var(--green)',failed:'#e06060'}
  const grouped={};Object.keys(cols).forEach(k=>grouped[k]=[])
  local.forEach(t=>{if(grouped[t.status])grouped[t.status].push(t)})
  const active=local.filter(t=>['pending','assigned','in_progress'].includes(t.status)).length
  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:'90vw',maxWidth:760}}>
        <div className="modal-title">
          <div style={{display:'flex',alignItems:'center',gap:8}}><ClipboardList size={15} style={{color:'var(--accent)'}}/> Task Board · {local.length}</div>
          <div style={{display:'flex',gap:6}}>
            {confirmAll?(<><span style={{fontSize:11,color:'#e06060'}}>Delete {active}?</span><button className="btn btn-danger btn-xs" onClick={()=>delAll()}>Yes</button><button className="btn btn-ghost btn-xs" onClick={()=>setConfirmAll(false)}>No</button></>):active>0?<button className="btn btn-danger btn-xs" onClick={()=>setConfirmAll(true)}>Clear Active</button>:null}
            <button className="btn btn-ghost btn-xs" onClick={onClose}><X size={14}/></button>
          </div>
        </div>
        <div className="modal-body">
          <div style={{display:'flex',gap:10,overflowX:'auto'}}>
            {Object.entries(cols).map(([status,label])=>(
              <div key={status} style={{minWidth:130,flex:1}}>
                <div style={{fontWeight:600,fontSize:11,color:colColors[status],marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  {label} ({grouped[status].length})
                  {['pending','assigned','in_progress','failed'].includes(status)&&grouped[status].length>0&&(
                    <button style={{background:'none',border:'none',cursor:'pointer',color:'#e06060',padding:2}} onClick={()=>delAll(status)}><X size={11}/></button>
                  )}
                </div>
                {grouped[status].slice(0,10).map(t=>(
                  <WBTaskCard key={t.id} task={t} color={colColors[status]} onDelete={()=>del(t.id)} isDeleting={deleting===t.id}/>
                ))}
                {!grouped[status].length&&<div style={{fontSize:11,color:'var(--text3)',textAlign:'center',padding:'10px 0'}}>empty</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function WBTaskCard({task,color,onDelete,isDeleting}){
  const [hover,setHover]=useState(false)
  const canDel=['pending','assigned','in_progress','failed'].includes(task.status)
  return(
    <div onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{background:hover?'var(--bg2)':'var(--bg3)',borderRadius:8,padding:'7px 9px',marginBottom:6,fontSize:11,position:'relative',border:'1px solid '+(hover?color+'55':'var(--border)'),transition:'all 0.1s'}}>
      <div style={{color:'var(--text)',marginBottom:3,lineHeight:1.3,paddingRight:canDel&&hover?18:0}}>{task.title?.slice(0,46)}</div>
      <div style={{fontSize:9,color:'var(--text3)'}}>{task.assigned_to} · #{task.id?.slice(0,5)}</div>
      {canDel&&hover&&<button onClick={e=>{e.stopPropagation();onDelete()}} disabled={isDeleting} style={{position:'absolute',top:4,right:4,background:'rgba(224,96,96,0.9)',border:'none',color:'#fff',borderRadius:5,width:17,height:17,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><X size={10}/></button>}
    </div>
  )
}

function CommandModal({onClose,onSend}){
  const [input,setInput]=useState('')
  const examples=['Build a portfolio website with hero, about, contact sections','Create a REST API for a todo app with auth','Design a landing page for a Japanese tea shop','Build a React dashboard with live charts']
  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:500}}>
        <div className="modal-title"><div style={{display:'flex',alignItems:'center',gap:8}}><Users size={15} style={{color:'var(--accent)'}}/> Command the Team</div><button className="btn btn-ghost btn-xs" onClick={onClose}><X size={14}/></button></div>
        <div className="modal-body">
          <p style={{fontSize:12,color:'var(--text3)',marginBottom:14}}>Haruto will plan it and the team writes real code files.</p>
          <textarea value={input} onChange={e=>setInput(e.target.value)} placeholder="Build a portfolio website..." rows={3} style={{marginBottom:14,resize:'vertical'}}/>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:10,color:'var(--text3)',textTransform:'uppercase',letterSpacing:0.5,marginBottom:8,fontWeight:600}}>Quick Examples</div>
            {examples.map((ex,i)=>(
              <div key={i} onClick={()=>setInput(ex)} style={{padding:'8px 12px',borderRadius:10,cursor:'pointer',fontSize:12,color:'var(--text2)',background:'var(--bg2)',marginBottom:5,border:'1px solid var(--border)',transition:'all 0.1s',boxShadow:'var(--neu-btn)'}}
                onMouseOver={e=>e.currentTarget.style.borderColor='var(--pink2)'} onMouseOut={e=>e.currentTarget.style.borderColor='var(--border)'}>
                <ChevronRight size={11} style={{display:'inline',marginRight:4}}/>{ex}
              </div>
            ))}
          </div>
          <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={()=>input.trim()&&onSend(input)}><Send size={12}/> Dispatch</button>
          </div>
        </div>
      </div>
    </div>
  )
}