import React, {useEffect, useState} from 'react';
import {AbsoluteFill, Sequence, continueRender, delayRender, staticFile, useCurrentFrame} from 'remotion';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import {LayoutCtx, TimelineProps, placeScenes, resolveTheme} from './core';
import {Wipe, useEnter} from './components';
import {SCENES} from './scenes';
import {Captions, LowerThird, ProgressBar, Watermark} from './overlays';

const WIPE = 16;

const useFonts = (fonts: TimelineProps['fonts'] = []) => {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    const custom = fonts.map((f) => {
      const face = new FontFace(f.family, `url(${staticFile(f.src)})`, {weight: f.weight || '400', style: f.style || 'normal'});
      return face.load().then((loaded) => (document.fonts as any).add(loaded));
    });
    const builtin = ['400 20px Inter', '500 20px Inter', '600 20px Inter', '500 20px "Space Grotesk"', '700 20px "Space Grotesk"'].map((f) => document.fonts.load(f));
    Promise.all([...custom, ...builtin]).then(() => continueRender(handle), () => continueRender(handle));
  }, [handle]);
};

const SceneWrap: React.FC<{transition?: string; children: React.ReactNode}> = ({transition, children}) => {
  const style = useEnter(transition, useCurrentFrame());
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};

// Generic, data-driven composition: every visual decision comes from the timeline JSON.
export const Studio: React.FC<TimelineProps> = (props) => {
  useFonts(props.fonts);
  const {width, height, fps} = props;
  const theme = resolveTheme(props.theme);
  const layout = {width, height, fps, u: Math.min(width, height) / 1080, portrait: height > width, theme};
  const placed = placeScenes(props.scenes);
  const media = props.media || {};
  const ov = props.overlays || {};
  return (
    <LayoutCtx.Provider value={layout}>
      <AbsoluteFill style={{background: theme.bg}}>
        {placed.map((s, i) => {
          const Comp = SCENES[s.type];
          if (!Comp) throw new Error(`Unknown scene type "${s.type}". Known: ${Object.keys(SCENES).join(', ')}`);
          return (
            <Sequence key={s.id || i} from={Math.round(s.from * fps)} durationInFrames={Math.max(1, Math.round((s.to - s.from) * fps))} name={s.id || s.type}>
              <SceneWrap transition={s.transition}>
                <Comp scene={s} media={media} />
              </SceneWrap>
            </Sequence>
          );
        })}
        {ov.lowerThirds?.map((l, i) => <LowerThird key={i} {...l} />)}
        {ov.captions?.length ? <Captions cues={ov.captions} style={ov.captionStyle} /> : null}
        {ov.watermark ? <Watermark {...ov.watermark} /> : null}
        {ov.progress ? <ProgressBar /> : null}
        {placed
          .filter((s) => s.transition === 'wipe')
          .map((s, i) => (
            <Sequence key={`w${i}`} from={Math.max(0, Math.round(s.from * fps) - WIPE / 2)} durationInFrames={WIPE}>
              <Wipe frames={WIPE} />
            </Sequence>
          ))}
      </AbsoluteFill>
    </LayoutCtx.Provider>
  );
};
