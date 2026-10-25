import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { AXIS, BASE, EYES, FACE, ORBITS, RIBBONS, faceFront, orbitPoint, ribbonPoint } from '@/lib/siborgGeometry';
export type SiBorgState = 'idle' | 'listening' | 'thinking' | 'insight' | 'recommend' | 'error';
const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Live 3D SiBorg. A pearl face with two luminous vertical eyes, framed by two
 * folded shells (ivory inside, burgundy outside) that sweep around behind it.
 * The shells never cross the face; the hero camera looks straight at it.
 *
 * Motion is understated: a slow sway and float at rest, a gentle follow of the
 * pointer, and state changes that lerp to stable poses. The face always stays
 * turned toward the viewer, so both eyes remain visible.
 */

type Pose = { glow: number; open: number; inward: number; lead: number; calm: number; sway: number; think: number; eyeY: number; eyeX: number; tilt: number; turn: number; lean: number };

const POSES: Record<SiBorgState, Pose> = {
  // eyeY: eye height scale, eyeX: eye shift, tilt: nod (rad), turn: extra yaw (rad), lean: move toward the viewer
  idle: { glow: 1, open: 0, inward: 0, lead: 0, calm: 0, sway: 1, think: 0, eyeY: 1, eyeX: 0, tilt: 0, turn: 0, lean: 0 },
  listening: { glow: 1.5, open: 1, inward: 0, lead: 0, calm: 0, sway: 0.3, think: 0, eyeY: 1.3, eyeX: 0, tilt: -0.1, turn: 0, lean: 0.3 },
  thinking: { glow: 0.8, open: 0, inward: 1, lead: 0, calm: 0, sway: 0.2, think: 1, eyeY: 0.6, eyeX: 0, tilt: 0.12, turn: 0, lean: 0 },
  insight: { glow: 1.4, open: 0.4, inward: 0, lead: 1, calm: 0, sway: 0.2, think: 0, eyeY: 1.15, eyeX: 0, tilt: -0.14, turn: 0, lean: 0.3 },
  recommend: { glow: 1.1, open: 0, inward: 0, lead: 1, calm: 0, sway: 0.2, think: 0, eyeY: 1, eyeX: 0.05, tilt: 0, turn: 0.34, lean: 0 },
  error: { glow: 0.25, open: 0, inward: 0.3, lead: 0, calm: 1, sway: 0, think: 0, eyeY: 0.22, eyeX: 0, tilt: 0.2, turn: 0, lean: -0.3 },
};

export type SiBorgView = 'front' | 'three-quarter' | 'side';
export const VIEW_YAW: Record<SiBorgView, number> = { front: 0.1, 'three-quarter': 0.45, side: 1.45 };

function ribbonGeometry(index: number, nt = 160, ns = 14) {
  const spec = RIBBONS[index];
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= nt; i++) for (let j = 0; j <= ns; j++) positions.push(...ribbonPoint(spec, i / nt, j / ns));
  for (let i = 0; i < nt; i++) {
    for (let j = 0; j < ns; j++) {
      const a = i * (ns + 1) + j;
      const b = a + 1;
      const c = a + ns + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

export type SiBorgObjectProps = {
  state?: SiBorgState;
  className?: string;
  /** Fixed camera view; also freezes the sway and pointer follow (stills, renders). */
  view?: SiBorgView;
  /** Explicit yaw in radians, overriding `view`. */
  yaw?: number;
  /** Follow the pointer a little (desktop only, never past a gentle limit). */
  follow?: boolean;
  /** Keep the drawing buffer so the canvas can be exported as a PNG. */
  preserve?: boolean;
  /** Solid background colour, or null for transparent. */
  background?: string | null;
  label?: string;
};

export function SiBorgObject3D({ state = 'idle', className = '', view = 'front', yaw, follow = true, preserve = false, background = null, label = 'SiBorg' }: SiBorgObjectProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<SiBorgState>(state);
  const [failed, setFailed] = useState(false);
  stateRef.current = state;
  const fixed = yaw !== undefined;
  const baseYaw = yaw ?? VIEW_YAW[view];

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: preserve, powerPreference: 'high-performance' });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(background ?? 0x000000, background ? 1 : 0);
    el.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.42;

    const camera = new THREE.PerspectiveCamera(27, 1, 0.1, 50);
    camera.position.set(0, 0.3, 9.4);
    camera.lookAt(0, 0.05, 0);

    const key = new THREE.DirectionalLight(0xffe9d9, 2.0);
    key.position.set(-3, 3.5, 5);
    const rim = new THREE.DirectionalLight(0xe9a7b8, 2.6);
    rim.position.set(4.5, 2, -4);
    const fillL = new THREE.DirectionalLight(0x9a1a42, 1.1);
    fillL.position.set(3.5, -2.5, 3);
    const faceLight = new THREE.PointLight(0xfff0e3, 14, 8, 2);
    faceLight.position.set(0.4, 0.8, 3.4);
    scene.add(key, rim, fillL, faceLight);

    const root = new THREE.Group();
    root.rotation.y = baseYaw;
    scene.add(root);
    const disposables: Array<{ dispose(): void }> = [envTex, pmrem];

    const mat = (color: number, metalness: number, roughness: number, extra: Partial<THREE.MeshPhysicalMaterialParameters> = {}) => {
      const m = new THREE.MeshPhysicalMaterial({ color, metalness, roughness, clearcoat: 0.45, clearcoatRoughness: 0.35, ...extra });
      disposables.push(m);
      return m;
    };
    const pearlShell = (side: THREE.Side) => mat(0xd6c5b8, 0.1, 0.5, { side, sheen: 0.5, sheenColor: new THREE.Color(0xffd9df) });
    const wineShell = (side: THREE.Side) => mat(0xa81f4b, 0.25, 0.42, { side });
    const deepShell = (side: THREE.Side) => mat(0x6d1530, 0.25, 0.46, { side });

    const shells: THREE.Group[] = [];
    [
      [pearlShell(THREE.FrontSide), wineShell(THREE.BackSide)],
      [deepShell(THREE.FrontSide), pearlShell(THREE.BackSide)],
    ].forEach(([front, back], i) => {
      const g = ribbonGeometry(i);
      disposables.push(g);
      const grp = new THREE.Group();
      grp.add(new THREE.Mesh(g, front), new THREE.Mesh(g, back));
      root.add(grp);
      shells.push(grp);
    });

    // face
    const faceMat = mat(0xefe3d8, 0.04, 0.34, { clearcoat: 0.7, clearcoatRoughness: 0.22, emissive: new THREE.Color(0xfff1e4), emissiveIntensity: 0.06 });
    const faceGeo = new THREE.SphereGeometry(1, 96, 64);
    disposables.push(faceGeo);
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.scale.set(FACE.rx, FACE.ry, FACE.rz);
    face.position.y = FACE.y;
    root.add(face);

    // eyes: narrow vertical capsules lying on the face, with a faint rose halo
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfff4e6, toneMapped: false });
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xe9a7b8, transparent: true, opacity: 0.28, depthWrite: false });
    const eyeGeo = new THREE.CapsuleGeometry(EYES.radius, EYES.halfLen * 2, 8, 20);
    const haloGeo = new THREE.CapsuleGeometry(EYES.radius * 2.1, EYES.halfLen * 2.1, 8, 20);
    disposables.push(eyeMat, haloMat, eyeGeo, haloGeo);
    const eyes: THREE.Group[] = [];
    const eyeBase: THREE.Vector3[] = [];
    [-1, 1].forEach((sgn) => {
      const { p, n } = faceFront(sgn * EYES.dx, EYES.dy);
      const g = new THREE.Group();
      g.position.set(p[0] + n[0] * 0.012, p[1] + n[1] * 0.012, p[2] + n[2] * 0.012);
      g.lookAt(g.position.x + n[0], g.position.y + n[1], g.position.z + n[2]);
      const flat = new THREE.Mesh(eyeGeo, eyeMat);
      flat.scale.z = 0.35;
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.scale.z = 0.2;
      halo.position.z = -0.01;
      g.add(halo, flat);
      root.add(g);
      eyes.push(g);
      eyeBase.push(g.position.clone());
    });

    // axis (above and below the face only), diamond, base
    const axisMat = new THREE.MeshBasicMaterial({ color: 0xf3ece6, transparent: true, opacity: 0.8 });
    disposables.push(axisMat);
    const seg = (y0: number, y1: number) => {
      const geo = new THREE.CylinderGeometry(0.006, 0.006, y1 - y0, 6);
      disposables.push(geo);
      const m = new THREE.Mesh(geo, axisMat);
      m.position.set(0, (y0 + y1) / 2, -0.2);
      root.add(m);
    };
    seg(AXIS.yTopStart, AXIS.yTop);
    seg(AXIS.yBottom, AXIS.yBottomEnd);
    const dia = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), new THREE.MeshBasicMaterial({ color: 0xf3ece6 }));
    dia.scale.y = 1.9;
    dia.position.set(0, AXIS.yTop + 0.12, -0.2);
    const baseMat = mat(0x2a0912, 0.2, 0.7, { clearcoat: 0 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(BASE.rx, BASE.rx * 1.05, 0.05, 64), baseMat);
    base.position.y = BASE.y;
    const baseRing = new THREE.Mesh(new THREE.TorusGeometry(BASE.rx * 1.02, 0.008, 8, 96), new THREE.MeshBasicMaterial({ color: 0xc9506f }));
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = BASE.y + 0.026;
    root.add(dia, base, baseRing);

    // orbit hairlines, only the arcs behind or beside the face
    ORBITS.forEach((o) => {
      let run: THREE.Vector3[] = [];
      const flush = () => {
        if (run.length > 1) {
          const geo = new THREE.BufferGeometry().setFromPoints(run);
          disposables.push(geo);
          root.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xe9a7b8, transparent: true, opacity: 0.45 })));
        }
        run = [];
      };
      for (let k = 0; k <= 200; k++) {
        const p = orbitPoint(o, (k / 200) * Math.PI * 2);
        const keep = p[2] < 0 || Math.abs(p[0]) > 1.05;
        if (keep) run.push(new THREE.Vector3(...p));
        else flush();
      }
      flush();
    });

    // recommendation / insight lead line
    const leadGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)]);
    const leadMat = new THREE.LineBasicMaterial({ color: 0xe9a7b8, transparent: true, opacity: 0 });
    const lead = new THREE.Line(leadGeo, leadMat);
    lead.position.set(FACE.rx + 0.75, FACE.y, 0.2);
    lead.scale.x = 0.0001;
    root.add(lead);
    disposables.push(leadGeo, leadMat);

    const size = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    size();
    const ro = new ResizeObserver(() => {
      size();
      draw();
    });
    ro.observe(el);

    const reduced = prefersReducedMotion();
    const canFollow = follow && !fixed && !reduced && !!window.matchMedia?.('(pointer: fine)').matches;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      pointer.tx = Math.max(-1, Math.min(1, (e.clientX - cx) / (window.innerWidth * 0.5)));
      pointer.ty = Math.max(-1, Math.min(1, (e.clientY - cy) / (window.innerHeight * 0.5)));
    };
    if (canFollow) window.addEventListener('pointermove', onMove, { passive: true });

    const cur: Pose = { ...POSES[stateRef.current] };
    let last = performance.now();
    const t0 = last;
    let visible = true;
    let raf = 0;
    let flash = 0;
    let prevState = stateRef.current;

    const apply = (now: number) => {
      const t = (now - t0) / 1000;
      const target = POSES[stateRef.current];
      if (stateRef.current !== prevState) {
        prevState = stateRef.current;
        if (prevState === 'insight') flash = 1;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = reduced ? 1 : 1 - Math.exp(-dt * 4);
      (Object.keys(cur) as Array<keyof Pose>).forEach((key2) => {
        cur[key2] += (target[key2] - cur[key2]) * k;
      });
      flash = Math.max(0, flash - dt * 1.4);
      pointer.x += (pointer.tx - pointer.x) * (1 - Math.exp(-dt * 3));
      pointer.y += (pointer.ty - pointer.y) * (1 - Math.exp(-dt * 3));

      const live = !reduced && !fixed;
      root.position.y = (live ? Math.sin(t * 0.8) * 0.08 * (1 - cur.calm) : 0) - cur.calm * 0.12;
      root.position.z = cur.lean * 0.9;
      root.rotation.y = baseYaw + cur.turn + (live ? Math.sin(t * 0.5) * 0.14 * cur.sway + pointer.x * 0.22 : 0);
      root.rotation.x = cur.tilt + (live ? pointer.y * 0.1 : 0);

      const drift = live ? Math.sin(t * 0.5) : 0;
      const think = live ? Math.sin(t * 0.9) : 0;
      shells[0].rotation.z = 0.05 * drift + 0.32 * cur.open + 0.3 * think * cur.think;
      shells[1].rotation.z = -0.05 * drift - 0.32 * cur.open - 0.3 * Math.sin(t * 0.9 + 1) * cur.think;
      const inward = 1 - 0.16 * cur.inward;
      shells.forEach((sh) => sh.scale.set(inward, inward, inward));

      const breathe = live ? 1 + Math.sin(t * 1.3) * 0.05 : 1;
      const g = Math.max(0.05, (cur.glow + flash * 0.7) * breathe);
      const e = Math.min(1, 0.55 + g * 0.45);
      eyeMat.color.setRGB(1 * e, 0.96 * e, 0.9 * e);
      haloMat.opacity = Math.min(0.55, 0.12 + g * 0.18);
      // thinking: the eyes squint and look side to side; error: nearly closed
      const gaze = cur.think * Math.sin(t * 1.6) * 0.07 + cur.eyeX;
      eyes.forEach((eg, i) => {
        eg.scale.set(1 + (g - 1) * 0.12, cur.eyeY, 1);
        eg.position.x = eyeBase[i].x + gaze;
      });
      faceMat.emissiveIntensity = 0.04 + g * 0.05;
      faceLight.intensity = 10 + g * 4;
      scene.environmentIntensity = 0.42 - cur.calm * 0.18;
      lead.scale.x = Math.max(0.0001, cur.lead * 1.6);
      leadMat.opacity = cur.lead * 0.9;
    };
    const draw = () => {
      apply(performance.now());
      renderer.render(scene, camera);
    };
    const loop = (now: number) => {
      raf = 0;
      if (!visible) return;
      apply(now);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!raf && visible && !reduced && !fixed) raf = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver((entries) => {
      visible = entries.some((en) => en.isIntersecting);
      if (visible) {
        last = performance.now();
        start();
      }
    });
    io.observe(el);
    draw();
    start();
    const stateTimer = reduced || fixed ? window.setInterval(draw, 400) : 0;

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (stateTimer) window.clearInterval(stateTimer);
      if (canFollow) window.removeEventListener('pointermove', onMove);
      io.disconnect();
      ro.disconnect();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [preserve, background, baseYaw, fixed, follow]);

  return (
    <div ref={host} className={`sb3d ${className}`} role="img" aria-label={label}>
      {failed && <img src="/brand/siborg/siborg-mark.svg" alt="" className="sb3d-fallback" />}
    </div>
  );
}
