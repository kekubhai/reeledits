import {Easing, interpolate, spring} from 'remotion';
import {createContext, useContext} from 'react';

// ---------- theme ----------
export type Theme = {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string; // text colour on top of accent
  line: string;
  display: string; // font-family for headlines
  body: string; // font-family for body/captions
  radius: number; // px at 1080p
  motion: 'snappy' | 'smooth' | 'calm';
};

export const THEMES: Record<string, Theme> = {
  // Dark, high-contrast product look.
  midnight: {bg: '#0A0A0B', surface: '#141416', text: '#F5F5F4', muted: '#A3A3A8', accent: '#FED600', accentText: '#0A0A0B', line: '#2A2A2E', display: "'Space Grotesk', sans-serif", body: "'Inter', sans-serif", radius: 14, motion: 'snappy'},
  // Light, friendly, readable: tutorials and explainers.
  paper: {bg: '#F7F5F0', surface: '#FFFFFF', text: '#16161A', muted: '#5F5F68', accent: '#3355FF', accentText: '#FFFFFF', line: '#DDDAD2', display: "'Space Grotesk', sans-serif", body: "'Inter', sans-serif", radius: 16, motion: 'smooth'},
  // Warm, editorial: vlogs, documentary, recaps.
  film: {bg: '#121010', surface: '#1D1A18', text: '#F3EDE4', muted: '#B3A99B', accent: '#F2A65A', accentText: '#121010', line: '#3A332D', display: "'Space Grotesk', sans-serif", body: "'Inter', sans-serif", radius: 10, motion: 'calm'},
};

export const resolveTheme = (t?: Partial<Theme> & {base?: string}): Theme => ({...THEMES[t?.base || 'midnight'], ...(t || {})});

// ---------- layout context ----------
export type Layout = {width: number; height: number; fps: number; u: number; portrait: boolean; theme: Theme};
export const LayoutCtx = createContext<Layout>(null as any);
export const useLayout = () => useContext(LayoutCtx);

// ---------- motion ----------
export const EASE = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  in: Easing.bezier(0.7, 0, 0.84, 0),
};

export const motionDur = (theme: Theme, base: number) => Math.round(base * ({snappy: 1, smooth: 1.25, calm: 1.6}[theme.motion] || 1));

export const progress = (frame: number, start: number, dur: number, ease = EASE.out) =>
  interpolate(frame, [start, start + Math.max(1, dur)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});

export const settle = (frame: number, fps: number, delay = 0, durationInFrames = 24) =>
  spring({frame: frame - delay, fps, durationInFrames, config: {damping: 200}});

export const fadeOut = (frame: number, total: number, dur = 8) =>
  interpolate(frame, [total - dur, total], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

// ---------- timeline types ----------
export type MediaRef =
  | {type: 'frames'; dir: string; count: number; fps: number; width: number; height: number}
  | {type: 'image'; path: string; width: number; height: number};

export type Cue = {from: number; to: number; text: string};

export type SceneBase = {
  id?: string;
  type: string;
  duration: number; // seconds
  at?: number; // absolute start (seconds); default: after previous scene
  transition?: 'cut' | 'fade' | 'rise' | 'zoom' | 'wipe';
  background?: string;
  [k: string]: any;
};

export type TimelineProps = {
  width: number;
  height: number;
  fps: number;
  theme?: Partial<Theme> & {base?: string};
  media?: Record<string, MediaRef>;
  scenes: SceneBase[];
  overlays?: {
    captions?: Cue[];
    captionStyle?: {variant?: 'box' | 'plain' | 'highlight'; position?: 'bottom' | 'top' | 'middle'; size?: number; maxWidth?: number};
    lowerThirds?: {from: number; to: number; name: string; role?: string}[];
    watermark?: {text: string; position?: 'top-left' | 'top-right' | 'bottom-right'};
    progress?: boolean;
  };
  fonts?: {family: string; src: string; weight?: string; style?: string}[];
};

export const placeScenes = (scenes: SceneBase[]) => {
  let t = 0;
  return scenes.map((s) => {
    const from = s.at ?? t;
    t = from + s.duration;
    return {...s, from, to: t};
  });
};
export const totalDuration = (p: TimelineProps) => Math.max(0.1, ...placeScenes(p.scenes).map((s) => s.to));
