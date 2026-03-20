import React, { useRef, useEffect, useMemo, useState } from 'react'

// ── OFFICE TIME ───────────────────────────────────────────────────────────
export function useOfficeTime() {
  const [h, setH] = useState(9)
  useEffect(() => {
    const s = Date.now()
    const iv = setInterval(() => setH((9 + (Date.now()-s)/60000) % 24), 1000)
    return () => clearInterval(iv)
  }, [])
  return h
}

function getToD(h) {
  if(h>=5&&h<7)  return 'dawn'
  if(h>=7&&h<12) return 'morning'
  if(h>=12&&h<14)return 'noon'
  if(h>=14&&h<18)return 'afternoon'
  if(h>=18&&h<20)return 'dusk'
  if(h>=20&&h<23)return 'evening'
  return 'night'
}

// ── SAFE PALETTE (never undefined) ───────────────────────────────────────
function makePalette(tod) {
  const sky = {
    dawn:     ['#f8c0a0','#f09060'],
    morning:  ['#aaccee','#88aacc'],
    noon:     ['#88bbff','#6699ee'],
    afternoon:['#99ccff','#77aadd'],
    dusk:     ['#ff9966','#dd6644'],
    evening:  ['#334466','#223355'],
    night:    ['#0a1828','#060f18'],
  }[tod||'morning'] || ['#aaccee','#88aacc']

  return {
    // Layout
    wall:'#f5ede0',       wallD:'#e8ddd0',    wallLine:'#ddd0c0',
    wallAcc:'#c8b8a0',    floorA:'#d4a870',   floorB:'#c89858',
    floorC:'#e0bc88',     floorLine:'#b88848',
    tatami:'#c8b870',     tatamiL:'#e0d090',  tatamiD:'#a89850',
    // Wood
    wood:'#8a5a30',       woodL:'#a87040',    woodD:'#6a3a18',
    // Paper
    paper:'#f8f4ec',      paperL:'#e8e0d0',
    // Sky
    sky1:sky[0],          sky2:sky[1],
    // Plants
    leaf:'#5aaa5a',       leafL:'#7acc7a',    leafD:'#3a8a3a',
    pot:'#d86838',        potD:'#b85820',
    bam:'#7aa050',        bamL:'#9ac870',     bamN:'#4a6020',
    // Sakura
    sakP:'#f8b8c8',       sakPD:'#e890a8',    sakT:'#6a3a18',
    // Furniture
    deskT:'#e8d4a8',      deskE:'#c8a870',    deskL:'#8a6030',
    shelf:'#a87040',      shelfL:'#c8905a',
    // Kotatsu
    kot:'#c84040',        kotL:'#e06060',     kotD:'#903020',
    kotTop:'#2a1808',
    // Chairs
    cA:'#7ab0d8',cB:'#e890b0',cC:'#80b870',cD:'#e8a870',
    cE:'#a080c8',cF:'#e89060',cG:'#70b0b0',cH:'#e8d060',
    cLeg:'#c0a880',
    // Appliances
    fridge:'#e8f0f8',     tvBod:'#1a1a2a',    tvScr:'#0a0a18',
    // Status dots
    working:'#60b870', idle:'#b0a090', resting:'#9870c0',
    meeting:'#e8a040', thinking:'#5898c0',
  }
}

// ── DRAW HELPERS ──────────────────────────────────────────────────────────
function px(ctx,x,y,w,h,c) {
  if(!c||!ctx||w<=0||h<=0)return
  ctx.fillStyle=c
  ctx.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)))
}
function li(hex,amt=30){
  try{
    const n=parseInt(hex.slice(1),16)
    const r=Math.min(255,((n>>16)&255)+amt)
    const g=Math.min(255,((n>>8)&255)+amt)
    const b=Math.min(255,(n&255)+amt)
    return `rgb(${r},${g},${b})`
  }catch{return hex||'#888888'}
}

// ── LAYOUT: Open lobby center, rooms on all 4 edges ───────────────────────
// 
//  ┌──────────┬──────────────────────┬──────────┐
//  │ OFFICE   │    TOP WINDOWS       │  LIVING  │
//  │  (tl)    │                      │   (tr)   │
//  ├──────────┤   OPEN LOBBY/HALL    ├──────────┤
//  │ BEDROOM  │     CENTER           │ KITCHEN  │
//  │  (bl)    │                      │   (br)   │
//  ├──────────┴──────────────────────┴──────────┤
//  │              FLOOR                          │
//  └─────────────────────────────────────────────┘
//
// Side rooms are ~22% wide, lobby is ~56% wide
// Rooms are ~40% tall each, lobby fills center

function getLayout(W,H) {
  const sideW = W*0.22    // side room width
  const lobW  = W*0.56    // lobby width
  const roomH = H*0.42    // room height (top rooms)
  const floorY = H*0.84   // where floor starts in center lobby
  return {
    // Left column rooms
    office:   {x:0,          y:0,       w:sideW, h:roomH,   floor:'wood'},
    bedroom:  {x:0,          y:roomH,   w:sideW, h:H-roomH, floor:'tatami'},
    // Center lobby
    lobby:    {x:sideW,      y:0,       w:lobW,  h:H,       floor:'wood'},
    // Right column rooms
    living:   {x:sideW+lobW, y:0,       w:sideW, h:roomH,   floor:'wood'},
    kitchen:  {x:sideW+lobW, y:roomH,   w:sideW, h:H-roomH, floor:'tile'},
  }
}

// ── DRAW BASE ROOMS ───────────────────────────────────────────────────────
function drawBase(ctx,W,H,P) {
  const L = getLayout(W,H)

  // Draw each room
  Object.entries(L).forEach(([name,rm])=>{
    const wallH = rm.h*0.40
    const floorY = rm.y+wallH

    // Wall
    px(ctx,rm.x,rm.y,rm.w,wallH,P.wall)
    // Subtle wall grain
    ctx.save();ctx.globalAlpha=0.04
    for(let i=0;i<8;i++) px(ctx,rm.x+i*(rm.w/8),rm.y,1,wallH,'#8a6040')
    ctx.restore()
    // Chair rail
    px(ctx,rm.x,floorY-5,rm.w,5,P.wallAcc)
    px(ctx,rm.x,floorY-2,rm.w,2,li(P.wallAcc,15))

    // Floor by type
    if(rm.floor==='tatami'){
      px(ctx,rm.x,floorY,rm.w,rm.h-wallH,P.tatami)
      for(let r=0;r<6;r++) px(ctx,rm.x,floorY+r*(rm.h-wallH)/6,rm.w,1,P.tatamiD)
      px(ctx,rm.x,floorY,rm.w,3,P.tatamiL)
      ctx.save();ctx.globalAlpha=0.1;px(ctx,rm.x+rm.w/2,floorY,1,rm.h-wallH,P.tatamiD);ctx.restore()
    } else if(rm.floor==='tile'){
      px(ctx,rm.x,floorY,rm.w,rm.h-wallH,'#e8e0d0')
      const tsize=16
      for(let r=0;r<10;r++) for(let c=0;c<10;c++)
        px(ctx,rm.x+c*tsize,floorY+r*tsize,1,tsize,'#c0b8a8'),
        px(ctx,rm.x+c*tsize,floorY+r*tsize,tsize,1,'#c0b8a8')
    } else {
      // Wood plank floor
      px(ctx,rm.x,floorY,rm.w,rm.h-wallH,P.floorA)
      const ph=(rm.h-wallH)/6
      for(let r=0;r<6;r++){
        const fy=floorY+r*ph
        ctx.save();ctx.globalAlpha=r%2===0?0.04:0.07;px(ctx,rm.x,fy,rm.w,ph,'#000');ctx.restore()
        px(ctx,rm.x,fy,rm.w,1,P.floorLine)
        const off=(r%3)*(rm.w/3)
        for(let c=0;c<3;c++) px(ctx,(rm.x+off+c*(rm.w/3))%W+rm.x,fy,1,ph-1,P.floorLine)
      }
      px(ctx,rm.x,floorY,rm.w,3,P.floorC)
    }
  })

  // Room divider walls (vertical)
  const sideW=W*0.22, lobW=W*0.56
  // Left divider
  px(ctx,sideW-3,0,6,H,P.woodD)
  // Right divider
  px(ctx,sideW+lobW-3,0,6,H,P.woodD)
  // Horizontal divider (office/bedroom split)
  px(ctx,0,H*0.42-3,sideW,6,P.woodD)
  px(ctx,sideW+lobW,H*0.42-3,sideW,6,P.woodD)

  // Door openings (gaps in dividers)
  const roomH=H*0.42
  // Office door → Lobby
  px(ctx,sideW-3,roomH*0.35,6,roomH*0.32,P.wall)
  // Bedroom door → Lobby
  px(ctx,sideW-3,roomH+roomH*0.15,6,roomH*0.3,P.tatami)
  // Living door → Lobby
  px(ctx,sideW+lobW-3,roomH*0.35,6,roomH*0.32,P.wall)
  // Kitchen door → Lobby
  px(ctx,sideW+lobW-3,roomH+roomH*0.15,6,roomH*0.3,P.floorA)

  // Door frames (wood trim)
  ;[[sideW-3,roomH*0.35],[sideW-3,roomH+roomH*0.15],[sideW+lobW-3,roomH*0.35],[sideW+lobW-3,roomH+roomH*0.15]].forEach(([dx,dy])=>{
    px(ctx,dx-2,dy-3,10,4,P.woodL)
    px(ctx,dx-2,dy+roomH*0.3,10,4,P.woodL)
  })
}

// ── WINDOWS ───────────────────────────────────────────────────────────────
function drawWindows(ctx,W,H,P,tod,t) {
  const L=getLayout(W,H)
  // Office window
  drawWin(ctx,L.office.x+L.office.w*0.1,L.office.y+L.office.h*0.07,L.office.w*0.75,L.office.h*0.3,P,tod,t,0)
  // Living window (big)
  drawWin(ctx,L.living.x+L.living.w*0.06,L.living.y+L.living.h*0.07,L.living.w*0.82,L.living.h*0.32,P,tod,t,1)
  // Bedroom window (small)
  drawWin(ctx,L.bedroom.x+L.bedroom.w*0.1,L.bedroom.y+L.bedroom.h*0.07,L.bedroom.w*0.7,L.bedroom.h*0.28,P,tod,t,2)
  // Kitchen window
  drawWin(ctx,L.kitchen.x+L.kitchen.w*0.1,L.kitchen.y+L.kitchen.h*0.07,L.kitchen.w*0.7,L.kitchen.h*0.28,P,tod,t,3)
  // Lobby top windows (3 small)
  const lx=L.lobby.x, lw=L.lobby.w
  ;[0.1,0.38,0.66].forEach((ox,i)=>{
    drawWin(ctx,lx+lw*ox,H*0.03,lw*0.22,H*0.2,P,tod,t,i+4)
  })
}

function drawWin(ctx,x,y,w,h,P,tod,t,idx) {
  // Frame
  px(ctx,x-4,y-4,w+8,h+8,P.woodD)
  px(ctx,x-2,y-2,w+4,h+4,P.woodL)
  // Sky
  px(ctx,x,y,w,h,P.sky1)
  ctx.save();ctx.globalAlpha=0.35;px(ctx,x,y,w,h*0.4,P.sky2);ctx.restore()
  // Night/Evening: stars + moon
  if(tod==='night'||tod==='evening'){
    if(idx===0||idx===4){px(ctx,x+w-16,y+6,12,12,'#ffee88');ctx.save();ctx.globalAlpha=0.15;px(ctx,x+w-20,y+2,20,20,'#ffee88');ctx.restore()}
    [[x+8,y+8],[x+22,y+5],[x+w-8,y+12],[x+14,y+20]].forEach(([sx,sy])=>px(ctx,sx,sy,2,2,'#ffffff'))
  }
  // Day: sun
  if((tod==='morning'||tod==='noon')&&idx===1){
    px(ctx,x+w-18,y+7,14,14,'#ffdd44')
    ctx.save();ctx.globalAlpha=0.15;px(ctx,x+w-24,y+1,26,26,'#ffee88');ctx.restore()
  }
  // Dawn/dusk tint
  if(tod==='dawn'||tod==='dusk'){
    ctx.save();ctx.globalAlpha=0.2;ctx.fillStyle=tod==='dusk'?'#ff8844':'#ffaa66';ctx.fillRect(x,y,w,h);ctx.restore()
  }
  // Clouds
  if(tod!=='night'&&tod!=='evening'){
    ctx.save();ctx.globalAlpha=0.8
    const off=Math.sin(t*0.04+idx)*12
    px(ctx,x+6+off,y+h*0.35,18,6,'#fff');px(ctx,x+4+off,y+h*0.38,22,8,'#fff')
    ctx.restore()
  }
  // Glass frame bars
  px(ctx,x+w/2,y,2,h,P.woodL)
  px(ctx,x,y+h/2,w,1,P.woodL)
  // Curtains
  px(ctx,x-4,y-4,8,h+12,'#f0c8d0');px(ctx,x-4,y-4,4,h+12,'#e0a8b8')
  px(ctx,x+w-2,y-4,8,h+12,'#f0c8d0');px(ctx,x+w+2,y-4,4,h+12,'#e0a8b8')
  px(ctx,x-8,y-6,w+16,3,P.wood)
}

// ── OFFICE ROOM ───────────────────────────────────────────────────────────
function drawOffice(ctx,W,H,P,t) {
  const L=getLayout(W,H)
  const {x,y,w,h}=L.office
  const wh=h*0.52,fy=y+wh

  // Work table - legs touch floor (fy)
  const th=Math.round(h*0.12), tx=x+w*0.06, tw=w*0.88
  const ty=fy-th-16  // 16px leg height, table sits on legs that touch floor
  ctx.save();ctx.globalAlpha=0.1;px(ctx,tx+3,fy+2,tw,6,'#604020');ctx.restore()
  px(ctx,tx,ty,tw,th,P.deskT);px(ctx,tx,ty,tw,3,li(P.deskT,18))
  px(ctx,tx,ty+th,tw,6,P.deskE);px(ctx,tx,ty+th,tw,2,li(P.deskE))
  px(ctx,tx,ty,2,th,P.deskE);px(ctx,tx+tw-2,ty,2,th,P.deskE)
  ;[[tx+8,ty+th],[tx+tw-14,ty+th]].forEach(([lx,ly])=>{px(ctx,lx,ly,5,16,P.deskL);px(ctx,lx,ly,5,2,li(P.deskL))})

  // Laptops
  ;[[tx+w*0.04,ty+3,P.cA],[tx+tw/2-14,ty+3,P.cC],[tx+tw-w*0.2,ty+3,P.cB]].forEach(([lx,ly,c])=>drawLaptop(ctx,lx,ly,c,t))
  drawMug(ctx,tx+w*0.18,ty+5,P.cD)
  drawMug(ctx,tx+w*0.62,ty+5,P.cA)

  // Chairs around table
  drawChairSide(ctx,tx-28,ty+2,P.cA,P,'r')
  drawChairSide(ctx,tx-28,ty+th-36,P.cB,P,'r')
  drawChairSide(ctx,tx+tw+2,ty+2,P.cC,P,'l')
  drawChairSide(ctx,tx+tw+2,ty+th-36,P.cD,P,'l')

  // Whiteboard on back wall
  const bx=x+w*0.08,by=y+h*0.06,bw=w*0.55,bh=h*0.22
  px(ctx,bx-3,by-3,bw+6,bh+6,P.woodD);px(ctx,bx,by,bw,bh,'#f8f8f0')
  ;[[bx+4,by+4,'#fff8a0'],[bx+36,by+6,'#ffc0d0'],[bx+68,by+3,'#c0d8ff']].forEach(([nx,ny,nc])=>{
    px(ctx,nx,ny,28,20,nc);px(ctx,nx,ny,28,3,li(nc,-20))
  })
  px(ctx,bx+2,by+bh-6,bw-4,2,'rgba(100,100,100,0.1)')

  // Bookshelf
  const sx=x+w-46,sy=y+h*0.08
  px(ctx,sx,sy,40,h*0.32,P.shelf);px(ctx,sx+1,sy+1,38,h*0.32-2,'#f8f4ec')
  px(ctx,sx,sy+h*0.1,40,2,P.shelf);px(ctx,sx,sy+h*0.22,40,2,P.shelf)
  ;['#e06060','#6080e0','#60a860','#e0a040','#a060e0'].forEach((c,i)=>px(ctx,sx+2+i*7,sy+3,6,h*0.09,c))
  ;['#40a8c0','#e06060','#6080e0','#60a860'].forEach((c,i)=>px(ctx,sx+2+i*9,sy+h*0.11,8,h*0.09,c))
  // Bonsai on shelf top
  px(ctx,sx+16,sy-16,5,16,P.woodD)
  px(ctx,sx+5,sy-24,18,10,P.leaf);px(ctx,sx+18,sy-28,16,9,P.leafL)

  // Floor lamp
  drawLamp(ctx,x+4,y+h*0.18,P,t)

  // Server rack
  px(ctx,x+4,y+h*0.28,22,h*0.16,'#2a2a3a');px(ctx,x+4,y+h*0.28,22,2,'#3a3a4a')
  for(let i=0;i<4;i++){px(ctx,x+7,y+h*0.29+i*8,4,4,i<2?'#00cc44':'#cc4400');px(ctx,x+13,y+h*0.30+i*8,10,2,'#1a1a2a')}
}

// ── LOBBY (open center) ───────────────────────────────────────────────────
function drawLobby(ctx,W,H,P,t) {
  const L=getLayout(W,H)
  const {x,y,w,h}=L.lobby
  const fy=y+h*0.40

  // Torii gate (decorative, on back wall)
  const tx=x+w*0.38,ty=y+h*0.06,tw=w*0.24
  px(ctx,tx,ty+8,4,h*0.32,P.kot);px(ctx,tx+tw-4,ty+8,4,h*0.32,P.kot)
  px(ctx,tx-4,ty,tw+8,5,P.kot);px(ctx,tx-2,ty+7,tw+4,4,P.kot)
  px(ctx,tx-4,ty+1,4,4,P.kotD);px(ctx,tx+tw,ty+1,4,4,P.kotD)
  // Small base stones
  px(ctx,tx-3,ty+h*0.32+8,10,5,'#c0b0a0');px(ctx,tx+tw-7,ty+h*0.32+8,10,5,'#c0b0a0')

  // 3 hanging lanterns
  ;[x+w*0.2,x+w*0.5,x+w*0.8].forEach((lx,i)=>{
    const ly=y+h*0.12, sw=Math.sin(t*0.55+i*1.3)*2.8
    ctx.save();ctx.translate(lx+sw,ly)
    px(ctx,-1,-16,2,16,P.wood)
    ctx.save();ctx.globalAlpha=0.18;px(ctx,-20,-10,40,35,'rgba(255,180,50,0.35)');ctx.restore()
    px(ctx,-8,0,16,3,'#d0a020');px(ctx,-10,3,20,16,P.kot);px(ctx,-8,5,16,12,P.kotL)
    px(ctx,-8,19,16,3,'#d0a020')
    px(ctx,-10,9,20,2,'rgba(0,0,0,0.12)');px(ctx,-10,14,20,2,'rgba(0,0,0,0.12)')
    px(ctx,-4,5,3,12,'rgba(255,255,255,0.18)')
    ctx.fillStyle='rgba(255,255,180,0.6)';ctx.font='8px serif';ctx.fillText(['和','愛','幸'][i],-5,14)
    px(ctx,-1,22,2,6,'#d0a020')
    ctx.restore()
  })

  // Reception sofa set (center of lobby)
  const sfx=x+w*0.08,sfy=fy-Math.round(h*0.18)
  // Sofa
  px(ctx,sfx,sfy,w*0.36,h*0.16,'#8888cc')
  px(ctx,sfx,sfy,w*0.36,3,li('#8888cc',20))
  px(ctx,sfx-5,sfy-h*0.07,9,h*0.23,'#8888cc')
  px(ctx,sfx+w*0.36-4,sfy-h*0.07,9,h*0.23,'#8888cc')
  px(ctx,sfx,sfy-h*0.1,w*0.36,h*0.12,'#7070bb')
  ;[sfx+3,sfx+w*0.12,sfx+w*0.22].forEach(cx2=>{
    px(ctx,cx2,sfy+2,w*0.08,h*0.12,'#aaaaee')
    px(ctx,cx2+2,sfy+4,w*0.08-4,h*0.12-6,li('#aaaaee',10))
  })

  // Coffee table in front of sofa
  const ctx_x=sfx+w*0.1,ctx_y=sfy+h*0.17
  px(ctx,ctx_x,ctx_y,w*0.2,h*0.06,P.kotTop)
  px(ctx,ctx_x,ctx_y,w*0.2,2,li(P.kotTop,20))
  px(ctx,ctx_x,ctx_y+h*0.06,w*0.2,5,P.woodD)
  drawMug(ctx,ctx_x+4,ctx_y+2,P.cC)
  px(ctx,ctx_x+w*0.1,ctx_y+2,18,13,'#fffff0')
  for(let l=0;l<3;l++) px(ctx,ctx_x+w*0.1+2,ctx_y+5+l*4,14,1,'#e8e8c8')

  // Plants left & right of lobby
  drawBigPlant(ctx,x+w*0.02,y+h*0.25,P,false)
  drawBamboo(ctx,x+w*0.9,y+h*0.18,P,false)
  // Cherry blossom tree (right side of lobby near living room door)
  drawSakura(ctx,x+w*0.82,y+h*0.08,P,t)

  // (clock drawn separately in useEffect)

  // Calendar on left wall
  px(ctx,x+4,y+h*0.08,36,44,P.woodD);px(ctx,x+6,y+h*0.08+2,32,40,'#f8f4f0')
  px(ctx,x+6,y+h*0.08+2,32,8,'#e04444');ctx.fillStyle='#fff';ctx.font='6px sans-serif';ctx.fillText('MAR',x+10,y+h*0.08+8)
  for(let r=0;r<4;r++) for(let c=0;c<7;c++){
    const n=r*7+c+1;if(n>31)continue
    ctx.fillStyle=n===20?'#e04444':'#4a3020';ctx.font='5px sans-serif';ctx.fillText(String(n),x+7+c*5,y+h*0.08+18+r*8)
  }

  // ── CENTER LOBBY TABLE (3-person round meeting table) ──
  const mtw=w*0.24,mth=Math.round(h*0.07),mtx=x+w*0.38,mty=fy-mth-14
  // Table shadow
  ctx.save();ctx.globalAlpha=0.1;px(ctx,mtx+4,mty+mth+2,mtw,8,'#604020');ctx.restore()
  // Table top (round-ish, pixel style)
  px(ctx,mtx,mty,mtw,mth,P.deskT)
  px(ctx,mtx,mty,mtw,3,li(P.deskT,18))
  px(ctx,mtx,mty+mth,mtw,6,P.deskE)
  // Inset shadow on table
  ctx.save();ctx.globalAlpha=0.06;px(ctx,mtx+2,mty+2,mtw-4,mth-4,'#604020');ctx.restore()
  // Table edge corners (round feel)
  px(ctx,mtx,mty,3,3,P.deskE);px(ctx,mtx+mtw-3,mty,3,3,P.deskE)
  // Items on table: 3 mugs + notepad + laptop
  drawMug(ctx,mtx+mtw*0.12,mty+2,P.cD)
  drawMug(ctx,mtx+mtw*0.5,mty+2,P.cA)
  drawMug(ctx,mtx+mtw*0.78,mty+2,P.cE)
  drawLaptop(ctx,mtx+mtw*0.35,mty+2,P.cF,t)
  // Legs
  ;[[mtx+6,mty+mth],[mtx+mtw-12,mty+mth]].forEach(([lx,ly])=>{
    px(ctx,lx,ly,5,14,P.deskL);px(ctx,lx,ly,5,2,li(P.deskL))
  })
  // 3 cushions around the table (for PM, blog, github)
  // Top cushion (PM sits here facing down)
  px(ctx,mtx+mtw*0.35,mty-14,mtw*0.3,10,P.cE)
  px(ctx,mtx+mtw*0.35,mty-14,mtw*0.3,3,li(P.cE,20))
  px(ctx,mtx+mtw*0.37,mty-12,mtw*0.3-4,7,'rgba(255,255,255,0.2)')
  // Left cushion (blog)
  px(ctx,mtx-16,mty,10,mth*0.8,P.cB)
  px(ctx,mtx-16,mty,10,3,li(P.cB,20))
  // Right cushion (github)
  px(ctx,mtx+mtw+6,mty,10,mth*0.8,P.cG)
  px(ctx,mtx+mtw+6,mty,10,3,li(P.cG,20))

  // Shoe rack by right side near bedroom door
  const srx=x+4,sry=fy+h*0.05
  px(ctx,srx,sry,w*0.06,h*0.12,P.woodL)
  for(let i=0;i<3;i++) px(ctx,srx+2,sry+3+i*(h*0.12-6)/3,w*0.06-4,h*0.03,'rgba(0,0,0,0.08)')
  // Tiny shoes
  ;[[srx+3,sry+4,'#3a2818'],[srx+3,sry+h*0.05,'#c04040']].forEach(([sx,sy,sc])=>{
    px(ctx,sx,sy,8,4,sc);px(ctx,sx+2,sy,6,2,li(sc,20))
  })
}

// ── LIVING ROOM ───────────────────────────────────────────────────────────
function drawLiving(ctx,W,H,P,t) {
  const L=getLayout(W,H)
  const {x,y,w,h}=L.living
  const fy=y+h*0.40

  // TV
  const tvx=x+w*0.06,tvy=y+h*0.06,tvw=w*0.86,tvh=h*0.3
  px(ctx,tvx-4,tvy-4,tvw+8,tvh+8,'#1a1a1a')
  px(ctx,tvx,tvy,tvw,tvh,P.tvBod)
  px(ctx,tvx+2,tvy+2,tvw-4,tvh-4,P.tvScr)
  // Animated screen content
  const fr=Math.floor(t*1.5)%3
  ;[[0,'#1a3050'],[1,'#152840'],[2,'#0f2035']].forEach(([f,c])=>{if(fr===f){px(ctx,tvx+2,tvy+2,tvw-4,tvh-4,c)}})
  ctx.save();ctx.globalAlpha=0.6
  px(ctx,tvx+6,tvy+tvh*0.2,tvw*0.6,tvh*0.08,'#4466aa')
  px(ctx,tvx+6,tvy+tvh*0.35,tvw*0.45,tvh*0.06,'#6688bb')
  px(ctx,tvx+6,tvy+tvh*0.45,tvw*0.3,tvh*0.06,'#6688bb')
  ctx.restore()
  // TV stand
  px(ctx,tvx+tvw/2-12,tvy+tvh,24,4,'#2a2a2a');px(ctx,tvx+tvw/2-18,tvy+tvh+4,36,3,'#1a1a1a')

  // KOTATSU
  const kh=Math.round(h*0.14),kw=w*0.86,kx=x+w*0.06,ky=fy-kh
  // Blanket (drapes over edges, colorful)
  px(ctx,kx-6,ky,kw+12,kh,P.kot)
  px(ctx,kx-6,ky,kw+12,3,P.kotL)
  // Pattern on blanket
  for(let i=0;i<8;i++) for(let j=0;j<3;j++)
    px(ctx,kx-2+i*(kw+8)/8,ky+4+j*(kh-8)/3,4,4,'rgba(255,255,255,0.15)')
  // Table top
  px(ctx,kx,ky-h*0.05,kw,h*0.06,P.kotTop)
  px(ctx,kx,ky-h*0.05,kw,2,li(P.kotTop,20))
  // Items on kotatsu top
  drawMug(ctx,kx+kw*0.12,ky-h*0.04,'#e87858')
  px(ctx,kx+kw*0.3,ky-h*0.04,14,10,'#f8f8e8')
  drawMug(ctx,kx+kw*0.65,ky-h*0.04,'#58a8e8')
  px(ctx,kx+kw*0.5,ky-h*0.03,8,12,'#3a3a4a');px(ctx,kx+kw*0.5+2,ky-h*0.03+2,4,4,'#e04040')
  // Floor cushions
  ;[[kx-14,ky+kh*0.1,P.cA],[kx+kw+4,ky+kh*0.1,P.cC],[kx+kw*0.35,ky+kh+4,P.cB]].forEach(([cx2,cy2,cc])=>{
    px(ctx,cx2,cy2,22,9,cc);px(ctx,cx2+2,cy2+1,18,7,li(cc,20))
    px(ctx,cx2+4,cy2+2,14,5,'rgba(255,255,255,0.2)')
  })

  // Bookshelf on right wall
  const bx=x+w-30,by=y+h*0.08
  px(ctx,bx,by,26,h*0.38,P.shelf);px(ctx,bx+1,by+1,24,h*0.38-2,'#f8f4ec')
  px(ctx,bx,by+h*0.12,26,2,P.shelf);px(ctx,bx,by+h*0.25,26,2,P.shelf)
  ;['#e06060','#6080e0','#60a860'].forEach((c,i)=>px(ctx,bx+2+i*8,by+3,6,h*0.1,c))
  ;['#e0a040','#a060e0'].forEach((c,i)=>px(ctx,bx+2+i*12,by+h*0.13,10,h*0.1,c))
}

// ── BEDROOM ───────────────────────────────────────────────────────────────
function drawBedroom(ctx,W,H,P,t) {
  const L=getLayout(W,H)
  const {x,y,w,h}=L.bedroom
  const fy=y+h*0.40

  // Futon/bed
  const bh=Math.round(h*0.18),bw=w*0.7,bx=x+w*0.06,by=fy-bh
  px(ctx,bx-2,by-4,bw+4,bh+8,P.woodD)
  px(ctx,bx,by,bw,bh,'#f0ece4');px(ctx,bx,by,bw,3,'#ffffff')
  px(ctx,bx+3,by+3,bw*0.33,bh*0.38,'#f8e8e8');px(ctx,bx+3,by+3,bw*0.33,2,'#ffffff')
  px(ctx,bx,by+bh*0.28,bw,bh*0.72,P.cA);px(ctx,bx,by+bh*0.28,bw,3,li(P.cA,15))
  for(let i=0;i<4;i++) px(ctx,bx+i*(bw/4)+3,by+bh*0.32,bw/4-6,bh*0.6,'rgba(255,255,255,0.1)')

  // Bedside table
  px(ctx,bx+bw+3,by+bh*0.18,w*0.14,h*0.1,P.deskT)
  px(ctx,bx+bw+3,by+bh*0.18,w*0.14,2,li(P.deskT,10))
  // Alarm clock
  px(ctx,bx+bw+5,by+bh*0.06,w*0.08,h*0.08,'#f0e8e0');px(ctx,bx+bw+7,by+bh*0.07,w*0.06,h*0.06,'#fff8f0')
  drawMug(ctx,bx+bw+w*0.1,by+bh*0.19,P.cE)

  // Wardrobe
  const wdh=Math.round(h*0.46),wx=x+w-52,wy=fy-wdh
  px(ctx,wx,wy,48,wdh,P.deskT);px(ctx,wx,wy,48,3,li(P.deskT,15))
  px(ctx,wx+2,wy+4,22,wdh-4,li(P.deskT,-8));px(ctx,wx+26,wy+4,20,wdh-4,li(P.deskT,-8))
  px(ctx,wx+10,wy+wdh*0.45,4,8,P.woodD);px(ctx,wx+33,wy+wdh*0.45,4,8,P.woodD)
  // Mirror on wardrobe
  px(ctx,wx+4,wy-h*0.16,40,h*0.17,li(P.deskT,-4))
  ctx.save();ctx.globalAlpha=0.22;px(ctx,wx+6,wy-h*0.15,36,h*0.14,'#88bbcc');ctx.restore()

  // Shoji screen
  const sx=x+4,sy=y+h*0.06,sw=6,ssh=h*0.34
  px(ctx,sx,sy,sw,ssh,P.wood)
  ;[sx+1,sx+sw/2+1].forEach(bx2=>{
    const bw2=(sw-3)/2
    px(ctx,bx2,sy+1,bw2,ssh-2,P.paper)
    for(let r=1;r<6;r++) px(ctx,bx2,sy+1+r*((ssh-2)/6),bw2,1,P.paperL)
  })

  // Floor lamp
  drawLamp(ctx,x+w-8,y+h*0.15,P,t)
}

// ── KITCHEN ───────────────────────────────────────────────────────────────
function drawKitchen(ctx,W,H,P,t) {
  const L=getLayout(W,H)
  const {x,y,w,h}=L.kitchen
  const fy=y+h*0.40

  // Counter top
  const ch=Math.round(h*0.1),cw=w*0.82,cx=x+w*0.06,cy=fy-ch
  px(ctx,cx,cy,cw,ch,'#e0d8c8');px(ctx,cx,cy,cw,3,'#f0e8d8')
  px(ctx,cx,cy+ch,cw,7,'#c8c0b0')
  // Counter items
  px(ctx,cx+3,cy-h*0.07,14,h*0.07,'#e0e8f0');px(ctx,cx+3,cy-h*0.07,14,2,li('#e0e8f0',10))
  px(ctx,cx+8,cy-h*0.09,7,4,'#a0a8b0')
  px(ctx,cx+cw*0.3,cy+2,24,ch-5,'#d4b890');px(ctx,cx+cw*0.3,cy+2,24,2,li('#d4b890',10))
  px(ctx,cx+cw*0.32,cy+ch*0.3,18,3,'#c0c0c0');px(ctx,cx+cw*0.48,cy+ch*0.3,3,3,'#8a5a30')
  ;[cx+cw*0.6,cx+cw*0.72].forEach(px2=>{
    px(ctx,px2,cy+2,w*0.1,ch-4,'#f0f0e8')
    ctx.save();ctx.globalAlpha=0.3;px(ctx,px2+2,cy+3,w*0.1-4,ch-6,'#e8e0d8');ctx.restore()
  })

  // Fridge
  const fx=x+w*0.06,fw=w*0.3,fh=Math.round(h*0.44),fyl=fy-fh
  px(ctx,fx,fyl,fw,fh,P.fridge);px(ctx,fx,fyl,fw,3,li(P.fridge,15))
  px(ctx,fx,fyl+fh*0.35,fw,2,'#c0ccd8')
  px(ctx,fx+fw-5,fyl+h*0.08,3,fh*0.25,'#a0a8b0')
  px(ctx,fx+fw-5,fyl+fh*0.38,3,fh*0.15,'#a0a8b0')
  ;[[fx+3,fyl+5,'#e04040'],[fx+9,fyl+5,'#40a040'],[fx+15,fyl+5,'#4040e0']].forEach(([mx,my,mc])=>px(ctx,mx,my,4,4,mc))
  px(ctx,fx+3,fyl+12,fw*0.5,h*0.08,'#fffff0')
  for(let l=0;l<3;l++) px(ctx,fx+5,fyl+15+l*5,fw*0.5-4,1,'#e8e8c8')

  // Microwave
  const mwx=x+w*0.42,mwy=y+h*0.08
  px(ctx,mwx,mwy,w*0.52,h*0.12,'#2a2a2a');px(ctx,mwx,mwy,w*0.52,2,'#3a3a3a')
  px(ctx,mwx+2,mwy+3,w*0.33,h*0.08,'#1a1a1a')
  px(ctx,mwx+w*0.36,mwy+3,w*0.14,h*0.07,'#001a00')
  ctx.fillStyle='#00cc00';ctx.font='6px "JetBrains Mono"';ctx.fillText('12:00',mwx+w*0.36+2,mwy+h*0.07+2)

  // Gas stove
  const stx=x+w*0.42,sty=mwy+h*0.14
  px(ctx,stx,sty,w*0.52,h*0.1,'#3a3a3a')
  ;[[stx+6,sty+5],[stx+w*0.25,sty+5],[stx+6,sty+h*0.06],[stx+w*0.25,sty+h*0.06]].forEach(([bx2,by2])=>{
    px(ctx,bx2,by2,9,7,'#2a2a2a')
    ctx.save();ctx.globalAlpha=0.4;px(ctx,bx2+2,by2+2,5,3,'#4444aa');ctx.restore()
  })

  // Hanging plant above counter
  px(ctx,cx+cw*0.75,cy-h*0.12,10,h*0.12,P.stem||P.leafD)
  ;[[cx+cw*0.7,cy-h*0.12],[cx+cw*0.76,cy-h*0.16],[cx+cw*0.82,cy-h*0.1]].forEach(([lx,ly])=>{
    px(ctx,lx,ly,11,6,P.leaf);px(ctx,lx+2,ly+1,7,4,P.leafL)
  })
}

// ── SHARED ASSETS ─────────────────────────────────────────────────────────
function drawChairSide(ctx,x,y,color,P,side) {
  px(ctx,x,y,28,18,color);px(ctx,x,y,28,3,li(color))
  px(ctx,x+2,y+3,24,14,li(color));px(ctx,x+4,y+4,20,10,'rgba(255,255,255,0.2)')
  const bx=side==='r'?x-5:x+22
  px(ctx,bx,y-20,9,24,color);px(ctx,bx+1,y-18,7,20,li(color))
  px(ctx,x+3,y+18,4,10,P.cLeg);px(ctx,x+20,y+18,4,10,P.cLeg)
}
function drawLaptop(ctx,x,y,accent,t) {
  px(ctx,x,y+9,30,4,'#c8c0b8');px(ctx,x+2,y,26,10,'#555565');px(ctx,x+3,y+1,24,8,'#1a2030')
  px(ctx,x+4,y+2,14,1,accent);px(ctx,x+4,y+4,18,1,'#88aaff');px(ctx,x+4,y+6,10,1,'#88ee88')
  if(Math.floor(t*2)%2===0) px(ctx,x+18,y+7,2,2,'#ffffff')
  px(ctx,x+2,y+9,26,2,'#666677');px(ctx,x+10,y+10,8,2,accent)
}
function drawMug(ctx,x,y,color) {
  px(ctx,x,y,10,12,color);px(ctx,x,y,10,2,'rgba(255,255,255,0.35)')
  px(ctx,x+10,y+3,3,2,color);px(ctx,x+10,y+6,3,2,color);px(ctx,x+11,y+3,1,5,color)
  ctx.save();ctx.globalAlpha=0.3;ctx.fillStyle='#888';ctx.font='7px sans-serif';ctx.fillText('~',x,y-2);ctx.restore()
}
function drawLamp(ctx,x,y,P,t) {
  ctx.save();ctx.globalAlpha=0.12;px(ctx,x-12,y-6,38,40,'#fff8e0');ctx.restore()
  px(ctx,x-4,y,24,12,'#f8e8a0');px(ctx,x-2,y+2,20,8,'#fffce8')
  px(ctx,x-5,y+10,26,3,P.woodL||'#a87040')
  px(ctx,x+7,y+13,4,28,P.woodL||'#a87040')
  px(ctx,x+1,y+39,14,5,P.wood||'#8a5a30');px(ctx,-2+x,y+42,20,3,P.wood||'#8a5a30')
}
function drawBigPlant(ctx,x,y,P,snow) {
  px(ctx,x,y+40,26,16,P.pot||'#d86838');px(ctx,x-2,y+44,30,12,li(P.pot||'#d86838',-10))
  px(ctx,x+9,y,5,42,P.leafD||'#3a8a3a')
  ;[[x-14,y+7,20,10],[x+12,y+3,20,10],[x-12,y+20,18,9],[x+12,y+16,18,9],[x-5,y-1,16,8]].forEach(([lx,ly,lw,lh])=>{
    px(ctx,lx,ly,lw,lh,P.leaf||'#5aaa5a');px(ctx,lx+2,ly+2,lw-4,lh-4,P.leafL||'#7acc7a')
    px(ctx,lx+lw/2-1,ly,2,lh,P.leafD||'#3a8a3a')
  })
  if(snow){ctx.save();ctx.globalAlpha=0.65;[[x-14,y+7],[x+12,y+3],[x-12,y+20]].forEach(([lx,ly])=>px(ctx,lx,ly,10,3,'#eef4ff'));ctx.restore()}
}
function drawBamboo(ctx,x,y,P,snow) {
  px(ctx,x-3,y+56,32,14,P.pot||'#d86838');px(ctx,x-5,y+60,36,10,li(P.pot||'#d86838',-10))
  for(let i=0;i<3;i++){
    const sx=x+4+i*9, sh=56+i*16, sy=y+56-sh
    for(let seg=0;seg<5;seg++){
      const sgy=sy+seg*(sh/5)
      px(ctx,sx,sgy,6,sh/5-2,i%2===0?P.bam||'#7aa050':'#9ac870')
      px(ctx,sx+1,sgy,4,sh/5-3,li(i%2===0?P.bam||'#7aa050':'#9ac870',15))
      px(ctx,sx,sgy+sh/5-2,6,2,P.bamN||'#4a6020')
    }
    px(ctx,sx-7,sy+4,18,5,P.bam||'#7aa050');px(ctx,sx+4,sy+12,16,5,'#9ac870')
    if(snow){ctx.save();ctx.globalAlpha=0.7;px(ctx,sx-2,sy,9,3,'#eef4ff');ctx.restore()}
  }
}
function drawSakura(ctx,x,y,P,t) {
  // Trunk
  px(ctx,x+8,y+32,7,28,P.sakT||'#6a3a18')
  px(ctx,x+9,y+34,5,26,li(P.sakT||'#6a3a18',15))
  // Main branches
  ;[[-24,y+44,22,6],[18,y+40,20,6],[-14,y+54,18,5],[16,y+52,16,5]].forEach(([bx,by,bw,bh])=>{
    px(ctx,x+bx,by,bw,bh,'#5a2a10')
  })
  // Blossom clusters - layered pink
  const blobs=[
    [x-20,y+28,40,22],[x-10,y+14,36,20],[x+8,y+22,34,18],
    [x-18,y+42,30,18],[x+6,y+38,28,16],[x-8,y+8,30,16],
    [x+14,y+14,24,14],[x-22,y+54,28,16],[x+10,y+50,24,14],
  ]
  blobs.forEach(([bx,by,bw,bh])=>{
    px(ctx,bx,by,bw,bh,P.sakP||'#f8b8c8')
    px(ctx,bx+3,by+3,bw-6,bh-6,P.sakPD||'#e890a8')
    ctx.save();ctx.globalAlpha=0.25;px(ctx,bx+5,by+4,bw/3,bh/3,'#ffffff');ctx.restore()
  })
  // Falling petals (animated)
  for(let i=0;i<6;i++){
    const px2=x-40+i*18+Math.sin(t*0.4+i)*12
    const py2=((t*16+i*55)%(60))+y+30
    ctx.save();ctx.translate(px2,py2);ctx.rotate(Math.sin(t*0.8+i)*25*Math.PI/180)
    px(ctx,-3,-4,7,8,P.sakP||'#f8b8c8');ctx.restore()
  }
  // Pot/base
  px(ctx,x+2,y+60,20,12,P.pot||'#d86838');px(ctx,x,y+64,24,8,li(P.pot||'#d86838',-10))
  px(ctx,x+2,y+64,20,3,li(P.pot||'#d86838',15))
}

function drawSmallClock(ctx,x,y,P) {
  px(ctx,x-3,y-3,36,36,P.woodD||'#6a3a18');px(ctx,x,y,30,30,'#fdf8f0')
  for(let i=0;i<12;i++){
    const a=(i/12)*Math.PI*2-Math.PI/2
    const mx=x+15+Math.cos(a)*11, my=y+15+Math.sin(a)*11
    px(ctx,mx-1,my-1,i%3===0?3:2,i%3===0?3:2,'#8a7060')
  }
  const now=new Date(),hr=(now.getHours()%12)/12+now.getMinutes()/720,mn=now.getMinutes()/60
  ;[[hr,7,2,'#4a3020'],[mn,10,2,'#4a3020']].forEach(([a,l,lw,c])=>{
    ctx.save();ctx.translate(x+15,y+15);ctx.rotate(a*Math.PI*2-Math.PI/2)
    ctx.fillStyle=c;ctx.fillRect(0,-1,l,lw);ctx.restore()
  })
  px(ctx,x+14,y+14,3,3,'#4a3020')
}

// ── SNOW ──────────────────────────────────────────────────────────────────
function drawSnow(ctx,W,H,t) {
  ctx.save();ctx.fillStyle='rgba(240,248,255,0.85)'
  for(let i=0;i<30;i++){
    const sx=(i*71+t*10*(1+i%3*0.5))%W, sy=(i*43+t*12)%(H*0.95)
    const sz=1+(i%3);px(ctx,sx,sy,sz,sz,'#eef4ff')
  }
  ctx.restore()
}

// ── 4-DIRECTIONAL AGENT ───────────────────────────────────────────────────
function drawAgent(ctx,agent,x,y,dir,t,selected,P,sit=false) {
  if(!agent||!P) return
  const sc=P[agent.status]||P.idle||'#b0a090'

  if(selected){
    ctx.save();ctx.globalAlpha=0.3+Math.sin(t*3)*0.08
    ctx.strokeStyle='#e8734a';ctx.lineWidth=2;ctx.setLineDash([3,2])
    ctx.strokeRect(x-4,y-2,36,60);ctx.setLineDash([]);ctx.restore()
  }
  ctx.save();ctx.globalAlpha=0.1;px(ctx,x+3,y+48,24,5,'#604020');ctx.restore()

  const bob=(agent.status==='working'?Math.sin(t*2.5)*1.5:agent.status==='resting'?Math.sin(t*0.6):0)
  ctx.save();ctx.translate(0,bob)

  const SKINS={pm:'#f5c890',designer:'#f8c898',frontend:'#f0b880',backend:'#e8b070',qa:'#f5c8a0',blog:'#f8d0a8',github:'#e8c090',techlead:'#f0b870'}
  const HAIRS={pm:'#2a1808',designer:'#cc3388',frontend:'#1a2868',backend:'#1a3818',qa:'#8a3820',blog:'#cc8830',github:'#183030',techlead:'#2a0808'}
  const SHIRTS={pm:'#4468c0',designer:'#c04888',frontend:'#3898b0',backend:'#389060',qa:'#a06030',blog:'#e8785a',github:'#303048',techlead:'#882828'}
  const PANTS={pm:'#2a3888',designer:'#781848',frontend:'#1868a0',backend:'#1a6038',qa:'#704010',blog:'#885030',github:'#202038',techlead:'#601818'}

  const sk=SKINS[agent.id]||'#f5c890'
  const hr=HAIRS[agent.id]||'#2a1808'
  const st=SHIRTS[agent.id]||'#4468c0'
  const pt=PANTS[agent.id]||'#2a3888'
  const wk=agent.status!=='idle'&&agent.status!=='resting'?Math.floor(t*3.5)%2:0

  const drawFront=()=>{
    px(ctx,x+5,y+2,20,14,hr);px(ctx,x+5,y+6,20,11,sk)
    if(agent.id==='designer'){px(ctx,x+17,y+1,7,4,'#ff88cc')}
    else if(agent.id==='frontend'){px(ctx,x+6,y-1,3,7,hr);px(ctx,x+12,y-3,4,9,hr);px(ctx,x+18,y-1,3,6,hr)}
    else if(agent.id==='blog'){px(ctx,x+18,y+1,6,4,'#ff8888')}
    px(ctx,x+8,y+8,4,5,'#1a1408');px(ctx,x+18,y+8,4,5,'#1a1408')
    px(ctx,x+8,y+7,3,3,'#fff');px(ctx,x+18,y+7,3,3,'#fff')
    px(ctx,x+9,y+9,2,2,'#3358c8');px(ctx,x+19,y+9,2,2,'#3358c8')
    px(ctx,x+9,y+8,1,1,'#fff');px(ctx,x+19,y+8,1,1,'#fff')
    ctx.save();ctx.globalAlpha=0.25;px(ctx,x+6,y+13,4,3,'#ff9090');px(ctx,x+20,y+13,4,3,'#ff9090');ctx.restore()
    if(agent.status==='resting'){px(ctx,x+11,y+15,8,1,'#cc9080')}else{px(ctx,x+10,y+15,9,2,'#cc8070')}
    px(ctx,x+7,y+17,16,13,st);px(ctx,x+12,y+17,7,4,'#fff');px(ctx,x+13,y+17,5,6,'#fff')
    px(ctx,x+3,y+17,5,11,st);px(ctx,x+22,y+17,5,11,st)
    px(ctx,x+2,y+26,5,5,sk);px(ctx,x+22,y+26,5,5,sk)
    if(sit){
      // Sitting - thighs forward, lower legs hang down
      px(ctx,x+7,y+30,10,6,pt);px(ctx,x+17,y+30,10,6,pt) // thighs
      px(ctx,x+14,y+36,5,8,pt);px(ctx,x+20,y+36,5,8,pt)  // lower legs
      px(ctx,x+13,y+43,7,4,'#3a2818');px(ctx,x+19,y+43,7,4,'#3a2818') // feet
    } else {
      if(wk===0){px(ctx,x+9,y+30,6,13,pt);px(ctx,x+15,y+30,6,13,pt)}
      else{px(ctx,x+9,y+30,6,11,pt);px(ctx,x+15,y+32,6,11,pt)}
      px(ctx,x+7,y+42,9,5,'#3a2818');px(ctx,x+14,y+42,9,5,'#3a2818')
    }
  }
  const drawBack=()=>{
    px(ctx,x+5,y+2,20,15,hr);px(ctx,x+5,y+9,20,8,sk)
    px(ctx,x+7,y+17,16,13,st)
    px(ctx,x+3,y+17,5,11,st);px(ctx,x+22,y+17,5,11,st)
    px(ctx,x+2,y+26,5,5,sk);px(ctx,x+22,y+26,5,5,sk)
    if(sit){
      px(ctx,x+7,y+30,10,6,pt);px(ctx,x+17,y+30,10,6,pt)
      px(ctx,x+14,y+36,5,8,pt);px(ctx,x+20,y+36,5,8,pt)
      px(ctx,x+13,y+43,7,4,'#3a2818');px(ctx,x+19,y+43,7,4,'#3a2818')
    } else {
      if(wk===0){px(ctx,x+9,y+30,6,13,pt);px(ctx,x+15,y+30,6,13,pt)}
      else{px(ctx,x+9,y+32,6,11,pt);px(ctx,x+15,y+30,6,11,pt)}
      px(ctx,x+7,y+42,9,5,'#3a2818');px(ctx,x+14,y+42,9,5,'#3a2818')
    }
  }
  const drawRight=()=>{
    px(ctx,x+5,y+2,16,13,hr);px(ctx,x+7,y+6,14,10,sk)
    px(ctx,x+5,y+7,4,5,sk) // ear
    px(ctx,x+16,y+8,4,4,'#1a1408');px(ctx,x+16,y+7,3,3,'#fff');px(ctx,x+17,y+8,2,2,'#3358c8')
    px(ctx,x+6,y+12,3,2,sk)
    px(ctx,x+5,y+17,15,12,st)
    px(ctx,x+19,y+19,5,10,st);px(ctx,x+19,y+27,5,5,sk)
    if(sit){
      px(ctx,x+5,y+29,14,6,pt) // thigh (side view - horizontal)
      px(ctx,x+16,y+35,5,8,pt) // lower leg hangs
      px(ctx,x+15,y+42,8,4,'#3a2818')
    } else {
      if(wk===0){px(ctx,x+6,y+29,6,13,pt);px(ctx,x+12,y+29,5,13,pt)}
      else{px(ctx,x+6,y+29,6,11,pt);px(ctx,x+12,y+31,5,11,pt)}
      px(ctx,x+5,y+41,9,5,'#3a2818');px(ctx,x+12,y+41,9,5,'#3a2818')
    }
  }
  const drawLeft=()=>{
    ctx.save();ctx.translate(x+30,0);ctx.scale(-1,1)
    px(ctx,-25,y+2,16,13,hr);px(ctx,-23,y+6,14,10,sk)
    px(ctx,-25,y+7,4,5,sk)
    px(ctx,-14,y+8,4,4,'#1a1408');px(ctx,-14,y+7,3,3,'#fff');px(ctx,-13,y+8,2,2,'#3358c8')
    px(ctx,-24,y+12,3,2,sk)
    px(ctx,-25,y+17,15,12,st)
    px(ctx,-29,y+19,5,10,st);px(ctx,-29,y+27,5,5,sk)
    if(sit){
      px(ctx,-19,y+29,14,6,pt)
      px(ctx,-21,y+35,5,8,pt)
      px(ctx,-23,y+42,8,4,'#3a2818')
    } else {
      if(wk===0){px(ctx,-24,y+29,6,13,pt);px(ctx,-18,y+29,5,13,pt)}
      else{px(ctx,-24,y+29,6,11,pt);px(ctx,-18,y+31,5,11,pt)}
      px(ctx,-25,y+41,9,5,'#3a2818');px(ctx,-18,y+41,9,5,'#3a2818')
    }
    ctx.restore()
  }

  if(dir==='down'||dir==='forward')     drawFront()
  else if(dir==='up'||dir==='back')     drawBack()
  else if(dir==='right')                drawRight()
  else                                  drawLeft()

  ctx.restore()

  // Status orb
  px(ctx,x+12,y-8,7,7,sc);px(ctx,x+13,y-7,3,3,'#ffffff')
  if(agent.status==='working'){
    ctx.save();const p=t%1;ctx.globalAlpha=(1-p)*0.45
    ctx.strokeStyle=sc;ctx.lineWidth=1;ctx.beginPath();ctx.arc(x+15,y-4,p*10,0,Math.PI*2);ctx.stroke();ctx.restore()
  }
  if(agent.status==='resting'){
    const zo=((t*0.55)%1)*9
    ctx.save();ctx.globalAlpha=1-((t*0.55)%1);ctx.fillStyle='#99aacc';ctx.font='9px sans-serif';ctx.fillText('z',x+24,y-4-zo);ctx.restore()
  }

  // Name tag
  const nm=agent.name||agent.id, nw=nm.length*6+10
  px(ctx,x+15-nw/2,y+50,nw,12,'rgba(255,248,252,0.95)')
  px(ctx,x+15-nw/2,y+50,nw,2,sc)
  ctx.fillStyle='#4a3020';ctx.font='bold 8px "DM Sans",sans-serif'
  ctx.fillText(nm,x+15-nw/2+4,y+60)
}

// ── AGENT POSITIONS ───────────────────────────────────────────────────────
export const AGENT_HOME = {
  // Office side room - at work table, seated
  designer: {x:0.03, y:0.50, dir:'right',  sit:true},
  backend:  {x:0.03, y:0.59, dir:'right',  sit:true},
  // PM at lobby center table, facing forward (boss seat)
  pm:       {x:0.44, y:0.51, dir:'forward', sit:true},
  // Blog/Github flanking the lobby table
  blog:     {x:0.37, y:0.56, dir:'right',  sit:true},
  github:   {x:0.57, y:0.56, dir:'left',   sit:true},
  // Living room - at kotatsu, seated
  frontend: {x:0.80, y:0.50, dir:'left',   sit:true},
  qa:       {x:0.80, y:0.59, dir:'left',   sit:true},
  // Bedroom - techlead at desk
  techlead: {x:0.09, y:0.75, dir:'right',  sit:true},
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function PixelOffice({W,H,agents,selectedAgent,time,onAgentClick,agentActivities,officeHour}) {
  const canvasRef=useRef(null)
  const agentArr=useMemo(()=>Object.values(agents),[agents])
  const oh=officeHour||9
  const timeOfDay=getToD(oh)
  const snow=Math.floor(oh/6)%4===3

  useEffect(()=>{
    const canvas=canvasRef.current
    if(!canvas||!W||!H||W<10||H<10) return
    const ctx=canvas.getContext('2d')
    if(!ctx) return
    ctx.clearRect(0,0,W,H)
    ctx.imageSmoothingEnabled=false
    // Build palette fresh each render - never undefined
    const P=makePalette(timeOfDay)
    try{
      drawBase(ctx,W,H,P)
      drawWindows(ctx,W,H,P,timeOfDay,time)
      drawOffice(ctx,W,H,P,time)
      drawLobby(ctx,W,H,P,time)
      drawLiving(ctx,W,H,P,time)
      drawBedroom(ctx,W,H,P,time)
      drawKitchen(ctx,W,H,P,time)
      drawSmallClock(ctx,W/2-15,2,P)
      if(snow) drawSnow(ctx,W,H,time)
      agentArr.forEach(a=>{
        const home=AGENT_HOME[a.id]||{x:0.44,y:0.48,dir:'forward',sit:false}
        drawAgent(ctx,a,W*home.x,H*home.y,home.dir,time,selectedAgent===a.id,P,home.sit)
      })
    }catch(e){console.error('PixelOffice:',e)}
  },[W,H,agents,selectedAgent,time,agentArr,timeOfDay,snow,oh])

  const handleClick=(e)=>{
    const canvas=canvasRef.current;if(!canvas)return
    const rect=canvas.getBoundingClientRect()
    const mx=(e.clientX-rect.left)*(W/rect.width)
    const my=(e.clientY-rect.top)*(H/rect.height)
    for(const[id,home]of Object.entries(AGENT_HOME)){
      const ax=W*home.x,ay=H*home.y
      if(mx>=ax-5&&mx<=ax+35&&my>=ay-5&&my<=ay+65){onAgentClick(id);return}
    }
    // Whiteboard click zone (office back wall)
    if(mx<=W*0.22&&my<=H*0.42) onAgentClick('whiteboard')
  }

  return(
    <canvas ref={canvasRef} width={W} height={H} onClick={handleClick}
      id="office-canvas" style={{cursor:'pointer'}}/>
  )
}