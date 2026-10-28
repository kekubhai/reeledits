import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Chip, BrowserFrame, Glow, Highlight, Kicker, MaskedLine, Media, PhoneFrame, Vignette, clampFade} from './components';
import {EASE, MediaRef, SceneBase, fadeOut, motionDur, progress, settle, useLayout} from './core';

type P = {scene: SceneBase; media: Record<string, MediaRef>};

const Bg: React.FC<{color?: string; glow?: boolean}> = ({color, glow}) => {
  const {theme} = useLayout();
  return (
    <AbsoluteFill style={{background: color || theme.bg}}>
      {glow ? <Glow /> : null}
    </AbsoluteFill>
  );
};

// ---------- title / statement ----------
export const TitleScene: React.FC<P> = ({scene}) => {
  const {u, theme, portrait} = useLayout();
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const align = scene.align || 'center';
  const size = (scene.size || (portrait ? 110 : 120)) * u;
  const sub = progress(frame, motionDur(theme, 14), 18);
  const out = scene.holdToEnd ? 1 : fadeOut(frame, durationInFrames, 8);
  return (
    <AbsoluteFill>
      <Bg color={scene.background} glow={scene.glow ?? true} />
      <AbsoluteFill style={{justifyContent: 'center', alignItems: align === 'center' ? 'center' : 'flex-start', padding: `0 ${(portrait ? 80 : 170) * u}px`, opacity: out}}>
        <div style={{textAlign: align, maxWidth: (portrait ? 920 : 1500) * u}}>
          {scene.kicker ? <div style={{display: 'flex', justifyContent: align === 'center' ? 'center' : 'flex-start'}}><Kicker text={scene.kicker} /></div> : null}
          {(scene.lines || []).map((l: string, i: number) => (
            <MaskedLine key={i} delay={4 + i * motionDur(theme, 5)} style={{fontFamily: theme.display, fontWeight: 700, fontSize: size, lineHeight: 1.04, letterSpacing: '-0.035em', color: i === scene.accentLine ? theme.accent : theme.text}}>
              {l}
            </MaskedLine>
          ))}
          {scene.sub ? <div style={{marginTop: 30 * u, fontFamily: theme.body, fontSize: 36 * u, lineHeight: 1.4, color: theme.muted, opacity: sub, transform: `translateY(${(1 - sub) * 14 * u}px)`}}>{scene.sub}</div> : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- full-frame footage ----------
const zoomAt = (z: any, p: number) => {
  if (!z) return {scale: 1, x: 50, y: 50};
  const [s0, x0, y0] = z.from || [1, 50, 50];
  const [s1, x1, y1] = z.to || [1.08, 50, 50];
  return {scale: s0 + (s1 - s0) * p, x: x0 + (x1 - x0) * p, y: y0 + (y1 - y0) * p};
};

export const FootageScene: React.FC<P> = ({scene, media}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const m = media[scene.media];
  const t = (scene.from || 0) + (frame / fps) * (scene.rate || 1);
  const p = interpolate(frame, [0, durationInFrames], [0, 1], {easing: EASE.inOut});
  const z = zoomAt(scene.zoom, p);
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <AbsoluteFill style={{transform: `scale(${z.scale})`, transformOrigin: `${z.x}% ${z.y}%`}}>
        <Media media={m} time={t} style={{width: '100%', height: '100%', objectFit: scene.fit || 'cover'}} />
      </AbsoluteFill>
      {scene.vignette ? <Vignette /> : null}
    </AbsoluteFill>
  );
};

// Photos fill the frame with a slow Ken Burns; logos/graphics (fit: contain) sit as a
// card on the theme background instead of being letterboxed on black.
export const ImageScene: React.FC<P> = ({scene, media}) => {
  const {u, theme} = useLayout();
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  if (scene.fit !== 'contain') return <FootageScene scene={{...scene, zoom: scene.zoom || {from: [1, 50, 50], to: [1.08, 50, 50]}}} media={media} />;
  const s = settle(frame, fps, 0, motionDur(theme, 26));
  return (
    <AbsoluteFill>
      <Bg color={scene.background} glow />
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity: fadeOut(frame, durationInFrames, 8)}}>
        <div style={{transform: `scale(${0.92 + s * 0.08 + (frame / durationInFrames) * 0.02})`, opacity: s}}>
          <Media media={media[scene.media]} time={0} style={{maxWidth: `${(scene.maxSize || 0.5) * 100}vw`, maxHeight: `${(scene.maxSize || 0.5) * 100}vh`, borderRadius: theme.radius * 2 * u, boxShadow: `0 ${40 * u}px ${90 * u}px rgba(0,0,0,0.45)`, display: 'block'}} />
        </div>
        {scene.caption ? <div style={{marginTop: 40 * u, fontFamily: theme.body, fontSize: 34 * u, color: theme.muted, opacity: progress(frame, 14, 18)}}>{scene.caption}</div> : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- device (screen recording in a frame, with copy) ----------
export const DeviceScene: React.FC<P> = ({scene, media}) => {
  const {u, theme, portrait, width, height} = useLayout();
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const m = media[scene.media];
  const t = (scene.from || 0) + (frame / fps) * (scene.rate || 1);
  const kind = scene.frame || 'phone';
  const srcAspect = m ? m.width / m.height : 16 / 10;
  const hasCopy = scene.title || scene.body || scene.kicker;

  // Screen size: fit the available box.
  const boxW = portrait ? width * 0.86 : hasCopy ? width * 0.5 : width * 0.8;
  // Leave the lower band free for captions when the device is shown alone.
  const boxH = portrait ? (hasCopy ? height * 0.55 : height * 0.66) : hasCopy ? height * 0.8 : height * 0.72;
  let sw = boxW, sh = boxW / srcAspect;
  if (sh > boxH) (sh = boxH), (sw = boxH * srcAspect);
  if (kind === 'browser') sh -= 44 * u;

  const enter = scene.enter === false ? 1 : settle(frame, fps, 0, motionDur(theme, 30));
  const exit = fadeOut(frame, durationInFrames, 9);
  const zoomP = scene.zoom ? progress(frame, (scene.zoom.at || 0) * fps, motionDur(theme, 24), EASE.inOut) - progress(frame, (scene.zoom.until ?? 1e9) * fps, motionDur(theme, 20), EASE.inOut) : 0;
  const zs = 1 + ((scene.zoom?.scale || 1.6) - 1) * zoomP;

  const screen = (
    <div style={{width: sw, height: sh, position: 'relative', overflow: 'hidden'}}>
      <div style={{width: sw, height: sh, transform: `scale(${zs})`, transformOrigin: `${(scene.zoom?.x ?? 0.5) * 100}% ${(scene.zoom?.y ?? 0.5) * 100}%`}}>
        <Media media={m} time={t} style={{width: sw, height: sh, display: 'block', objectFit: 'cover'}} />
        {(scene.highlights || []).map((h: any, i: number) => (
          <Highlight key={i} {...h} sw={sw} sh={sh} visible={clampFade(frame, h.from ?? 0.5, h.to ?? scene.duration - 0.3, fps)} round={h.round} />
        ))}
      </div>
    </div>
  );
  const device = kind === 'phone' ? <PhoneFrame w={sw} h={sh}>{screen}</PhoneFrame> : kind === 'browser' ? <BrowserFrame w={sw} h={sh} url={scene.url}>{screen}</BrowserFrame> : <div style={{borderRadius: theme.radius * u, overflow: 'hidden', boxShadow: `0 ${40 * u}px ${90 * u}px rgba(0,0,0,0.45)`}}>{screen}</div>;
  const chips = (scene.highlights || []).filter((h: any) => h.label);
  const side = scene.side || 'right';
  const copy = hasCopy ? (
    <div style={{width: portrait ? width * 0.84 : width * 0.36, opacity: exit}}>
      {scene.kicker ? <Kicker text={scene.kicker} index={scene.index} /> : null}
      {(scene.title || []).map((l: string, i: number) => (
        <MaskedLine key={i} delay={6 + i * 5} style={{fontFamily: theme.display, fontWeight: 700, fontSize: (portrait ? 84 : 92) * u, lineHeight: 1.03, letterSpacing: '-0.035em', color: theme.text}}>
          {l}
        </MaskedLine>
      ))}
      {scene.body ? <div style={{marginTop: 28 * u, fontFamily: theme.body, fontSize: 30 * u, lineHeight: 1.42, color: theme.muted, opacity: progress(frame, 16, 20)}}>{scene.body}</div> : null}
      {chips.map((h: any, i: number) => (
        <Chip key={i} text={h.label} visible={clampFade(frame, h.from ?? 0.5, h.to ?? scene.duration - 0.3, fps)} style={{marginTop: 26 * u}} />
      ))}
    </div>
  ) : null;

  return (
    <AbsoluteFill>
      <Bg color={scene.background} />
      <Glow x={portrait ? '50%' : side === 'right' ? '68%' : '32%'} y={portrait ? '62%' : '52%'} opacity={0.1} />
      <AbsoluteFill style={{flexDirection: portrait ? 'column' : side === 'right' ? 'row' : 'row-reverse', alignItems: 'center', justifyContent: hasCopy ? 'space-evenly' : 'center', padding: portrait ? `${120 * u}px 0` : 0}}>
        {copy}
        <div style={{opacity: interpolate(enter, [0, 0.3], [0, 1], {extrapolateRight: 'clamp'}) * exit, transform: `translateY(${(1 - enter) * 140 * u}px) scale(${1 + (frame / durationInFrames) * 0.02})`}}>{device}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- bullets ----------
export const BulletsScene: React.FC<P> = ({scene}) => {
  const {u, theme, portrait} = useLayout();
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const items: string[] = scene.items || [];
  const at: number[] = scene.itemAt || items.map((_, i) => 0.8 + i * Math.max(0.6, (scene.duration - 1.5) / Math.max(1, items.length)));
  const out = fadeOut(frame, durationInFrames, 8);
  return (
    <AbsoluteFill>
      <Bg color={scene.background} />
      <AbsoluteFill style={{padding: `${(portrait ? 260 : 150) * u}px ${(portrait ? 80 : 170) * u}px`, opacity: out}}>
        {scene.kicker ? <Kicker text={scene.kicker} /> : null}
        <MaskedLine delay={4} style={{fontFamily: theme.display, fontWeight: 700, fontSize: (portrait ? 80 : 86) * u, lineHeight: 1.05, letterSpacing: '-0.03em', color: theme.text}}>
          {scene.heading}
        </MaskedLine>
        <div style={{marginTop: 56 * u, display: 'flex', flexDirection: 'column', gap: 30 * u}}>
          {items.map((it, i) => {
            const p = progress(frame, at[i] * fps, motionDur(theme, 16));
            const active = frame / fps >= at[i] && (i === items.length - 1 || frame / fps < at[i + 1]);
            return (
              <div key={i} style={{display: 'flex', alignItems: 'flex-start', gap: 26 * u, opacity: p * (scene.dimPast && !active ? 0.45 : 1) + (1 - p) * 0, transform: `translateX(${(1 - p) * 30 * u}px)`}}>
                <div style={{flex: 'none', width: 44 * u, height: 44 * u, borderRadius: 22 * u, background: active ? theme.accent : theme.surface, border: `${2 * u}px solid ${theme.accent}`, color: active ? theme.accentText : theme.accent, fontFamily: theme.display, fontWeight: 700, fontSize: 22 * u, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 4 * u}}>{i + 1}</div>
                <div style={{fontFamily: theme.body, fontWeight: 500, fontSize: (portrait ? 40 : 40) * u, lineHeight: 1.35, color: theme.text}}>{it}</div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- diagram (nodes + edges, revealed over time, optional travelling pulse) ----------
export const DiagramScene: React.FC<P> = ({scene}) => {
  const {u, theme, width, height} = useLayout();
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const t = frame / fps;
  const nodes: any[] = scene.nodes || [];
  const pos = (n: any) => ({x: n.x * width, y: n.y * height});
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const nw = (scene.nodeWidth || 300) * u, nh = (scene.nodeHeight || 120) * u;
  const out = fadeOut(frame, durationInFrames, 8);
  const loop = scene.loop; // {edges:[index...], from: sec, period: sec}
  const activeEdge = loop && t >= loop.from ? loop.edges[Math.floor((t - loop.from) / (loop.period || 1.2)) % loop.edges.length] : -1;
  const edgePulse = loop && t >= loop.from ? ((t - loop.from) % (loop.period || 1.2)) / (loop.period || 1.2) : 0;

  return (
    <AbsoluteFill>
      <Bg color={scene.background} />
      <AbsoluteFill style={{opacity: out}}>
        {scene.title ? (
          <div style={{position: 'absolute', left: 0, right: 0, top: 90 * u, textAlign: 'center'}}>
            <MaskedLine delay={2} style={{fontFamily: theme.display, fontWeight: 700, fontSize: 64 * u, letterSpacing: '-0.03em', color: theme.text}}>{scene.title}</MaskedLine>
          </div>
        ) : null}
        <svg width={width} height={height} style={{position: 'absolute', inset: 0}}>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth={7} markerHeight={7} orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={theme.muted} />
            </marker>
          </defs>
          {(scene.edges || []).map((e: any, i: number) => {
            const a = pos(byId[e.from]), b = pos(byId[e.to]);
            const p = progress(frame, (e.at ?? 0) * fps, motionDur(theme, 18), EASE.inOut);
            const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
            // trim to node box edges
            const k = Math.min(Math.abs((nw / 2 + 14 * u) / (dx || 1e-6)), Math.abs((nh / 2 + 14 * u) / (dy || 1e-6)));
            const sx = a.x + dx * k, sy = a.y + dy * k, ex = b.x - dx * k, ey = b.y - dy * k;
            const bend = (e.curve || 0) * len;
            const mx = (sx + ex) / 2 - (dy / len) * bend, my = (sy + ey) / 2 + (dx / len) * bend;
            const d = `M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`;
            const L = len * 1.1;
            const isActive = i === activeEdge;
            const q = edgePulse, px = (1 - q) * (1 - q) * sx + 2 * (1 - q) * q * mx + q * q * ex, py = (1 - q) * (1 - q) * sy + 2 * (1 - q) * q * my + q * q * ey;
            return (
              <g key={i}>
                <path d={d} fill="none" stroke={isActive ? theme.accent : theme.muted} strokeWidth={3 * u} strokeDasharray={L} strokeDashoffset={L * (1 - p)} markerEnd={p > 0.95 ? 'url(#arrow)' : undefined} opacity={0.9} />
                {isActive ? <circle cx={px} cy={py} r={9 * u} fill={theme.accent} /> : null}
                {e.label && p > 0.5 ? (
                  <text x={mx + (-dy / len) * 30 * u} y={my + (dx / len) * 30 * u + 8 * u} textAnchor="middle" fill={theme.muted} fontFamily={theme.body} fontSize={22 * u} opacity={progress(frame, (e.at ?? 0) * fps + 10, 12)}>{e.label}</text>
                ) : null}
              </g>
            );
          })}
        </svg>
        {nodes.map((n) => {
          const {x, y} = pos(n);
          const s = settle(frame, fps, (n.at ?? 0) * fps, motionDur(theme, 22));
          const lit = loop && activeEdge >= 0 && [scene.edges[activeEdge]?.from, scene.edges[activeEdge]?.to].includes(n.id);
          return (
            <div key={n.id} style={{position: 'absolute', left: x - nw / 2, top: y - nh / 2, width: nw, height: nh, borderRadius: theme.radius * u, background: n.accent || lit ? theme.accent : theme.surface, border: `${2 * u}px solid ${n.accent || lit ? theme.accent : theme.line}`, boxShadow: `0 ${16 * u}px ${40 * u}px rgba(0,0,0,0.12)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: s, transform: `scale(${0.85 + s * 0.15})`}}>
              <div style={{fontFamily: theme.display, fontWeight: 700, fontSize: 34 * u, color: n.accent || lit ? theme.accentText : theme.text}}>{n.label}</div>
              {n.sub ? <div style={{fontFamily: theme.body, fontSize: 21 * u, marginTop: 6 * u, color: n.accent || lit ? theme.accentText : theme.muted}}>{n.sub}</div> : null}
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- end card ----------
export const EndCardScene: React.FC<P> = ({scene}) => {
  const {u, theme, portrait} = useLayout();
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const sub = progress(frame, 22, 20);
  const cta = progress(frame, 36, 20);
  const fade = interpolate(frame, [durationInFrames - (scene.fadeToBlack === false ? 1 : 20), durationInFrames], [1, scene.fadeToBlack === false ? 1 : 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <AbsoluteFill style={{opacity: fade}}>
        <Bg color={scene.background} glow />
        <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: `0 ${80 * u}px`}}>
          <MaskedLine delay={4} style={{fontFamily: theme.display, fontWeight: 700, fontSize: (portrait ? 120 : 150) * u, letterSpacing: '-0.04em', color: theme.text, lineHeight: 1.02}}>{scene.title}</MaskedLine>
          <div style={{height: 6 * u, width: `${progress(frame, 12, 22) * Math.min(520, 60 + (scene.title || '').length * 40) * u}px`, background: theme.accent, borderRadius: 4 * u, marginTop: 22 * u}} />
          {scene.sub ? <div style={{marginTop: 40 * u, fontFamily: theme.body, fontSize: 38 * u, color: theme.muted, opacity: sub, transform: `translateY(${(1 - sub) * 14 * u}px)`}}>{scene.sub}</div> : null}
          {scene.cta ? <div style={{marginTop: 40 * u, fontFamily: theme.body, fontWeight: 600, fontSize: 30 * u, color: theme.accentText, background: theme.accent, padding: `${14 * u}px ${30 * u}px`, borderRadius: 999, opacity: cta, transform: `translateY(${(1 - cta) * 14 * u}px)`}}>{scene.cta}</div> : null}
          {scene.note ? <div style={{marginTop: 24 * u, fontFamily: theme.body, fontSize: 26 * u, color: theme.muted, opacity: cta}}>{scene.note}</div> : null}
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const SCENES: Record<string, React.FC<P>> = {
  title: TitleScene,
  footage: FootageScene,
  image: ImageScene,
  device: DeviceScene,
  bullets: BulletsScene,
  diagram: DiagramScene,
  endcard: EndCardScene,
};
