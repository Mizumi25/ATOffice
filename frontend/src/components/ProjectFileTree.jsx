import React, { useState, useEffect, useCallback, useRef } from 'react'
import { FolderOpen, Folder, FileCode, RefreshCw, ChevronRight, ChevronDown, Package } from 'lucide-react'

const API = 'http://localhost:8000'

const EXT_COLORS = {
  jsx:'#61dafb',tsx:'#61dafb',js:'#f7df1e',ts:'#3178c6',
  py:'#3776ab',md:'#4488cc',css:'#264de4',scss:'#cc669a',
  html:'#e34c26',json:'#888',sh:'#44aa44',
  yml:'#cc8844',yaml:'#cc8844',toml:'#9a6030',
  env:'#60b860',txt:'#999',sql:'#e88840',
}
const AGENT_COLORS = {
  haruto:'#6878c8', masa:'#285878',  yuki:'#c05898',
  ren:'#4898b8',    sora:'#508870',  kaito:'#8048b8',
  kazu:'#506898',   nao:'#a06040',   mei:'#b07840',
  mizu:'#6040a8',   system:'#666',   unknown:'#999',
}

function FileIcon({ name }) {
  const ext = (name||'').split('.').pop()?.toLowerCase()
  return <FileCode size={11} style={{color:EXT_COLORS[ext]||'#b090a8',flexShrink:0}}/>
}

export default function ProjectFileTree({ onSelectFile, selectedFile, refreshTick }) {
  const [projects, setProjects] = useState([])
  const filesRef = useRef({})
  const [, forceRender] = useState(0)
  const [expanded, setExpanded] = useState({})
  const [loading, setLoading] = useState(false)
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  // Try multiple endpoints to load files — robust fallback chain
  const loadFiles = useCallback(async (taskId, name) => {
    const key = name || taskId
    const endpoints = [
      taskId && `${API}/workspace/projects/${taskId}/files`,
      name   && `${API}/workspace/projects/${name}/files`,
      name   && `${API}/workspace/projects/${name}/files-by-name`,
    ].filter(Boolean)

    for (const url of endpoints) {
      try {
        const res = await fetch(url)
        if (!res.ok) continue
        const data = await res.json()
        const files = data.files || []
        if (!mounted.current) return
        filesRef.current[key] = files
        forceRender(n => n+1)
        return
      } catch {}
    }
    // Last resort: scan /workspace/files for anything matching project name
    try {
      const res = await fetch(`${API}/workspace/files`)
      if (res.ok) {
        const data = await res.json()
        const files = Array.isArray(data)
          ? data.filter(f => (f.path||'').includes(name||taskId||''))
          : []
        if (!mounted.current) return
        filesRef.current[key] = files
        forceRender(n => n+1)
      }
    } catch {}
  }, [])

  const loadProjects = useCallback(async (silent=false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch(`${API}/workspace/projects`)
      if (!res.ok) return
      const list = await res.json()
      if (!mounted.current) return
      const arr = Array.isArray(list) ? list : []
      setProjects(arr)
      if (arr.length > 0) {
        setExpanded(prev =>
          Object.keys(prev).length === 0 ? { [arr[0].name]: true } : prev
        )
      }
      for (const p of arr) loadFiles(p.task_id, p.name)
    } catch {}
    if (mounted.current && !silent) setLoading(false)
  }, [loadFiles])

  useEffect(() => { loadProjects() }, [refreshTick])
  useEffect(() => {
    const iv = setInterval(() => loadProjects(true), 3500)
    return () => clearInterval(iv)
  }, [loadProjects])

  const toggle = useCallback((taskId, name) => {
    const key = name || taskId
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
    if (!filesRef.current[key]) loadFiles(taskId, name)
  }, [loadFiles])

  const totalFiles = Object.values(filesRef.current).reduce((s,f) => s + f.length, 0)

  if (!projects.length && !loading) return (
    <div style={{padding:'32px 16px',textAlign:'center',color:'var(--text3)'}}>
      <FolderOpen size={28} style={{margin:'0 auto 12px',display:'block',opacity:0.25}}/>
      <div style={{fontSize:12,marginBottom:4}}>No projects yet</div>
      <div style={{fontSize:11,marginBottom:14}}>Give the team a task to get started</div>
      <button onClick={()=>loadProjects()} style={{
        fontSize:11,padding:'4px 14px',background:'var(--bg2)',
        border:'1px solid var(--border)',borderRadius:6,cursor:'pointer',color:'var(--text2)',
        display:'inline-flex',alignItems:'center',gap:5,
      }}><RefreshCw size={10}/>Refresh</button>
    </div>
  )

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column'}}>
      {/* Header */}
      <div style={{padding:'6px 12px',borderBottom:'1px solid var(--border)',display:'flex',
        alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <span style={{fontSize:11,color:'var(--text3)',fontWeight:500}}>
          {projects.length} project{projects.length!==1?'s':''} · {totalFiles} files
        </span>
        <button onClick={()=>loadProjects()} style={{background:'none',border:'none',cursor:'pointer',padding:3,display:'flex'}}>
          <RefreshCw size={11} style={{
            color:loading?'var(--accent)':'var(--text3)',
            animation:loading?'spin 1s linear infinite':'none'
          }}/>
        </button>
      </div>

      {/* List */}
      <div style={{flex:1,overflowY:'auto',padding:'4px 0'}}>
        {projects.map(proj => {
          const key = proj.name || proj.task_id
          const isOpen = !!expanded[key]
          const files = filesRef.current[key] || []

          // Group by top folder — normalize path, handle flat files and nested
          const folders = {}
          files.forEach(f => {
            const rawPath = (f.path||f.name||'').replace(/\\/g,'/')
            const parts = rawPath.split('/').filter(Boolean)
            // If path has subdirs, group by first dir. Otherwise root ''
            const folder = parts.length > 1 ? parts[0] : ''
            ;(folders[folder] = folders[folder]||[]).push({...f, _normPath: rawPath})
          })
          // Sort: root files first, then folders alphabetically
          const sortedFolders = Object.entries(folders).sort(([a],[b]) => {
            if(a===''&&b!=='') return -1
            if(a!==''&&b==='') return 1
            return a.localeCompare(b)
          })

          return (
            <div key={key}>
              <div onClick={() => toggle(proj.task_id, proj.name)} style={{
                display:'flex',alignItems:'center',gap:7,
                padding:'6px 10px',cursor:'pointer',userSelect:'none',
                background:isOpen?'var(--bg2)':'transparent',
                borderBottom:'1px solid var(--border)',
              }}>
                {isOpen
                  ? <ChevronDown size={10} style={{color:'var(--accent)',flexShrink:0}}/>
                  : <ChevronRight size={10} style={{color:'var(--text3)',flexShrink:0}}/>}
                <Package size={11} style={{color:'var(--accent)',flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',
                    whiteSpace:'nowrap',color:'var(--text)'}}>{proj.name}</div>
                  <div style={{fontSize:10,color:'var(--text3)',marginTop:1}}>
                    {files.length} file{files.length!==1?'s':''}
                    {proj.agents?.length>0 && ` · ${proj.agents.slice(0,3).join(', ')}`}
                  </div>
                </div>
              </div>

              {isOpen && (
                <div style={{background:'var(--bg)'}}>
                  {files.length===0 ? (
                    <div style={{padding:'10px 20px',fontSize:11,color:'var(--text3)',
                      display:'flex',alignItems:'center',gap:6}}>
                      <RefreshCw size={9} style={{animation:'spin 1.5s linear infinite',opacity:0.5}}/>
                      Scanning files...
                    </div>
                  ) : sortedFolders.map(([folder, folderFiles]) => (
                    <div key={folder}>
                      {folder && (
                        <div style={{padding:'3px 10px 3px 22px',display:'flex',
                          alignItems:'center',gap:5}}>
                          <Folder size={10} style={{color:'var(--text3)'}}/>
                          <span style={{fontSize:10,color:'var(--text3)',fontWeight:600,
                            fontFamily:'monospace'}}>{folder}/</span>
                        </div>
                      )}
                      {folderFiles.map(f => {
                        const fname = f.name || (f.path||'').split('/').pop()
                        const isSel = selectedFile?.path===(f.path||f.name)
                        return (
                          <div key={f.path||f.name} onClick={()=>onSelectFile(f)}
                            style={{
                              display:'flex',alignItems:'center',gap:6,
                              padding:`4px 10px 4px ${folder?36:22}px`,
                              cursor:'pointer',
                              background:isSel?'var(--bg2)':'transparent',
                              borderLeft:isSel?'2px solid var(--accent)':'2px solid transparent',
                            }}
                            onMouseOver={e=>!isSel&&(e.currentTarget.style.background='var(--bg2)')}
                            onMouseOut={e=>!isSel&&(e.currentTarget.style.background='transparent')}
                          >
                            <FileIcon name={fname}/>
                            <div style={{width:6,height:6,borderRadius:'50%',flexShrink:0,
                              background:AGENT_COLORS[f.agent||'unknown']||'#999'}}/>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:11,overflow:'hidden',textOverflow:'ellipsis',
                                whiteSpace:'nowrap',color:'var(--text)'}}>{fname}</div>
                              <div style={{fontSize:9,color:'var(--text3)',marginTop:1}}>
                                {f.agent}{f.size!=null?` · ${(f.size/1024).toFixed(1)}kb`:''}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}