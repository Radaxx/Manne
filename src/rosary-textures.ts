import * as THREE from 'three';

// Les textures du chapelet 3D, calculées pixel par pixel (React Native n'a pas de canvas 2D) :
// le bois d'olivier des grains, la nappe de lin, le relief de la médaille et la flaque de lumière.
// Elles sont calculées une seule fois puis gardées en mémoire.

function hash(i: number, j: number, s: number) {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Bruit de valeur qui se raccorde tous les `period` en x (pour faire le tour du grain sans couture). */
function vnoise(x: number, y: number, s: number, period: number) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    xf = x - xi,
    yf = y - yi;
  const u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf);
  const x0 = ((xi % period) + period) % period,
    x1 = (x0 + 1) % period;
  const a = hash(x0, yi, s),
    b = hash(x1, yi, s),
    c = hash(x0, yi + 1, s),
    d = hash(x1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number, s: number, period: number) {
  let t = 0,
    a = 0.5,
    f = 1;
  for (let o = 0; o < 3; o++) {
    t += a * vnoise(x * f, y * f, s + o * 31, period * f);
    f *= 2;
    a *= 0.5;
  }
  return t / 0.875;
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

function texture(data: Uint8Array, w: number, h: number, srgb: boolean, wrap: THREE.Wrapping = THREE.ClampToEdgeWrapping) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = wrap;
  t.wrapT = wrap === THREE.RepeatWrapping ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/** Le bois d'olivier : fond miel et crème, veines brunes ondulées qui font le tour du grain. */
function olive(seed: number) {
  const W = 256,
    H = 128,
    px = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const warp = fbm(u * 2, v * 4.4, seed, 2);
      const warp2 = fbm(u * 10, v * 8, seed + 7, 10);
      const w = v * 16 + warp * 3.2 + warp2 * 0.7;
      const band = Math.abs(Math.sin(w * Math.PI));
      const dark = smooth(0.26, 0, band) * (0.3 + 0.7 * fbm(u * 6, v * 10, seed + 3, 6));
      const fine = (1 - Math.abs(Math.sin(w * Math.PI * 2.7 + warp2 * 2))) ** 12 * 0.28;
      const tone = fbm(u * 3, v * 2.4, seed + 11, 3);
      const heart = smooth(0.45, 0.75, fbm(u * 4, v * 3.2, seed + 21, 4));
      const broad = 0.5 + 0.5 * Math.sin(w * Math.PI * 0.5);
      const shade = broad * 0.3 + heart * 0.45;
      let r = mix(mix(222, 188, tone), 156, shade);
      let g = mix(mix(188, 140, tone), 104, shade);
      let b = mix(mix(132, 82, tone), 56, shade);
      const k = Math.min(1, dark * 0.95 + fine);
      r = mix(r, 58, k);
      g = mix(g, 34, k);
      b = mix(b, 19, k);
      const pore = hash(x, y, seed + 99) < 0.04 ? 0.88 : 1;
      const i = (y * W + x) * 4;
      px[i] = r * pore;
      px[i + 1] = g * pore;
      px[i + 2] = b * pore;
      px[i + 3] = 255;
    }
  }
  return texture(px, W, H, true, THREE.RepeatWrapping);
}

/** La nappe de lin sombre : un tissage serré, fil à fil. */
function linen() {
  const S = 128,
    px = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const warpThread = (x + y) % 2 === 0;
      const thread = warpThread ? hash(x >> 1, 7, 3) : hash(5, y >> 1, 4);
      const v = 0.78 + 0.22 * thread + (hash(x, y, 9) - 0.5) * 0.12 + 0.08 * Math.sin((warpThread ? y : x) * Math.PI * 0.5);
      const i = (y * S + x) * 4;
      px[i] = 22 * v;
      px[i + 1] = 21 * v;
      px[i + 2] = 20 * v;
      px[i + 3] = 255;
    }
  }
  return texture(px, S, S, true, THREE.RepeatWrapping);
}

/** Distance d'un point au segment [a, b]. */
function segment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax,
    dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

/** Le relief de la médaille (carte de relief en niveaux de gris) : un filet, une croix et le monogramme marial. */
function medal() {
  const S = 128,
    px = new Uint8Array(S * S * 4);
  const strokes: [number, number, number, number][] = [
    [-0.2, -0.2, -0.2, 0.12],
    [-0.2, 0.12, 0, -0.08],
    [0, -0.08, 0.2, 0.12],
    [0.2, 0.12, 0.2, -0.2],
    [0, 0.18, 0, 0.36],
    [-0.07, 0.3, 0.07, 0.3],
  ];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S - 0.5,
        v = y / S - 0.5;
      const ring = 1 - smooth(0.012, 0.022, Math.abs(Math.hypot(u, v) - 0.43));
      let d = 1;
      for (const [ax, ay, bx, by] of strokes) d = Math.min(d, segment(u, v, ax, ay, bx, by));
      const letter = 1 - smooth(0.022, 0.034, d);
      const value = 85 + 170 * Math.max(ring * 0.7, letter);
      const i = (y * S + x) * 4;
      px[i] = px[i + 1] = px[i + 2] = value;
      px[i + 3] = 255;
    }
  }
  return texture(px, S, S, false);
}

/** Une tache de lumière chaude, très douce, pour la nappe sous le grain qu'on prie. */
function pool() {
  const S = 64,
    px = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const r = Math.hypot(x + 0.5 - S / 2, y + 0.5 - S / 2) / (S / 2);
      const a = r >= 1 ? 0 : r < 0.35 ? mix(1, 0.45, r / 0.35) : mix(0.45, 0, (r - 0.35) / 0.65);
      const i = (y * S + x) * 4;
      px[i] = 255;
      px[i + 1] = mix(190, 150, r);
      px[i + 2] = mix(95, 45, r);
      px[i + 3] = Math.round(a * 255);
    }
  }
  return texture(px, S, S, true);
}

/** Une ombre douce (noir, transparente sur les bords), posée sous chaque grain. */
function shadow() {
  const S = 64,
    px = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const r = Math.min(1, Math.hypot(x + 0.5 - S / 2, y + 0.5 - S / 2) / (S / 2));
      const i = (y * S + x) * 4;
      px[i] = px[i + 1] = px[i + 2] = 0;
      px[i + 3] = Math.round((1 - smooth(0, 1, r)) * 255);
    }
  }
  return texture(px, S, S, false);
}

export type RosaryTextures = {
  woods: THREE.DataTexture[];
  linen: THREE.DataTexture;
  medal: THREE.DataTexture;
  pool: THREE.DataTexture;
  shadow: THREE.DataTexture;
};

let cache: RosaryTextures | null = null;

export function rosaryTextures(): RosaryTextures {
  if (!cache)
    cache = {
      woods: [13, 26, 39].map(olive),
      linen: linen(),
      medal: medal(),
      pool: pool(),
      shadow: shadow(),
    };
  return cache;
}
