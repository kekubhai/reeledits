import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Cue, TimelineProps, progress, useLayout} from './core';

export const Captions: React.FC<{cues: Cue[]; style?: NonNullable<TimelineProps['overlays']>['captionStyle']}> = ({cues, style = {}}) => {
  const {u, theme, portrait} = useLayout();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const c = cues.find((c) => t >= c.from && t < c.to);
  if (!c) return null;
  const f = frame - c.from * fps;
  const len = (c.to - c.from) * fps;
  const opacity = interpolate(f, [0, 4, len - 4, len], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const variant = style.variant || 'box';
  const size = (style.size || (portrait ? 46 : 38)) * u;
  const pos = style.position || 'bottom';
  const words = c.text.split(' ');
  // Highlight: words light up in proportion to elapsed time (no word timings needed).
  const spoken = variant === 'highlight' ? Math.floor(((t - c.from) / (c.to - c.from)) * words.length * 1.15) : words.length;
  return (
    <div style={{position: 'absolute', left: 0, right: 0, ...(pos === 'top' ? {top: 80 * u} : pos === 'middle' ? {top: '58%'} : {bottom: (portrait ? 330 : 70) * u}), display: 'flex', justifyContent: 'center', opacity}}>
      <div style={{maxWidth: (style.maxWidth || (portrait ? 900 : 1300)) * u, textAlign: 'center', padding: variant === 'plain' ? 0 : `${12 * u}px ${26 * u}px`, borderRadius: 14 * u, background: variant === 'plain' ? 'transparent' : 'rgba(10,10,11,0.78)', fontFamily: theme.body, fontWeight: 600, fontSize: size, lineHeight: 1.3, color: '#F5F5F4', textShadow: variant === 'plain' ? `0 ${2 * u}px ${12 * u}px rgba(0,0,0,0.8)` : 'none'}}>
        {variant === 'highlight'
          ? words.map((w, i) => (
              <span key={i} style={{color: i < spoken ? '#FFFFFF' : 'rgba(245,245,244,0.42)'}}>
                {w}{' '}
              </span>
            ))
          : c.text}
      </div>
    </div>
  );
};

export const LowerThird: React.FC<{name: string; role?: string; from: number; to: number}> = ({name, role, from, to}) => {
  const {u, theme} = useLayout();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const inP = progress(frame, from * fps, 20);
  const out = interpolate(frame / fps, [to - 0.4, to], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  if (frame / fps < from || frame / fps > to) return null;
  return (
    <div style={{position: 'absolute', left: 110 * u, top: 110 * u, display: 'flex', gap: 20 * u, opacity: out}}>
      <div style={{width: 6 * u, background: theme.accent, borderRadius: 3 * u, transform: `scaleY(${inP})`, transformOrigin: 'top'}} />
      <div style={{padding: `${10 * u}px ${22 * u}px ${12 * u}px ${18 * u}px`, background: 'rgba(10,10,11,0.72)', borderRadius: 10 * u, opacity: inP, transform: `translateX(${(1 - inP) * -40 * u}px)`}}>
        <div style={{fontFamily: theme.display, fontWeight: 700, fontSize: 40 * u, color: '#F5F5F4', lineHeight: 1.1}}>{name}</div>
        {role ? <div style={{fontFamily: theme.body, fontSize: 24 * u, color: '#CFCFD3', marginTop: 4 * u}}>{role}</div> : null}
      </div>
    </div>
  );
};

export const Watermark: React.FC<{text: string; position?: string}> = ({text, position = 'top-right'}) => {
  const {u, theme} = useLayout();
  const [v, h] = position.split('-');
  return (
    <div style={{position: 'absolute', [v]: 54 * u, [h]: 64 * u, fontFamily: theme.display, fontWeight: 700, fontSize: 24 * u, letterSpacing: '0.08em', color: theme.text, opacity: 0.7}}>{text}</div>
  );
};

export const ProgressBar: React.FC = () => {
  const {u, theme} = useLayout();
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  return <div style={{position: 'absolute', left: 0, bottom: 0, height: 6 * u, width: `${(frame / durationInFrames) * 100}%`, background: theme.accent}} />;
};
