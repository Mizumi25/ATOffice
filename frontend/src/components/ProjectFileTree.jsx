import React, { useState, useEffect, useRef, useCallback } from 'react'
import { FolderOpen, Folder, FileCode, RefreshCw, ChevronRight, ChevronDown, Package } from 'lucide-react'

const API = 'http://localhost:8000'

const EXT_COLORS = {
  jsx:'#61dafb',tsx:'#61dafb',js:'#f7df1e',ts:'#3178c6',
  py:'#3776ab',md:'#4488cc',css:'#264de4',scss:'#cc669a',
  html:'#e34c26',json:'#888',sh:'#44aa44',
  yml:'#cc8844',yaml:'#cc8844',env:'#60b860',txt:'#999',sql:'#e88840',
}
const AGENT_COLORS = {
  haruto:'#6878c8',masa:'#285878',yuki:'#c05898',ren:'#4898b8',
  sora:'#508870',kaito:'#8048b8',kazu:'#506898',nao:'#a06040',
  mei:'#b07840',mizu:'#6040a8',system:'#666',unknown:'#999',
}

function FileIcon({ name }) {
  const ext = (name||'').split('.').pop()?.toLowerCase()
  return <FileCode size={11} style={{color:EXT_COLORS[ext]||'#b090a8',flexShrink:0}}/>
}

export default function ProjectFileTree({ onSelectFile, selectedFile, refreshTick }) {
  const [projects, setProjects]   = useState([])
  const [files, setFiles]         = useState({})   // { projectName: [...] }
  const [expanded, setExpanded]   = useState({})
  const [loading, setLoading]     = useState(false)
  const [status, setStatus]       = useState('')

  // ── fetch project list ────────────────────────────────────────────────────
  const fetchProjects = useCallback(async () => {
    setLoading(true)
    setStatus('Fetching projects...')
    try {
      const r = await fetch(`${API}/workspace/projects`)
      if (!r.ok) { setStatus(`Error ${r.status}`); return }
      const data = await r.json()
      const arr = Array.isArray(data) ? data : []
      setStatus(`Got ${arr.length} projects`)
      setProjects(arr)
      // auto-expand first
      if (arr.length > 0) {
        setExpanded(prev => Object.keys(prev).length === 0 ? {[arr[0].name]: true} : prev)
      }
      // fetch files for all
      for (const p of arr) fetchFiles(p.name, p.task_id)
    } catch(e) {
      setStatus(`Fetch error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  // ── fetch files for one project ───────────────────────────────────────────
  const fetchFiles = useCallback(async (name, taskId) => {
    // Try by name first (most reliable), then by task_id
    const urls = [
      `${API}/workspace/projects/${encodeURIComponent(name)}/files-by-name`,
      `${API}/workspace/projects/${encodeURIComponent(taskId)}/files`,
    ]
    for (const url of urls) {
      try {
        const r = await fetch(url)
        if (!r.ok) continue
        const data = await r.json()
        const list = data.files || []
        setFiles(prev => ({...prev, [name]: list}))
        return
      } catch {}
    }
  }, [])

  // ── effects ───────────────────────────────────────────────────────────────
  useEffect(() => { fetchProjects() }, [])
  useEffect(() => { if (refreshTick > 0) fetchProjects() }, [refreshTick])
  useEffect(() => {
    const iv = setInterval(fetchProjects, 6000)
    return () => clearInterval(iv)
  }, [])

  const toggle = (name, taskId) => {
    setExpanded(prev => {
      const next = {...prev, [name]: !prev[name]}
      if (next[name]) fetchFiles(name, taskId)
      return next
    })
  }

  const totalFiles = Object.values(files).reduce((s, f) => s + f.length, 0)

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',fontSize:12}}>
      {/* header */}
      <div style={{padding:'6px 12px',borderBottom:'1px solid var(--border)',
        display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <span style={{fontSize:11,color:'var(--text3)',fontWeight:500}}>
          {projects.length} project{projects.length!==1?'s':''} · {totalFiles} files
        </span>
        <button onClick={fetchProjects} style={{background:'none',border:'none',cursor:'pointer',padding:3,display:'flex'}}>
          <RefreshCw size={11} style={{
            color: loading ? 'var(--accent)' : 'var(--text3)',
            animation: loading ? 'spin 1s linear infinite' : 'none'
          }}/>
        </button>
      </div>

      {/* debug status — remove once working */}
      {status && (
        <div style={{padding:'2px 12px',fontSize:10,color:'var(--text3)',borderBottom:'1px solid var(--border)',opacity:0.7}}>
          {status}
        </div>
      )}

      {/* empty state */}
      {!loading && projects.length === 0 && (
        <div style={{padding:'32px 16px',textAlign:'center',color:'var(--text3)'}}>
          <FolderOpen size={28} style={{margin:'0 auto 12px',display:'block',opacity:0.25}}/>
          <div style={{marginBottom:4}}>No projects yet</div>
          <button onClick={fetchProjects} style={{
            fontSize:11,padding:'4px 14px',background:'var(--bg2)',
            border:'1px solid var(--border)',borderRadius:6,cursor:'pointer',color:'var(--text2)',
            display:'inline-flex',alignItems:'center',gap:5,
          }}><RefreshCw size={10}/> Refresh</button>
        </div>
      )}

      {/* project list */}
      <div style={{flex:1,overflowY:'auto',padding:'4px 0'}}>
        {projects.map(proj => {
          const isOpen = !!expanded[proj.name]
          const projFiles = files[proj.name] || []

          // group files by top-level folder
          const folders = {}
          projFiles.forEach(f => {
            const p = (f.path||f.name||'').replace(/\\/g,'/').split('/').filter(Boolean)
            const folder = p.length > 1 ? p[0] : ''
            ;(folders[folder] = folders[folder]||[]).push(f)
          })

          return (
            <div key={proj.name}>
              {/* project row */}
              <div onClick={() => toggle(proj.name, proj.task_id)} style={{
                display:'flex',alignItems:'center',gap:7,padding:'6px 10px',
                cursor:'pointer',userSelect:'none',
                background: isOpen ? 'var(--bg2)' : 'transparent',
                borderBottom:'1px solid var(--border)',
              }}>
                {isOpen
                  ? <ChevronDown  size={10} style={{color:'var(--accent)',flexShrink:0}}/>
                  : <ChevronRight size={10} style={{color:'var(--text3)',flexShrink:0}}/>}
                <Package size={11} style={{color:'var(--accent)',flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',
                    whiteSpace:'nowrap',color:'var(--text)'}}>{proj.name}</div>
                  <div style={{fontSize:10,color:'var(--text3)',marginTop:1}}>
                    {projFiles.length} file{projFiles.length!==1?'s':''}
                    {proj.agents?.length>0 && ` · ${proj.agents.slice(0,3).join(', ')}`}
                  </div>
                </div>
              </div>

              {/* files */}
              {isOpen && (
                <div style={{background:'var(--bg)'}}>
                  {projFiles.length === 0 ? (
                    <div style={{padding:'10px 20px',fontSize:11,color:'var(--text3)',
                      display:'flex',alignItems:'center',gap:6}}>
                      <RefreshCw size={9} style={{animation:'spin 1.5s linear infinite',opacity:0.5}}/>
                      Scanning files...
                    </div>
                  ) : Object.entries(folders).sort(([a],[b])=>a.localeCompare(b)).map(([folder, folderFiles]) => (
                    <div key={folder||'__root'}>
                      {folder && (
                        <div style={{padding:'3px 10px 3px 22px',display:'flex',alignItems:'center',gap:5}}>
                          <Folder size={10} style={{color:'var(--text3)'}}/>
                          <span style={{fontSize:10,color:'var(--text3)',fontWeight:600,
                            fontFamily:'monospace'}}>{folder}/</span>
                        </div>
                      )}
                      {folderFiles.map(f => {
                        const fname = f.name || (f.path||'').split('/').pop()
                        const isSel = selectedFile?.path === (f.path||f.name)
                        return (
                          <div key={f.path||f.name} onClick={() => onSelectFile(f)} style={{
                            display:'flex',alignItems:'center',gap:6,
                            padding:`4px 10px 4px ${folder?36:22}px`,
                            cursor:'pointer',
                            background: isSel ? 'var(--bg2)' : 'transparent',
                            borderLeft: isSel ? '2px solid var(--accent)' : '2px solid transparent',
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