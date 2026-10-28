// Remotion entry for the Studio timeline engine. Props come from a project's
// generated/timeline.resolved.json (passed with --props).
import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {Studio} from './Studio';
import {TimelineProps, totalDuration} from './core';

const sample: TimelineProps = {
  width: 1920,
  height: 1080,
  fps: 30,
  scenes: [
    {type: 'title', duration: 3, kicker: 'Studio', lines: ['Timeline engine', 'is ready.'], accentLine: 1},
    {type: 'endcard', duration: 3, title: 'Studio', sub: 'Pass a timeline with --props.'},
  ],
};

const Root: React.FC = () => (
  <Composition
    id="Studio"
    component={Studio as any}
    defaultProps={sample as any}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={180}
    calculateMetadata={({props}) => {
      const p = props as unknown as TimelineProps;
      return {width: p.width, height: p.height, fps: p.fps, durationInFrames: Math.round(totalDuration(p) * p.fps)};
    }}
  />
);

registerRoot(Root);
