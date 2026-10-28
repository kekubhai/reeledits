import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {EASE, MediaRef, progress, useLayout} from './core';

// ---------- media ----------
// Shows a prepared frame sequence (or a still image) at `time` seconds into the segment.
export const Media: React.FC<{media: MediaRef; time: number; style?: React.CSSProperties}> = ({media, time, style}) => {
  if (!media) return null;
  if (media.type === 'image') return <Img src={staticFile(media.path)} style={style} />;
  const n = Math.min(media.count, Math.max(1, Math.floor(time * media.fps + 1e-6) + 1));
  return <Img src={staticFile(`${media.dir}/${String(n).padStart(5, '0')}.jpg`)} style={style} />;
};

// ---------- text ----------
export const MaskedLine: React.FC<{delay: number; dur?: number; style?: React.CSSProperties; children: React.ReactNode}> = ({delay, dur = 18, style, children}) => {
  const frame = useCurrentFrame();
  const p = progress(frame, delay, dur);
  return (
    <div style={{overflow: 'hidden', paddingBottom: '0.2em', marginBottom: '-0.2em'}}>
      <div style={{transform: `translateY(${(1 - p) * 130}%)`, ...style}}>{children}</div>
    </div>
  );
};

export const Kicker: React.FC<{text: string; delay?: number; index?: string}> = ({text, delay = 0, index}) => {
  const {u, theme} = useLayout();
  const p = progress(useCurrentFrame(), delay, 16);
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 16 * u, opacity: p, transform: `translateX(${(1 - p) * -20 * u}px)`, marginBottom: 28 * u}}>
      {index ? <span style={{fontFamily: theme.display, fontWeight: 700, fontSize: 26 * u, color: theme.accent}}>{index}</span> : null}
      <span style={{width: 40 * u, height: 2 * u, background: theme.accent, opacity: 0.8}} />
      <span style={{fontFamily: theme.body, fontWeight: 600, fontSize: 21 * u, letterSpacing: '0.18em', textTransform: 'uppercase', color: theme.muted}}>{text}</span>
    </div>
  );
};

// ---------- devices ----------
export const PhoneFrame: React.FC<{w: number; h: number; children: React.ReactNode}> = ({w, h, children}) => {
  const {u} = useLayout();
  const b = 13 * u;
  return (
    <div style={{width: w + b * 2, height: h + b * 2, padding: b, borderRadius: 64 * u, background: 'linear-gradient(160deg,#2b2b2f 0%,#121214 45%,#1c1c1f 100%)', boxShadow: `0 0 0 ${1.5 * u}px #3a3a3f, 0 ${60 * u}px ${120 * u}px rgba(0,0,0,0.55)`}}>
      <div style={{width: w, height: h, borderRadius: 51 * u, overflow: 'hidden', position: 'relative', background: '#000'}}>{children}</div>
    </div>
  );
};

export const BrowserFrame: React.FC<{w: number; h: number; url?: string; children: React.ReactNode}> = ({w, h, url, children}) => {
  const {u, theme} = useLayout();
  const bar = 44 * u;
  return (
    <div style={{width: w, borderRadius: 14 * u, overflow: 'hidden', background: '#1b1b1e', boxShadow: `0 0 0 ${1 * u}px rgba(255,255,255,0.12), 0 ${50 * u}px ${100 * u}px rgba(0,0,0,0.45)`}}>
      <div style={{height: bar, display: 'flex', alignItems: 'center', gap: 8 * u, padding: `0 ${16 * u}px`, background: '#232327'}}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
          <div key={c} style={{width: 12 * u, height: 12 * u, borderRadius: 6 * u, background: c}} />
        ))}
        {url ? (
          <div style={{marginLeft: 16 * u, flex: 1, height: 26 * u, borderRadius: 8 * u, background: '#2e2e33', color: '#a8a8b0', fontFamily: theme.body, fontSize: 15 * u, display: 'flex', alignItems: 'center', paddingLeft: 12 * u}}>{url}</div>
        ) : null}
      </div>
      <div style={{width: w, height: h, position: 'relative', overflow: 'hidden', background: '#000'}}>{children}</div>
    </div>
  );
};

// Focus ring + label anchored to a region of the screen (coords 0..1 of the screen).
export const Highlight: React.FC<{x: number; y: number; w: number; h: number; sw: number; sh: number; visible: number; round?: boolean}> = ({x, y, w, h, sw, sh, visible, round}) => {
  const {u, theme} = useLayout();
  return (
    <div style={{position: 'absolute', left: x * sw - 6 * u, top: y * sh - 6 * u, width: w * sw + 12 * u, height: h * sh + 12 * u, borderRadius: round ? 999 : 10 * u, border: `${2.5 * u}px solid ${theme.accent}`, opacity: visible, transform: `scale(${1.2 - visible * 0.2})`, boxShadow: `0 0 ${24 * u}px ${theme.accent}66`}} />
  );
};

export const Chip: React.FC<{text: string; visible: number; style?: React.CSSProperties}> = ({text, visible, style}) => {
  const {u, theme} = useLayout();
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 12 * u, opacity: visible, transform: `translateX(${(1 - visible) * -14 * u}px)`, ...style}}>
      <div style={{width: 42 * visible * u, height: 2 * u, background: theme.accent}} />
      <div style={{fontFamily: theme.body, fontWeight: 600, fontSize: 22 * u, color: theme.accentText, background: theme.accent, padding: `${8 * u}px ${16 * u}px`, borderRadius: 999, whiteSpace: 'nowrap'}}>{text}</div>
    </div>
  );
};

// ---------- transitions ----------
export const Wipe: React.FC<{frames: number}> = ({frames}) => {
  const {theme} = useLayout();
  const frame = useCurrentFrame();
  const p = progress(frame, 0, frames, EASE.inOut);
  const x = -130 + p * 260;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden'}}>
      <div style={{position: 'absolute', top: '-10%', bottom: '-10%', left: `${x}%`, width: '130%', transform: 'skewX(-12deg)', background: theme.accent}} />
    </AbsoluteFill>
  );
};

export const Vignette: React.FC<{strength?: number}> = ({strength = 0.38}) => (
  <AbsoluteFill style={{background: `radial-gradient(ellipse 75% 85% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,${strength}) 100%), linear-gradient(0deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 26%)`}} />
);

export const Glow: React.FC<{x?: string; y?: string; opacity?: number}> = ({x = '50%', y = '50%', opacity = 0.12}) => {
  const {theme} = useLayout();
  const hex = Math.round(opacity * 255).toString(16).padStart(2, '0');
  return <AbsoluteFill style={{background: `radial-gradient(ellipse 50% 55% at ${x} ${y}, ${theme.accent}${hex}, transparent 70%)`}} />;
};

export const useEnter = (kind: string | undefined, frame: number) => {
  const {u} = useLayout();
  const p = progress(frame, 0, 12);
  if (kind === 'fade') return {opacity: p};
  if (kind === 'rise') return {opacity: p, transform: `translateY(${(1 - p) * 60 * u}px)`};
  if (kind === 'zoom') return {opacity: p, transform: `scale(${1.06 - p * 0.06})`};
  return {};
};

export const clampFade = (frame: number, from: number, to: number, fps: number, d = 0.3) =>
  interpolate(frame / fps, [from, from + d, to - d, to], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
