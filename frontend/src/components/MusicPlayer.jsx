import React, { useState, useRef, useEffect } from 'react'

export default function MusicPlayer() {
  const [isOpen, setIsOpen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [track, setTrack] = useState(null)
  const [trackName, setTrackName] = useState('')
  const [volume, setVolume] = useState(0.5)
  const audioRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    if (audioRef.current) {
      audioRef.current.src = url
      audioRef.current.play()
      setIsPlaying(true)
    }
    setTrack(url)
    setTrackName(file.name.replace(/\.[^.]+$/, ''))
  }

  const toggle = () => {
    if (!audioRef.current) return
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false) }
    else { audioRef.current.play(); setIsPlaying(true) }
  }

  return (
    <>
      <audio ref={audioRef} loop onEnded={() => setIsPlaying(false)} />

      {/* Speaker button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 62, right: 12, zIndex: 100,
          width: 38, height: 38, borderRadius: '50%',
          background: isPlaying ? 'var(--accent)' : 'var(--card)',
          border: '1px solid var(--border2)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: isPlaying ? '0 2px 12px rgba(232,115,74,0.4)' : '0 2px 8px var(--shadow)',
          transition: 'all 0.2s',
          fontSize: 16,
        }}
        title="Music Player"
      >
        {isPlaying ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill={isPlaying?'white':'var(--text2)'}>
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--text2)">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
        )}
      </button>

      {/* Player panel */}
      {isOpen && (
        <div style={{
          position: 'fixed', bottom: 108, right: 12, zIndex: 100,
          width: 240, background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 12, boxShadow: '0 8px 30px var(--shadow2)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ padding: '10px 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: 12 }}>🎵 Lo-Fi Player</span>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14 }}>✕</button>
          </div>

          <div style={{ padding: 14 }}>
            {/* Track name */}
            <div style={{
              padding: '8px 12px', background: 'var(--bg2)', borderRadius: 8,
              marginBottom: 12, fontSize: 11, color: trackName ? 'var(--text)' : 'var(--text3)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              border: '1px solid var(--border)'
            }}>
              {trackName || 'No track selected'}
              {isPlaying && <span style={{ marginLeft: 6, color: 'var(--accent)', animation: 'blink 1s infinite' }}>♪</span>}
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, justifyContent: 'center' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.1 15.9 0 13.36 0c-1.3 0-2.48.52-3.36 1.36L9 2.4l-1-1.04C7.12.52 5.94 0 4.64 0 2.1 0 0 2.1 0 4.64c0 .48.11.92.18 1.36H0c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/></svg>
                Pick Music
              </button>
              {track && (
                <button className={`btn btn-sm ${isPlaying ? 'btn-primary' : 'btn-secondary'}`} onClick={toggle}>
                  {isPlaying ? '⏸' : '▶'}
                </button>
              )}
            </div>

            {/* Volume */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--text3)">
                <path d="M3 9v6h4l5 5V4L7 9H3z"/>
              </svg>
              <input type="range" min="0" max="1" step="0.05" value={volume}
                onChange={e => setVolume(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--accent)', height: 3 }}
              />
              <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--text3)">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
              </svg>
            </div>
            <p style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'center', marginTop: 8 }}>
              Pick any music from your phone 🎵
            </p>
          </div>

          <input ref={fileRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleFile} />
        </div>
      )}
    </>
  )
}