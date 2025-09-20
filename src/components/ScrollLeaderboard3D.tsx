"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { supabase } from '@/lib/supabaseClient';

/* ===================== Types ===================== */
type RegionMode = 'global' | 'country';

export interface Profile {
  id: string;
  username: string | null;
  elo_rating: number;
  is_supporter: boolean;
  nickname_color?: string | null;
  badge_color?: string | null;
  country?: string | null;
}

interface ScrollLeaderboard3DProps {
  open: boolean;
  originRef?: React.RefObject<HTMLElement | null>; // 버튼 기준 앵커 (선택)
  width?: number;
  height?: number;

  // 선택적 확장
  currentUserId?: string;
  currentCountry?: string;
  liveUserIds?: string[];                 // 관전 우선 대상
  avatarUrls?: Record<string,string>;     // (확장용)

  // 콜백
  onRequestSpectate?: (profile: Profile) => void;
  onRequestProfile?: (profile: Profile) => void;
}

/* ===================== Deform / Theme ===================== */
const DEFORM = {
  planeW: 1.2,
  planeH: 1.8,
  radius: 0.24,
  curlRatio: 0.42,
  maxTheta: 3.769911, // 216°
};

const THEME = {
  bgTop:    '#2e2e27',
  bgBot:    '#23231d',
  vignette: 'rgba(0,0,0,0.45)',
  innerBorder: 'rgba(255,255,255,0.06)',
  headerGoldTop:  '#f2d58a',
  headerGoldBot:  '#caa75a',
  textMain: 'rgba(255,255,255,0.92)',
  textSub:  'rgba(255,255,255,0.60)',
  rowStripe: 'rgba(255,255,255,0.03)',
  hairline: 'rgba(255,255,255,0.14)',
  gold:   '#d4af37',
  silver: '#c0c0c0',
  bronze: '#cd7f32',
  chipBorder: 'rgba(255,255,255,0.28)',
  chipFillTop: 'rgba(255,255,255,0.20)',
  chipFillMid: 'rgba(255,255,255,0.10)',
  chipFillBot: 'rgba(255,255,255,0.06)',
  chipHover:   'rgba(255,255,255,0.32)',
};

/* ===================== Canvas helpers ===================== */
function drawRoundedRect(ctx: CanvasRenderingContext2D, x:number, y:number, w:number, h:number, r=12){
  const anyCtx = ctx as any;
  if (typeof anyCtx.roundRect === 'function') { anyCtx.roundRect(x,y,w,h,r); return; }
  const rr = Math.min(r, w/2, h/2);
  ctx.moveTo(x+rr, y);
  ctx.lineTo(x+w-rr, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+rr);
  ctx.lineTo(x+w, y+h-rr);
  ctx.quadraticCurveTo(x+w, y+h, x+w-rr, y+h);
  ctx.lineTo(x+rr, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-rr);
  ctx.lineTo(x, y+rr);
  ctx.quadraticCurveTo(x, y, x+rr, y);
}

function drawCrown(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, fill: string) {
  const r = w / 6;
  ctx.save();
  ctx.translate(cx - w/2, cy - h/2);
  ctx.beginPath();
  ctx.moveTo(0, h); ctx.lineTo(w, h);
  ctx.lineTo(w*0.85, h*0.45);
  ctx.lineTo(w*0.66, h*0.7);
  ctx.lineTo(w*0.5, h*0.35);
  ctx.lineTo(w*0.34, h*0.7);
  ctx.lineTo(w*0.15, h*0.45);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.beginPath();
  ctx.arc(w*0.2,  h*0.42, r*0.6, 0, Math.PI*2);
  ctx.arc(w*0.5,  h*0.33, r*0.6, 0, Math.PI*2);
  ctx.arc(w*0.8,  h*0.42, r*0.6, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
  ctx.restore();
}

function drawMedal(ctx: CanvasRenderingContext2D, x:number, y:number, radius:number, kind:'gold'|'silver'|'bronze') {
  const col = kind === 'gold' ? THEME.gold : kind === 'silver' ? THEME.silver : THEME.bronze;
  const g1 = ctx.createRadialGradient(x, y, radius*0.2, x, y, radius*1.15);
  g1.addColorStop(0, col); g1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g1; ctx.beginPath(); ctx.arc(x, y, radius*1.15, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI*2);
  const g2 = ctx.createLinearGradient(x, y-radius, x, y+radius);
  g2.addColorStop(0, 'rgba(255,255,255,0.9)'); g2.addColorStop(1, col);
  ctx.strokeStyle = g2; ctx.lineWidth = 3; ctx.stroke();
}

function makeNoiseCanvas(size=128, alpha=0.05){
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const x = c.getContext('2d')!;
  const id = x.createImageData(size, size);
  for (let i=0;i<id.data.length;i+=4){
    const v = Math.random()*255|0;
    id.data[i]=id.data[i+1]=id.data[i+2]=v;
    id.data[i+3]=Math.round(alpha*255);
  }
  x.putImageData(id,0,0);
  return c;
}

function flagEmoji(code?: string){
  if (!code) return '';
  const cc = code.toUpperCase().slice(0,2);
  const A = 0x1F1E6;
  const cp1 = A + (cc.charCodeAt(0) - 65);
  const cp2 = A + (cc.charCodeAt(1) - 65);
  if (isNaN(cp1) || isNaN(cp2)) return '';
  return String.fromCodePoint(cp1) + String.fromCodePoint(cp2);
}

/* ===================== Leaderboard Canvas Hook ===================== */
function useLeaderboardCanvas(
  width = 1024, height = 1536,
  opts?: {
    currentUserId?: string;
    currentCountry?: string;
    liveUserIds?: string[];
    avatarUrls?: Record<string,string>;
  },
  handlers?: {
    onRowProfile?: (p: Profile) => void;
    onRowWatch?: (p: Profile) => void;
  }
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const noiseRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const buttonRectsRef = useRef<{ id: string; x: number; y: number; w: number; h: number }[]>([]);
  const [hasMap, setHasMap] = useState(false);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>('');
  const [countries, setCountries] = useState<string[]>([]);

  // UI state
  const [orderAsc, setOrderAsc] = useState(false);
  const [supportersOnly, setSupportersOnly] = useState(false);
  const [regionMode, setRegionMode] = useState<RegionMode>('global');
  const [myCountry, setMyCountry] = useState<string>('GLOBAL');
  const [scrollY, setScrollY] = useState(0);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [focus, setFocus] = useState<'search' | null>(null); // 캔버스 내 포커스
  const blinkRef = useRef<any>(null);

  // Physics scrolling state
  const [physicsOn, setPhysicsOn] = useState(true);
  const [inertiaLevel, setInertiaLevel] = useState<'LOW'|'MED'|'HIGH'>('MED');
  const posRef = useRef(0);       // continuous position for physics integrator
  const velRef = useRef(0);       // velocity (pixels/sec)
  const rafRef = useRef<number| null>(null);
  const lastTsRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  const layoutRef = useRef<{viewTop:number; viewBottom:number; viewH:number; rowH:number; left:number; right:number} | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  // Keep physics pos in sync with React state
  useEffect(() => { posRef.current = scrollY; }, [scrollY]);

  // Load profiles from Supabase and derive country list
  const fetchProfiles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, elo_rating, is_supporter, nickname_color, badge_color, country')
        .neq('elo_rating', 1200)
        .order('elo_rating', { ascending: false })
        .limit(300);
      if (error) { console.warn('fetchProfiles error', error); return; }
      const list = (data || []) as Profile[];
      setProfiles(list);
      setUpdatedAt(new Date().toLocaleString());
      const set = new Set<string>();
      for (const p of list) {
        const c = (p.country || '').toString().trim().toUpperCase();
        if (c) set.add(c);
      }
      const cs = Array.from(set.values()).sort();
      const final = ['GLOBAL', ...cs.filter(c => c !== 'GLOBAL')];
      setCountries(final);
      if (!myCountry) setMyCountry('GLOBAL');
    } catch (e) {
      console.warn('fetchProfiles exception', e);
    }
  }, [myCountry]);

  

  // ensure canvas/texture initialized + prime draw
  const ensure = useCallback(() => {
    if (!canvasRef.current) {
      const c = document.createElement('canvas');
      c.width = width; c.height = height;
      canvasRef.current = c;
    }
    if (!textureRef.current && canvasRef.current) {
      textureRef.current = new THREE.CanvasTexture(canvasRef.current);
      if ('colorSpace' in (textureRef.current as any)) {
        (textureRef.current as any).colorSpace = THREE.SRGBColorSpace;
      } else {
        (textureRef.current as any).encoding = THREE.sRGBEncoding;
      }
      textureRef.current.minFilter = THREE.LinearFilter;
      textureRef.current.magFilter = THREE.LinearFilter;
      try { (textureRef.current as any).anisotropy = 6; } catch {}
      // prime draw to avoid black frame
      const ctx = canvasRef.current.getContext('2d')!;
      ctx.fillStyle = '#2e2e27'; ctx.fillRect(0,0,width,height);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 64px system-ui, -apple-system, Segoe UI';
      ctx.textAlign = 'center'; ctx.fillText('Leaderboard', width/2, 120);
      ctx.font = '28px system-ui, -apple-system, Segoe UI';
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillText('Loading...', width/2, 170);
      textureRef.current.needsUpdate = true;
    }
    if (!noiseRef.current) noiseRef.current = makeNoiseCanvas(128, 0.05);
    if (canvasRef.current && textureRef.current) setHasMap(true);
  }, [width, height]);

  // 국가 추정
  useEffect(() => {
    (async () => {
      if (opts?.currentCountry) { setMyCountry(opts.currentCountry.toUpperCase()); return; }
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const uid = user?.id || opts?.currentUserId;
        if (user?.id) setAuthUserId(user.id);
        if (uid) {
          const { data } = await supabase.from('profiles').select('country').eq('id', uid).single();
          if (data?.country) { setMyCountry(String(data.country).toUpperCase()); return; }
        }
      } catch {}
      try {
        const loc = navigator.language || (Intl as any)?.DateTimeFormat?.().resolvedOptions?.().locale || 'en-US';
        const m = loc.match(/[-_]([A-Z]{2})$/i);
        if (m && m[1]) setMyCountry(m[1].toUpperCase());
      } catch {}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // list derivation (sorted/filtered)
  const getSortedList = useCallback((): Profile[] => {
    const base = supportersOnly ? profiles.filter(p => p.is_supporter) : profiles;
    let regionFiltered = base;
    if (regionMode === 'country' && myCountry && myCountry !== 'GLOBAL') {
      regionFiltered = base.filter(p => (p.country || '').toUpperCase() === myCountry);
    }
    const query = searchQuery.trim().toLowerCase();
    const nameFiltered = query.length > 0
      ? regionFiltered.filter(p => (p.username || 'anonymous').toLowerCase().includes(query))
      : regionFiltered;
    const sorted = [...nameFiltered].sort((a,b)=> orderAsc ? a.elo_rating - b.elo_rating : b.elo_rating - a.elo_rating);
    return sorted;
  }, [profiles, supportersOnly, regionMode, myCountry, searchQuery, orderAsc]);
  const exportCsv = useCallback(() => {
    try {
      const list = getSortedList().slice(0, 200);
      const rows = ['rank,username,elo,country,supporter'];
      list.forEach((p,i)=> rows.push(`${i+1},"${(p.username||'Anonymous').replace(/"/g,'""')}",${p.elo_rating},${p.country||''},${p.is_supporter?'1':'0'}`));
      const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download='leaderboard.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 1000);
    } catch (e) { console.warn('CSV export failed', e); }
  }, [profiles, supportersOnly, regionMode, myCountry, searchQuery, orderAsc]);

  const pickSpectateTarget = useCallback((): Profile | null => {
    const list = getSortedList();
    const pool = (opts?.liveUserIds && opts.liveUserIds.length>0)
      ? list.filter(p => opts.liveUserIds!.includes(p.id))
      : list;
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }, [profiles, supportersOnly, regionMode, myCountry, searchQuery, orderAsc, opts?.liveUserIds]);

  // 캔버스 UI 파츠 그리기 도우미
  const pushRect = (id:string, x:number, y:number, w:number, h:number) => {
    buttonRectsRef.current.push({ id, x, y, w, h });
  };

  const drawChip = (ctx:CanvasRenderingContext2D, id:string, label:string, x:number, y:number, w:number, h:number, active=false, hovered=false) => {
    const gBtn = ctx.createLinearGradient(0, y, 0, y + h);
    gBtn.addColorStop(0, THEME.chipFillTop);
    gBtn.addColorStop(0.5, THEME.chipFillMid);
    gBtn.addColorStop(1, THEME.chipFillBot);
    ctx.beginPath(); drawRoundedRect(ctx, x, y, w, h, 10);
    ctx.fillStyle = hovered ? THEME.chipHover : gBtn; ctx.fill();
    ctx.lineWidth = 1.8; ctx.strokeStyle = active ? THEME.gold : THEME.chipBorder;
    ctx.beginPath(); drawRoundedRect(ctx, x, y, w, h, 10); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '700 24px system-ui, -apple-system, Segoe UI';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w/2, y + h/2 + 1);
    pushRect(id, x, y, w, h);
  };

  // 그리기
  const draw = useCallback(() => {
    ensure();
    const c = canvasRef.current!;
    const ctx = c.getContext('2d')!;
    const W = c.width, H = c.height;

    // BG
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, THEME.bgTop); bg.addColorStop(1, THEME.bgBot);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const vg = ctx.createRadialGradient(W*0.5, H*0.32, H*0.15, W*0.5, H*0.5, H*0.7);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, THEME.vignette);
    ctx.fillStyle = vg; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle = THEME.innerBorder; ctx.lineWidth = 2;
    ctx.strokeRect(18, 18, W-36, H-36);

    // Title
    drawCrown(ctx, W/2, 68, 74, 42, THEME.gold);
    const titleGrad = ctx.createLinearGradient(0, 50, 0, 120);
    titleGrad.addColorStop(0, THEME.headerGoldTop);
    titleGrad.addColorStop(1, THEME.headerGoldBot);
    ctx.fillStyle = titleGrad;
    ctx.font = '900 62px ui-serif, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 4;
    ctx.strokeText('Leaderboard', W/2, 126);
    ctx.fillText('Leaderboard', W/2, 126);

    // meta (우상단)
    ctx.fillStyle = THEME.textSub;
    ctx.font = '600 24px system-ui, -apple-system, Segoe UI';
    ctx.textAlign = 'right';
    ctx.fillText(updatedAt ? `Updated: ${updatedAt}` : '', W - 54, 156);

    // Controls row (칩 전부 캔버스에 그림)
    buttonRectsRef.current = [];
    const controlsY = 164;
    const lineY = controlsY + 62;

    // Search field (캔버스 포커스 지원)
    const searchX = 60, searchW = Math.min(360, W * 0.40), searchH = 52;
    const searchHovered = hoverId === 'btn:search';
    const gSearch = ctx.createLinearGradient(0, controlsY, 0, controlsY + searchH);
    gSearch.addColorStop(0, THEME.chipFillTop);
    gSearch.addColorStop(1, THEME.chipFillBot);
    ctx.beginPath(); drawRoundedRect(ctx, searchX, controlsY, searchW, searchH, 12);
    ctx.fillStyle = searchHovered ? THEME.chipHover : gSearch; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = focus==='search' ? THEME.gold : THEME.chipBorder;
    ctx.beginPath(); drawRoundedRect(ctx, searchX, controlsY, searchW, searchH, 12); ctx.stroke();
    // icon + text
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = '700 24px system-ui, -apple-system, Segoe UI'; ctx.fillStyle='#fff';
    ctx.fillText('Search:', searchX + 14, controlsY + searchH/2 + 1);
    const qx = searchX + 14 + ctx.measureText('Search:').width + 12;
    const placeholder = 'type name…';
    const showCaret = focus==='search' && ((Date.now() >> 9) & 1) === 0;
    const textToDraw = (searchQuery || placeholder);
    ctx.fillStyle = searchQuery ? '#fff' : 'rgba(255,255,255,0.6)';
    ctx.fillText(textToDraw, qx, controlsY + searchH/2 + 1);
    if (showCaret) {
      const tw = ctx.measureText(searchQuery).width;
      ctx.fillRect(qx + tw + 3, controlsY + 12, 2, searchH - 24);
    }
    pushRect('btn:search', searchX, controlsY, searchW, searchH);

    // 오른쪽 칩들 자동 배치
    let x = W - 60; const gap = 10;
    const placeRight = (id:string, label:string, active=false) => {
      const m = ctx.measureText(label);
      const w = Math.max(120, Math.ceil(m.width) + 26);
      x -= w; const y = controlsY; const h = 52;
      const hovered = hoverId === id;
      drawChip(ctx, id, label, x, y, w, h, active, hovered);
      x -= gap;
    };

    placeRight('btn:export', 'Export CSV');
    placeRight('btn:50th', '▼ 50th');
    placeRight('btn:top', '▲ Top');
    placeRight('btn:myrank', '☆ My Rank');
    placeRight('btn:random', 'Spectate Random');
    placeRight('btn:auto', `Auto: ${autoRefresh ? 'ON' : 'OFF'}`, autoRefresh);
    placeRight('btn:refresh', 'Refresh');

    // 왼쪽 이어서(검색 옆) — region / country / supporters / sort
    let lx = searchX + searchW + 12;
    const placeLeft = (id:string, label:string, active=false, minW=120) => {
      const m = ctx.measureText(label);
      const w = Math.max(minW, Math.ceil(m.width) + 26);
      const y = controlsY; const h = 52;
      const hovered = hoverId === id;
      drawChip(ctx, id, label, lx, y, w, h, active, hovered);
      lx += w + gap;
    };

    placeLeft('btn:region', regionMode === 'global' ? 'Region: Global' : `Region: ${myCountry}`, regionMode==='country');
    if (regionMode === 'country') {
      drawChip(ctx, 'btn:countryPrev', '◀', lx, controlsY, 52, 52, false, hoverId==='btn:countryPrev'); lx += 52 + gap;
      drawChip(ctx, 'btn:countryNext', '▶', lx, controlsY, 52, 52, false, hoverId==='btn:countryNext'); lx += 52 + gap;
    }
    placeLeft('btn:supporters', `Supporters: ${supportersOnly ? 'ON' : 'OFF'}`, supportersOnly, 160);
    placeLeft('btn:sort', `Sort: ${orderAsc ? 'ASC' : 'DESC'}`, true, 150);
    placeLeft('btn:physics', `Physics: ${physicsOn ? 'ON' : 'OFF'}`, physicsOn, 160);
    placeLeft('btn:inertia', `Inertia: ${inertiaLevel}`, true, 160);

    // 구분선
    ctx.strokeStyle = THEME.hairline; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(60, lineY); ctx.lineTo(W-60, lineY); ctx.stroke();

    // Table header
    const left = 80, right = W - 80;
    const nameX = left + 180;
    const scoreX = right - 80;
    let y = lineY + 36;
    ctx.fillStyle = THEME.textSub;
    ctx.font = '700 28px system-ui, -apple-system, Segoe UI';
    ctx.textAlign = 'left';  ctx.fillText('#', left, y);
    ctx.fillText('Player', nameX, y);
    ctx.textAlign = 'right'; ctx.fillText('ELO', scoreX, y);
    y += 18;
    ctx.strokeStyle = THEME.hairline; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();

    // rows / viewport — 7행 보장 (CTA 포함 위해 행 높이 상향)
    y += 36;
    const viewTop = y - 28;
    const viewBottom = H - 84;
    const viewH = viewBottom - viewTop;
    const rowH = Math.max(92, Math.floor(viewH / 7));
    layoutRef.current = { viewTop, viewBottom, viewH, rowH, left, right };

    const sorted = getSortedList();
    const totalH = sorted.length * rowH;
    const maxScroll = Math.max(0, totalH - viewH);
    const clampedScroll = Math.max(0, Math.min(scrollY, maxScroll));
    let firstIndex = Math.floor(clampedScroll / rowH);
    let yOffset = -(clampedScroll % rowH);
    const visibleCount = Math.ceil(viewH / rowH) + 1;

    const rankFont = Math.min(54, Math.max(28, Math.floor(rowH * 0.48)));
    const nameFont = Math.min(52, Math.max(28, Math.floor(rowH * 0.45)));
    const eloFont  = Math.min(50, Math.max(28, Math.floor(rowH * 0.45)));

    for (let vi = 0; vi < visibleCount; vi++) {
      const idx = firstIndex + vi;
      if (idx < 0 || idx >= sorted.length) continue;
      const p = sorted[idx];
      const yRow = y + yOffset + vi * rowH;
      if (yRow + rowH/2 < viewTop || yRow - rowH/2 > viewBottom) continue;

      // stripe
      ctx.fillStyle = idx % 2 === 0 ? THEME.rowStripe : 'transparent';
      ctx.fillRect(left, yRow - rowH/2, right - left, rowH);

      // 상위 3위 강조
      if (idx < 3) {
        drawMedal(ctx, left + 30, yRow - 10, Math.max(12, Math.floor(rowH*0.16)), idx===0?'gold':idx===1?'silver':'bronze');
      }

      // rank
      ctx.font = `800 ${rankFont}px system-ui, -apple-system, Segoe UI`;
      ctx.textAlign = 'left';
      ctx.fillStyle = THEME.textMain;
      ctx.fillText(String(idx + 1), left, yRow + Math.floor(rankFont*0.35));

      // supporter gem
      if (p.is_supporter) {
        const badgeColor = p.badge_color || THEME.gold;
        ctx.fillStyle = badgeColor;
        ctx.beginPath(); ctx.arc(nameX - 28, yRow - 12, 5.5, 0, Math.PI*2); ctx.fill();
      }

      // name
      ctx.textAlign = 'left';
      ctx.fillStyle = p.nickname_color || '#fff';
      ctx.font = `800 ${nameFont}px system-ui, -apple-system, Segoe UI`;
      ctx.fillText(p.username || 'Anonymous', nameX, yRow + Math.floor(nameFont*0.35));

      // country chip (이름 옆)
      if (p.country) {
        const flag = flagEmoji(p.country);
        if (flag) {
          ctx.font = `700 ${Math.max(16, Math.floor(rowH*0.22))}px system-ui, -apple-system, Segoe UI`;
          const m = ctx.measureText(flag);
          const pad = 10, ch = Math.max(18, Math.floor(rowH*0.32));
          const cy = yRow - Math.floor(ch*0.65);
          let cx = nameX + Math.ceil(ctx.measureText(p.username || 'Anonymous').width) + 12;
          ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(cx, cy, m.width + pad*2, ch);
          ctx.strokeStyle = THEME.chipBorder; ctx.strokeRect(cx+0.5, cy+0.5, m.width + pad*2 -1, ch -1);
          ctx.fillStyle = '#fff'; ctx.textAlign='left';
          ctx.fillText(flag, cx + pad, yRow + Math.floor(nameFont*0.02));
        }
      }

      // elo (우측)
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = `800 ${eloFont}px system-ui, -apple-system, Segoe UI`;
      ctx.fillText(String(p.elo_rating), scoreX, yRow + Math.floor(eloFont*0.35));

      // row-level CTA (닉네임 밑) — Profile / Watch
      const ctaY = Math.min(yRow + rowH/2 - 14, yRow + Math.floor(rowH*0.34));
      let cx = nameX;
      const makeCTA = (id:string, label:string, active=false) => {
        ctx.font = '700 20px system-ui, -apple-system, Segoe UI';
        const m = ctx.measureText(label);
        const w = Math.max(88, Math.ceil(m.width) + 22);
        const h = 28;
        const hovered = hoverId === id;
        const gBtn = ctx.createLinearGradient(0, ctaY, 0, ctaY + h);
        gBtn.addColorStop(0, THEME.chipFillTop);
        gBtn.addColorStop(1, THEME.chipFillBot);
        ctx.beginPath(); drawRoundedRect(ctx, cx, ctaY, w, h, 8);
        ctx.fillStyle = hovered ? THEME.chipHover : gBtn; ctx.fill();
        ctx.lineWidth = 1.6; ctx.strokeStyle = active ? THEME.gold : THEME.chipBorder;
        ctx.beginPath(); drawRoundedRect(ctx, cx, ctaY, w, h, 8); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(label, cx + w/2, ctaY + h/2 + 0.5);
        pushRect(id, cx, ctaY, w, h);
        cx += w + 10;
      };
      makeCTA(`row:profile:${p.id}`, 'Profile');
      makeCTA(`row:watch:${p.id}`, 'Watch', !!(opts?.liveUserIds?.includes(p.id)));

      // 행 전체 히트(향후 확장용)
      pushRect(`row:${p.id}`, left, yRow - rowH/2, right - left, rowH);
    }

    // 상/하 페이드
    const fadeH = 22;
    const ft = ctx.createLinearGradient(0, viewTop, 0, viewTop + fadeH);
    ft.addColorStop(0, THEME.bgTop); ft.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ft; ctx.fillRect(left, viewTop, right-left, fadeH);
    const fb = ctx.createLinearGradient(0, viewBottom - fadeH, 0, viewBottom);
    fb.addColorStop(0, 'rgba(0,0,0,0)'); fb.addColorStop(1, THEME.bgBot);
    ctx.fillStyle = fb; ctx.fillRect(left, viewBottom - fadeH, right-left, fadeH);

    // 스크롤바
    const totalH2 = getSortedList().length * rowH;
    const maxScroll2 = Math.max(0, totalH2 - viewH);
    if (maxScroll2 > 0) {
      const barX = right + 12, barW = 8, barY = viewTop, barH = viewH;
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(barX, barY, barW, barH);
      const thumbH = Math.max(24, (viewH / totalH2) * barH);
      const thumbY = barY + (Math.max(0, Math.min(scrollY, maxScroll2)) / maxScroll2) * (barH - thumbH);
      const tg = ctx.createLinearGradient(0, thumbY, 0, thumbY + thumbH);
      tg.addColorStop(0, THEME.chipFillTop); tg.addColorStop(1, 'rgba(255,255,255,0.5)');
      ctx.fillStyle = tg; ctx.fillRect(barX, thumbY, barW, thumbH);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
      ctx.strokeRect(barX + 0.5, thumbY + 0.5, barW - 1, thumbH - 1);
    }

    textureRef.current!.needsUpdate = true;
  }, [ensure, updatedAt, scrollY, supportersOnly, orderAsc, regionMode, myCountry, searchQuery, hoverId, profiles]);

  // Smoothly scroll to a specific index (needs getSortedList + draw)
  const scrollToIndex = useCallback((index:number, animated=false) => {
    const layout = layoutRef.current; if (!layout) return;
    const totalH = getSortedList().length * layout.rowH;
    const maxScroll = Math.max(0, totalH - layout.viewH);
    const target = Math.max(0, Math.min(index * layout.rowH, maxScroll));
    if (animated) {
      try {
        try { velRef.current = 0; stopPhysics(); } catch {}
        gsap.to({}, { duration: 0.35, ease: 'power2.out', onUpdate: () => {
          setScrollY(s => s + (target - s) * 0.25);
          draw();
        }});
      } catch {
        setScrollY(target); draw();
      }
    } else { setScrollY(target); draw(); }
  }, [profiles, supportersOnly, regionMode, myCountry, searchQuery, orderAsc, draw]);

  // Find current user's index in the sorted list (uses authUserId fallback)
  const getMyRankIndex = useCallback((): number => {
    const list = getSortedList();
    const uid = opts?.currentUserId || authUserId || '';
    if (!uid) return -1;
    return list.findIndex(p => p.id === uid);
  }, [profiles, supportersOnly, regionMode, myCountry, searchQuery, orderAsc, opts?.currentUserId, authUserId]);

  // 저장/자동 새로고침/검색 캐럿 블링크
  useEffect(() => {
    try {
      const ls = localStorage;
      const so = ls.getItem('lb_supportersOnly'); if (so!=null) setSupportersOnly(so==='1');
      const oa = ls.getItem('lb_orderAsc'); if (oa!=null) setOrderAsc(oa==='1');
      const sq = ls.getItem('lb_searchQuery'); if (sq!=null) setSearchQuery(sq);
      const ar = ls.getItem('lb_autoRefresh'); if (ar!=null) setAutoRefresh(ar==='1');
      const rm = ls.getItem('lb_regionMode'); if (rm==='country' || rm==='global') setRegionMode(rm);
      const mc = ls.getItem('lb_myCountry'); if (mc) setMyCountry(mc);
      const ph = ls.getItem('lb_physics'); if (ph!=null) setPhysicsOn(ph==='1');
      const il = ls.getItem('lb_inertia'); if (il==='LOW' || il==='MED' || il==='HIGH') setInertiaLevel(il as any);
    } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem('lb_supportersOnly', supportersOnly?'1':'0'); } catch {} }, [supportersOnly]);
  useEffect(() => { try { localStorage.setItem('lb_orderAsc', orderAsc?'1':'0'); } catch {} }, [orderAsc]);
  useEffect(() => { try { localStorage.setItem('lb_searchQuery', searchQuery); } catch {} }, [searchQuery]);
  useEffect(() => { try { localStorage.setItem('lb_autoRefresh', autoRefresh?'1':'0'); } catch {} }, [autoRefresh]);
  useEffect(() => { try { localStorage.setItem('lb_regionMode', regionMode); } catch {} }, [regionMode]);
  useEffect(() => { try { localStorage.setItem('lb_myCountry', myCountry||''); } catch {} }, [myCountry]);
  useEffect(() => { try { localStorage.setItem('lb_physics', physicsOn?'1':'0'); } catch {} }, [physicsOn]);
  useEffect(() => { try { localStorage.setItem('lb_inertia', inertiaLevel); } catch {} }, [inertiaLevel]);

  useEffect(() => {
    if (!autoRefresh) return; let id:any;
    try { id = setInterval(() => { fetchProfiles().then(draw).catch(()=>{}); }, 10_000); } catch {}
    return () => { if (id) clearInterval(id); };
  }, [autoRefresh, fetchProfiles, draw]);

  useEffect(() => { ensure(); fetchProfiles(); }, [ensure, fetchProfiles]);
  useEffect(() => { draw(); }, [draw]);
  // Cleanup on unmount without referencing stopPhysics before initialization
  useEffect(() => {
    return () => {
      try {
        if (runningRef.current) {
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          rafRef.current = null; runningRef.current = false; lastTsRef.current = null;
        }
      } catch {}
    };
  }, []);

  // 검색 포커스 시 캐럿 블링크
  useEffect(() => {
    if (focus === 'search') {
      if (blinkRef.current) clearInterval(blinkRef.current);
      blinkRef.current = setInterval(draw, 500);
      return () => { clearInterval(blinkRef.current); blinkRef.current = null; };
    } else {
      if (blinkRef.current) { clearInterval(blinkRef.current); blinkRef.current = null; }
    }
  }, [focus, draw]);

  // 상호작용
  const getHitAtPx = useCallback((px:number, py:number) => {
    return buttonRectsRef.current.find(b => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) || null;
  }, []);

  const cycleCountry = useCallback((dir: -1 | 1) => {
    if (!countries.length) return;
    const idx = Math.max(0, countries.findIndex(c => c === myCountry));
    const next = (idx < 0 ? 0 : (idx + (dir===1?1:countries.length-1)) % countries.length);
    setMyCountry(countries[next]);
  }, [countries, myCountry]);

  const handleClickAtUv = useCallback(async (uv: THREE.Vector2) => {
    ensure();
    const c = canvasRef.current!;
    const px = uv.x * c.width;
    const py = (1 - uv.y) * c.height;
    const hit = getHitAtPx(px, py);
    if (!hit) return;

    // 검색 포커스 처리
    if (hit.id === 'btn:search') { setFocus('search'); draw(); return; }
    else if (!hit.id.startsWith('row:')) { if (focus) setFocus(null); }

    if (hit.id === 'btn:refresh') {
      await fetchProfiles(); draw();
    } else if (hit.id === 'btn:auto') {
      setAutoRefresh(v => !v); draw();
    } else if (hit.id === 'btn:sort') {
      setOrderAsc(v => !v); setScrollY(0); draw();
    } else if (hit.id === 'btn:supporters') {
      setSupportersOnly(v => !v); setScrollY(0); draw();
    } else if (hit.id === 'btn:region') {
      setRegionMode(m => m==='global' ? 'country' : 'global'); setScrollY(0); draw();
    } else if (hit.id === 'btn:countryPrev') {
      cycleCountry(-1); setRegionMode('country'); setScrollY(0); draw();
    } else if (hit.id === 'btn:countryNext') {
      cycleCountry(1); setRegionMode('country'); setScrollY(0); draw();
    } else if (hit.id === 'btn:physics') {
      setPhysicsOn(v => {
        const nv = !v;
        if (!nv) { try { velRef.current = 0; } catch {}; try { stopPhysics(); } catch {} }
        return nv;
      });
      draw();
    } else if (hit.id === 'btn:inertia') {
      setInertiaLevel(l => l==='LOW' ? 'MED' : l==='MED' ? 'HIGH' : 'LOW');
      draw();
    } else if (hit.id === 'btn:myrank') {
      const me = getMyRankIndex(); if (me >= 0) { scrollToIndex(me, true); }
    } else if (hit.id === 'btn:top') {
      scrollToIndex(0, true);
    } else if (hit.id === 'btn:50th') {
      scrollToIndex(49, true);
    } else if (hit.id === 'btn:export') {
      exportCsv();
    } else if (hit.id === 'btn:random') {
      const target = pickSpectateTarget(); if (target) handlers?.onRowWatch?.(target);
    } else if (hit.id.startsWith('row:profile:')) {
      const id = hit.id.split(':')[2]; const p = profiles.find(x => x.id === id); if (p) handlers?.onRowProfile?.(p);
    } else if (hit.id.startsWith('row:watch:')) {
      const id = hit.id.split(':')[2]; const p = profiles.find(x => x.id === id); if (p) handlers?.onRowWatch?.(p);
    }
  }, [ensure, fetchProfiles, draw, focus, profiles, cycleCountry, getMyRankIndex, scrollToIndex, exportCsv, pickSpectateTarget, handlers]);

  const handleHoverAtUv = useCallback((uv: THREE.Vector2) => {
    ensure();
    const c = canvasRef.current!;
    const px = uv.x * c.width;
    const py = (1 - uv.y) * c.height;
    const hit = getHitAtPx(px, py);
    setHoverId(prev => (prev === hit?.id ? prev : hit?.id || null));
    if ((hit?.id || null) !== hoverId) draw();
    return !!hit;
  }, [draw, ensure, getHitAtPx, hoverId]);

  const handleHoverLeave = useCallback(() => {
    if (hoverId !== null) { setHoverId(null); draw(); }
  }, [hoverId, draw]);

  // 키보드 입력(검색 창 포커스 상태에서만)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (focus !== 'search') return;
      if (e.defaultPrevented) { e.stopPropagation(); return; }
      const key = e.key;
      if (key === 'Escape') { setFocus(null); e.preventDefault(); e.stopPropagation(); draw(); return; }
      if (key === 'Backspace') { setSearchQuery(q => q.slice(0, -1)); e.preventDefault(); e.stopPropagation(); draw(); return; }
      if (key === 'Enter') { /* 필요 시 첫 결과로 점프 가능 */ e.preventDefault(); e.stopPropagation(); return; }
      if (key.length === 1) {
        const ch = key;
        // 간단한 필터(인쇄 가능한 문자)
        if (/[\p{L}\p{N}\p{P}\p{Zs}]/u.test(ch)) {
          setSearchQuery(q => (q + ch).slice(0, 40));
          e.preventDefault(); e.stopPropagation(); draw(); return;
        }
      }
    };
    window.addEventListener('keydown', onKey as any, true);
    return () => window.removeEventListener('keydown', onKey as any, true);
  }, [focus, draw]);

  // Physics helpers
  const getMaxScrollNow = useCallback(() => {
    const layout = layoutRef.current;
    if (!layout) return 0;
    const totalH = getSortedList().length * layout.rowH;
    const maxScroll = Math.max(0, totalH - layout.viewH);
    return maxScroll;
  }, [getSortedList]);

  const stopPhysics = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null; runningRef.current = false; lastTsRef.current = null;
  }, []);

  const startPhysics = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    lastTsRef.current = null;
    const frictionPerFrame = inertiaLevel === 'LOW' ? 0.88 : inertiaLevel === 'HIGH' ? 0.965 : 0.93; // at ~60fps
    const kSpring = 120; // spring stiffness
    const cDamp = 28;    // edge damping
    const loop = (ts: number) => {
      if (!runningRef.current) return;
      if (lastTsRef.current == null) { lastTsRef.current = ts; rafRef.current = requestAnimationFrame(loop); return; }
      const dt = Math.max(0.001, Math.min(0.05, (ts - (lastTsRef.current||ts)) / 1000));
      lastTsRef.current = ts;

      const decay = Math.pow(frictionPerFrame, dt * 60);
      const max = getMaxScrollNow();

      let p = posRef.current;
      let v = velRef.current * decay; // base friction

      // spring at bounds
      if (p < 0) {
        const x = p; // negative
        const a = -kSpring * x - cDamp * v;
        v += a * dt;
      } else if (p > max) {
        const x = p - max; // positive overshoot
        const a = -kSpring * x - cDamp * v;
        v += a * dt;
      }

      // integrate
      p += v * dt;

      posRef.current = p; velRef.current = v;
      setScrollY(p); draw();

      // stopping condition
      const within = p >= -0.5 && p <= max + 0.5;
      if (within && Math.abs(v) < 3e-2) {
        if (p < 0) p = 0; if (p > max) p = max;
        posRef.current = p; velRef.current = 0; setScrollY(p); draw();
        stopPhysics(); return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [draw, getMaxScrollNow, inertiaLevel, stopPhysics]);

  const handleWheelDelta = useCallback((dy: number) => {
    if (physicsOn) {
      const impulse = (inertiaLevel === 'LOW' ? 600 : inertiaLevel === 'HIGH' ? 1100 : 850);
      posRef.current = typeof scrollY === 'number' ? scrollY : posRef.current;
      velRef.current += dy * impulse;
      if (!runningRef.current) startPhysics();
      return;
    }
    const next = (s:number)=> Math.max(0, s + dy * 0.9);
    gsap.to({}, { duration: 0.22, ease: 'power2.out', onUpdate: () => { setScrollY(s => next(s)); draw(); } });
  }, [physicsOn, inertiaLevel, scrollY, startPhysics, draw]);

  const refreshNow = useCallback(async () => { await fetchProfiles(); draw(); }, [fetchProfiles, draw]);

  return {
    // rendering
    canvasRef, textureRef, hasMap,

    // interactions
    handleClickAtUv, handleHoverAtUv, handleHoverLeave, handleWheelDelta,

    // expose for Scene to lock scroll etc
    refreshNow,

    // states for external info (not used outside now)
    orderAsc, supportersOnly, regionMode, myCountry,
  };
}

/* ===================== Drape + Roll (상단 힌지) ===================== */
function DrapeRollScroll({
  texture, progressRef, edgeRef, drapeRef, clipRef,
  onUvClick, onWheelDelta, onUvMove, onUvLeave
}:{
  texture: THREE.Texture,
  progressRef: React.MutableRefObject<number>,
  edgeRef: React.MutableRefObject<number>,
  drapeRef: React.MutableRefObject<number>,
  clipRef: React.MutableRefObject<number>,
  onUvClick?: (uv: THREE.Vector2) => void,
  onWheelDelta?: (dy:number)=>void,
  onUvMove?: (uv:THREE.Vector2)=>void,
  onUvLeave?: ()=>void,
}){
  const meshRef = useRef<THREE.Mesh>(null!);
  const matRef = useRef<THREE.MeshBasicMaterial>(null!);

  const seg = useMemo(() => {
    let segW = 64, segH = 128;
    try {
      const mem = (navigator as any).deviceMemory || 8;
      const cores = navigator.hardwareConcurrency || 8;
      const small = typeof window !== 'undefined' && window.innerWidth <= 480;
      if (mem <= 4 || cores <= 4 || small) { segW = 40; segH = 80; }
    } catch {}
    return { segW, segH };
  }, []);

  const timeRef = useRef(0);
  useFrame((_, dt)=>{
    timeRef.current += dt;
    const s:any = (matRef.current as any)?.userData?.shader;
    if (!s) return;
    s.uniforms.uRoll.value       = progressRef.current;
    s.uniforms.uEdge.value       = edgeRef.current;
    s.uniforms.uDrape.value      = drapeRef.current;
    s.uniforms.uTime.value       = timeRef.current;
    s.uniforms.uClipAbove.value  = clipRef.current;
  });

  return (
    <mesh
      ref={meshRef}
      position={[0, -DEFORM.planeH/2, 0]} // 상단 힌지
      onPointerDown={(e:any)=>{ if (onUvMove && e.uv) onUvMove(e.uv); }}
      onPointerMove={(e:any)=>{ if (onUvMove && e.uv) onUvMove(e.uv); }}
      onPointerUp={()=>{ onUvLeave?.(); }}
      onPointerLeave={()=>{ onUvLeave?.(); }}
      onWheel={(e:any)=>{ e.stopPropagation(); try{e.nativeEvent?.preventDefault?.()}catch{}; onWheelDelta?.(e.deltaY||0); }}
      onClick={(e:any)=>{ if (onUvClick && e.uv) onUvClick(e.uv); }}
    >
      <planeGeometry args={[DEFORM.planeW, DEFORM.planeH, seg.segW, seg.segH]} />
      <meshBasicMaterial
        ref={matRef}
        map={texture}
        side={THREE.DoubleSide}
        transparent
        toneMapped={false}
        onBeforeCompile={(shader)=>{
          shader.uniforms.uRoll       = { value: 1.0 };
          shader.uniforms.uEdge       = { value: 1.0 };
          shader.uniforms.uRadius     = { value: DEFORM.radius };
          shader.uniforms.uCurlRatio  = { value: DEFORM.curlRatio };
          shader.uniforms.uDrape      = { value: 0.0 };
          shader.uniforms.uSagAmp     = { value: 0.14 };
          shader.uniforms.uSagFreq    = { value: 1.1 };
          shader.uniforms.uHeaderHold = { value: 1.0 };
          shader.uniforms.uTime       = { value: 0.0 };
          shader.uniforms.uClipAbove  = { value: 0.0 };

          shader.vertexShader = `
            uniform float uRoll, uEdge, uRadius, uCurlRatio;
            uniform float uDrape, uSagAmp, uSagFreq, uHeaderHold, uTime;
            varying vec2 vUv;
            varying float vT;
            varying float vBand;
            ${shader.vertexShader}
          `.replace(
            '#include <begin_vertex>',
            `
              #include <begin_vertex>
              vUv = uv;
              float H = ${DEFORM.planeH.toFixed(6)};
              float W = ${DEFORM.planeW.toFixed(6)};
              float t = (transformed.y + H*0.5) / H;
              vT = t;

              // Drape: 천처럼 아래로 늘어짐
              float hold = smoothstep(1.0 - 0.17*uHeaderHold, 1.0, t);
              float drapeW = uDrape * pow(1.0 - t, 1.05) * (1.0 - hold);
              transformed.y -= drapeW * uSagAmp;

              float sx = (transformed.x + W*0.5) / W;
              float belly = (1.0 - cos(3.14159265 * sx)) * 0.5;
              transformed.z += drapeW * uSagAmp * (0.44 * belly);
              float ripple = sin( (sx*6.28318*(1.0+uSagFreq)) + uTime*2.0 ) * exp(-2.2*t);
              transformed.z += drapeW * uSagAmp * 0.12 * ripple;

              // Rolling band
              float bandStart = clamp(uEdge - uCurlRatio, 0.0, 1.0);
              float band = smoothstep(bandStart, uEdge, t);
              band = pow(band, 0.6);
              vBand = band;
              float roll = smoothstep(0.0, 1.0, 1.0 - uRoll);
              float theta = band * roll * ${DEFORM.maxTheta.toFixed(6)};
              transformed.y += (1.0 - cos(theta)) * uRadius;
              transformed.z += sin(theta) * uRadius;

              // trailing fall
              float trailStart = max(0.0, uEdge - 0.20);
              float trail = smoothstep(trailStart, uEdge, t) * (1.0 - band);
              transformed.y += trail * roll * (uRadius * 0.06);
              transformed.z += trail * roll * (uRadius * 0.10);
            `
          );
          shader.fragmentShader = `
            uniform float uEdge;
            uniform float uClipAbove;
            varying vec2 vUv;
            varying float vT;
            varying float vBand;
            ${shader.fragmentShader}
          `.replace(
            'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
            `
              if (uClipAbove > 0.5 && vT > uEdge) discard;
              vec4 base = vec4( outgoingLight, diffuseColor.a );
              float shade = 1.0 - 0.06 * (1.0 - cos(vBand * 3.1415926));
              base.rgb *= shade;
              gl_FragColor = base;
            `
          );
          (matRef.current as any).userData.shader = shader;
        }}
      />
    </mesh>
  );
}

/* ===================== Screen→World anchor helper ===================== */
function screenToWorldOnZPlane(screenX: number, screenY: number, targetZ: number, camera: THREE.Camera, gl: THREE.WebGLRenderer) {
  const rect = gl.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ( (screenX - rect.left) / rect.width ) * 2 - 1,
    - ( (screenY - rect.top) / rect.height ) * 2 + 1
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0,0,1), -targetZ);
  const hit = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, hit);
  return hit;
}

/* ===================== Scene (anchored to button) ===================== */
function Scene({
  open, map, originRef,
  onButtonClick, onWheelDelta, onHover, onHoverLeave
}: {
  open: boolean, map: THREE.Texture, originRef?: React.RefObject<HTMLElement | null>,
  onButtonClick: (uv: THREE.Vector2) => void,
  onWheelDelta: (dy:number)=>void,
  onHover: (uv: THREE.Vector2) => boolean,
  onHoverLeave: ()=>void,
}) {
  const { gl, scene, camera, size } = useThree();

  const progressRef = useRef(0); // 0=말림, 1=펼침
  const edgeRef     = useRef(1); // 1=top, 0=bottom
  const drapeRef    = useRef(0); // 0~1
  const clipRef     = useRef(1); // 0/1

  const rootRef = useRef<THREE.Group>(null!);
  const tilt = -0.12;

  const targetZRef = useRef<number>(0);
  const targetPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, DEFORM.planeH/2 + 0.2, 0));

  useEffect(() => {
    gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    gl.shadowMap.enabled = false;
    if ('outputColorSpace' in (gl as any)) (gl as any).outputColorSpace = THREE.SRGBColorSpace;
    else (gl as any).outputEncoding = THREE.sRGBEncoding;
    scene.background = null;
    try { gl.setClearColor(0x000000 as any, 0); } catch {}
  }, [gl, scene]);

  // 카메라 프레이밍
  useEffect(() => {
    try {
      const fov = (camera as any).fov ?? 40;
      const fovRad = (fov * Math.PI) / 180;
      const aspect = size.width / size.height;
      const hFov = 2 * Math.atan(Math.tan(fovRad / 2) * aspect);
      const zH = (DEFORM.planeH / 2) / Math.tan(fovRad / 2);
      const zW = (DEFORM.planeW / 2) / Math.tan(hFov / 2);
      const desiredZ = Math.max(zH, zW) + 0.7;
      (camera.position as any).z = desiredZ;
      (camera.position as any).x = 0;
      if ((camera.position as any).y == null || Math.abs((camera.position as any).y) < 0.1) {
        (camera.position as any).y = 0.7;
      }
      (camera as any).updateProjectionMatrix?.();
      targetZRef.current = 0;
    } catch {}
  }, [camera, size.width, size.height]);

  const getOriginWorld = useCallback(() => {
    const btnEl = originRef?.current ?? null;
    if (btnEl?.getBoundingClientRect) {
      const rect = btnEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.bottom;
      return screenToWorldOnZPlane(cx, cy, targetZRef.current, camera, gl);
    }
    // fallback: canvas 상단 중앙
    const canvasRect = gl.domElement.getBoundingClientRect();
    const fallbackCx = canvasRect.left + canvasRect.width / 2;
    const fallbackCy = canvasRect.top + 6;
    return screenToWorldOnZPlane(fallbackCx, fallbackCy, targetZRef.current, camera, gl);
  }, [originRef, camera, gl]);

  // 오픈/클로즈 타임라인 — 짧고 역동적으로 (롤업 속도 단축)
  useEffect(() => {
    const r = rootRef.current;
    if (!r) return;

    let raf = 0;
    const kick = () => {
      gsap.killTweensOf([progressRef, edgeRef, drapeRef, clipRef, r.position, r.scale, r.rotation]);

      const originWorld = getOriginWorld();
      const finalPos = targetPosRef.current;

      r.rotation.set(tilt, 0, 0);

      if (open) {
        r.position.copy(originWorld);
        r.scale.set(1, 0.02, 1);
        clipRef.current = 1; edgeRef.current = 1.0; progressRef.current = 0.0; drapeRef.current = 0.0;

        gsap.timeline({ defaults:{ overwrite:'auto' }})
          .to(r.position, { x: finalPos.x, y: finalPos.y, z: finalPos.z, duration: 0.28, ease: 'power3.out' }, 0.00)
          .to(r.scale,    { y: 1.0, duration: 0.22, ease: 'power2.out' }, 0.04)
          .to(clipRef,    { current: 0.0, duration: 0.16, ease: 'power2.out' }, 0.10)
          .to(edgeRef,    { current: 0.86, duration: 0.18, ease: 'power2.out' }, 0.00)
          .to(progressRef,{ current: 1.0, duration: 0.40, ease: 'expo.out' }, 0.06)
          .to(drapeRef,   { current: 1.0, duration: 0.26, ease: 'power2.out' }, 0.12);
      } else {
        gsap.timeline({ defaults:{ overwrite:'auto' }})
          .to(drapeRef,    { current: 0.0, duration: 0.12, ease: 'power1.in' }, 0.00)
          .to(edgeRef,     { current: 1.0, duration: 0.18, ease: 'power2.in' }, 0.02)
          .to(progressRef, { current: 0.0, duration: 0.24, ease: 'power2.inOut' }, 0.02)
          .to(clipRef,     { current: 1.0, duration: 0.14, ease: 'power1.in' }, 0.16)
          .to(r.position,  { x: originWorld.x, y: originWorld.y, z: originWorld.z, duration: 0.24, ease: 'power2.in' }, 0.00)
          .to(r.scale,     { y: 0.02, duration: 0.18, ease: 'power2.in' }, 0.06);
      }
    };

    raf = requestAnimationFrame(kick);
    return () => cancelAnimationFrame(raf);
  }, [open, getOriginWorld]);

  // 열려 있을 때 버튼 이동 추적
  useEffect(() => {
    if (!open) return;
    const r = rootRef.current; if (!r) return;
    const update = () => {
      const w = getOriginWorld();
      gsap.to(r.position, { x:w.x, y:w.y, z:w.z, duration: 0.10, ease: 'power1.out' });
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update as any);
    };
  }, [open, getOriginWorld]);

  const { gl: renderer } = useThree();
  const setCursor = useCallback((hover:boolean)=> {
    try { (renderer.domElement.style as any).cursor = hover ? 'pointer' : 'default'; } catch {}
  }, [renderer.domElement]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <hemisphereLight args={[0xffffff, 0x444444, 0.6]} />
      <directionalLight position={[2.5, 3.5, 2.5]} castShadow={false} intensity={1.05} />

      <group ref={rootRef} rotation={[-0.12, 0, 0]}>
        <DrapeRollScroll
          texture={map}
          progressRef={progressRef}
          edgeRef={edgeRef}
          drapeRef={drapeRef}
          clipRef={clipRef}
          onUvClick={onButtonClick}
          onUvMove={(uv)=>{ const h = onHover(uv); setCursor(h); }}
          onUvLeave={()=>{ onHoverLeave(); setCursor(false); }}
          onWheelDelta={onWheelDelta}
        />
      </group>
    </>
  );
}

/* ===================== Exported Component ===================== */
export default function ScrollLeaderboard3D({
  open, originRef, width = 1024, height = 1536,
  currentUserId, currentCountry, liveUserIds, avatarUrls,
  onRequestSpectate, onRequestProfile,
}: ScrollLeaderboard3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    canvasRef, textureRef, hasMap,
    handleClickAtUv, handleHoverAtUv, handleHoverLeave, handleWheelDelta,
  } = useLeaderboardCanvas(width, height,
    { currentUserId, currentCountry, liveUserIds, avatarUrls },
    {
      onRowProfile: (p) => onRequestProfile?.(p),
      onRowWatch:   (p) => onRequestSpectate?.(p),
    }
  );

  // 전역 스크롤 락 (PageDown/Space/Arrow/Wheel/Touch 완전 차단, 내부만 스크롤)
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    let scrollTop = 0;
    const prev = {
      bodyPos: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      bodyOverflow: body.style.overflow,
      bodyTA: body.style.touchAction,
      rootOverflow: root.style.overflow,
      rootOSBy: root.style.overscrollBehaviorY,
      rootOSB: root.style.overscrollBehavior,
    };
    const isTypingEl = (el: EventTarget | null) => {
      const t = el as HTMLElement | null;
      if (!t) return false;
      const tag = t.tagName;
      return /INPUT|TEXTAREA|SELECT/.test(tag) || t.isContentEditable;
    };
    const blockWheel = (e: WheelEvent) => { if (open) { e.preventDefault(); e.stopPropagation(); } };
    const blockTouch = (e: TouchEvent) => { if (open) { e.preventDefault(); e.stopPropagation(); } };
    const blockKey = (e: KeyboardEvent) => {
      if (!open) return;
      const key = e.key.toLowerCase();
      const blockKeys = ['pagedown','pageup','home','end'];
      const navKeys = ['arrowdown','arrowup',' ','spacebar'];
      const typing = isTypingEl(e.target);
      const shouldBlock = blockKeys.includes(key) || (!typing && navKeys.includes(key));
      if (shouldBlock) { e.preventDefault(); e.stopPropagation(); }
    };
    if (open) {
      scrollTop = window.scrollY || window.pageYOffset || 0;
      body.style.position = 'fixed';
      body.style.top = `-${scrollTop}px`;
      body.style.width = '100%';
      body.style.overflow = 'hidden';
      body.style.touchAction = 'none';
      root.style.overflow = 'hidden';
      root.style.overscrollBehaviorY = 'contain';
      root.style.overscrollBehavior = 'contain';
      window.addEventListener('wheel', blockWheel, { capture: true, passive: false });
      window.addEventListener('touchmove', blockTouch, { capture: true, passive: false });
      window.addEventListener('keydown', blockKey as any, true);
      setTimeout(() => containerRef.current?.focus(), 0);
    }
    return () => {
      window.removeEventListener('wheel', blockWheel as any, true);
      window.removeEventListener('touchmove', blockTouch as any, true);
      window.removeEventListener('keydown', blockKey as any, true);
      body.style.position = prev.bodyPos;
      body.style.top = prev.bodyTop;
      body.style.width = prev.bodyWidth;
      body.style.overflow = prev.bodyOverflow;
      body.style.touchAction = prev.bodyTA;
      root.style.overflow = prev.rootOverflow;
      root.style.overscrollBehaviorY = prev.rootOSBy;
      root.style.overscrollBehavior = prev.rootOSB;
      try { window.scrollTo(0, scrollTop); } catch {}
    };
  }, [open]);

  // 래퍼에서 휠/터치 버블 차단 — 내부 스크롤만
  const stopWheel = (e: React.WheelEvent) => { e.preventDefault(); e.stopPropagation(); };
  const stopTouchMove = (e: React.TouchEvent) => { e.preventDefault(); e.stopPropagation(); };
  const stopPointer = (e: React.PointerEvent) => { e.stopPropagation(); };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="region"
      aria-label="Leaderboard"
      style={{ position:'relative', width:'100%', overflow:'visible' }}
      onWheel={stopWheel}
      onTouchMove={stopTouchMove}
      onPointerDown={stopPointer}
    >
      {/* Canvas wrapper */}
      <div
        style={{
          width: '100%',
          height: 'min(70vh, 720px)',
          borderRadius: 12,
          overflow: 'hidden',
          background: 'transparent',
          overscrollBehavior: 'contain',
          touchAction: 'none',
          position:'relative',
          zIndex:1
        }}
        onWheel={(e:any)=>{ try{e.preventDefault()}catch{}; e.stopPropagation(); handleWheelDelta?.(e.deltaY||0); }}
      >
        {!hasMap && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '100%', height: '100%', color: 'rgba(255,255,255,0.75)',
            background: 'rgba(20,20,20,0.3)'
          }}>Loading leaderboard…</div>
        )}
        {hasMap && textureRef.current && (
          <Canvas
            camera={{ position: [0, 0.7, 2.2], fov: 40 }}
            dpr={[1, 1.8]}
            gl={{ alpha: true, powerPreference: 'high-performance', antialias: false }}
            shadows={false}
          >
            <Scene
              open={open}
              map={textureRef.current}
              originRef={originRef}
              onButtonClick={(uv)=>handleClickAtUv(uv)}
              onWheelDelta={(dy)=>handleWheelDelta(dy)}
              onHover={(uv)=>handleHoverAtUv(uv)}
              onHoverLeave={handleHoverLeave}
            />
          </Canvas>
        )}
        {/* hidden source canvas */}
        <canvas ref={canvasRef} width={width} height={height} style={{ display: 'none' }} />
      </div>
    </div>
  );
}












