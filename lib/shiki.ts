import { codeToHtml } from "shiki";

export const SHIKI_THEMES = { light: "vitesse-light", dark: "vitesse-dark" } as const;

// Effective block backgrounds: blocks render on --surface (see globals.css).
const LIGHT_BG: RGB = [255, 255, 255];
const DARK_BG: RGB = [24, 34, 43]; // #18222B

type RGB = [number, number, number];

function parseHex(color: string): [RGB, number] | undefined {
  const m = color.match(/^#([0-9a-f]{3,8})$/i);
  if (!m) return undefined;
  let hex = m[1];
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join("");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return [[r, g, b], a];
}

function channelToLinear(v: number): number {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(rgb: RGB): number {
  return (
    0.2126 * channelToLinear(rgb[0]) +
    0.7152 * channelToLinear(rgb[1]) +
    0.0722 * channelToLinear(rgb[2])
  );
}

function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = luminance(a) > luminance(b) ? [a, b] : [b, a];
  return (luminance(hi) + 0.05) / (luminance(lo) + 0.05);
}

/**
 * Syntax themes routinely carry accent colours that fail WCAG AA for small text
 * (the plan's contrast rule applies to code too). Any token colour that does not
 * reach 4.5:1 against the block's background is blended towards black or white
 * until it does — the theme keeps its look, every token keeps its contrast.
 */
function enforceAA(color: string, bg: RGB): string {
  const parsed = parseHex(color);
  if (!parsed) return color;
  const [rgb, alpha] = parsed;
  const effective: RGB =
    alpha < 1 ? (rgb.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha))) as RGB) : rgb;
  if (contrast(effective, bg) >= 4.5) return color;
  const target: RGB = luminance(bg) > 0.18 ? [0, 0, 0] : [255, 255, 255];
  let lo = 0;
  let hi = 1;
  let best: RGB = effective;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const blended = effective.map((v, j) => Math.round(v + (target[j] - v) * mid)) as RGB;
    if (contrast(blended, bg) >= 4.5) {
      hi = mid;
      best = blended;
    } else {
      lo = mid;
    }
  }
  return `#${best.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Shiki with both theme colours, light and dark (the site has a manual theme
 * toggle, so highlighting must not depend on prefers-color-scheme). Shiki emits
 * `--shiki-light`/`--shiki-dark` variables on every single span; here they are
 * deduplicated into per-block classes, adjacent same-style spans are merged, and
 * AA-unsafe token colours are fixed. The classes only define custom properties,
 * so the cascade in globals.css stays simple.
 */
export async function highlight(code: string, lang: string): Promise<string> {
  const raw = await codeToHtml(code, { lang, themes: SHIKI_THEMES, defaultColor: false });
  const seen = new Map<string, string>();
  let css = "";
  let body = raw.replace(/<span style="([^"]+)">/g, (match, style: string) => {
    if (!style.includes("--shiki-light")) return match;
    const fixed = style
      .replace(
        /--shiki-light:(#[0-9a-fA-F]+)/g,
        (_, c) => `--shiki-light:${enforceAA(c, LIGHT_BG)}`,
      )
      .replace(/--shiki-dark:(#[0-9a-fA-F]+)/g, (_, c) => `--shiki-dark:${enforceAA(c, DARK_BG)}`);
    let cls = seen.get(fixed);
    if (!cls) {
      cls = `s${seen.size}`;
      seen.set(fixed, cls);
      css += `.${cls}{${fixed}}`;
    }
    return `<span class="${cls}">`;
  });
  // merge adjacent spans that ended up with the same (deduplicated) class
  for (let prev = ""; prev !== body;) {
    prev = body;
    body = body.replace(
      /<span class="(s\d+)">([^<]*)<\/span><span class="\1">([^<]*)<\/span>/g,
      '<span class="$1">$2$3</span>',
    );
  }
  // keep the hoisted styles next to the block they belong to
  return body.replace(/(<pre[^>]*>)/, `$1<style>${css}</style>`);
}
