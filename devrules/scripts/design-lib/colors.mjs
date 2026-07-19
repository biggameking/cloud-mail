// devrules 共享模块：颜色解析与 WCAG 对比度。
// 支持 hex(#RGB/#RGBA/#RRGGBB/#RRGGBBAA)、rgb()/rgba()、hsl()/hsla()（逗号与空格语法）。
// oklch/oklab 等宽色域格式返回 null（调用方按“无法校验”处理，不报错）。

export function parseColor(input) {
  if (typeof input !== 'string') return null;
  const s = input.trim();

  // hex
  let m = /^#([0-9a-fA-F]{3,8})$/.exec(s);
  if (m) {
    const h = m[1];
    if (h.length === 3 || h.length === 4) {
      const r = parseInt(h[0] + h[0], 16);
      const g = parseInt(h[1] + h[1], 16);
      const b = parseInt(h[2] + h[2], 16);
      const a = h.length === 4 ? parseInt(h[3] + h[3], 16) / 255 : 1;
      return { r, g, b, a };
    }
    if (h.length === 6 || h.length === 8) {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
    return null;
  }

  // rgb()/rgba()
  m = /^rgba?\(\s*([^)]+)\)$/.exec(s);
  if (m) {
    const parts = splitArgs(m[1]);
    if (parts.length < 3) return null;
    const conv = (p, i) => {
      p = p.trim();
      if (p.endsWith('%')) return Math.round(parseFloat(p) * 2.55);
      return i < 3 ? Math.round(parseFloat(p)) : parseFloat(p);
    };
    const r = conv(parts[0], 0), g = conv(parts[1], 1), b = conv(parts[2], 2);
    let a = 1;
    if (parts[3] !== undefined) {
      const p = parts[3].trim();
      a = p.endsWith('%') ? parseFloat(p) / 100 : parseFloat(p);
    }
    if ([r, g, b].some((v) => Number.isNaN(v))) return null;
    return { r, g, b, a };
  }

  // hsl()/hsla()
  m = /^hsla?\(\s*([^)]+)\)$/.exec(s);
  if (m) {
    const parts = splitArgs(m[1]);
    if (parts.length < 3) return null;
    const h = parseFloat(parts[0]);
    const sat = parseFloat(parts[1]) / 100;
    const light = parseFloat(parts[2]) / 100;
    let a = 1;
    if (parts[3] !== undefined) {
      const p = parts[3].trim();
      a = p.endsWith('%') ? parseFloat(p) / 100 : parseFloat(p);
    }
    if ([h, sat, light].some((v) => Number.isNaN(v))) return null;
    const { r, g, b } = hslToRgb(h, sat, light);
    return { r, g, b, a };
  }

  const named = NAMED_COLORS[s.toLowerCase()];
  if (named) return { a: 1, ...named };
  return null;
}

/** 参数切分：兼容 "1, 2, 3"、"1 2 3"、"1 2 3 / 0.5"。 */
function splitArgs(inner) {
  const slash = inner.split('/');
  const main = slash[0].trim();
  const alpha = slash[1]?.trim();
  const parts = main.includes(',') ? main.split(',') : main.split(/\s+/);
  const out = parts.map((p) => p.trim()).filter(Boolean);
  if (alpha !== undefined) out[3] = alpha;
  return out;
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] =
    h < 60 ? [c, x, 0] :
    h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] : [c, 0, x];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function relativeLuminance({ r, g, b }) {
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 对比度（1~21）。任一颜色不可解析返回 null。 */
export function contrastRatio(colorA, colorB) {
  const a = typeof colorA === 'string' ? parseColor(colorA) : colorA;
  const b = typeof colorB === 'string' ? parseColor(colorB) : colorB;
  if (!a || !b) return null;
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** 返回 "r g b" 通道串（供 rgb(var(--x-rgb) / <alpha-value>) 用）；不可解析返回 null。 */
export function rgbChannels(colorStr) {
  const c = parseColor(colorStr);
  if (!c) return null;
  return `${c.r} ${c.g} ${c.b}`;
}

// 常用命名色（够 DESIGN.md 场景使用；生僻命名色建议直接写 hex）
const NAMED_COLORS = {
  white: { r: 255, g: 255, b: 255 },
  black: { r: 0, g: 0, b: 0 },
  transparent: { r: 0, g: 0, b: 0, a: 0 },
  red: { r: 255, g: 0, b: 0 },
  green: { r: 0, g: 128, b: 0 },
  blue: { r: 0, g: 0, b: 255 },
  gray: { r: 128, g: 128, b: 128 },
  grey: { r: 128, g: 128, b: 128 },
};
