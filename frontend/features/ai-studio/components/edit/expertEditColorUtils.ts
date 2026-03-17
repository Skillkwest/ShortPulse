/**
 * Shared color parsing and HSV/RGB conversion helpers for Expert Edit surfaces.
 */

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

export type HsvColor = {
  h: number;
  s: number;
  v: number;
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const parseHexColor = (value: string): RgbColor | null => {
  const normalized = value.trim();
  const match = /^#?([0-9a-f]{6})$/i.exec(normalized);
  if (!match) return null;
  const hex = match[1];
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  if (![r, g, b].every((channel) => Number.isFinite(channel))) {
    return null;
  }
  return { r, g, b };
};

export const rgbToHex = ({ r, g, b }: RgbColor) =>
  `#${[r, g, b]
    .map((channel) => clampNumber(Math.round(channel), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;

export const rgbToHsv = ({ r, g, b }: RgbColor): HsvColor => {
  const red = clampNumber(r / 255, 0, 1);
  const green = clampNumber(g / 255, 0, 1);
  const blue = clampNumber(b / 255, 0, 1);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === red) {
      hue = ((green - blue) / delta) % 6;
    } else if (max === green) {
      hue = (blue - red) / delta + 2;
    } else {
      hue = (red - green) / delta + 4;
    }
    hue *= 60;
    if (hue < 0) {
      hue += 360;
    }
  }
  const saturation = max === 0 ? 0 : delta / max;
  return {
    h: clampNumber(hue, 0, 360),
    s: clampNumber(saturation, 0, 1),
    v: clampNumber(max, 0, 1),
  };
};

export const hsvToRgb = ({ h, s, v }: HsvColor): RgbColor => {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clampNumber(s, 0, 1);
  const value = clampNumber(v, 0, 1);
  const chroma = value * saturation;
  const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = value - chroma;

  let red = 0;
  let green = 0;
  let blue = 0;

  if (hue < 60) {
    red = chroma;
    green = second;
  } else if (hue < 120) {
    red = second;
    green = chroma;
  } else if (hue < 180) {
    green = chroma;
    blue = second;
  } else if (hue < 240) {
    green = second;
    blue = chroma;
  } else if (hue < 300) {
    red = second;
    blue = chroma;
  } else {
    red = chroma;
    blue = second;
  }

  return {
    r: Math.round((red + match) * 255),
    g: Math.round((green + match) * 255),
    b: Math.round((blue + match) * 255),
  };
};

export const hexToHsv = (value: string): HsvColor => {
  const parsed = parseHexColor(value);
  if (!parsed) {
    return { h: 0, s: 0, v: 1 };
  }
  return rgbToHsv(parsed);
};
