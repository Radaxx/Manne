import type { ExpoWebGLRenderingContext } from 'expo-gl';
import * as THREE from 'three';
import type { RosaryColorId } from './appearance';
import { litBead, type RosaryStep } from './rosary';
import { rosaryTextures } from './rosary-textures';

// Le chapelet en bois d'olivier, en 3D, posé sur une nappe de lin. La caméra suit le grain qu'on prie
// le long de la chaîne ; les grains priés gardent une lueur dorée. Même numérotation que src/rosary.tsx :
// 0 la croix, 1 à 5 le pendentif, 6 + d × 11 les dizaines (précédées de leur gros grain), 60 la médaille.

export type RosaryView = {
  steps: RosaryStep[];
  index: number;
  finished: boolean;
  peek: boolean;
};

export type RosaryScene = {
  setView(view: RosaryView): void;
  /** Le geste en cours : de -1 (vers le haut, revenir) à 1 (vers le bas, avancer) ; 0 au relâchement. */
  setDrag(progress: number): void;
  setActive(active: boolean): void;
  dispose(): void;
};

const MEDAL = 60;
const BG = 0x0d0e12;
const GOLD = new THREE.Color(0xffb547);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

const isBig = (b: number) => b === 1 || (b >= 5 && b < MEDAL && (b - 5) % 11 === 0);
const radius = (b: number) => (b === MEDAL ? 0.3 : b === 0 ? 0 : isBig(b) ? 0.25 : 0.17);
/** Position sur le fil physique : croix, pendentif, médaille, boucle, et retour à la médaille. */
const pathIndex = (b: number) => (b <= 5 ? b : b + 1);

// Comme sur un vrai chapelet : les grains d'une dizaine se touchent presque,
// et un bout de chaîne isole chaque Notre Père, la médaille et la croix.
function spacing(a: number, b: number) {
  const ends = (x: number) => x === MEDAL || x === 0;
  const gap = a === MEDAL || b === MEDAL ? 0.45 : a === 0 || b === 0 ? 0.7 : !isBig(a) && !isBig(b) && !ends(a) && !ends(b) ? 0.03 : 0.42;
  return radius(a) + radius(b) + gap;
}

/** Le centre de chaque grain, posé sur la nappe. */
function layout() {
  const loopOrder = [MEDAL, ...Array.from({ length: 54 }, (_, k) => k + 6), MEDAL];
  const marks = [0];
  for (let i = 1; i < loopOrder.length; i++) marks.push(marks[i - 1] + spacing(loopOrder[i - 1], loopOrder[i]));
  // La boucle suit une forme un peu irrégulière, comme un chapelet qu'on vient de poser.
  const shape = (th: number) => {
    const r = 1 + 0.055 * Math.sin(2 * th + 0.7) + 0.03 * Math.sin(3 * th + 1.9);
    return new THREE.Vector3(r * Math.cos(th), 0, r * Math.sin(th));
  };
  const SAMPLES = 720,
    pts: THREE.Vector3[] = [],
    acc = [0];
  for (let i = 0; i <= SAMPLES; i++) {
    pts.push(shape(Math.PI / 2 + (i / SAMPLES) * Math.PI * 2));
    if (i > 0) acc.push(acc[i - 1] + pts[i].distanceTo(pts[i - 1]));
  }
  const scale = marks[marks.length - 1] / acc[SAMPLES];
  const onLoop = (d: number) => {
    const target = d / scale;
    let i = 1;
    while (i < SAMPLES && acc[i] < target) i++;
    const t = (target - acc[i - 1]) / (acc[i] - acc[i - 1] || 1);
    return pts[i - 1].clone().lerp(pts[i], t).multiplyScalar(scale);
  };
  const centers: THREE.Vector3[] = [];
  loopOrder.slice(0, -1).forEach((b, i) => {
    centers[b] = onLoop(marks[i]);
  });
  // Le pendentif, de la médaille (ovale, plus longue dans ce sens) vers la croix.
  let along = 0,
    prev = MEDAL;
  for (const b of [5, 4, 3, 2, 1, 0]) {
    along += spacing(prev, b) + (prev === MEDAL ? 0.09 : 0);
    const p = centers[MEDAL].clone();
    p.z += along;
    p.x += 0.32 * Math.sin(along * 0.4);
    centers[b] = p;
    prev = b;
  }
  centers.forEach((c, b) => {
    c.y = b === MEDAL ? 0.03 : b === 0 ? 0.05 : radius(b);
  });
  return centers;
}

/**
 * Crée la scène dans le contexte d'un GLView. Lève une erreur si le téléphone n'offre pas WebGL 2 ;
 * onError est appelé si le rendu échoue plus tard (la boucle s'arrête alors d'elle-même).
 */
export function createRosaryScene(
  gl: ExpoWebGLRenderingContext,
  { reducedMotion, onError, material = 'olive' }: { reducedMotion: boolean; onError?: (e: unknown) => void; material?: RosaryColorId },
): RosaryScene {
  const g = globalThis as { WebGLRenderingContext?: unknown; WebGL2RenderingContext?: new () => unknown };
  if (!g.WebGL2RenderingContext || !(gl instanceof g.WebGL2RenderingContext)) throw new Error('WebGL 2 indisponible sur ce téléphone');

  const width = gl.drawingBufferWidth,
    height = gl.drawingBufferHeight;

  // three.js attend un canvas : on lui en donne l'essentiel, comme le fait React Three Fiber sur mobile.
  const canvas = {
    width,
    height,
    style: {},
    clientWidth: width,
    clientHeight: height,
    getContext: () => gl,
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as HTMLCanvasElement;
  // expo-gl ne gère que UNPACK_FLIP_Y_WEBGL : on ignore les autres réglages au lieu d'afficher un avertissement.
  const pixelStorei = gl.pixelStorei.bind(gl);
  gl.pixelStorei = (pname: number, param: number | boolean) => {
    if (pname === gl.UNPACK_FLIP_Y_WEBGL) pixelStorei(pname, param as number);
  };

  // expo-gl fait hériter son contexte WebGL 2 de WebGLRenderingContext (comme le dit la spécification),
  // et three.js le prend alors pour du WebGL 1 et refuse de démarrer : on masque ce test le temps de la création.
  const webgl1 = g.WebGLRenderingContext;
  g.WebGLRenderingContext = undefined;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, context: gl as unknown as WebGL2RenderingContext, antialias: true });
  } finally {
    g.WebGLRenderingContext = webgl1;
  }
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  const aniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 10, 26);
  const fog = scene.fog as THREE.Fog;
  const camera = new THREE.PerspectiveCamera(52, width / height, 0.05, 120);
  const tex = rosaryTextures(material);

  // Reflets : un petit studio (boîte à lumière chaude au-dessus, contre-jour froid) précalculé, si le téléphone sait le faire.
  const ext = renderer.extensions;
  if (ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float')) {
    try {
      const env = new THREE.Scene();
      env.add(
        new THREE.Mesh(
          new THREE.BoxGeometry(20, 20, 20),
          new THREE.MeshBasicMaterial({
            color: 0x0b0b0d,
            side: THREE.BackSide,
          }),
        ),
      );
      const panel = (w: number, h: number, color: number, k: number, pos: [number, number, number]) => {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(w, h),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(color).multiplyScalar(k),
            side: THREE.DoubleSide,
          }),
        );
        m.position.set(...pos);
        m.lookAt(0, 0, 0);
        env.add(m);
      };
      panel(8, 5, 0xffe2b8, 5, [-2, 8, 2]);
      panel(4, 6, 0x9fb4ff, 1.2, [8, 3, -4]);
      panel(6, 2, 0xffc77a, 1.6, [0, 2, 9]);
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(env, 0.04).texture;
      pmrem.dispose();
    } catch {
      scene.environment = null;
    }
  }

  scene.add(new THREE.HemisphereLight(0xffe9cc, BG, scene.environment ? 0.25 : 0.6));
  const key = new THREE.DirectionalLight(0xffe0b0, 1.5);
  key.position.set(-5, 11, 5);
  key.target.position.set(0, 0, 2);
  scene.add(key, key.target);
  const glowLight = new THREE.PointLight(0xffa53a, 0, 3, 2);
  scene.add(glowLight);

  // Une flaque de lumière chaude sur la nappe, sous le grain qu'on prie.
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 1.9),
    new THREE.MeshBasicMaterial({
      map: tex.pool,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.004;
  scene.add(pool);

  const linen = tex.linen.clone();
  linen.repeat.set(80, 80);
  linen.anisotropy = aniso;
  linen.needsUpdate = true;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({
      map: linen,
      roughness: 0.96,
      metalness: 0,
      bumpMap: linen,
      bumpScale: 0.4,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const woodMat = (i: number) => {
    const t = tex.woods[i % tex.woods.length];
    return new THREE.MeshPhysicalMaterial({
      map: t,
      bumpMap: t,
      bumpScale: 0.2,
      roughness: 0.44,
      clearcoat: 0.6,
      clearcoatRoughness: 0.26,
      envMapIntensity: 0.8,
      emissive: GOLD,
      emissiveMap: t,
      emissiveIntensity: 0,
    });
  };
  const brass = new THREE.MeshStandardMaterial({
    color: 0xc9a465,
    metalness: 1,
    roughness: 0.32,
    envMapIntensity: 1.1,
  });
  if (!scene.environment) brass.roughness = 0.45;

  const centers = layout();
  const glowMats: THREE.MeshStandardMaterial[][] = [];
  const glow: number[] = [];

  const smallGeo = new THREE.SphereGeometry(0.17, 32, 24),
    bigGeo = new THREE.SphereGeometry(0.25, 40, 28);
  for (let b = 1; b < MEDAL; b++) {
    const m = new THREE.Mesh(isBig(b) ? bigGeo : smallGeo, woodMat(b));
    m.position.copy(centers[b]);
    // Chaque grain est tourné au hasard (mais toujours de la même façon) pour varier le veinage.
    m.rotation.set((((b * 37) % 11) / 11) * Math.PI, (((b * 53) % 13) / 13) * Math.PI * 2, (((b * 17) % 7) / 7 - 0.5) * 0.6);
    scene.add(m);
    glowMats[b] = [m.material];
    glow[b] = 0;
  }

  // La croix, en olivier avec des embouts de laiton.
  {
    const dir = centers[0].clone().sub(centers[1]).setY(0).normalize();
    const g = new THREE.Group();
    g.position.copy(centers[0]).setY(0);
    g.rotation.y = Math.atan2(dir.x, dir.z);
    const mat = woodMat(7);
    const part = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
      const p = new THREE.Mesh(geo, m);
      p.position.set(x, y, z);
      g.add(p);
    };
    part(new THREE.BoxGeometry(0.16, 0.1, 1.2), mat, 0, 0.05, 0.66);
    part(new THREE.BoxGeometry(0.76, 0.1, 0.16), mat, 0, 0.051, 0.4);
    const cap = new THREE.BoxGeometry(0.19, 0.12, 0.07);
    part(cap, brass, 0, 0.06, 1.25);
    part(cap, brass, 0, 0.06, 0.09);
    const capSide = new THREE.BoxGeometry(0.07, 0.12, 0.19);
    part(capSide, brass, 0.4, 0.06, 0.4);
    part(capSide, brass, -0.4, 0.06, 0.4);
    part(new THREE.CylinderGeometry(0.075, 0.075, 0.13, 24), brass, 0, 0.06, 0.4);
    part(new THREE.TorusGeometry(0.06, 0.014, 8, 20), brass, 0, 0.06, 0);
    scene.add(g);
    glowMats[0] = [mat];
    glow[0] = 0;
  }

  // La médaille de laiton, ovale, avec son relief.
  {
    const top = brass.clone();
    top.bumpMap = tex.medal;
    top.bumpScale = 3;
    top.emissive = GOLD.clone();
    const side = brass.clone();
    side.emissive = GOLD.clone();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 48), [side, top, side]);
    disc.scale.z = 1.3;
    disc.position.copy(centers[MEDAL]);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.02, 8, 48), side);
    rim.rotation.x = Math.PI / 2;
    rim.scale.y = 1.3;
    rim.position.copy(centers[MEDAL]).setY(0.05);
    scene.add(disc, rim);
    glowMats[MEDAL] = [top, side];
    glow[MEDAL] = 0;
  }

  // La chaîne : des maillons de laiton entre chaque grain, qui retombent sur la nappe.
  {
    const LINK_R = 0.036,
      LINK_TUBE = 0.0105,
      LINK_PITCH = 0.085;
    const order = [0, 1, 2, 3, 4, 5, MEDAL, ...Array.from({ length: 54 }, (_, k) => k + 6), MEDAL];
    const links: THREE.Matrix4[] = [];
    const X = new THREE.Vector3(1, 0, 0),
      q = new THREE.Quaternion(),
      roll = new THREE.Quaternion(),
      stretch = new THREE.Vector3(1.45, 1, 1);
    for (let i = 0; i < order.length - 1; i++) {
      const a = order[i],
        b = order[i + 1];
      const A = centers[a].clone(),
        B = centers[b].clone();
      if (a === 0) A.setY(0.06);
      const flat = B.clone().sub(A).setY(0);
      const dir = flat.clone().normalize();
      const ra = a === 0 ? 0.03 : radius(a) * 0.85,
        rb = radius(b) * 0.85;
      const usable = flat.length() - ra - rb;
      if (usable <= 0.02) continue;
      const sag = Math.max(A.y, B.y);
      // On mesure la chaîne le long de sa vraie courbe (elle descend du grain jusqu'à la nappe) pour que les maillons se suivent sans trou.
      const STEPS = 32,
        pts: THREE.Vector3[] = [],
        acc = [0];
      for (let j = 0; j <= STEPS; j++) {
        const u = j / STEPS;
        const p = A.clone().addScaledVector(dir, ra + usable * u);
        p.y = Math.max(LINK_TUBE, mix(A.y, B.y, u) - sag * 4 * u * (1 - u) * 1.1);
        pts.push(p);
        if (j > 0) acc.push(acc[j - 1] + p.distanceTo(pts[j - 1]));
      }
      const total = acc[STEPS];
      const along = (d: number) => {
        let j = 1;
        while (j < STEPS && acc[j] < d) j++;
        const t = (d - acc[j - 1]) / (acc[j] - acc[j - 1] || 1);
        return pts[j - 1].clone().lerp(pts[j], t);
      };
      const n = Math.max(1, Math.round(total / LINK_PITCH));
      for (let j = 0; j < n; j++) {
        const d = ((j + 0.5) / n) * total;
        const p = along(d);
        const t = along(Math.min(total, d + 0.02))
          .sub(along(Math.max(0, d - 0.02)))
          .normalize();
        // Un maillon sur deux est debout (le tore est dans son plan XY), l'autre couché : aucun ne s'enfonce dans la nappe.
        const upright = links.length % 2 === 1;
        p.y = Math.max(p.y, upright ? LINK_R + LINK_TUBE : LINK_TUBE);
        q.setFromUnitVectors(X, t);
        roll.setFromAxisAngle(t, upright ? 0 : Math.PI / 2);
        links.push(new THREE.Matrix4().compose(p, roll.clone().multiply(q), stretch));
      }
    }
    const chain = new THREE.InstancedMesh(new THREE.TorusGeometry(LINK_R, LINK_TUBE, 6, 14), brass, links.length);
    links.forEach((m, i) => {
      chain.setMatrixAt(i, m);
    });
    scene.add(chain);
  }

  // Les ombres : un voile sombre et flou sous chaque grain, décalé à l'opposé de la lumière.
  // Les ombres calculées de three.js reposent sur des textures de profondeur qu'expo-gl ne gère pas
  // correctement sur Android (bruit noir en damier) ; ces ombres de contact marchent partout.
  {
    const away = new THREE.Vector3().subVectors(key.target.position, key.position).setY(0).normalize();
    const blobs: THREE.Matrix4[] = [];
    const flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    const blob = (x: number, z: number, height: number, sx: number, sz: number, turn = 0) => {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), turn).multiply(flat);
      const p = new THREE.Vector3(x, 0.003, z).addScaledVector(away, height * 0.45);
      blobs.push(new THREE.Matrix4().compose(p, q, new THREE.Vector3(sx, sz, 1)));
    };
    for (let b = 1; b < MEDAL; b++) blob(centers[b].x, centers[b].z, centers[b].y, radius(b) * 2.9, radius(b) * 2.9);
    blob(centers[MEDAL].x, centers[MEDAL].z, 0.05, 0.75, 0.95);
    const dir = centers[0].clone().sub(centers[1]).setY(0).normalize();
    const turn = Math.atan2(dir.x, dir.z);
    const along = (d: number) => centers[0].clone().addScaledVector(dir, d);
    const beam = along(0.66),
      bar = along(0.4);
    blob(beam.x, beam.z, 0.1, 0.32, 1.35, turn);
    blob(bar.x, bar.z, 0.1, 0.9, 0.3, turn);
    const shadows = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: tex.shadow, color: 0x000000, transparent: true, opacity: 0.75, depthWrite: false }),
      blobs.length,
    );
    blobs.forEach((m, i) => {
      shadows.setMatrixAt(i, m);
    });
    scene.add(shadows);
  }

  // Le fil que suit la caméra, de la croix jusqu'au retour à la médaille.
  const pathOrder = [0, 1, 2, 3, 4, 5, MEDAL, ...Array.from({ length: 54 }, (_, k) => k + 6), MEDAL];
  const curve = new THREE.CatmullRomCurve3(
    pathOrder.map((b) => centers[b].clone().setY(0.15)),
    false,
    'centripetal',
  );
  const N = pathOrder.length;
  const UP = new THREE.Vector3(0, 1, 0);

  function followCam(u: number) {
    const t = Math.min(1, Math.max(0, u / (N - 1)));
    const p = curve.getPoint(t);
    const tan = curve.getTangent(t).setY(0).normalize();
    const side = new THREE.Vector3().crossVectors(tan, UP).normalize();
    const pos = p
      .clone()
      .addScaledVector(tan, -3.6)
      .addScaledVector(side, 1.1)
      .add(new THREE.Vector3(0, 4.4, 0));
    const look = p.clone().addScaledVector(tan, 0.35).setY(0.1);
    return { pos, look };
  }
  let orbit = 0;
  function overviewCam() {
    // Assez de recul pour que la boucle et le pendentif tiennent dans le cadre.
    const half = THREE.MathUtils.degToRad(camera.fov / 2);
    const hHalf = Math.atan(Math.tan(half) * camera.aspect);
    const dist = Math.max(5.8 / Math.tan(hHalf), 9.8 / Math.tan(half));
    const pos = new THREE.Vector3(Math.sin(orbit) * dist * 0.5, dist * 0.87, Math.cos(orbit) * dist * 0.5 + 2.4);
    return { pos, look: new THREE.Vector3(0, 0, 2.4) };
  }

  // Le grain courant s'affiche dans le haut de l'écran, au-dessus de la feuille de prière.
  const frame = (k: number) => {
    camera.setViewOffset(width, height * k, 0, height * (k - 1), width, height);
    camera.updateProjectionMatrix();
  };

  let view: RosaryView = { steps: [], index: 0, finished: false, peek: false };
  let uCur = -1,
    uGoal = 0,
    uDrag = 0,
    uDragGoal = 0,
    dragging = false,
    ov = 1,
    ovGoal = 0;
  let active = true,
    raf = 0,
    dirty = true,
    last = 0,
    frameNo = 0;
  const camLook = new THREE.Vector3();

  /** Le grain qu'on prie ; avant le premier grain (signe de croix), celui qui vient. */
  const currentBead = (index: number) => {
    const lit = litBead(view.steps, index);
    if (lit !== null) return lit;
    return view.steps.find((s) => s.bead !== null)?.bead ?? 0;
  };

  frame(1.34);
  {
    const o = overviewCam();
    camera.position.copy(o.pos);
    camLook.copy(o.look);
  }

  const tmpTarget = new THREE.Vector3();
  function tick(now: number) {
    raf = requestAnimationFrame(safeTick);
    if (!active) return;
    const dt = last ? Math.min(0.05, Math.max(0, (now - last) / 1000)) : 0.016;
    last = now;
    frameNo++;
    const k = (rate: number) => (reducedMotion ? 1 : 1 - Math.exp(-dt * rate));

    let moving = dirty;
    dirty = false;
    if ((view.finished || view.peek) && !reducedMotion) {
      orbit += dt * 0.07;
      moving = true;
    }
    const du = (uGoal - uCur) * k(4.2);
    uCur += du;
    const dd = (uDragGoal - uDrag) * k(dragging ? 18 : 9);
    uDrag += dd;
    const dov = (ovGoal - ov) * k(2.4);
    ov += dov;
    if (Math.abs(du) + Math.abs(dd) + Math.abs(dov) > 1e-4) moving = true;

    const f = followCam(uCur + uDrag),
      o = overviewCam();
    const e = ov * ov * (3 - 2 * ov);
    const before = camera.position.clone();
    camera.position.lerp(tmpTarget.lerpVectors(f.pos, o.pos, e), k(7));
    camLook.lerp(tmpTarget.lerpVectors(f.look, o.look, e), k(7));
    camera.lookAt(camLook);
    if (before.distanceToSquared(camera.position) > 1e-8) moving = true;
    // Le brouillard suit la distance : la nappe se perd dans le noir, jamais le chapelet.
    const dist = camera.position.distanceTo(camLook);
    fog.near = dist * 1.05;
    fog.far = dist * 2.6;

    // Les grains déjà priés gardent une lueur dorée ; le grain courant respire.
    const lit = view.finished ? null : currentBead(view.index);
    const done = new Set<number>();
    for (let i = 0; i < view.index; i++) {
      const b = view.steps[i]?.bead;
      if (b !== null && b !== undefined) done.add(b);
    }
    const pulse = lit !== null && !reducedMotion;
    const tSec = now / 1000;
    for (let b = 0; b <= MEDAL; b++) {
      let target = 0;
      if (view.finished) target = 0.45;
      else if (b === lit) target = 1.25 + (pulse ? 0.3 * Math.sin(tSec * 2.1) : 0);
      else if (done.has(b)) target = 0.38;
      const g = glow[b] + (target - glow[b]) * k(6);
      if (Math.abs(g - glow[b]) > 1e-4) moving = true;
      glow[b] = g;
      for (const m of glowMats[b]) m.emissiveIntensity = b === MEDAL ? g * 0.5 : g;
    }
    if (lit !== null) {
      const c = centers[lit];
      glowLight.position.lerp(tmpTarget.set(c.x, 0.7, c.z), k(8));
      pool.position.x = glowLight.position.x;
      pool.position.z = glowLight.position.z;
    }
    const breathe = pulse ? Math.sin(tSec * 2.1) : 0;
    glowLight.intensity += ((lit !== null ? 4 + 0.8 * breathe : 0) - glowLight.intensity) * k(6);
    const poolMat = pool.material as THREE.MeshBasicMaterial;
    poolMat.opacity += ((lit !== null ? 0.75 + 0.15 * breathe : 0) - poolMat.opacity) * k(6);

    // Quand seule la respiration du grain anime la scène, 30 images par seconde suffisent.
    if (moving || (pulse && frameNo % 2 === 0)) {
      renderer.render(scene, camera);
      gl.endFrameEXP();
    }
  }
  // Une erreur dans la boucle ne doit jamais faire planter l'app : on arrête la scène et on prévient l'écran.
  function safeTick(now: number) {
    try {
      tick(now);
    } catch (e) {
      cancelAnimationFrame(raf);
      onError?.(e);
    }
  }
  raf = requestAnimationFrame(safeTick);

  return {
    setView(next) {
      const first = uCur < 0;
      view = next;
      uGoal = pathIndex(currentBead(next.index));
      if (first) uCur = uGoal;
      ovGoal = next.finished || next.peek ? 1 : 0;
      frame(next.finished || next.peek ? 1.12 : 1.34);
      dirty = true;
    },
    setDrag(progress) {
      dragging = progress !== 0;
      if (!dragging) {
        uDragGoal = 0;
        return;
      }
      const here = pathIndex(currentBead(view.index));
      const toward = progress > 0 ? Math.min(view.steps.length - 1, view.index + 1) : Math.max(0, view.index - 1);
      uDragGoal = Math.abs(progress) * 0.6 * (pathIndex(currentBead(toward)) - here);
    },
    setActive(next) {
      active = next;
      last = 0;
      dirty = true;
    },
    dispose() {
      cancelAnimationFrame(raf);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
        }
      });
      linen.dispose();
      scene.environment?.dispose();
      renderer.dispose();
    },
  };
}
