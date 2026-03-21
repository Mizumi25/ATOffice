/**
 * PixelOffice.jsx — Pokemon GBA Office
 *
 * FIXES vs previous version:
 * - Agents spawn in open floor tiles (NOT in wall/desk zones)
 * - Collision map rebuilt so rooms have clear walkable centers
 * - Chibi sprites: large round eyes only, no mouth = cute not horrified
 * - Distinct features per agent (hair color, accessory shape)
 * - Monitors are big relative to character (real desk-sized)
 * - Windows are modern horizontal sliding panels, not tiny squares
 * - Floor planks are 4px thin, consistent across all rooms
 * - Dense clutter: posters, cables, snacks, figures, plants everywhere
 * - AGENT_HOME exports tile positions for AgentDialogues to use
 */

import React, { useRef, useEffect, useMemo, useCallback } from 'react'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const COLS = 44
const ROWS = 28
const SPR  = 2    // sprite logical-pixel → canvas-pixel multiplier
// sprite logical dimensions — GBA Pokemon chibi lollipop proportions (1.5x scale)
// Head: 27×24  Body: 15×12  Legs: ~7px nubs  Total: 30×54 logical → 60×108 canvas
const SW = 30     // sprite width  in logical px  → 60 canvas px
const SH = 54     // sprite height in logical px  → 108 canvas px

export function useOfficeTime() {
  const [h, setH] = React.useState(9)
  useEffect(() => {
    const s = Date.now()
    const iv = setInterval(() => setH((9 + (Date.now() - s) / 60000) % 24), 1000)
    return () => clearInterval(iv)
  }, [])
  return h
}
function tod(h) {
  if (h>=5&&h<7)  return 'dawn'
  if (h>=7&&h<12) return 'morning'
  if (h>=12&&h<14)return 'noon'
  if (h>=14&&h<18)return 'afternoon'
  if (h>=18&&h<20)return 'dusk'
  if (h>=20&&h<23)return 'evening'
  return 'night'
}

// ─── PALETTE ─────────────────────────────────────────────────────────────────
function pal(timeOfDay) {
  const sk = {
    dawn:['#ffc8a0','#f09868'], morning:['#b8d8f0','#90b8d8'], noon:['#90c8ff','#70aaee'],
    afternoon:['#a8d8ff','#88baee'], dusk:['#ffaa88','#dd7755'],
    evening:['#384870','#263458'], night:['#0c1c30','#08121e']
  }[timeOfDay] ?? ['#b8d8f0','#90b8d8']
  return {
    sky1:sk[0], sky2:sk[1],
    wall:'#f2eadc', wallLo:'#e8dece', wallAcc:'#cab8a0', rail:'#a89070',
    plankA:'#d0a460', plankB:'#c49050', plankLine:'#b07840',
    tatami:'#c8b868', tatamiL:'#dece88', tatamiD:'#a89848',
    tile:'#ddd5c8', tileD:'#c8c0b2', tileL:'#ece6da',
    wd:'#7a5028', wdL:'#9a7040', wdD:'#5a3010',
    dsk:'#e8d4a4', dskE:'#c8a868', dskL:'#8a5e28',
    shelf:'#a87040', shelfL:'#c8905a',
    scr:'#091422', scrL:'#0e2038',
    paper:'#f8f4ec', fridge:'#e0ecf4',
    pot:'#c86030', potD:'#a04820',
    pl:'#50a050', plL:'#70c070', plD:'#308030',
    bam:'#6a9840',
    sakP:'#f8b4c4', sakPD:'#e890a8', sakT:'#5a3010',
    lantern:'#c03030', lanternL:'#e05050',
    sofa:'#7878c0',
    mug:['#e06848','#48a0d8','#70b860','#e0c040','#c060a0'],
    bk:['#d05050','#5070d0','#50a050','#d09030','#9050d0','#50a0c0'],
    sticky:['#fff89a','#ffc0cc','#c0d8ff','#d0ffcc'],
    working:'#50b060', idle:'#a89880', resting:'#8860b8',
    meeting:'#e09030', thinking:'#4888b8',
    skin:{
      pm:'#f4c488', designer:'#f8c090', frontend:'#eeb070', backend:'#e0a860',
      qa:'#f4c898', blog:'#f8cc98', github:'#e0b880', techlead:'#eeae68',
      product:'#f0c888', architect:'#e8b870', mobile:'#f8c0a0', perf:'#e8b888',
      platform:'#e0b068', data:'#f4c8a0', aiml:'#e8b888', analytics:'#f8c898',
      infra:'#e8b870', security:'#f0b870', sdet:'#f4c490', growth:'#f8cca0'
    },
    hair:{
      pm:'#281408', designer:'#c02878', frontend:'#182060', backend:'#183018',
      qa:'#882818', blog:'#c08020', github:'#181e28', techlead:'#280808',
      product:'#1a2858', architect:'#181828', mobile:'#c83878', perf:'#182848',
      platform:'#183820', data:'#c08830', aiml:'#281860', analytics:'#c83060',
      infra:'#181c28', security:'#281010', sdet:'#8a3820', growth:'#c08030'
    },
    shirt:{
      pm:'#3858b0', designer:'#c04890', frontend:'#3090a8', backend:'#308050',
      qa:'#b06830', blog:'#d87050', github:'#282840', techlead:'#801818',
      product:'#206098', architect:'#184870', mobile:'#d05890', perf:'#285898',
      platform:'#208858', data:'#c09030', aiml:'#503890', analytics:'#b03070',
      infra:'#284858', security:'#902818', sdet:'#806030', growth:'#408838'
    },
    pants:{
      pm:'#203080', designer:'#801840', frontend:'#1060a0', backend:'#186030',
      qa:'#603810', blog:'#804828', github:'#181830', techlead:'#581010',
      product:'#183870', architect:'#102840', mobile:'#801050', perf:'#183068',
      platform:'#185030', data:'#805020', aiml:'#302060', analytics:'#701838',
      infra:'#182838', security:'#601010', sdet:'#604020', growth:'#285820'
    }
  }
}

// ─── DRAW HELPERS ─────────────────────────────────────────────────────────────
const R = x => Math.round(x)
function B(ctx,x,y,w,h,c){if(!c||w<=0||h<=0)return;ctx.fillStyle=c;ctx.fillRect(R(x),R(y),Math.max(1,R(w)),Math.max(1,R(h)))}
// px() — same as B(), needed by drawSprite from ATOffice-improved
function px(ctx,x,y,w,h,c){B(ctx,x,y,w,h,c)}
function L(hex,a=22){try{const n=parseInt(hex.replace('#',''),16);return`rgb(${Math.min(255,((n>>16)&255)+a)},${Math.min(255,((n>>8)&255)+a)},${Math.min(255,(n&255)+a)})`}catch{return hex}}
function D(hex,a=22){return L(hex,-a)}
// sprite pixel — auto-scales by SPR
function P(ctx,x,y,w,h,c){B(ctx,x*SPR,y*SPR,w*SPR,h*SPR,c)}

// ─── COLLISION MAP ────────────────────────────────────────────────────────────
// 0=walkable  1=solid wall/furniture
const CMAP = (()=>{
  const m = Array.from({length:ROWS},()=>new Uint8Array(COLS))
  const s=(r1,c1,r2,c2,v=1)=>{for(let r=r1;r<=r2;r++)for(let c=c1;c<=c2;c++)if(r>=0&&r<ROWS&&c>=0&&c<COLS)m[r][c]=v}
  // outer boundary
  s(0,0,0,COLS-1);s(ROWS-1,0,ROWS-1,COLS-1);s(0,0,ROWS-1,0);s(0,COLS-1,ROWS-1,COLS-1)
  // left vertical wall col 11 — doors at rows 5-8 and 18-21
  s(0,11,ROWS-1,11);s(5,11,8,11,0);s(18,11,21,11,0)
  // right vertical wall col 32 — doors at rows 5-8 and 18-21
  s(0,32,ROWS-1,32);s(5,32,8,32,0);s(18,32,21,32,0)
  // horizontal walls inside wings (split top/bottom)
  s(14,0,14,10);s(14,33,14,COLS-1)
  // ── furniture in design room (cols 0-10) ──
  // desks at rows 2-3 (back wall area) — agents stand at row 5-6 in front
  s(2,1,3,9)
  // bookshelf col 9-10 rows 2-5
  s(2,9,6,10)
  // server rack col 1 rows 5-7
  s(5,1,7,2)
  // ── furniture in dev room (cols 33-43) ──
  s(2,33,3,42)
  s(2,42,6,43)
  s(5,42,7,43)
  // ── techlead room (cols 0-10 rows 15-27) ──
  s(15,1,16,9)
  // ── QA room (cols 33-43 rows 15-27) ──
  s(15,33,16,42)
  // ── lobby furniture ──
  // PM table rows 8-10 cols 17-26
  s(8,17,10,26)
  // sofa rows 14-16 cols 13-19
  s(14,13,16,19)
  return m
})()
function solid(c,r){if(r<0||r>=ROWS||c<0||c>=COLS)return true;return CMAP[r][c]===1}

// ─── A* ──────────────────────────────────────────────────────────────────────
function astar(sc,sr,gc,gr){
  const K=(c,r)=>c*100+r,H=(c,r)=>Math.abs(c-gc)+Math.abs(r-gr)
  const open=new Map(),came=new Map(),g=new Map(),f=new Map()
  const sk=K(sc,sr);g.set(sk,0);f.set(sk,H(sc,sr));open.set(sk,[sc,sr])
  let it=0
  while(open.size&&it++<1200){
    let cur=null,bf=Infinity
    for(const[k,n]of open){const v=f.get(k)??Infinity;if(v<bf){bf=v;cur=n}}
    if(!cur)break
    const ck=K(...cur)
    if(cur[0]===gc&&cur[1]===gr){
      const p=[];let c=ck
      while(came.has(c)){const cc=Math.floor(c/100),cr=c%100;p.unshift([cc,cr]);c=came.get(c)}
      return p
    }
    open.delete(ck)
    for(const[dc,dr]of[[0,1],[0,-1],[1,0],[-1,0]]){
      const nc=cur[0]+dc,nr=cur[1]+dr
      if(solid(nc,nr))continue
      const nk=K(nc,nr),tg=(g.get(ck)??Infinity)+1
      if(tg<(g.get(nk)??Infinity)){came.set(nk,ck);g.set(nk,tg);f.set(nk,tg+H(nc,nr));open.set(nk,[nc,nr])}
    }
  }
  return[]
}

const AGENT_LOOKS = {
  haruto:  { skin: '#f5c890', hair: '#2a1808', shirt: '#4468c0', pants: '#2a3888', acc: '#e8d060' },
  masa:    { skin: '#e8b870', hair: '#181828', shirt: '#205878', pants: '#102840', acc: '#60a8cc' },
  yuki:    { skin: '#f8c898', hair: '#cc3388', shirt: '#d060a0', pants: '#8a2050', acc: '#ff88cc' },
  ren:     { skin: '#f0b880', hair: '#1a2868', shirt: '#3898b0', pants: '#1868a0', acc: '#60ccff' },
  sora:    { skin: '#e8b070', hair: '#1a3818', shirt: '#389060', pants: '#1a6038', acc: '#60ff90' },
  kaito:   { skin: '#e8b888', hair: '#281860', shirt: '#503890', pants: '#302060', acc: '#cc88ff' },
  kazu:    { skin: '#e8c090', hair: '#183030', shirt: '#303048', pants: '#202038', acc: '#80a0ff' },
  nao:     { skin: '#f0b870', hair: '#281010', shirt: '#902818', pants: '#601010', acc: '#ff8844' },
  mei:     { skin: '#f5c8a0', hair: '#8a3820', shirt: '#c07838', pants: '#704010', acc: '#ff9040' },
  mizu:    { skin: '#e8c8f0', hair: '#0a0820', shirt: '#1a3050', pants: '#0a1828', acc: '#6040a8' },
}



// ─── CHIBI SPRITE — GBA Pokemon lollipop proportions (1.5x) ──────────────────
// Layout (logical px, all scaled by SPR=2 on canvas):
//   Head : 27 wide × 24 tall  — massive round dome
//   Neck : 6 wide  × 3 tall
//   Body : 15 wide × 12 tall  — stubby block
//   Arms : 4 wide  × 7 tall
//   Legs : 6 wide  × 7 tall   — nub stumps
//   Feet : 6 wide  × 3 tall
//   Total: 30 wide × 54 tall  logical → 60×108 canvas px
//
// Eyes: pure solid black — no white shine
function drawSprite(ctx, wx, wy, agentId, dir, frame, sit, selected, status, t, P, scale = 1) {
  const look = AGENT_LOOKS[agentId] ?? AGENT_LOOKS.pm
  const S = scale
  const s = (x, y, w, h, c) => { if(!c||w<=0||h<=0) return; B(ctx, wx+x*S, wy+y*S, w*S, h*S, c) }

  // ── Selection glow ────────────────────────────────────────────────────────
  if (selected) {
    ctx.save()
    ctx.globalAlpha = 0.28 + Math.sin(t * 4) * 0.1
    ctx.strokeStyle = '#ffdd44'
    ctx.lineWidth = 2
    ctx.strokeRect(wx - 2, wy - 2, 32*S, 58*S)
    ctx.restore()
  }

  // ── Ground shadow — oval under feet ───────────────────────────────────────
  ctx.save()
  ctx.globalAlpha = 0.15
  ctx.fillStyle = '#301808'
  ctx.beginPath()
  ctx.ellipse(wx + 15*S, wy + 53*S, 12*S, 3*S, 0, 0, Math.PI*2)
  ctx.fill()
  ctx.restore()

  // ── Idle bob ──────────────────────────────────────────────────────────────
  const isResting = status === 'resting'
  const bob = isResting          ? 0
            : status==='working' ? Math.sin(t * 5) * 0.8
            : Math.sin(t * 2.2) * 1.1
  ctx.save()
  ctx.translate(0, Math.round(bob))

  // Walk leg/arm offsets
  const lL = frame===1 ? -3 : frame===3 ?  2 : 0
  const lR = frame===1 ?  2 : frame===3 ? -3 : 0
  const aL = frame===1 ?  2 : frame===3 ? -2 : 0
  const aR = frame===1 ? -2 : frame===3 ?  2 : 0

  if (isResting) {
    // ── SLEEP — lying flat ──────────────────────────────────────────────────
    s(0, 15, 24, 21, look.skin)        // head on side
    s(0, 15, 24,  9, look.hair)        // hair
    s(6,  26, 4, 2, '#2a1808')         // closed eye L
    s(14, 26, 4, 2, '#2a1808')         // closed eye R
    s(22, 21, 15, 9, look.shirt)       // body horizontal
    s(33, 27,  6, 4, look.pants)       // leg 1
    s(33, 33,  6, 4, look.pants)       // leg 2
    s(37, 27,  4, 3, '#4a3010')        // shoe 1
    s(37, 33,  4, 3, '#4a3010')        // shoe 2
    // Zzz
    const zo = ((t * 0.7) % 1) * 16
    ctx.save()
    ctx.globalAlpha = 1 - (t * 0.7) % 1
    ctx.fillStyle = '#9980cc'
    ctx.font = `bold ${Math.round(11*S)}px sans-serif`
    ctx.fillText('z', wx + 27*S, wy + 10*S - zo)
    ctx.restore()

  } else if (dir === 'down') {
    // ── FRONT ───────────────────────────────────────────────────────────────
    // Head — 27×24, centered (offset 1 from left)
    s(1,   0, 27, 24, look.skin)
    s(1,   0, 27,  7, look.hair)       // hair cap
    s(1,   5,  4,  6, look.hair)       // left side wisp
    s(24,  5,  4,  6, look.hair)       // right side wisp
    // Eyes — pure solid black, no shine
    s(6,  10,  5,  6, '#1a1028')       // left eye
    s(18, 10,  5,  6, '#1a1028')       // right eye
    // Blush
    s(4,  16,  3,  2, '#f0a0a0')
    s(22, 16,  3,  2, '#f0a0a0')
    // Neck
    s(12, 24,  6,  3, look.skin)
    // Body
    s(7,  27, 15, 12, look.shirt)
    s(11, 27,  7,  3, '#fff')          // collar
    // Arms
    s(3,  27+aL, 4, 7, look.shirt)
    s(22, 27+aR, 4, 7, look.shirt)
    s(3,  34+aL, 4, 3, look.skin)      // hands
    s(22, 34+aR, 4, 3, look.skin)
    // Legs
    if (sit) {
      s(8,  39, 6, 6, look.pants);  s(15, 39, 6, 6, look.pants)
      s(7,  45, 7, 3, '#4a3010');   s(14, 45, 7, 3, '#4a3010')
    } else {
      s(8,  39+lL, 6, 7, look.pants)
      s(15, 39+lR, 6, 7, look.pants)
      s(7,  46+lL, 7, 3, '#4a3010')
      s(14, 46+lR, 7, 3, '#4a3010')
    }
    _drawAcc(ctx, s, agentId, look, 'down', t)

  } else if (dir === 'up') {
    // ── BACK ────────────────────────────────────────────────────────────────
    s(1,   0, 27, 24, look.hair)
    s(4,  17, 21,  7, look.skin)       // skin strip at bottom of head
    s(11,  0,  7,  4, L(look.hair,15)) // back cowlick
    s(12, 24,  6,  3, look.skin)
    s(7,  27, 15, 12, look.shirt)
    s(3,  27+aL, 4, 7, D(look.shirt,10))
    s(22, 27+aR, 4, 7, D(look.shirt,10))
    s(3,  34+aL, 4, 3, look.skin)
    s(22, 34+aR, 4, 3, look.skin)
    if (sit) {
      s(8,  39, 6, 6, look.pants);  s(15, 39, 6, 6, look.pants)
      s(7,  45, 7, 3, '#4a3010');   s(14, 45, 7, 3, '#4a3010')
    } else {
      s(8,  39+lL, 6, 7, look.pants);  s(15, 39+lR, 6, 7, look.pants)
      s(7,  46+lL, 7, 3, '#4a3010');   s(14, 46+lR, 7, 3, '#4a3010')
    }

  } else if (dir === 'right') {
    // ── SIDE RIGHT ──────────────────────────────────────────────────────────
    s(2,   0, 24, 24, look.skin)
    s(2,   0, 24,  7, look.hair)
    s(2,   5,  4,  7, look.hair)       // back hair
    s(24,  9,  3,  5, look.skin)       // ear
    // One eye — pure black
    s(14, 10,  5,  6, '#1a1028')
    // Blush
    s(13, 16,  3,  2, '#f0a0a0')
    s(12, 24,  6,  3, look.skin)
    s(5,  27, 15, 12, look.shirt)
    // front arm swings
    s(2,  27+aL, 4, 7, look.shirt)
    s(2,  34+aL, 4, 3, look.skin)
    // back arm barely visible
    s(19, 28,    3, 5, D(look.shirt,15))
    if (sit) {
      s(5, 39, 12, 6, look.pants)
      s(13, 45, 8, 3, '#4a3010')
    } else {
      s(7,  39+lL, 8, 7, look.pants)
      s(11, 39+lR, 8, 7, D(look.pants,12))
      s(6,  46+lL, 9, 3, '#4a3010')
      s(10, 46+lR, 9, 3, '#5a3a18')
    }
    _drawAcc(ctx, s, agentId, look, 'right', t)

  } else {
    // ── SIDE LEFT — mirror of right ──────────────────────────────────────────
    ctx.save()
    ctx.translate(wx + 15*S, 0)
    ctx.scale(-1, 1)
    const ms = (x, y, w, h, c) => { if(!c||w<=0||h<=0) return; B(ctx, -15*S+x*S, wy+y*S, w*S, h*S, c) }
    ms(2,   0, 24, 24, look.skin)
    ms(2,   0, 24,  7, look.hair)
    ms(2,   5,  4,  7, look.hair)
    ms(24,  9,  3,  5, look.skin)
    ms(14, 10,  5,  6, '#1a1028')
    ms(13, 16,  3,  2, '#f0a0a0')
    ms(12, 24,  6,  3, look.skin)
    ms(5,  27, 15, 12, look.shirt)
    ms(2,  27+aL, 4, 7, look.shirt)
    ms(2,  34+aL, 4, 3, look.skin)
    ms(19, 28,    3, 5, D(look.shirt,15))
    if (sit) {
      ms(5, 39, 12, 6, look.pants); ms(13, 45, 8, 3, '#4a3010')
    } else {
      ms(7,  39+lL, 8, 7, look.pants); ms(11, 39+lR, 8, 7, D(look.pants,12))
      ms(6,  46+lL, 9, 3, '#4a3010'); ms(10, 46+lR, 9, 3, '#5a3a18')
    }
    ctx.restore()
  }

  ctx.restore() // end bob

  // ── STATUS ORB ─────────────────────────────────────────────────────────────
  const sc = (P && (P[status ?? 'idle'] ?? P.idle)) ?? '#a0a080'
  B(ctx, wx + 24*S, wy - 4*S, 6*S, 6*S, sc)
  B(ctx, wx + 25*S, wy - 3*S, 3*S, 3*S, 'rgba(255,255,255,0.45)')

  if (status === 'working') {
    const prog = (t * 1.8) % 1
    ctx.save()
    ctx.globalAlpha = (1 - prog) * 0.45
    ctx.strokeStyle = sc
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(wx + 27*S, wy - 1*S, prog * 16, 0, Math.PI*2)
    ctx.stroke()
    ctx.restore()
  }

  if (status === 'thinking') {
    const d = Math.floor(t * 2.5) % 3
    ctx.save()
    ctx.fillStyle = '#5898c0'
    ctx.font = `bold ${Math.round(10*S)}px sans-serif`
    ctx.fillText('.'.repeat(d + 1), wx + 20*S, wy - 5*S)
    ctx.restore()
  }

  // ── NAME TAG ──────────────────────────────────────────────────────────────
  const name = agentId.charAt(0).toUpperCase() + agentId.slice(1)
  const nw = name.length * 5 + 8
  const nx = wx + 15*S - nw / 2
  const ny = wy + 52*S + 2
  ctx.fillStyle = 'rgba(248,244,240,0.93)'
  ctx.fillRect(nx, ny, nw, 10)
  ctx.fillStyle = sc
  ctx.fillRect(nx, ny, nw, 2)
  ctx.fillStyle = '#4a3020'
  ctx.font = `bold ${Math.round(6*S)}px "DM Sans", sans-serif`
  ctx.fillText(name, nx + 3, ny + 8)
}

// ── Per-agent accessories (1.5x scaled) ──────────────────────────────────────
function _drawAcc(ctx, s, agentId, look, dir, t) {
  const pulse = 0.7 + Math.sin(t * 3) * 0.3
  switch(agentId) {
    // Bows / ribbons
    case 'designer':   s(22, -2, 7, 4, look.acc); s(23, -1, 4, 3, L(look.acc,20)); break
    case 'mobile':     s(22, -2, 7, 4, look.acc); break
    case 'analytics':  s(0,  -2, 7, 4, look.acc); break
    case 'growth':     s(21,  0, 6, 4, look.acc); break
    // Headsets
    case 'github':
      if(dir==='down'){s(0,9,3,6,look.acc); s(27,9,3,6,look.acc); s(0,7,28,3,D(look.hair,5))}
      break
    case 'platform':
      if(dir==='down'){s(27,9,4,5,look.acc); s(27,10,6,3,D(look.acc,10))}
      break
    case 'sdet':
      if(dir==='down'){s(0,9,3,6,look.acc); s(26,9,3,6,look.acc)}
      break
    // Glasses
    case 'architect':
      if(dir==='down'){
        s(5,12,7,4,'rgba(160,220,255,0.25)')
        s(17,12,7,4,'rgba(160,220,255,0.25)')
        s(5,12,7,1,look.acc); s(12,13,5,1,look.acc); s(17,12,7,1,look.acc)
      }
      break
    case 'data':
      if(dir==='down'){s(5,14,7,3,'rgba(255,220,100,0.3)'); s(17,14,7,3,'rgba(255,220,100,0.3)')}
      break
    case 'blog':       s(20,  0, 6, 4, look.acc); break  // hair clip
    // Hair spikes
    case 'frontend':   s(4,-3,3,5,look.hair); s(11,-4,4,6,look.hair); s(19,-3,4,5,look.hair); break
    case 'perf':       s(12,-4,5,7,look.hair); s(7,-3,4,5,look.hair); break
    case 'backend':    s(9,-3,11,4,look.hair); s(7,-4,4,6,look.hair); s(18,-4,4,6,look.hair); break
    case 'product':    s(10,-3,9,5,look.hair); break
    // Caps / hats
    case 'pm':         s(4,-3,21,5,look.acc); s(3,-2,23,3,D(look.acc,15)); break
    case 'infra':      s(3,-4,23,7,look.acc); s(3,-4,23,3,D(look.acc,20)); s(10,-4,9,2,'#fff'); break
    case 'security':   s(4,-3,21,5,'#303030'); s(7,-3,15,2,'#606060'); break
    case 'qa':         s(9,-2,11,4,look.acc); break  // headband
    // Techlead headphones
    case 'techlead':
      if(dir==='down'){s(0,8,3,7,look.acc); s(27,8,3,7,look.acc); s(1,7,27,4,D(look.hair,5))}
      break
    // Mizu crown glow
    case 'mizu':
      if(dir==='down'){s(7,-3,15,3,look.acc); s(10,-5,9,3,L(look.acc,30))}
      break
    // aiml subtle aura — skip canvas direct draw, just do a tinted hair top
    case 'aiml':
      s(8,-2,13,3,look.acc)
      break
    default: break
  }
}


// ─── SPRITE WRAPPERS (adapters for renderScene) ───────────────────────────────
// These adapt our call signature to drawSprite's signature
function sprite(ctx,wx,wy,id,dir,frame,sel,status,t,C){
  drawSprite(ctx,wx,wy,id,
    dir==='d'||dir==='down'?'down':dir==='u'||dir==='up'?'up':dir==='r'||dir==='right'?'right':'left',
    frame,false,sel,status,t,px,1)
}
function spriteSeated(ctx,wx,wy,id,sel,status,t,C){
  drawChair(ctx,wx,wy+18,C)
  drawSprite(ctx,wx,wy,id,'down',0,true,sel,status,t,px,1)
}


// ─── AGENT HOME POSITIONS — all 20 agents, verified walkable tiles ────────────
export const AGENT_HOME = {
  // Design room (cols 1-10)
  masa:    {col:3,  row:6,  dir:'u'},
  yuki:    {col:7,  row:6,  dir:'u'},
  // Lobby center
  haruto:  {col:21, row:12, dir:'u'},
  sora:    {col:16, row:12, dir:'r'},
  kaito:   {col:26, row:12, dir:'l'},
  kazu:    {col:21, row:20, dir:'u'},
  nao:     {col:24, row:20, dir:'l'},
  // Dev room (cols 33-43)
  ren:     {col:37, row:6,  dir:'u'},
  mei:     {col:40, row:9,  dir:'d'},
  // Mizu — lobby center
  mizu:    {col:22, row:14, dir:'d'},
}


// ─── INTERACTABLE OBJECTS ─────────────────────────────────────────────────────
// Each entry: tile col/row the NPC walks to, pixel draw coords, and interaction data
export const INTERACTABLES = {
  coffee_machine: {
    col:9, row:11, label:'☕ Coffee Machine',
    room:'design',
    playerMsg: [
      "You make a strong espresso. +10 energy.",
      "The coffee machine gurgles. Dark roast, no mercy.",
      "You grab a cup. Smells like productivity.",
    ],
    npcReactions: {
      default: "{name} pours a coffee and stares at the screen.",
      designer: "Yuki adds oat milk and a sakura sticker to her cup.",
      backend:  "Sora drinks it black. Triple shot.",
      techlead: "Riku takes one sip, grimaces, drinks anyway.",
      mizu:     "Mizu takes a cup without looking up from her notebook.",
    }
  },
  fridge_lobby: {
    col:30, row:22, label:'🧃 Lobby Fridge',
    room:'lobby',
    playerMsg: [
      "Cold ramune, matcha milk, and leftover sushi. Nice.",
      "You grab a Mitsuya Cider. Refreshing.",
      "Someone left a sticky note on the last pudding: 'DON'T TOUCH — Hana'",
    ],
    npcReactions: {
      default: "{name} grabs a drink from the fridge.",
      blog:    "Hana checks if her pudding is still there. It is.",
      frontend:"Ren grabs an energy drink and cracks it dramatically.",
      qa:      "Mei takes a water. 'Hydration is part of testing.'",
    }
  },
  wifi_router: {
    col:20, row:4, label:'📡 WiFi Router',
    room:'lobby',
    playerMsg: [
      "Blinking green. 'ATOffice-5G' — 847ms ping. Respectable.",
      "You restart the router. Everything goes dark for 3 seconds. Tense.",
      "Signal strong. The office breathes a collective sigh of relief.",
    ],
    npcReactions: {
      default: "{name} glances at the router suspiciously.",
      github:  "Kazu checks the router logs. Everything nominal.",
      infra:   "Sota mutters something about 'single point of failure'.",
    }
  },
  whiteboard_lobby: {
    col:21, row:6, label:'📋 Main Whiteboard',
    room:'lobby',
    playerMsg: [
      "Covered in sprint tasks, wireframes, and one very suspicious doodle.",
      "You add a sticky note: 'TODO: ship it'.",
      "Someone drew the system architecture in 3 different colors. It's beautiful.",
    ],
    npcReactions: {
      default:   "{name} studies the whiteboard intensely.",
      product:   "Hiro rewrites the user story for the 4th time.",
      architect: "Masa adds three more arrows to the architecture diagram.",
      pm:        "Haruto erases something and writes 'IN PROGRESS' instead.",
    }
  },
  plant_big: {
    col:13, row:15, label:'🌿 Big Monstera',
    room:'lobby',
    playerMsg: [
      "The monstera is thriving. Someone has been watering it religiously.",
      "You find a sticky note on the pot: 'Her name is Midori. Be kind.'",
      "A rubber duck is hidden behind the leaves. You leave it there.",
    ],
    npcReactions: {
      default:  "{name} pauses by the plant and takes a breath.",
      designer: "Yuki adjusts the plant's position for better composition.",
      growth:   "Yuna photographs it for the company Instagram.",
    }
  },
  snack_shelf: {
    col:42, row:20, label:'🍡 Snack Shelf',
    room:'qa',
    playerMsg: [
      "Pocky, konpeito, dried mango, and mystery cookies from last sprint.",
      "You take a Pocky. Chocolate. Classic.",
      "The shelf is dangerously well stocked. Someone loves this team.",
    ],
    npcReactions: {
      default: "{name} raids the snack shelf.",
      qa:      "Mei takes exactly three Pocky sticks. Methodical.",
      sdet:    "Taro grabs snacks and doesn't come back for 10 minutes.",
      mobile:  "Reo fills his pockets. Nobody says anything.",
    }
  },
  standing_desk: {
    col:37, row:14, label:'🧍 Standing Desk',
    room:'dev',
    playerMsg: [
      "You stand at Kai's desk. Your posture immediately improves.",
      "Height: 112cm. There's a sticky note: 'Change every 30min'.",
      "Already at standing height. Someone is very disciplined.",
    ],
    npcReactions: {
      default: "{name} switches to the standing position.",
      perf:    "Kai switches between sitting and standing precisely every 30min.",
      frontend:"Ren tries it for 2 minutes, then sits back down.",
    }
  },
  game_console: {
    col:2, row:25, label:'🎮 Retro Console',
    room:'techlead',
    playerMsg: [
      "A Game Boy Color with a Pokémon cartridge. Mid-battle, mid-dungeon.",
      "The high score reads 'RKU'. Riku doesn't talk about it.",
      "You play 3 minutes of Tetris. You feel better about everything.",
    ],
    npcReactions: {
      default:  "{name} sits down for 'just one round'.",
      techlead: "Riku plays exactly 2 minutes to decompress, then goes back.",
      data:     "Daisuke beats Riku's Tetris score. Doesn't tell anyone.",
      aiml:     "Kaito stares at the screen. 'This is just a Q-learning environment.'",
    }
  },
  fish_tank: {
    col:10, row:19, label:'🐟 Aquarium',
    room:'techlead',
    playerMsg: [
      "Three koi, one very fat goldfish, and a tiny plastic torii gate.",
      "The fish are watching you. Judging your code quality.",
      "You tap the glass. The fat goldfish ignores you completely.",
    ],
    npcReactions: {
      default:  "{name} watches the fish for a moment.",
      mizu:     "Mizu watches the fish for a long moment. Then writes something down.",
      security: "Nao checks if the tank has a security camera. It does.",
      architect:"Masa explains the fish's swimming patterns are non-deterministic.",
    }
  },
  noodle_station: {
    col:21, row:25, label:'🍜 Instant Noodle Station',
    room:'lobby_bottom',
    playerMsg: [
      "A kettle, 12 varieties of instant ramen, and a Pocky emergency stash.",
      "You make a tonkotsu ramen. 3 minutes of patience. Worth it.",
      "Someone left a half-eaten ramen. The sticky note says 'MINE — Ren'.",
    ],
    npcReactions: {
      default:  "{name} makes instant ramen.",
      frontend: "Ren waits precisely 3 minutes. Then eats standing up.",
      backend:  "Sora adds two eggs and calls it 'protein optimization'.",
      blog:     "Hana photographs the ramen before eating it.",
    }
  },
}

// Which agents are likely to visit which objects (for NPC roaming)
export const AGENT_OBJECT_AFFINITY = {
  pm:        ['whiteboard_lobby','coffee_machine','fridge_lobby'],
  product:   ['whiteboard_lobby','coffee_machine','noodle_station'],
  architect: ['whiteboard_lobby','coffee_machine','fish_tank'],
  designer:  ['coffee_machine','plant_big','standing_desk'],
  mobile:    ['snack_shelf','fridge_lobby','standing_desk'],
  frontend:  ['coffee_machine','standing_desk','noodle_station'],
  perf:      ['standing_desk','coffee_machine','snack_shelf'],
  backend:   ['coffee_machine','fridge_lobby','noodle_station'],
  platform:  ['coffee_machine','snack_shelf','wifi_router'],
  data:      ['coffee_machine','game_console','fish_tank'],
  aiml:      ['game_console','coffee_machine','fish_tank'],
  analytics: ['whiteboard_lobby','fridge_lobby','plant_big'],
  github:    ['wifi_router','coffee_machine','snack_shelf'],
  infra:     ['wifi_router','coffee_machine','noodle_station'],
  security:  ['wifi_router','fish_tank','coffee_machine'],
  qa:        ['fridge_lobby','snack_shelf','coffee_machine'],
  sdet:      ['snack_shelf','game_console','coffee_machine'],
  blog:      ['fridge_lobby','plant_big','noodle_station'],
  growth:    ['plant_big','whiteboard_lobby','fridge_lobby'],
  techlead:  ['game_console','coffee_machine','fish_tank'],
  mizu:      ['fish_tank','coffee_machine','whiteboard_lobby'],
}



// ─── AGENT STATE MANAGER ─────────────────────────────────────────────────────
class AgentStateManager {
  constructor(){this.states={};this.speed=5}
  init(){
    for(const[id,h]of Object.entries(AGENT_HOME)){
      if(!this.states[id])
        this.states[id]={px:h.col,py:h.row,dir:h.dir,frame:0,wt:0,path:[],pi:0,cb:null,floor:1,atObject:null}
    }
  }
  walkTo(id,dc,dr,cb=null){
    const s=this.states[id];if(!s)return
    const path=astar(Math.round(s.px),Math.round(s.py),dc,dr)
    s.path=path;s.pi=0;s.cb=cb
  }
  walkToAgent(mid,tid){
    const ts=this.states[tid];if(!ts)return
    const tc=Math.round(ts.px),tr=Math.round(ts.py)
    const v=[[tc-1,tr],[tc+1,tr],[tc,tr-1],[tc,tr+1]].find(([c,r])=>!solid(c,r))
    if(v)this.walkTo(mid,v[0],v[1],()=>{
      const ms=this.states[mid],ts2=this.states[tid];if(!ms||!ts2)return
      const dx=ts2.px-ms.px,dy=ts2.py-ms.py
      ms.dir=Math.abs(dx)>Math.abs(dy)?(dx>0?'r':'l'):(dy>0?'d':'u')
      ts2.dir=Math.abs(dx)>Math.abs(dy)?(dx>0?'l':'r'):(dy>0?'u':'d')
    })
  }
  returnHome(id){
    const h=AGENT_HOME[id];if(!h)return
    this.walkTo(id,h.col,h.row,()=>{const s=this.states[id];if(s)s.dir=h.dir})
  }
  tick(dt){
    for(const s of Object.values(this.states)){
      if(!s.path||s.pi>=s.path.length){s.frame=0;continue}
      const[tc,tr]=s.path[s.pi]
      const dx=tc-s.px,dy=tr-s.py,dist=Math.hypot(dx,dy),spd=this.speed*dt
      s.wt=(s.wt||0)+dt;s.frame=Math.floor(s.wt*10)%4
      if(Math.abs(dx)>Math.abs(dy))s.dir=dx>0?'r':'l'
      else if(Math.abs(dy)>.01)s.dir=dy>0?'d':'u'
      if(dist<=spd){s.px=tc;s.py=tr;s.pi++;if(s.pi>=s.path.length){s.path=[];s.frame=0;if(s.cb){s.cb();s.cb=null}}}
      else{s.px+=dx/dist*spd;s.py+=dy/dist*spd}
    }
  }
  all(){return this.states}
  goUpstairs(agentId){
    // Walk agent to stair position then mark as upstairs
    const s=this.states[agentId]; if(!s) return
    s.floor=2; s.atObject='bedroom'
    // Assign bedroom col based on agent index
    const idx=Object.keys(AGENT_HOME).indexOf(agentId)
    s.px=3+(idx%5)*8; s.py=4+(Math.floor(idx/5))*7
    s.dir='u'; s.path=[]; s.frame=0
  }
  goDownstairs(agentId){
    const s=this.states[agentId]; if(!s) return
    s.floor=1; s.atObject=null
    this.returnHome(agentId)
  }
  walkToObject(agentId, objKey){
    const obj = INTERACTABLES[objKey]
    if(!obj) return
    this.walkTo(agentId, obj.col, obj.row, ()=>{
      const s=this.states[agentId]; if(s){s.dir='down'; s.atObject=objKey}
    })
  }
  leaveObject(agentId){
    const s=this.states[agentId]; if(s) s.atObject=null
    this.returnHome(agentId)
  }
}
export const agentMgr = new AgentStateManager()
// Who is upstairs (resting/sleeping) — used by renderScene to skip floor-1 drawing
export function getFloor2Agents(states){
  return Object.entries(states).filter(([,s])=>s.floor===2).map(([id])=>id)
}

// ─── CHIBI SPRITE ─────────────────────────────────────────────────────────────
// 14×20 logical px. Each agent has distinct hair+shirt color and one accessory.
// NO mouth — just big round cute eyes.
function _acc(ctx,wx,wy,id,P,hr,sh,t){
  const x=wx/SPR,y=wy/SPR
  if(id==='designer') { // bow in pink
    P(ctx,x+9,y-2,4,3,'#ff78b8');P(ctx,x+10,y-2,2,1,'#ff50a0')
  }
  if(id==='frontend') { // antenna-style spiky hair
    P(ctx,x+2,y-3,2,3,hr);P(ctx,x+6,y-4,2,4,hr);P(ctx,x+10,y-3,2,3,hr)
  }
  if(id==='pm') { // small briefcase on arm
    P(ctx,x-1,y+14,4,4,'#8a6830');P(ctx,x-1,y+14,4,1,L('#8a6830',20));P(ctx,x+0,y+13,2,1,'#8a6830')
  }
  if(id==='techlead') { // headphones
    P(ctx,x+0,y+3,2,4,'#cc3030');P(ctx,x+12,y+3,2,4,'#cc3030');P(ctx,x+0,y+3,14,2,'#cc3030')
  }
  if(id==='qa') { // magnifying glass
    P(ctx,x+12,y+15,3,3,'#c8a040');P(ctx,x+13,y+16,1,1,'#0a0808');P(ctx,x+14,y+18,2,2,'#c8a040')
  }
  if(id==='blog') { // notepad
    P(ctx,x+12,y+13,4,5,'#f8f0e0');P(ctx,x+13,y+14,2,1,'rgba(0,0,0,.2)');P(ctx,x+13,y+16,2,1,'rgba(0,0,0,.15)')
  }
  if(id==='github') { // hoodie pocket
    P(ctx,x+4,y+15,6,3,D(sh,10));P(ctx,x+5,y+16,4,1,'rgba(0,0,0,.1)')
  }
  if(id==='backend') { // terminal glasses
    P(ctx,x+3,y+4,3,2,'#202060');P(ctx,x+8,y+4,3,2,'#202060');P(ctx,x+6,y+5,2,1,'#202060')
  }
  // ── new agents ────────────────────────────────────────────────────────────
  if(id==='product')   { P(ctx,x+4,y+4,3,2,'#2060a0');P(ctx,x+8,y+4,3,2,'#2060a0');P(ctx,x+6,y+5,2,1,'#2060a0') } // glasses
  if(id==='architect') { P(ctx,x+1,y-1,12,2,'#285878') } // architect visor
  if(id==='mobile')    { P(ctx,x+11,y+0,3,5,'#d06898') } // earring
  if(id==='perf')      { P(ctx,x+0,y+3,2,4,'#3878a8');P(ctx,x+12,y+3,2,4,'#3878a8');P(ctx,x+0,y+3,14,2,'#3878a8') } // headset
  if(id==='platform')  { P(ctx,x+12,y+13,4,5,'#288860') } // tool hanging from belt
  if(id==='data')      { P(ctx,x+3,y-2,8,3,'#508888') } // top bun
  if(id==='aiml')      { P(ctx,x+2,y-2,2,4,hr);P(ctx,x+10,y-2,2,4,hr);P(ctx,x+5,y-3,4,2,'#8048b8') } // antenna
  if(id==='analytics') { P(ctx,x+11,y+1,3,5,'#387898') } // side ponytail
  if(id==='infra')     { P(ctx,x+0,y+10,3,4,'#488888');P(ctx,x+1,y+11,1,2,'#fff') } // utility clip
  if(id==='security')  { P(ctx,x+0,y+3,2,5,'#a06040');P(ctx,x+12,y+3,2,5,'#a06040') } // shoulder guards
  if(id==='sdet')      { P(ctx,x+4,y-2,6,2,'#907850') } // headband
  if(id==='growth')    { P(ctx,x+11,y+0,3,2,'#609848');P(ctx,x+11,y+2,2,2,'#a0d060') } // leaf pin
  if(id==='mizu')      {
    // Long flowing dark hair (tresses on both sides)
    P(ctx,x+0,y-1,3,12,'#0a0820');P(ctx,x+11,y-1,3,12,'#0a0820')
    // Small notebook in hand
    P(ctx,x+12,y+13,4,5,'#1a3050');P(ctx,x+13,y+14,2,1,'rgba(255,255,255,.3)')
  }
}
// ─── WORLD LAYOUT ────────────────────────────────────────────────────────────
function layout(W,H){
  const tw=W/COLS,th=H/ROWS
  // left wing: cols 0-10 = 11 tiles
  // lobby: cols 12-31 = 20 tiles
  // right wing: cols 33-43 = 11 tiles
  const lw=11*tw, lbW=21*tw, rw=11*tw, topH=14*th, botH=H-topH
  return{tw,th,lw,lbW,rw,topH,botH}
}

// ─── FLOOR TILES — consistent 4px planks ─────────────────────────────────────
function drawFloor(ctx,rx,ry,rw,rh,type,C){
  const wallH=Math.round(rh*.36),fy=ry+wallH,fh=rh-wallH
  if(type==='tatami'){
    B(ctx,rx,fy,rw,fh,C.tatami)
    // tatami grid lines every 24px
    for(let y=fy;y<fy+fh;y+=24) B(ctx,rx,y,rw,1,C.tatamiD)
    for(let x=rx;x<rx+rw;x+=24) B(ctx,rx+x-rx,fy,1,fh,C.tatamiD)
    B(ctx,rx,fy,rw,2,C.tatamiL)
  } else if(type==='tile'){
    B(ctx,rx,fy,rw,fh,C.tile)
    for(let y=fy;y<fy+fh;y+=16) B(ctx,rx,y,rw,1,C.tileD)
    for(let x=rx;x<rx+rw;x+=16) B(ctx,rx+x-rx,fy,1,fh,C.tileD)
  } else {
    // wood planks — 4px per plank, consistent offset
    B(ctx,rx,fy,rw,fh,C.plankA)
    const ph=4
    let toggle=0
    for(let y=fy;y<fy+fh;y+=ph){
      if(y+ph>fy+fh)break
      if(toggle)B(ctx,rx,y,rw,ph,C.plankB)
      toggle=1-toggle
      B(ctx,rx,y,rw,1,C.plankLine)
      // vertical joints staggered
      const off=((Math.floor((y-fy)/ph))%3)*(rw/3)
      for(let i=0;i<3;i++) B(ctx,(rx+off+i*(rw/3))%rw+rx,y+1,1,ph-2,D(toggle?C.plankB:C.plankA,6))
    }
    B(ctx,rx,fy,rw,2,L(C.plankA,15)) // top shine
  }
}

// ─── WALLS ───────────────────────────────────────────────────────────────────
function drawWall(ctx,rx,ry,rw,rh,C){
  const wallH=Math.round(rh*.36),fy=ry+wallH
  B(ctx,rx,ry,rw,wallH,C.wall)
  // subtle horizontal wallpaper lines
  ctx.save();ctx.globalAlpha=.04
  for(let y=ry+8;y<fy;y+=18) B(ctx,rx,y,rw,1,'#806040')
  ctx.restore()
  // chair rail
  B(ctx,rx,fy-5,rw,5,C.rail);B(ctx,rx,fy-2,rw,2,L(C.rail,20))
  // baseboard
  B(ctx,rx,fy-1,rw,1,C.wdD)
}

// ─── MODERN SLIDING WINDOW ───────────────────────────────────────────────────
// Horizontal sliding style — two panels side by side, thin aluminum frame
function drawWindow(ctx,x,y,w,h,C,timeOfDay,t,idx){
  // outer frame (thin aluminum — light gray)
  B(ctx,x-2,y-2,w+4,h+4,'#b8b4ae')
  // inner frame
  B(ctx,x-1,y-1,w+2,h+2,'#d0ccc6')
  // glass panels
  const halfW=Math.floor(w/2)-1
  B(ctx,x,y,halfW,h,C.sky1)
  B(ctx,x+halfW+2,y,halfW,h,C.sky1)
  // sky gradient
  ctx.save();ctx.globalAlpha=.3;B(ctx,x,y,w,h*.3,C.sky2);ctx.restore()
  // center mullion
  B(ctx,x+halfW,y,2,h,'#c8c4bc')
  // sliding panel indicator (subtle line showing which panel slides)
  B(ctx,x+halfW+2,y,4,h,'rgba(200,200,190,.15)')
  // window latch dot
  B(ctx,x+halfW-1,y+h/2-2,4,4,'#a0a09a')
  // sky content
  if(timeOfDay==='night'||timeOfDay==='evening'){
    B(ctx,x+halfW-14,y+4,8,8,'#ffee88')
    [[x+5,y+5],[x+14,y+3],[x+halfW-4,y+9],[x+halfW+8,y+4]].forEach(([sx,sy])=>B(ctx,sx,sy,2,2,'#fff'))
  } else {
    // clouds drift
    ctx.save();ctx.globalAlpha=.8
    const off=Math.sin(t*.05+idx)*6
    B(ctx,x+4+off,y+h*.36,12,5,'#fff');B(ctx,x+2+off,y+h*.39,16,5,'#fff')
    B(ctx,x+halfW+6-off*.5,y+h*.42,10,4,'#fff');B(ctx,x+halfW+4-off*.5,y+h*.45,14,4,'#fff')
    ctx.restore()
    if(timeOfDay==='morning'||timeOfDay==='noon')
      B(ctx,x+w-14,y+4,10,10,'#ffdd40')
  }
  // window sill
  B(ctx,x-3,y+h,w+6,5,'#d0ccc4');B(ctx,x-3,y+h,w+6,2,'#e0dcd4')
  // reflection glint
  ctx.save();ctx.globalAlpha=.12;B(ctx,x+2,y+1,6,h-2,'#fff');ctx.restore()
  // curtain rod
  B(ctx,x-5,y-4,w+10,2,'#8a8480')
  // curtains (thin, pulled to sides)
  B(ctx,x-5,y-2,8,h+4,'#f0ccd0');B(ctx,x+w-1,y-2,8,h+4,'#f0ccd0')
}

// ─── MICRO PROP LIBRARY ──────────────────────────────────────────────────────
// All sized relative to character height ~40px
// Desks: 36px wide × 12px deep (bigger than before)
function deskFull(ctx,x,y,w,h,C){
  ctx.save();ctx.globalAlpha=.12;B(ctx,x+3,y+h+1,w,5,'#3a1800');ctx.restore()
  B(ctx,x,y,w,h,C.dsk);B(ctx,x,y,w,2,L(C.dsk,20));B(ctx,x,y+h,w,5,C.dskE)
  B(ctx,x+3,y+h,3,12,C.dskL);B(ctx,x+w-6,y+h,3,12,C.dskL)
}

// BIG monitor — 30×22px (taller than character is wide, proper desk monitor)
function bigMonitor(ctx,x,y,screenColor='#2a5888'){
  B(ctx,x,y,30,22,'#141820')     // bezel
  B(ctx,x+1,y+1,28,19,screenColor) // screen
  // content lines
  B(ctx,x+2,y+3,20,2,L(screenColor,25))
  B(ctx,x+2,y+6,16,1,L(screenColor,15))
  B(ctx,x+2,y+8,22,1,L(screenColor,10))
  B(ctx,x+2,y+10,14,1,'#40a060')
  B(ctx,x+2,y+12,18,1,L(screenColor,8))
  B(ctx,x+2,y+14,10,1,'#e06040')
  B(ctx,x+2,y+16,20,1,L(screenColor,12))
  // status bar
  B(ctx,x+1,y+20,28,2,'#0a0e14')
  B(ctx,x+2,y+21,6,1,'#60cc60')
  // stand
  B(ctx,x+12,y+22,6,4,'#1e2228');B(ctx,x+8,y+26,14,2,'#181c22')
}

// Small laptop
function laptop(ctx,x,y,t,ac='#3a88cc'){
  B(ctx,x,y+8,22,3,'#b0a8a0');B(ctx,x+2,y,18,9,'#3a3a48')
  B(ctx,x+3,y+1,16,7,'#080e18');B(ctx,x+4,y+2,9,1,ac);B(ctx,x+4,y+4,13,1,'#304050')
  if(Math.floor(t*2)%2===0)B(ctx,x+15,y+5,2,2,'#fff')
  B(ctx,x+7,y+8,8,2,D(ac,5))
}

function mug(ctx,x,y,c,steam,t=0){
  B(ctx,x,y,9,10,c);B(ctx,x,y,9,2,L(c,35));B(ctx,x+9,y+2,2,1,c);B(ctx,x+9,y+4,2,1,c);B(ctx,x+10,y+2,1,4,c)
  if(steam){ctx.save();ctx.globalAlpha=.3;ctx.fillStyle='#bbb';ctx.font='8px sans-serif';ctx.fillText('~',x-1+Math.sin(t*3),y-2);ctx.restore()}
}

function bk(ctx,x,y,c,thin=false){const bw=thin?3:5,bh=15;B(ctx,x,y,bw,bh,c);B(ctx,x,y,bw,2,L(c,22));B(ctx,x,y+bh*.35,bw,1,D(c,12));B(ctx,x,y+bh*.68,bw,1,D(c,12));B(ctx,x,y,1,bh,D(c,22))}

function sticky(ctx,x,y,c){B(ctx,x,y,12,10,c);B(ctx,x+1,y+3,10,1,'rgba(0,0,0,.1)');B(ctx,x+1,y+5,8,1,'rgba(0,0,0,.08)');B(ctx,x+1,y+7,6,1,'rgba(0,0,0,.06)')}

function plantS(ctx,x,y,C){B(ctx,x+2,y+8,5,7,C.pot);B(ctx,x+1,y+12,7,4,D(C.pot,12));B(ctx,x+4,y,1,9,C.plD);B(ctx,x-2,y+1,6,4,C.pl);B(ctx,x+4,y,6,4,C.pl);B(ctx,x-1,y+5,5,3,C.plL);B(ctx,x+4,y+4,5,3,C.plL);B(ctx,x+1,y-2,4,3,C.pl)}

function cactus(ctx,x,y,C){B(ctx,x+2,y+2,5,14,C.pl);B(ctx,x,y+6,3,3,C.plL);B(ctx,x+7,y+8,3,3,C.plL);B(ctx,x+2,y+16,7,7,C.pot);B(ctx,x+1,y+20,9,4,D(C.pot,12))}

function bamboo(ctx,x,y,C){B(ctx,x,y+48,24,10,C.pot);for(let i=0;i<3;i++){const sx=x+3+i*7,sh=42+i*12,sy=y+48-sh;for(let s=0;s<5;s++){const gy=sy+s*(sh/5);B(ctx,sx,gy,5,sh/5-1,i%2?C.bam:C.plL);B(ctx,sx,gy+sh/5-1,5,1,C.plD)}}}

function sakura(ctx,x,y,C,t){
  B(ctx,x+5,y+26,4,20,C.sakT);B(ctx,x+6,y+28,2,18,L(C.sakT,18))
  ;[[-16,y+18,26,14],[-7,y+9,24,12],[+5,y+16,22,11],[-13,y+30,18,10],[+4,y+28,17,9],[-4,y+3,20,10]].forEach(([bx,by,bw,bh])=>{B(ctx,x+bx,by,bw,bh,C.sakP);B(ctx,x+bx+2,by+2,bw-4,bh-4,C.sakPD);ctx.save();ctx.globalAlpha=.18;B(ctx,x+bx+2,by+2,bw/3,bh/3,'#fff');ctx.restore()})
  for(let i=0;i<5;i++){const fx=x-18+i*12+Math.sin(t*.5+i)*9,fy=((t*11+i*40)%48)+y+18;ctx.save();ctx.translate(R(fx),R(fy));ctx.rotate(Math.sin(t*.9+i)*.5);B(ctx,-2,-3,5,6,C.sakP);ctx.restore()}
  B(ctx,x+1,y+46,14,7,C.pot)
}

function lantern(ctx,x,y,idx,t,C){
  const sw=Math.sin(t*.6+idx*1.4)*2.5
  ctx.save();ctx.translate(R(x+sw),R(y))
  ctx.save();ctx.globalAlpha=.1;B(ctx,-15,-8,30,26,'rgba(255,170,40,.25)');ctx.restore()
  B(ctx,-1,-10,2,10,C.wd);B(ctx,-6,0,12,3,'#d0a010')
  B(ctx,-8,3,16,12,C.lantern);B(ctx,-6,5,12,8,C.lanternL)
  B(ctx,-8,7,16,2,'rgba(0,0,0,.12)');B(ctx,-8,12,16,3,'#d0a010')
  B(ctx,-2,5,2,7,'rgba(255,255,255,.2)')
  ctx.fillStyle='rgba(255,225,100,.75)';ctx.font='6px serif';ctx.fillText(['和','愛','幸'][idx%3],-3,11)
  ctx.restore()
}

function clock(ctx,x,y,C){
  B(ctx,x-3,y-3,26,26,C.wdD);B(ctx,x,y,20,20,'#fdf8ec')
  for(let i=0;i<12;i++){const a=(i/12)*Math.PI*2-Math.PI/2;B(ctx,x+10+Math.cos(a)*8-1,y+10+Math.sin(a)*8-1,i%3?2:3,i%3?2:3,'#8a7060')}
  const now=new Date(),hr=(now.getHours()%12)/12+now.getMinutes()/720,mn=now.getMinutes()/60
  ;[[hr,5,1,'#3a2010'],[mn,8,1,'#3a2010']].forEach(([a,l,lw,c])=>{ctx.save();ctx.translate(x+10,y+10);ctx.rotate(a*Math.PI*2-Math.PI/2);ctx.fillStyle=c;ctx.fillRect(0,-lw,l,lw*2);ctx.restore()})
  B(ctx,x+9,y+9,3,3,'#3a2010')
}

function figure(ctx,x,y){B(ctx,x+2,y,5,4,'#f4c488');B(ctx,x+2,y,5,2,'#281408');B(ctx,x+1,y+4,7,5,'#d84848');B(ctx,x,y+4,2,4,'#d84848');B(ctx,x+7,y+4,2,4,'#d84848');B(ctx,x+2,y+9,2,4,'#1a2870');B(ctx,x+5,y+9,2,4,'#1a2870')}

function ramen(ctx,x,y){B(ctx,x,y+3,13,7,'#f0e8c8');B(ctx,x+1,y+4,11,5,'#d0a040');B(ctx,x+3,y+5,3,2,'#e06040');B(ctx,x+7,y+5,2,2,'#80c070');B(ctx,x+3,y,2,5,'#a07030');B(ctx,x+7,y,2,5,'#a07030')}

function keyboard(ctx,x,y){B(ctx,x,y,22,8,'#c0bab6');B(ctx,x+1,y+1,20,6,'#b0aab0');for(let r=0;r<2;r++)for(let c=0;c<9;c++)B(ctx,x+2+c*2,y+2+r*3,1,2,'#d4d0cc')}

function snack(ctx,x,y,c){B(ctx,x,y,7,9,c);B(ctx,x+1,y+1,5,2,L(c,25));B(ctx,x+1,y+7,5,1,D(c,12))}

function poster(ctx,x,y,c1,c2){
  B(ctx,x,y,14,18,c1);B(ctx,x+1,y+2,12,10,c2);B(ctx,x+2,y+14,10,1,'rgba(0,0,0,.15)');B(ctx,x+2,y+16,8,1,'rgba(0,0,0,.1)')
  B(ctx,x-1,y-1,2,20,'rgba(0,0,0,.1)') // pin shadow
}

function serverRack(ctx,x,y,h,C){
  B(ctx,x,y,14,h,'#141820');B(ctx,x,y,14,2,'#1e2430')
  for(let i=0;i<Math.floor(h/8);i++){B(ctx,x+2,y+3+i*8,3,3,i%2?'#00cc44':'#cc4400');B(ctx,x+6,y+4+i*8,7,1,'#0a0e16')}
  // blinking light
  if(Math.floor(Date.now()/500)%2) B(ctx,x+10,y+3,2,2,'#00aaff')
}

function cable(ctx,x,y,c='#2a1c28'){
  ctx.save();ctx.strokeStyle=c;ctx.lineWidth=1.5;ctx.lineCap='round'
  ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+6,y+8,x+12,y+3,x+18,y+6);ctx.stroke();ctx.restore()
}

function torii(ctx,x,y,w,h,C){
  const pl=6 // pillar width
  B(ctx,x,y+h*.2,pl,h*.8,C.lantern);B(ctx,x+w-pl,y+h*.2,pl,h*.8,C.lantern)
  B(ctx,x-4,y,w+8,pl,C.lantern);B(ctx,x-2,y+h*.15,w+4,pl*.8,C.lantern)
  B(ctx,x-4,y,4,pl,'#901818');B(ctx,x+w,y,4,pl,'#901818')
  // base stones
  B(ctx,x-3,y+h*.95,12,5,'#b0a898');B(ctx,x+w-9,y+h*.95,12,5,'#b0a898')
}

// ─── MAIN RENDER ─────────────────────────────────────────────────────────────

// ─── INTERACTABLE OBJECT DRAW FUNCTIONS ──────────────────────────────────────

function drawCoffeeMachine(ctx,x,y,t){
  // Body
  B(ctx,x,y+4,22,20,'#2a2a32');B(ctx,x,y+4,22,3,'#3a3a44')
  // Screen
  B(ctx,x+3,y+7,10,8,'#1a3a2a');B(ctx,x+4,y+8,8,2,'#40cc80');B(ctx,x+4,y+11,6,1,'#208840')
  // Buttons
  B(ctx,x+15,y+8,4,3,'#c03030');B(ctx,x+15,y+12,4,3,'#3060c0')
  // Cup platform
  B(ctx,x+4,y+24,14,2,'#444');B(ctx,x+6,y+26,10,6,'#f8f0e0')
  // Steam (animated)
  const s=Math.sin(t*3)*2
  ctx.save();ctx.globalAlpha=.3+Math.sin(t*2)*.1
  ctx.fillStyle='#bbb';ctx.font='8px sans-serif'
  ctx.fillText('~',x+9+s,y+2);ctx.fillText('~',x+12-s,y-1)
  ctx.restore()
  // Label
  ctx.fillStyle='rgba(248,244,240,0.85)';ctx.fillRect(x-2,y+33,26,9)
  ctx.fillStyle='#3a2010';ctx.font='bold 6px DM Sans,sans-serif';ctx.fillText('☕ Coffee',x,y+40)
}

function drawFridge(ctx,x,y,glow){
  B(ctx,x,y,28,44,'#ddeef8');B(ctx,x,y,28,2,'#eef6fc')
  B(ctx,x,y+22,28,1,'#b0c8d8')
  // Door handles
  B(ctx,x+22,y+6,4,8,'#a0b8c8');B(ctx,x+22,y+28,4,8,'#a0b8c8')
  // Glow when open
  if(glow){ctx.save();ctx.globalAlpha=.15;B(ctx,x-4,y,36,44,'#88ddff');ctx.restore()}
  // Items visible through door
  ctx.save();ctx.globalAlpha=.5
  B(ctx,x+3,y+4,6,4,'#f0e020');B(ctx,x+11,y+4,5,4,'#50b870')
  B(ctx,x+3,y+26,5,4,'#e05050');B(ctx,x+10,y+26,8,4,'#f0c040')
  ctx.restore()
  // Indicator light
  B(ctx,x+2,y+2,3,3,glow?'#40ff80':'#20a040')
  ctx.fillStyle='rgba(248,244,240,0.85)';ctx.fillRect(x-2,y+47,32,9)
  ctx.fillStyle='#3a2010';ctx.font='bold 6px DM Sans,sans-serif';ctx.fillText('🧃 Fridge',x,y+54)
}

function drawWifiRouter(ctx,x,y,t){
  B(ctx,x,y+8,24,12,'#1a1a2a');B(ctx,x,y+8,24,2,'#2a2a3a')
  // Signal arcs (animated pulse)
  const pulse=(Math.floor(t*2)%3)
  ctx.save();ctx.strokeStyle='#40a0ff';ctx.lineWidth=1.5;ctx.lineCap='round'
  ;[0,1,2].forEach(i=>{
    ctx.globalAlpha=pulse===i?0.9:0.3
    ctx.beginPath();ctx.arc(x+12,y+8,4+i*5,Math.PI*1.1,Math.PI*1.9);ctx.stroke()
  })
  ctx.restore()
  // Antenna
  B(ctx,x+4,y,2,9,'#2a2a3a');B(ctx,x+18,y,2,9,'#2a2a3a')
  // LEDs
  ;[[3,'#40ff40'],[8,'#40a0ff'],[13,'#ffcc00']].forEach(([ox,lc])=>{
    B(ctx,x+ox,y+12,3,3,Math.floor(t*3)%2?lc:'#181820')
  })
  ctx.fillStyle='rgba(248,244,240,0.85)';ctx.fillRect(x-2,y+23,28,9)
  ctx.fillStyle='#3a2010';ctx.font='bold 6px DM Sans,sans-serif';ctx.fillText('📡 WiFi',x+2,y+30)
}

function drawWhiteboardObj(ctx,x,y,t){
  B(ctx,x,y,40,26,'#f8f4ec');B(ctx,x,y,40,2,'#e8e0d0')
  B(ctx,x-3,y-3,46,32,'#8a6030');B(ctx,x,y,40,26,'#f8f4ec');B(ctx,x,y,40,2,'#e8e0d0')
  // Marker scribbles
  ctx.save();ctx.globalAlpha=.35
  B(ctx,x+3,y+5,28,2,'#3355cc');B(ctx,x+3,y+9,20,2,'#aa3355')
  B(ctx,x+3,y+13,24,2,'#3a8a3a');B(ctx,x+8,y+17,14,2,'#cc7700')
  ctx.restore()
  // Marker tray
  B(ctx,x,y+26,40,4,'#a87040')
  ;[3,9,15,21].forEach((ox,i)=>B(ctx,x+ox,y+27,5,2,['#e05050','#5050e0','#50a050','#e0a020'][i]))
  ctx.fillStyle='rgba(248,244,240,0.85)';ctx.fillRect(x-3,y+34,46,9)
  ctx.fillStyle='#3a2010';ctx.font='bold 6px DM Sans,sans-serif';ctx.fillText('📋 Whiteboard',x-1,y+41)
}

function drawPlantObj(ctx,x,y,t){
  // Pot
  B(ctx,x+8,y+28,16,12,'#c86030');B(ctx,x+7,y+38,18,4,'#a04820')
  // Stem
  B(ctx,x+14,y+10,4,20,'#508030')
  // Leaves
  const sway=Math.sin(t*.8)*.5
  ctx.save();ctx.translate(x+16,y+22);ctx.rotate(sway*.05)
  B(ctx,-12,-4,22,10,'#50a040');B(ctx,-10,-2,18,6,'#70c060')
  ctx.restore()
  ctx.save();ctx.translate(x+16,y+16);ctx.rotate(-sway*.06)
  B(ctx,-2,-8,20,10,'#50a040');B(ctx,0,-6,16,6,'#70c060')
  ctx.restore()
  // Big leaf
  ctx.save();ctx.translate(x+16,y+10);ctx.rotate(sway*.04)
  B(ctx,-8,-10,18,12,'#408030');B(ctx,-6,-8,14,8,'#60a050')
  ctx.restore()
  ctx.fillStyle='rgba(248,244,240,0.85)';ctx.fillRect(x-2,y+45,36,9)
  ctx.fillStyle='#3a2010';ctx.font='bold 6px DM Sans,sans-serif';ctx.fillText('🌿 Monstera',x,y+52)
}

function drawSnackShelf(ctx,x,y){
  // Shelf
  B(ctx,x,y,32,4,'#a87040');B(ctx,x,y+12,32,4,'#a87040');B(ctx,x,y+24,32,4,'#a87040')
  // Snacks row 1
  B(ctx,x+2,y-8,5,9,'#e85050');B(ctx,x+8,y-8,5,9,'#50a0e8')
  B(ctx,x+14,y-8,5,9,'#50e870');B(ctx,x+20,y-8,5,9,'#e8c040')
  B(ctx,x+26,y-8,4,9,'#e050c0')
  // Snacks row 2
  B(ctx,x+2,y+4,5,8,'#e8a040');B(ctx,x+9,y+4,12,8,'#f8e8c0')
  B(ctx,x+22,y+4,8,8,'#c0e8a0')
  ctx.fillStyle='rgba(248,244,240,0.85)';ctx.fillRect(x-2,y+28,36,9)
  ctx.fillStyle='#3a2010';ctx.font='bold 6px DM Sans,sans-serif';ctx.fillText('🍡 Snacks',x+2,y+35)
}

function drawStandingDesk(ctx,x,y){
  // Desk surface
  B(ctx,x,y,36,8,'#e8d4a4');B(ctx,x,y,36,2,'#f0e0b8')
  // Legs (tall — standing height)
  B(ctx,x+2,y+8,4,28,'#8a6030');B(ctx,x+30,y+8,4,28,'#8a6030')
  // Height control panel
  B(ctx,x+14,y+10,8,10,'#1a1a28');B(ctx,x+15,y+12,3,3,'#60ff60');B(ctx,x+20,y+12,3,3,'#6060ff')
  // Monitor stand
  B(ctx,x+14,y-16,8,17,'#1a1a28');B(ctx,x+4,y-20,28,5,'#1a1a28')
  B(ctx,x+5,y-19,26,3,'#0a2040')
  ctx.fillStyle='rgba(248,244,240,0.85)';ctx.fillRect(x-2,y+40,40,9)
  ctx.fillStyle='#3a2010';ctx.font='bold 6px DM Sans,sans-serif';ctx.fillText('🧍 Standing',x+2,y+47)
}

function drawGameConsole(ctx,x,y,t){
  // TV body
  B(ctx,x,y+4,32,22,'#2a1828');B(ctx,x+2,y+6,28,18,'#0a0818')
  // Screen content (pixel art style)
  const frame=Math.floor(t*4)%4
  ;[[8,'#e05050'],[14,'#50e060'],[20,'#5050e0']].forEach(([bx,bc],i)=>{
    B(ctx,x+bx,y+14-((frame+i)%3)*2,4,4,bc)
  })
  // Scanlines
  ctx.save();ctx.globalAlpha=.08
  for(let sy=y+6;sy<y+24;sy+=2) B(ctx,x+2,sy,28,1,'#000')
  ctx.restore()
  // Antenna
  B(ctx,x+6,y,2,5,'#2a1828');B(ctx,x+24,y,2,5,'#2a1828')
  // Controller
  B(ctx,x+4,y+28,10,6,'#3a1828');B(ctx,x+18,y+28,10,6,'#3a1828')
  ctx.fillStyle='rgba(248,244,240,0.85)';ctx.fillRect(x-2,y+37,36,9)
  ctx.fillStyle='#3a2010';ctx.font='bold 6px DM Sans,sans-serif';ctx.fillText('🎮 Console',x+2,y+44)
}

function drawFishTank(ctx,x,y,t){
  // Tank
  B(ctx,x,y,36,28,'#88ccee');ctx.save();ctx.globalAlpha=.3;B(ctx,x,y,36,28,'#aaddff');ctx.restore()
  // Glass reflections
  ctx.save();ctx.globalAlpha=.15;B(ctx,x+2,y+2,4,24,'#fff');ctx.restore()
  // Water surface shimmer
  ctx.save();ctx.globalAlpha=.4+Math.sin(t*2)*.1
  B(ctx,x,y,36,3,'#aaddff');ctx.restore()
  // Fish
  const f1x=x+5+Math.sin(t*.7)*12, f1y=y+8+Math.sin(t*.5)*4
  const f2x=x+20+Math.sin(t*.5+1)*8, f2y=y+16+Math.sin(t*.8+2)*3
  ctx.save();ctx.fillStyle='#ff8840'
  ctx.beginPath();ctx.ellipse(f1x,f1y,6,3,Math.sin(t*.7)*.3,0,Math.PI*2);ctx.fill()
  ctx.fillStyle='#ff6020'
  ctx.beginPath();ctx.ellipse(f2x,f2y,4,2,Math.sin(t*.5+1)*.3,0,Math.PI*2);ctx.fill()
  ctx.restore()
  // Gravel
  B(ctx,x,y+25,36,3,'#c8a870')
  // Torii gate decoration
  B(ctx,x+13,y+16,10,2,'#c03030');B(ctx,x+14,y+18,2,8,'#c03030');B(ctx,x+21,y+18,2,8,'#c03030')
  // Frame
  B(ctx,x-3,y-3,42,34,'#8a6030')
  ctx.fillStyle='rgba(248,244,240,0.85)';ctx.fillRect(x-3,y+34,42,9)
  ctx.fillStyle='#3a2010';ctx.font='bold 6px DM Sans,sans-serif';ctx.fillText('🐟 Aquarium',x,y+41)
}

function drawNoodleStation(ctx,x,y,t){
  // Counter
  B(ctx,x,y+16,36,6,'#e0d0b8');B(ctx,x,y+16,36,2,'#f0e0c8')
  // Kettle
  B(ctx,x+2,y+4,12,12,'#c8c8c8');B(ctx,x+3,y+5,10,10,'#d8d8d8')
  B(ctx,x+6,y+2,4,3,'#a0a0a0');B(ctx,x+11,y+8,4,3,'#a0a0a0')
  // Steam (when hot)
  ctx.save();ctx.globalAlpha=.25+Math.sin(t*2.5)*.1;ctx.fillStyle='#bbb';ctx.font='8px serif'
  ctx.fillText('~',x+5,y+0);ctx.fillText('~',x+9,y-3);ctx.restore()
  // Ramen cups stacked
  B(ctx,x+16,y,8,6,'#f8e050');B(ctx,x+17,y+1,6,4,'#e0c040')
  B(ctx,x+16,y+6,8,6,'#e85050');B(ctx,x+17,y+7,6,4,'#c83040')
  B(ctx,x+16,y+12,8,5,'#50b8e8');B(ctx,x+17,y+13,6,3,'#3090c8')
  // Chopsticks
  B(ctx,x+26,y+4,2,14,'#c89870');B(ctx,x+30,y+2,2,16,'#c89870')
  ctx.fillStyle='rgba(248,244,240,0.85)';ctx.fillRect(x-2,y+25,40,9)
  ctx.fillStyle='#3a2010';ctx.font='bold 6px DM Sans,sans-serif';ctx.fillText('🍜 Noodles',x+2,y+32)
}


// ─── OFFICE CHAIR (Japanese modern — low back, mesh look) ────────────────────
function drawChair(ctx,x,y,C,facing='d'){
  const R=Math.round
  // Seat
  B(ctx,x,y+6,16,7,'#2a2a38');B(ctx,x,y+6,16,2,'#3a3a4a')
  // Back
  if(facing==='d'||facing==='u'){
    B(ctx,x+1,y,14,7,'#1e1e2a');B(ctx,x+2,y+1,12,5,'#28283a')
    // Mesh lines
    ctx.save();ctx.globalAlpha=.35
    for(let i=2;i<12;i+=3) B(ctx,x+i,y+1,1,5,'#4a4a5e')
    ctx.restore()
  }
  // Armrests
  B(ctx,x-2,y+7,4,3,'#222230');B(ctx,x+14,y+7,4,3,'#222230')
  // Legs (5-star base)
  ctx.save();ctx.globalAlpha=.6
  ;[[-4,6],[4,8],[0,10],[-6,9],[6,9]].forEach(([ox,oy])=>
    B(ctx,x+7+ox,y+13+oy,2,2,'#1a1a28')
  )
  // Wheels
  ;[[-5,15],[5,15],[0,17],[-7,14],[7,14]].forEach(([ox,oy])=>
    B(ctx,x+7+ox,y+13+oy,2,2,'#333')
  )
  ctx.restore()
}

// ─── AGENT SITTING IN CHAIR ──────────────────────────────────────────────────
// Draws chair first then sprite on top in seated pose
function spriteSleeping(ctx,wx,wy,id,t,C){
  // Draw chibi lying flat using drawSprite rotated -90deg
  ctx.save()
  // Center of where the sprite would stand
  const cx=wx+8, cy=wy+12
  ctx.translate(cx, cy)
  ctx.rotate(-Math.PI/2)
  ctx.translate(-8, -12)
  drawSprite(ctx,0,0,id,'down',0,false,false,'resting',t,px,1)
  ctx.restore()
  // Floating Zzz bubbles
  const zo=((t*.6)%1)*16
  ctx.save()
  ctx.globalAlpha=1-((t*.6)%1)
  ctx.fillStyle='#9980cc';ctx.font='bold 9px DM Sans,sans-serif'
  ctx.fillText('z',wx+20,wy-2-zo)
  ctx.restore()
  ctx.save()
  ctx.globalAlpha=1-((t*.6+.4)%1)
  ctx.fillStyle='#7860a8';ctx.font='bold 7px DM Sans,sans-serif'
  ctx.fillText('z',wx+26,wy-8-zo)
  ctx.restore()
}

// ─── JAPANESE BEDROOM BED ─────────────────────────────────────────────────────
function drawBed(ctx,x,y,C,agentId){
  // Futon/bed frame
  B(ctx,x,y+6,40,20,'#c89870');B(ctx,x,y+6,40,2,'#d8a880')
  // Mattress
  B(ctx,x+2,y+8,36,14,'#f0e8dc');B(ctx,x+2,y+8,36,3,'#f8f0e8')
  // Pillow
  B(ctx,x+3,y+8,12,8,'#e8dcc8');B(ctx,x+4,y+9,10,2,'#f0e4d0')
  // Blanket (colored per agent)
  const colors=['#3858b0','#c04888','#3090a8','#308050','#b06830','#d87050','#282840','#801818']
  const idx=Object.keys(AGENT_HOME||{}).indexOf(agentId||'')
  const bc=colors[idx%colors.length]||'#3858b0'
  B(ctx,x+16,y+9,20,12,bc);B(ctx,x+16,y+9,20,2,bc.replace(/^#/,'#')+'dd')
  // Bed legs
  B(ctx,x+1,y+24,4,4,'#8a6030');B(ctx,x+35,y+24,4,4,'#8a6030')
  // Bedside table
  B(ctx,x+42,y+12,10,18,'#a87040');B(ctx,x+43,y+13,8,8,'#ddd5c8')
  B(ctx,x+44,y+15,3,3,'#f0c040')  // lamp
}

// ─── 2ND FLOOR RENDER ─────────────────────────────────────────────────────────
function renderFloor2(ctx,W,H,C,t,restingAgents,states){
  const R=Math.round
  // ── BACKGROUND ──
  B(ctx,0,0,W,H,'#1a1208')

  // ── LAYOUT: 4 rooms, 2 top / 2 bottom, hallway cross in center ──
  const hw=R(W*.12), hh=R(H*.14)  // hallway thickness
  const cx=R(W/2), cy=R(H/2)       // hallway center

  const rooms=[
    {x:0,       y:0,    w:cx-hw/2, h:cy-hh/2, label:'🛏 Dev Wing',    tatami:true},
    {x:cx+hw/2, y:0,    w:W-(cx+hw/2), h:cy-hh/2, label:'🛏 Design Wing', tatami:true},
    {x:0,       y:cy+hh/2, w:cx-hw/2, h:H-(cy+hh/2), label:'🛏 TechLead Wing', tatami:false},
    {x:cx+hw/2, y:cy+hh/2, w:W-(cx+hw/2), h:H-(cy+hh/2), label:'🛏 PM Wing', tatami:false},
  ]

  // Draw rooms
  rooms.forEach(({x,y,w,h,label,tatami})=>{
    // Floor
    if(tatami){
      B(ctx,x,y,w,h,'#c8b868')
      for(let ty=y;ty<y+h;ty+=22) B(ctx,x,ty,w,1,C.tatamiD||'#a89848')
      for(let tx=x;tx<x+w;tx+=22) B(ctx,tx,y,1,h,C.tatamiD||'#a89848')
    } else {
      B(ctx,x,y,w,h,'#d0a460')
      for(let py2=y;py2<y+h;py2+=8){B(ctx,x,py2,w,6,'#c89850');B(ctx,x,py2+6,w,2,'#b07838')}
    }
    // Wall at top/outer edge
    const wallH=R(h*.28)
    B(ctx,x,y,w,wallH,'#2a1e14')
    B(ctx,x,y+wallH,w,3,C.rail||'#a89070')
    // Window on outer wall
    const ww=R(w*.25),wx2=R(x+w*.35),wy2=R(y+4)
    B(ctx,wx2-2,wy2-2,ww+4,wallH-8,'#8a6030')
    B(ctx,wx2,wy2,ww,wallH-12,C.sky1||'#b8d8f0')
    ctx.save();ctx.globalAlpha=.25;B(ctx,wx2,wy2,ww,R((wallH-12)*.4),C.sky2||'#90b8d8');ctx.restore()
    B(ctx,R(wx2+ww/2)-1,wy2,2,wallH-12,'#c8c4bc')
    // Paper lantern
    const lx=R(x+w*.65),ly=R(y+wallH+4)
    B(ctx,lx-5,ly,10,14,C.lantern||'#c03030');B(ctx,lx-4,ly+2,8,8,C.lanternL||'#e05050')
    B(ctx,lx-1,ly-4,2,5,'#8a6030');B(ctx,lx-1,ly+14,2,4,'#8a6030')
    ctx.save();ctx.globalAlpha=.12+Math.sin(t*1.5+x)*.04;B(ctx,lx-16,ly,32,18,'#ffa020');ctx.restore()
    // Room label
    ctx.save();ctx.globalAlpha=.7;ctx.fillStyle='#f8e8c8';ctx.font='bold 8px DM Sans,sans-serif'
    ctx.fillText(label,x+6,y+wallH-4);ctx.restore()
    // Small plant in corner
    B(ctx,R(x+w-14),R(y+wallH+8),8,12,C.pot||'#c86030')
    B(ctx,R(x+w-13),R(y+wallH+2),6,8,C.pl||'#50a050')
    B(ctx,R(x+w-15),R(y+wallH+4),5,5,C.plL||'#70c070')
  })

  // ── HALLWAY CROSS ──
  // Horizontal hall
  B(ctx,0,cy-hh/2,W,hh,'#241a0e')
  for(let hy=cy-hh/2;hy<cy+hh/2;hy+=6){B(ctx,0,hy,W,4,'#2e2010');B(ctx,0,hy+4,W,2,'#1a1008')}
  // Vertical hall
  B(ctx,cx-hw/2,0,hw,H,'#241a0e')
  for(let hx=cx-hw/2;hx<cx+hw/2;hx+=6){B(ctx,hx,0,4,H,'#2e2010');B(ctx,hx+4,0,2,H,'#1a1008')}
  // Hall lanterns
  ;[[cx,cy-H*.25],[cx,cy+H*.25],[W*.25,cy],[W*.75,cy]].forEach(([lx,ly],i)=>{
    B(ctx,R(lx-5),R(ly-8),10,14,C.lantern||'#c03030')
    B(ctx,R(lx-4),R(ly-6),8,8,C.lanternL||'#e05050')
    ctx.save();ctx.globalAlpha=.15+Math.sin(t*1.8+i)*.05
    B(ctx,R(lx-20),R(ly-10),40,20,'#ffa020');ctx.restore()
  })

  // ── BEDS — 2 per room (10 beds total for 20 agents) ──
  const bedSlots=[
    // Room 0 (top-left): dev wing
    {x:20,y:80,wing:0},{x:R(rooms[0].w-70),y:80,wing:0},
    {x:20,y:160,wing:0},{x:R(rooms[0].w-70),y:160,wing:0},
    // Room 1 (top-right): design wing
    {x:R(cx+hw/2+16),y:80,wing:1},{x:R(W-72),y:80,wing:1},
    {x:R(cx+hw/2+16),y:160,wing:1},{x:R(W-72),y:160,wing:1},
    // Room 2 (bottom-left): techlead wing
    {x:20,y:R(cy+hh/2+20),wing:2},{x:R(rooms[2].w-70),y:R(cy+hh/2+20),wing:2},
    {x:20,y:R(cy+hh/2+100),wing:2},{x:R(rooms[2].w-70),y:R(cy+hh/2+100),wing:2},
    // Room 3 (bottom-right): PM wing
    {x:R(cx+hw/2+16),y:R(cy+hh/2+20),wing:3},{x:R(W-72),y:R(cy+hh/2+20),wing:3},
    {x:R(cx+hw/2+16),y:R(cy+hh/2+100),wing:3},{x:R(W-72),y:R(cy+hh/2+100),wing:3},
  ]

  restingAgents.forEach((agentId,idx)=>{
    if(idx>=bedSlots.length) return
    const {x,y}=bedSlots[idx]
    drawBed(ctx,x,y,C,agentId)
    spriteSleeping(ctx,x+8,y+4,agentId,t,C)
  })

  // ── STAIRS INDICATOR (center hallway, bottom) ──
  const sx=R(W/2-20),sy=H-44
  for(let i=0;i<5;i++) B(ctx,sx+i*5,sy-i*5,44-i*10,8,'#a87040')
  B(ctx,sx-2,sy-26,4,30,C.wdD||'#5a3010');B(ctx,sx+40,sy-26,4,30,C.wdD||'#5a3010')
  B(ctx,sx-4,sy-28,48,3,C.rail||'#a89070')
  ctx.fillStyle='rgba(248,244,240,0.92)';ctx.fillRect(R(W/2-36),sy+10,72,14)
  ctx.strokeStyle='#c8a868';ctx.lineWidth=1;ctx.strokeRect(R(W/2-36),sy+10,72,14)
  ctx.fillStyle='#3a2010';ctx.font='bold 8px DM Sans,sans-serif'
  ctx.textAlign='center';ctx.fillText('▼ 1F (click)',W/2,sy+21);ctx.textAlign='left'
}


// ─── RAIN ─────────────────────────────────────────────────────────────────────
function drawRain(ctx,W,H,t,intensity=0.6){
  const count=Math.floor(80*intensity)
  ctx.save()
  ctx.strokeStyle='rgba(180,210,240,0.35)'
  ctx.lineWidth=1
  for(let i=0;i<count;i++){
    // Deterministic position from time + index
    const px=((i*137.508+t*120)%W)
    const py=((i*97.3+t*300+i*31)%(H+60))-30
    const len=8+Math.floor(i*3.7)%8
    ctx.beginPath()
    ctx.moveTo(px,py)
    ctx.lineTo(px-2,py+len)
    ctx.stroke()
  }
  ctx.restore()
  // Rain on window glass — small rivulets
  ctx.save()
  ctx.strokeStyle='rgba(180,210,240,0.2)'
  ctx.lineWidth=1
  for(let i=0;i<15;i++){
    const px=50+i*43
    const py=((i*23.7+t*40)%80)
    ctx.beginPath();ctx.moveTo(px,py)
    ctx.bezierCurveTo(px-1,py+8,px+1,py+14,px,py+20)
    ctx.stroke()
  }
  ctx.restore()
}

// ─── LOBBY CENTER MEETING TABLE ───────────────────────────────────────────────
function drawMeetingTable(ctx,x,y,w,h,C){
  // Table surface — long dark wood
  B(ctx,x,y,w,h,'#3a2810');B(ctx,x,y,w,3,'#4a3418')
  B(ctx,x,y+h,w,5,C.dskE||'#c8a868')  // edge
  // Legs
  ;[[4,h+4],[w-10,h+4],[4,h+4],[w-10,h+4]].forEach(([ox,oy])=>
    B(ctx,x+ox,y+oy,6,16,'#2a1c0c')
  )
  // Surface sheen
  ctx.save();ctx.globalAlpha=.08
  B(ctx,x+4,y+2,w-8,4,'#fff')
  ctx.restore()
  // Center piece — small plant/flower
  const mx=x+Math.round(w/2),my=y+Math.round(h/2)
  B(ctx,mx-3,my-2,6,8,C.pot||'#c86030')
  B(ctx,mx-1,my-8,2,7,C.plD||'#308030')
  B(ctx,mx-4,my-10,8,5,C.pl||'#50a050')
}

// ─── STAIRCASE ────────────────────────────────────────────────────────────────
function drawStairs(ctx,x,y,C){
  for(let i=0;i<6;i++){
    B(ctx,x+i*5,y-i*4,28-i*2,6,C.plankA||'#d0a460')
    B(ctx,x+i*5,y-i*4,28-i*2,1,C.plankB||'#c49050')
  }
  B(ctx,x,y-30,4,32,C.wdD||'#5a3010')
  B(ctx,x+26,y-30,4,32,C.wdD||'#5a3010')
  // Handrail
  B(ctx,x-2,y-32,32,3,C.rail||'#a89070')
  ctx.fillStyle='rgba(248,244,240,0.85)';ctx.font='bold 7px DM Sans,sans-serif'
  ctx.fillText('▲ 2F',x+2,y+10)
}

function renderScene(ctx,W,H,C,timeOfDay,t,agents,selectedAgent,states){
  // Defensive: palette must be valid
  if(!C||!C.sky1||!C.sky2) return
  ctx.clearRect(0,0,W,H);ctx.imageSmoothingEnabled=false
  const {tw,th,lw,lbW,rw,topH,botH}=layout(W,H)

  // ═══ WALLS ═══
  drawWall(ctx,0,0,lw,topH,C)          // design
  drawWall(ctx,0,topH,lw,botH,C)       // techlead
  drawWall(ctx,lw,0,lbW,H,C)           // lobby
  drawWall(ctx,lw+lbW,0,rw,topH,C)    // dev
  drawWall(ctx,lw+lbW,topH,rw,botH,C) // qa

  // ═══ FLOORS ═══
  drawFloor(ctx,0,0,lw,topH,'wood',C)
  drawFloor(ctx,0,topH,lw,botH,'tatami',C)
  drawFloor(ctx,lw,0,lbW,H,'wood',C)
  drawFloor(ctx,lw+lbW,0,rw,topH,'wood',C)
  drawFloor(ctx,lw+lbW,topH,rw,botH,'tile',C)

  // ═══ DIVIDERS ═══
  B(ctx,lw-4,0,8,H,C.wdD)
  B(ctx,lw+lbW-4,0,8,H,C.wdD)
  B(ctx,0,topH-4,lw,8,C.wdD)
  B(ctx,lw+lbW,topH-4,rw,8,C.wdD)
  // door openings
  const dh=th*4.5
  ;[[lw-4,topH*.22,dh,C.wall],[lw-4,topH+botH*.18,dh,C.tatami],[lw+lbW-4,topH*.22,dh,C.wall],[lw+lbW-4,topH+botH*.18,dh,C.tile]].forEach(([dx,dy,ddh,fill])=>{
    B(ctx,dx,dy,8,ddh,fill)
    B(ctx,dx-2,dy-3,12,3,C.wdL);B(ctx,dx-2,dy+ddh,12,3,C.wdL)
    B(ctx,dx-2,dy,3,ddh,C.wdL);B(ctx,dx+7,dy,3,ddh,C.wdL)
  })

  // helper: wall-top Y for each room
  const dwh=Math.round(topH*.36), twh=Math.round(botH*.36), lwh=Math.round(H*.36)
  const dfy=dwh, tfy=topH+twh, qfy=topH+twh, lfy=lwh

  // ════════════════════════════════════════════════════════
  // DESIGN ROOM (cols 0-10, rows 0-13)
  // ════════════════════════════════════════════════════════
  drawWindow(ctx,8,6,lw-20,dwh-14,C,timeOfDay,t,0)

  // Whiteboard — occupies back wall nicely
  const wbx=10,wby=8,wbw=lw-24,wbh=dwh*.35
  B(ctx,wbx-2,wby-2,wbw+4,wbh+4,C.wdD);B(ctx,wbx,wby,wbw,wbh,'#f6f4ee')
  sticky(ctx,wbx+3,wby+3,C.sticky[0]);sticky(ctx,wbx+18,wby+4,C.sticky[1]);sticky(ctx,wbx+33,wby+2,C.sticky[2])
  ctx.save();ctx.globalAlpha=.28;B(ctx,wbx+4,wby+wbh-6,wbw-8,1,'#3355aa');B(ctx,wbx+4,wby+wbh-4,wbw*.55,1,'#aa3355');ctx.restore()
  // marker tray
  B(ctx,wbx,wby+wbh,wbw,3,C.wdL);B(ctx,wbx+3,wby+wbh+1,4,1,'#e05050');B(ctx,wbx+8,wby+wbh+1,4,1,'#5050e0');B(ctx,wbx+13,wby+wbh+1,4,1,'#50a050')

  // Bookshelf right wall
  B(ctx,lw-16,8,14,dwh*.52,C.shelf||C.wdL);B(ctx,lw-15,9,12,dwh*.52-2,'#f8f0e8')
  B(ctx,lw-16,8+dwh*.17,14,1,C.wdD);B(ctx,lw-16,8+dwh*.35,14,1,C.wdD)
  ;[0,1,2].forEach(i=>bk(ctx,lw-15+i*4,10,C.bk[i],true))
  ;[3,4,5].forEach(i=>bk(ctx,lw-15+(i-3)*4,10+dwh*.19,C.bk[i],true))
  figure(ctx,lw-14,8+dwh*.36)

  // Server rack — left wall, not blocking walkway
  serverRack(ctx,2,dfy-44,28,C)

  // Designer desk + Backend desk (back of room, agents walk in FRONT)
  const dskW=38,dskH=12,dsky=dfy-dskH-2
  ;[3,lw-dskW-3].forEach((dx,i)=>{
    deskFull(ctx,dx,dsky,dskW,dskH,C)
    bigMonitor(ctx,dx+2,dsky-26,i===0?'#2a4888':'#1a5830')
    mug(ctx,dx+dskW-12,dsky+2,C.mug[i],true,t)
    keyboard(ctx,dx+2,dsky+3);cable(ctx,dx+10,dsky+11,'#2a1828')
    sticky(ctx,dx+20,dsky+2,C.sticky[i]);sticky(ctx,dx+28,dsky+3,C.sticky[(i+2)%4])
    if(i===0)ramen(ctx,dx+dskW-14,dsky-2)
    else{snack(ctx,dx+dskW-10,dsky-2,'#88cc44');figure(ctx,dx+26,dsky-10)}
  })

  // Floor plants
  plantS(ctx,2,dfy-22,C);cactus(ctx,lw-10,dfy-24,C)

  // Posters on wall
  poster(ctx,wbx+wbw+3,wby,'#2a3870','#4488cc')
  poster(ctx,wbx+wbw+3,wby+22,'#3a1858','#9050d8')

  // ════════════════════════════════════════════════════════
  // TECH LEAD ROOM (cols 0-10, rows 14-27)
  // ════════════════════════════════════════════════════════
  drawWindow(ctx,8,topH+6,lw-20,twh-14,C,timeOfDay,t,5)

  const tlDsky=tfy-dskH-2
  deskFull(ctx,3,tlDsky,lw-6,dskH,C)
  bigMonitor(ctx,5,tlDsky-28,'#441820')
  bigMonitor(ctx,38,tlDsky-28,'#441820')
  keyboard(ctx,4,tlDsky+2);mug(ctx,lw-16,tlDsky+2,C.mug[2],true,t)
  ;[[8,C.sticky[0]],[22,C.sticky[1]],[36,C.sticky[2]]].forEach(([sx,sc])=>sticky(ctx,sx,tlDsky+2,sc))
  cable(ctx,8,tlDsky+10,'#201028');cable(ctx,28,tlDsky+10,'#201028')

  // Futon at bottom of techlead room
  const ftx=3,fty=tfy+botH*.32,ftw=lw-8,fth=16
  B(ctx,ftx-2,fty-2,ftw+4,fth+4,C.wdD);B(ctx,ftx,fty,ftw,fth,'#f0ead8')
  B(ctx,ftx,fty+fth*.35,ftw,fth*.65,C.sofa);B(ctx,ftx,fty+fth*.35,ftw,2,L(C.sofa,15))
  // pillow
  B(ctx,ftx+3,fty+2,12,9,'#f8e8e0');B(ctx,ftx+3,fty+2,12,2,'#fff')

  // Bookshelf
  B(ctx,lw-16,topH+8,14,twh*.55,C.shelf||C.wdL)
  ;[0,1,2,3,4].forEach(i=>bk(ctx,lw-15+i*2,topH+10,C.bk[i],true))
  plantS(ctx,2,tfy-22,C)
  poster(ctx,10,topH+8,'#203858','#3080aa')
  poster(ctx,10,topH+30,'#583020','#c06030')

  // ════════════════════════════════════════════════════════
  // LOBBY (cols 12-31, full height)
  // ════════════════════════════════════════════════════════
  // 3 modern sliding windows
  ;[.1,.39,.67].forEach((ox,i)=>drawWindow(ctx,lw+lbW*ox,4,lbW*.22,H*.2,C,timeOfDay,t,i+2))

  // Torii gate (decorative, back wall center)
  torii(ctx,lw+lbW*.35,8,lbW*.26,H*.2,C)

  // Lanterns
  ;[lw+lbW*.22,lw+lbW*.5,lw+lbW*.78].forEach((lx,i)=>lantern(ctx,lx,H*.08,i,t,C))

  // Clock
  clock(ctx,W/2-10,4,C)

  // PM meeting table — rows 8-10 in tile space = big enough for PM to stand behind
  const mtW=Math.round(lbW*.44),mtH=14,mtx=lw+lbW*.28,mty=lfy+H*.06
  deskFull(ctx,mtx,mty,mtW,mtH,C)
  bigMonitor(ctx,mtx+mtW*.55,mty-28,'#2a4840')
  mug(ctx,mtx+4,mty+2,C.mug[0],true,t);mug(ctx,mtx+mtW*.45,mty+2,C.mug[3],true,t);mug(ctx,mtx+mtW-16,mty+2,C.mug[1],true,t)
  laptop(ctx,mtx+mtW*.2,mty+2,t,'#e8c030')
  sticky(ctx,mtx+mtW*.62,mty+2,C.sticky[0]);sticky(ctx,mtx+mtW*.75,mty+3,C.sticky[1])
  B(ctx,mtx+8,mty+4,10,7,C.paper);B(ctx,mtx+22,mty+3,10,7,C.paper)

  // Sofa (left of lobby)
  const sfx=lw+6,sfy=lfy+H*.1
  B(ctx,sfx,sfy,lbW*.3,H*.12,C.sofa);B(ctx,sfx,sfy,lbW*.3,3,L(C.sofa,22))
  B(ctx,sfx-5,sfy-H*.06,9,H*.18,C.sofa);B(ctx,sfx+lbW*.3-4,sfy-H*.06,9,H*.18,C.sofa)
  B(ctx,sfx,sfy-H*.09,lbW*.3,H*.09,D(C.sofa,-15))
  // cushions on sofa
  ;[sfx+4,sfx+lbW*.1,sfx+lbW*.2].forEach(cx=>B(ctx,cx,sfy+2,lbW*.07,H*.08,'rgba(255,255,255,.15)'))

  // Coffee table
  const ctx2x=sfx+lbW*.03,ctx2y=sfy+H*.13
  B(ctx,ctx2x,ctx2y,lbW*.22,H*.048,C.wdD);B(ctx,ctx2x,ctx2y,lbW*.22,2,L(C.wdD,15))
  mug(ctx,ctx2x+3,ctx2y+1,C.mug[2],false);ramen(ctx,ctx2x+lbW*.1,ctx2y-4)
  B(ctx,ctx2x+12,ctx2y+1,14,9,C.paper);B(ctx,ctx2x+12,ctx2y+3,14,1,'rgba(0,0,0,.1)')

  // Sakura tree right side
  sakura(ctx,lw+lbW*.82,H*.04,C,t)

  // Big plant left of lobby
  const px=lw+8,py=H*.22
  B(ctx,px+2,py+24,11,9,C.pot);B(ctx,px,py+28,15,6,D(C.pot,12))
  B(ctx,px+5,py,2,26,C.plD)
  ;[[-8,py+3,14,8],[+8,py+1,14,8],[-6,py+12,12,6],[+7,py+10,12,6],[-2,py-2,10,5]].forEach(([bx,by,bw,bh])=>{B(ctx,px+bx,by,bw,bh,C.pl);B(ctx,px+bx+1,by+1,bw-3,bh-2,C.plL)})

  // Blog desk (bottom-left of lobby)
  const bdW=30,bdH=9,bdY=lfy+H*.46
  deskFull(ctx,lw+8,bdY,bdW,bdH,C)
  laptop(ctx,lw+10,bdY+1,t,'#d87050');mug(ctx,lw+8+bdW-12,bdY+2,C.mug[4],true,t)
  sticky(ctx,lw+22,bdY+1,C.sticky[3])

  // GitHub desk (bottom-right of lobby)
  deskFull(ctx,lw+lbW-bdW-8,bdY,bdW,bdH,C)
  laptop(ctx,lw+lbW-bdW-6,bdY+1,t,'#7080c8');mug(ctx,lw+lbW-16,bdY+2,C.mug[1],true,t)
  sticky(ctx,lw+lbW-bdW+4,bdY+1,C.sticky[0])

  // Calendar
  B(ctx,lw+6,H*.08,22,26,C.wdD);B(ctx,lw+8,H*.08+2,18,22,'#f8f4ec');B(ctx,lw+8,H*.08+2,18,6,'#d03030')
  ctx.fillStyle='#fff';ctx.font='5px sans-serif';ctx.fillText('MAR',lw+11,H*.08+7)

  // Shoe rack
  B(ctx,lw+2,lfy+4,10,14,C.wdL);for(let i=0;i<3;i++)B(ctx,lw+3,lfy+5+i*4,8,2,D(C.wdL,15))
  B(ctx,lw+3,lfy+5,5,2,'#2a1808');B(ctx,lw+3,lfy+9,5,2,'#c03030')

  // Lobby clutter
  ;[lw+lbW*.1,lw+lbW*.84].forEach((px2,i)=>cactus(ctx,px2,lfy+H*.64,C))
  plantS(ctx,lw+lbW*.55,lfy+H*.62,C)
  sticky(ctx,sfx+5,sfy+H*.15,C.sticky[1]);sticky(ctx,sfx+lbW*.12,sfy+H*.17,C.sticky[2])

  // Posters on lobby back wall
  poster(ctx,lw+4,H*.08,'#1a3058','#3868b0')
  poster(ctx,lw+lbW-20,H*.08,'#381a18','#a04030')

  // ════════════════════════════════════════════════════════
  // DEV ROOM (cols 33-43, rows 0-13)
  // ════════════════════════════════════════════════════════
  const devRx=lw+lbW
  drawWindow(ctx,devRx+8,6,rw-20,dwh-14,C,timeOfDay,t,1)

  // Big monitor wall
  const mwx=devRx+8,mwy=8,mww=rw-18,mwh=dwh*.35
  B(ctx,mwx-2,mwy-2,mww+4,mwh+4,'#141820');B(ctx,mwx,mwy,mww,mwh,'#080e18')
  ;['#3060a0','#408870','#302860','#c05030','#408870','#3060a0'].forEach((c,i)=>B(ctx,mwx+3,mwy+3+i*4,(mww-10)*(i%2?.7:.9),2,c))
  B(ctx,mwx+mww-10,mwy+2,4,4,'#ffcc40')
  B(ctx,mwx+mww/2-4,mwy+mwh,8,3,'#1a1a20');B(ctx,mwx+mww/2-10,mwy+mwh+3,20,2,'#141418')

  ;[devRx+3,devRx+rw-dskW-3].forEach((dx,i)=>{
    deskFull(ctx,dx,dsky,dskW,dskH,C)
    mug(ctx,dx+dskW-12,dsky+2,C.mug[i+2],true,t)
    keyboard(ctx,dx+2,dsky+3);cable(ctx,dx+10,dsky+11,'#281828')
    if(i===0){laptop(ctx,dx+2,dsky+2,t,'#30a8c8');ramen(ctx,dx+dskW-14,dsky-2);figure(ctx,dx+22,dsky-10)}
    else{bigMonitor(ctx,dx+2,dsky-26,'#a05030');snack(ctx,dx+dskW-10,dsky-2,'#ff8030');sticky(ctx,dx+18,dsky+2,C.sticky[3])}
  })

  bamboo(ctx,devRx+2,dfy-62,C);plantS(ctx,devRx+rw-10,dfy-24,C)
  // rubber duck
  B(ctx,devRx+rw*.5,dsky,'#ffdd40');B(ctx,devRx+rw*.5,dsky,6,4,'#ffdd40');B(ctx,devRx+rw*.5+1,dsky-2,4,3,'#ffdd40');B(ctx,devRx+rw*.5+3,dsky-1,3,1,'#ff8800')
  poster(ctx,devRx+rw-18,8,'#182838','#2868a0');poster(ctx,devRx+rw-18,30,'#182818','#289050')

  // ════════════════════════════════════════════════════════
  // QA ROOM (cols 33-43, rows 14-27)
  // ════════════════════════════════════════════════════════
  drawWindow(ctx,devRx+8,topH+6,rw-20,twh-14,C,timeOfDay,t,6)

  // Counter
  B(ctx,devRx+4,qfy-14,rw-8,12,'#ddd6c8');B(ctx,devRx+4,qfy-14,rw-8,2,'#ede6d8');B(ctx,devRx+4,qfy-2,rw-8,5,'#c0b8a8')

  // Fridge (proper size — taller than character)
  const fxr=devRx+4,fw=18,fhr=Math.round(botH*.42),fyr=qfy-fhr
  B(ctx,fxr,fyr,fw,fhr,C.fridge||'#e0ecf4');B(ctx,fxr,fyr,fw,2,L(C.fridge||'#e0ecf4',15))
  B(ctx,fxr,fyr+fhr*.38,fw,1,'#b0c0cc');B(ctx,fxr+fw-5,fyr+6,3,fhr*.22,'#a0a8b0');B(ctx,fxr+fw-5,fyr+fhr*.4,3,fhr*.14,'#a0a8b0')
  ;[[fxr+2,fyr+2,'#e03030'],[fxr+6,fyr+2,'#30a030'],[fxr+10,fyr+2,'#3030e0']].forEach(([mx,my,mc])=>B(ctx,mx,my,3,3,mc))

  // Microwave
  B(ctx,devRx+26,topH+8,rw-30,12,'#1a1a20');B(ctx,devRx+28,topH+10,rw-44,8,'#0a0a10')
  ctx.fillStyle='#00cc00';ctx.font='5px monospace';ctx.fillText('12:00',devRx+rw-20,topH+17)

  // QA terminal
  B(ctx,devRx+rw-22,qfy-22,18,20,'#0a0a14');B(ctx,devRx+rw-21,qfy-21,16,18,'#080c18')
  ;['#50cc50','#50cc50','#d04040','#50cc50'].forEach((c,i)=>B(ctx,devRx+rw-20,qfy-19+i*4,10,2,c))

  mug(ctx,devRx+8,qfy-12,C.mug[1],true,t);mug(ctx,devRx+22,qfy-12,C.mug[3],true,t);ramen(ctx,devRx+34,qfy-15)
  snack(ctx,devRx+rw-16,qfy-12,'#88cc44');snack(ctx,devRx+rw-8,qfy-12,'#cc8844')
  plantS(ctx,devRx+rw-10,qfy-24,C);cactus(ctx,devRx+4,qfy-24,C)
  poster(ctx,devRx+rw-18,topH+8,'#203018','#50a838');poster(ctx,devRx+rw-18,topH+30,'#181830','#5050c0')

  // ═══ INTERACTABLE OBJECTS ═══
  // Coffee machine — design room
  drawCoffeeMachine(ctx,R(lw-32),R(dfy-50),t)
  // Fridge — lobby right side
  drawFridge(ctx,R(lw+lbW-36),R(lfy+H*.15),false)
  // WiFi router — lobby top center
  drawWifiRouter(ctx,R(W/2-12),R(10),t)
  // Main whiteboard — lobby
  drawWhiteboardObj(ctx,R(lw+20),R(lfy*0.3),t)
  // Big monstera plant — lobby entrance
  drawPlantObj(ctx,R(lw+8),R(lfy+H*.28),t)
  // Snack shelf — QA room
  drawSnackShelf(ctx,R(lw+lbW+2),R(qfy+H*.08))
  // Standing desk — dev room
  drawStandingDesk(ctx,R(lw+lbW+8),R(dfy+H*.08))
  // Game console — techlead room
  drawGameConsole(ctx,R(4),R(tfy+H*.16),t)
  // Fish tank — techlead room wall
  drawFishTank(ctx,R(2),R(tfy+H*.32),t)
  // Noodle station — lobby bottom
  drawNoodleStation(ctx,R(lw+lbW*.38),R(lfy+H*.38),t)

  // ═══ MEETING TABLE (lobby center) ═══
  const mtBx=R(lw+lbW*.18), mtBy=R(H*.4)
  const mtBW=R(lbW*.64), mtBH=24
  drawMeetingTable(ctx,mtBx,mtBy,mtBW,mtBH,C)
  const meetSeats=[[mtBx+8,mtBy-20],[mtBx+R(mtBW*.33),mtBy-20],[mtBx+R(mtBW*.66),mtBy-20],
    [mtBx+8,mtBy+mtBH+3],[mtBx+R(mtBW*.33),mtBy+mtBH+3],[mtBx+R(mtBW*.66),mtBy+mtBH+3],
    [mtBx-20,mtBy+2],[mtBx+mtBW+3,mtBy+2]]
  meetSeats.forEach(([cx,cy])=>drawChair(ctx,cx,cy,C))

  // ═══ STAIRS (lobby right wall) ═══
  drawStairs(ctx,R(lw+lbW*.5-16),R(H*.84),C)
  // Stair label — clearly clickable
  ctx.save()
  ctx.fillStyle='rgba(248,244,240,0.92)';ctx.fillRect(R(lw+lbW*.5-38),R(H*.87),76,14)
  ctx.strokeStyle='#c8a868';ctx.lineWidth=1;ctx.strokeRect(R(lw+lbW*.5-38),R(H*.87),76,14)
  ctx.fillStyle='#3a2010';ctx.font='bold 8px DM Sans,sans-serif'
  ctx.textAlign='center';ctx.fillText('2F ↑ (click stairs)',R(lw+lbW*.5),R(H*.87)+10);ctx.textAlign='left'
  ctx.restore()

  // ═══ RAIN (evening/night/dusk) ═══
  if(timeOfDay==='night'||timeOfDay==='evening'||timeOfDay==='dusk'){
    const intensity=timeOfDay==='night'?0.7:timeOfDay==='evening'?0.5:0.3
    drawRain(ctx,W,H,t,intensity)
  }

  // ═══ DEPTH-SORTED SPRITES — floor 1 only ═══
  const toRender=agents.map(a=>{
    const s=states[a.id]??{};const h=AGENT_HOME[a.id]??{col:21,row:13,dir:'d'}
    if(s.floor===2) return null
    const col=s.px??h.col,row=s.py??h.row,dir=s.dir??h.dir,frame=s.frame??0
    const wx=col*tw-8,wy=row*th-24
    const sitting=!s.path?.length&&(a.status==='working'||a.status==='idle')&&!s.atObject
    return{a,wx,wy,dir,frame,sitting}
  }).filter(Boolean)
  toRender.sort((a,b)=>a.wy-b.wy)
  toRender.forEach(({a,wx,wy,dir,frame,sitting})=>{
    if(sitting) spriteSeated(ctx,R(wx),R(wy),a.id,selectedAgent===a.id,a.status||'idle',t,C)
    else sprite(ctx,R(wx),R(wy),a.id,dir,frame,selectedAgent===a.id,a.status||'idle',t,C)
  })
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function PixelOffice({W,H,agents,selectedAgent,time,onAgentClick,officeHour,onObjectClick}){
  const canvasRef=useRef(null),lastRef=useRef(null),rafRef=useRef(null)
  const agentArr=useMemo(()=>Object.values(agents),[agents])
  const timeOfDay=tod(officeHour??9)
  const [viewFloor,setViewFloor]=React.useState(1)

  useEffect(()=>{agentMgr.init()},[])

  useEffect(()=>{
    for(const a of agentArr){
      if(a.status==='meeting'&&a.id!=='pm') agentMgr.walkToAgent(a.id,'pm')
      const s=agentMgr.all()[a.id]
      if(a.status==='resting'&&s&&s.floor!==2) agentMgr.goUpstairs(a.id)
      if(a.status!=='resting'&&s&&s.floor===2) agentMgr.goDownstairs(a.id)
    }
  },[agentArr.map(a=>a.status+a.id).join(',')])

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas||!W||!H)return
    const ctx=canvas.getContext('2d')
    const loop=(ts)=>{
      const dt=lastRef.current?Math.min((ts-lastRef.current)/1000,.05):.016
      lastRef.current=ts;agentMgr.tick(dt)
      const C=pal(timeOfDay)
      // Always clear first — prevents stale frames
      ctx.clearRect(0,0,W,H)
      ctx.imageSmoothingEnabled=false
      try{
        const allSt=agentMgr.all()
        if(viewFloor===2){
          const restIds=Object.entries(allSt).filter(([,s])=>s.floor===2).map(([id])=>id)
          renderFloor2(ctx,W,H,C,ts/1000,restIds,allSt)
          ctx.fillStyle='rgba(248,244,240,0.92)';ctx.fillRect(W/2-42,H-30,84,22)
          ctx.strokeStyle='#c8a868';ctx.strokeRect(W/2-42,H-30,84,22)
          ctx.fillStyle='#3a2010';ctx.font='bold 9px DM Sans,sans-serif'
          ctx.textAlign='center';ctx.fillText('▼ Back to 1F  (click stairs)',W/2,H-15);ctx.textAlign='left'
        } else {
          renderScene(ctx,W,H,C,timeOfDay,ts/1000,agentArr,selectedAgent,allSt)
        }
      } catch(e){
        try{ctx.setTransform(1,0,0,1,0,0)}catch{}
        ctx.globalAlpha=1
      }
      rafRef.current=requestAnimationFrame(loop)
    }
    rafRef.current=requestAnimationFrame(loop)
    return()=>{if(rafRef.current)cancelAnimationFrame(rafRef.current)}
  },[W,H,agentArr,selectedAgent,timeOfDay,viewFloor])

  const handleClick=useCallback((e)=>{
    const canvas=canvasRef.current;if(!canvas)return
    const rect=canvas.getBoundingClientRect()
    const mx=(e.clientX-rect.left)*(W/rect.width),my=(e.clientY-rect.top)*(H/rect.height)
    const L=layout(W,H)
    const{tw,th,lw,lbW,topH,botH}=L
    for(const[id,s]of Object.entries(agentMgr.all())){
      const wx=(s.px??0)*tw-(SW*SPR)/2,wy=(s.py??0)*th-SH*SPR
      if(mx>=wx-3&&mx<=wx+SW*SPR+3&&my>=wy-3&&my<=wy+SH*SPR+6){onAgentClick(id);return}
    }
    const dfy=Math.round(topH*.36)
    const tfy=topH+Math.round(botH*.36)
    const qfy=topH+Math.round(botH*.36)
    const lfy=Math.round(H*.36)

    // Object hit regions (pixel coords, must match draw positions above)
    const objHits=[
      {id:'coffee_machine', x:lw-32, y:dfy-50, w:26, h:50},
      {id:'fridge_lobby',   x:lw+lbW-36, y:lfy+H*.15, w:32, h:56},
      {id:'wifi_router',    x:W/2-12, y:10, w:28, h:35},
      {id:'whiteboard_lobby', x:lw+20, y:lfy*.3, w:44, h:46},
      {id:'plant_big',      x:lw+8, y:lfy+H*.28, w:36, h:55},
      {id:'snack_shelf',    x:lw+lbW+2, y:qfy+H*.08, w:36, h:40},
      {id:'standing_desk',  x:lw+lbW+8, y:dfy+H*.08, w:40, h:50},
      {id:'game_console',   x:4, y:tfy+H*.16, w:36, h:48},
      {id:'fish_tank',      x:2, y:tfy+H*.32, w:42, h:46},
      {id:'noodle_station', x:lw+lbW*.38, y:lfy+H*.38, w:40, h:40},
    ]
    for(const obj of objHits){
      if(mx>=obj.x-4&&mx<=obj.x+obj.w+4&&my>=obj.y-4&&my<=obj.y+obj.h+4){
        if(onObjectClick) onObjectClick(obj.id); return
      }
    }

    if(mx<=lw&&my<=topH*.45)onAgentClick('whiteboard')

    // Stair hit region — bottom center lobby
    const stairX=R(lw+lbW*.5-16),stairY=R(H*.84)
    if(mx>=stairX-20&&mx<=stairX+60&&my>=stairY-30&&my<=stairY+30){
      setViewFloor(2); return
    }
    // Floor-2 back button (when on 2nd floor — bottom center)
    if(viewFloor===2&&mx>=W/2-42&&mx<=W/2+42&&my>=H-30&&my<=H-8){
      setViewFloor(1); return
    }
  },[W,H,onAgentClick,onObjectClick,viewFloor,setViewFloor])

  return(<canvas ref={canvasRef} width={W} height={H} onClick={handleClick} id="office-canvas" style={{cursor:'pointer',imageRendering:'pixelated'}}/>)
}