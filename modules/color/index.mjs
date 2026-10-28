// Colour-correction presets as FFmpeg filter chains. Correct first, then style.
// Each preset is deliberately restrained; UI/screen footage should normally use 'none'.
export const GRADES = {
  none: '',
  // Lift underexposed faces against a bright sky/window; pull highlights in.
  'lift-face': "curves=m='0/0 0.18/0.24 0.45/0.53 0.8/0.84 1/0.94',eq=contrast=1.04:saturation=1.06",
  // Gentle warm, slightly filmic contrast for vlogs and montages.
  warm: "eq=contrast=1.06:saturation=1.08:gamma_r=1.03:gamma_b=0.97,curves=m='0/0.02 0.5/0.5 1/0.97'",
  // Neutral cleanup: small contrast/saturation boost, no hue shift.
  clean: 'eq=contrast=1.04:saturation=1.05',
  // Cool, muted documentary look.
  cool: "eq=contrast=1.05:saturation=0.92:gamma_b=1.03:gamma_r=0.98",
  // Desaturated with protected highlights.
  muted: "eq=saturation=0.82:contrast=1.03,curves=m='0/0.03 1/0.96'",
};

export const DENOISE = {light: 'hqdn3d=1.5:1.5:4:4', medium: 'hqdn3d=3:3:6:6'};

export const gradeChain = ({grade = 'none', denoise, sharpen} = {}) => {
  const parts = [];
  if (denoise) parts.push(DENOISE[denoise] || DENOISE.light);
  if (GRADES[grade] === undefined) throw new Error(`Unknown grade "${grade}". Options: ${Object.keys(GRADES).join(', ')}`);
  if (GRADES[grade]) parts.push(GRADES[grade]);
  if (sharpen) parts.push('unsharp=5:5:0.35');
  return parts.join(',');
};
