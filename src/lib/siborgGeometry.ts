/**
 * SiBorg form: one parametric definition shared by the 3D scene
 * (src/components/SiBorgObject3D.tsx) and the 2D vector assets
 * (scripts/generate-siborg-assets.mjs).
 *
 * A smooth pearl face sits on a vertical axis, front-facing, with two narrow
 * vertical eyes. Two folded ribbon shells embrace it: they begin at the
 * flanks, sweep around the back and rise, so they frame the face and never
 * cross it. Ivory is the inside of each shell, burgundy the outside.
 *
 * Axes: +y up, +z toward the viewer, angle alpha measured from +z toward +x.
 */

export type Vec3 = [number, number, number];

export type RibbonSpec = {
  name: 'a' | 'b';
  /** sweep around the ring, degrees (0 = right, 90 = top) */
  b0: number;
  b1: number;
  R0: number;
  R1: number;
  /** extra radius at mid-sweep */
  bulge: number;
  /** ring orientation: tilt about the vertical axis, then roll about the view axis (degrees) */
  yaw: number;
  roll: number;
  /** ring centre */
  cy: number;
  cz: number;
  /** twist of the width plane: 0 = edge-on to the ring plane, 90 = lying in it */
  phiBase: number;
  phiAmp: number;
  phiTurns: number;
  phiShift: number;
  widthMax: number;
  widthPower: number;
  cup: number;
};

export const RIBBONS: RibbonSpec[] = [
  { name: 'a', b0: -125, b1: 205, R0: 1.3, R1: 1.22, bulge: 0.16, yaw: 52, roll: -28, cy: 0.12, cz: -0.45, phiBase: 68, phiAmp: 62, phiTurns: 0.9, phiShift: 0.2, widthMax: 0.95, widthPower: 0.7, cup: 0.35 },
  { name: 'b', b0: 215, b1: -95, R0: 1.2, R1: 1.34, bulge: 0.12, yaw: -48, roll: 38, cy: 0.05, cz: -0.5, phiBase: 62, phiAmp: 58, phiTurns: 1.1, phiShift: 2.3, widthMax: 0.8, widthPower: 0.75, cup: 0.3 },
];

/** Face: a smooth, slightly flattened ovoid. */
export const FACE = { rx: 0.62, ry: 0.82, rz: 0.58, y: 0.1 };

/** Two narrow vertical capsule eyes on the front of the face. */
export const EYES = { dx: 0.2, dy: 0.06, halfLen: 0.15, radius: 0.052 };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rad = (d: number) => (d * Math.PI) / 180;

/** Point on a shell surface. t along its length, s across its width, both 0..1. */
export function ribbonPoint(r: RibbonSpec, t: number, s: number, spread = 0): Vec3 {
  const beta = rad(lerp(r.b0, r.b1, t)) + spread * (r.name === 'a' ? 1 : -1);
  const R = lerp(r.R0, r.R1, t) + r.bulge * Math.sin(Math.PI * t);
  const rx = Math.cos(beta);
  const ry = Math.sin(beta);
  const phi = rad(r.phiBase + r.phiAmp * Math.sin(2 * Math.PI * r.phiTurns * t + r.phiShift));
  const w = r.widthMax * Math.pow(Math.max(0, Math.sin(Math.PI * t)), r.widthPower);
  const u = (s - 0.5) * w;
  const bow = r.cup * (s - 0.5) * (s - 0.5) * w;
  // local frame: ring in the xy plane, radial = (rx, ry, 0), ring normal = z
  let lx = R * rx + u * Math.sin(phi) * rx;
  let ly = R * ry + u * Math.sin(phi) * ry;
  let lz = u * Math.cos(phi) + bow;
  // tilt about the vertical axis
  const cyw = Math.cos(rad(r.yaw));
  const syw = Math.sin(rad(r.yaw));
  [lx, lz] = [lx * cyw + lz * syw, -lx * syw + lz * cyw];
  // roll about the view axis
  const cr = Math.cos(rad(r.roll));
  const sr = Math.sin(rad(r.roll));
  [lx, ly] = [lx * cr - ly * sr, lx * sr + ly * cr];
  return [lx, ly + r.cy, lz + r.cz];
}

/** Faint orbit contours. Only the arcs behind or beside the face are drawn. */
export const ORBITS = [
  { rx: 1.95, rz: 1.95, tiltX: 1.2, tiltZ: -0.4, y: 0.15 },
  { rx: 1.7, rz: 1.7, tiltX: 0.5, tiltZ: 0.55, y: 0.2 },
];

export function orbitPoint(o: (typeof ORBITS)[number], a: number): Vec3 {
  let x = Math.cos(a) * o.rx;
  let y = 0;
  let z = Math.sin(a) * o.rz;
  const cy = Math.cos(o.tiltX);
  const sy = Math.sin(o.tiltX);
  [y, z] = [y * cy - z * sy, y * sy + z * cy];
  const cz = Math.cos(o.tiltZ);
  const sz = Math.sin(o.tiltZ);
  [x, y] = [x * cz - y * sz, x * sz + y * cz];
  return [x, y + o.y, z];
}

export const BASE = { y: -1.85, rx: 0.95 };
/** The axis is drawn only above and below the face so it never crosses it. */
export const AXIS = { yTop: 2.15, yTopStart: 1.0, yBottom: -1.85, yBottomEnd: -0.85 };

/** Point on the front of the face at lateral/vertical offset (x, y). */
export function faceFront(x: number, yOff: number): { p: Vec3; n: Vec3 } {
  const nx = x / FACE.rx;
  const ny = yOff / FACE.ry;
  const z = FACE.rz * Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  const n: Vec3 = [x / (FACE.rx * FACE.rx), yOff / (FACE.ry * FACE.ry), z / (FACE.rz * FACE.rz)];
  const l = Math.hypot(...n) || 1;
  return { p: [x, FACE.y + yOff, z], n: [n[0] / l, n[1] / l, n[2] / l] };
}
