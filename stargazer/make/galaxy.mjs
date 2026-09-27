// Procedural spiral galaxy + starfield as Gaussian splats (.spz). Usage: node galaxy.mjs <outdir>
import fs from "node:fs";
import path from "node:path";
import { encodeSpz, rng, quatFromX } from "./spz-writer.mjs";

const out = process.argv[2] || ".";
const R = rng(20260927);
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => c1.map((v, i) => lerp(v, c2[i], t));
const jitter = (c, amt) => c.map(v => Math.min(1, Math.max(0, v + (R() - 0.5) * amt)));

const galaxy = [];
const push = (x, y, z, s, color, a, elong = null) => {
  const [r, g, b] = color;
  if (elong) {
    const { dir, ratio, flat = 1 } = elong;
    galaxy.push({ x, y, z, sx: s * ratio, sy: s * flat, sz: s, r, g, b, a, ...quatFromX(dir[0], dir[1], dir[2]) });
  } else {
    galaxy.push({ x, y, z, sx: s, sy: s, sz: s, r, g, b, a });
  }
};

const ARMS = 2;
const PITCH = 0.34; // tan of pitch angle: lower = tighter
const R0 = 6;
const RMAX = 130;

const armAngle = (r, k) => (k / ARMS) * Math.PI * 2 + Math.log(r / R0) / PITCH;
const sampleRadius = (scale, max) => {
  for (;;) {
    const r = -Math.log(1 - R()) * scale + R0 * 0.6;
    if (r < max) return r;
  }
};
const diskThickness = r => 1.6 * Math.exp(-r / 70) + 0.3;

// Tangent direction of the spiral at (r, theta), for stretching splats along the arm
const armTangent = (r, theta) => {
  const dr = 1;
  const dtheta = 1 / (PITCH * r);
  return [Math.cos(theta) * dr - r * Math.sin(theta) * dtheta, 0, Math.sin(theta) * dr + r * Math.cos(theta) * dtheta];
};

// 1. Core bulge: warm, dense, softly flattened
const CORE = [1.0, 0.82, 0.55];
const CORE_HOT = [1.0, 0.95, 0.85];
for (let i = 0; i < 45000; i++) {
  const rad = Math.abs(R.gauss()) * 11 + Math.abs(R.gauss()) * 4;
  const u = R() * 2 - 1;
  const phi = R() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  const x = rad * s * Math.cos(phi);
  const z = rad * s * Math.sin(phi);
  const y = rad * u * 0.55;
  const heat = Math.exp(-rad / 5);
  push(x, y, z, lerp(0.35, 1.1, R()), jitter(mix(CORE, CORE_HOT, heat), 0.08), lerp(0.004, 0.018, heat));
}

// 2. Arm stars: bright blue-white young stars concentrated on the arms, older yellow stars between
const YOUNG = [0.72, 0.82, 1.0];
const OLD = [1.0, 0.86, 0.66];
for (let i = 0; i < 230000; i++) {
  const r = sampleRadius(38, RMAX);
  const onArm = R() < 0.78;
  const k = Math.floor(R() * ARMS);
  const spread = onArm ? R.gauss() * (0.2 + r * 0.0016) : R() * Math.PI * 2;
  const theta = armAngle(r, k) + spread;
  const rr = r + R.gauss() * 2.5;
  const x = rr * Math.cos(theta);
  const z = rr * Math.sin(theta);
  const y = R.gauss() * diskThickness(r);
  const color = onArm ? jitter(mix(YOUNG, [1, 1, 1], R() * 0.4), 0.1) : jitter(OLD, 0.12);
  push(x, y, z, lerp(0.12, 0.34, R() ** 2), color, lerp(0.05, 0.16, R()) * (0.25 + 0.75 * Math.min(1, r / 55)));
}

// 3. Arm nebulosity: large, soft, stretched along the arm
const GLOW_A = [0.4, 0.55, 1.0];
const GLOW_B = [0.6, 0.5, 0.9];
for (let i = 0; i < 42000; i++) {
  const r = sampleRadius(45, RMAX);
  const k = Math.floor(R() * ARMS);
  const theta = armAngle(r, k) + R.gauss() * (0.12 + r * 0.0015);
  const x = r * Math.cos(theta);
  const z = r * Math.sin(theta);
  const y = R.gauss() * diskThickness(r) * 0.8;
  push(x, y, z, lerp(1.4, 3.6, R()), jitter(mix(GLOW_A, GLOW_B, R()), 0.1), lerp(0.004, 0.012, R()) * (0.3 + 0.7 * Math.min(1, r / 60)), {
    dir: armTangent(r, theta),
    ratio: lerp(1.8, 3.2, R()),
    flat: 0.35
  });
}

// 4. Dust lanes: dark, trailing just inside each arm
const DUST = [0.1, 0.06, 0.05];
const dust = [];
const pushTo = (arr, fn) => { const before = galaxy.length; fn(); arr.push(...galaxy.splice(before)); };
for (let i = 0; i < 38000; i++) pushTo(dust, () => {
  const r = sampleRadius(40, RMAX * 0.9) + 4;
  const k = Math.floor(R() * ARMS);
  const theta = armAngle(r, k) - 0.22 + R.gauss() * 0.06;
  const x = r * Math.cos(theta);
  const z = r * Math.sin(theta);
  const y = R.gauss() * 0.35;
  push(x, y, z, lerp(0.6, 1.6, R()), jitter(DUST, 0.04), lerp(0.25, 0.55, R()), {
    dir: armTangent(r, theta),
    ratio: lerp(2, 4, R()),
    flat: 0.3
  });
});

// 5. Star-forming knots (HII regions): pink clusters strung along the arms
const HII = [1.0, 0.36, 0.62];
for (let c = 0; c < 420; c++) {
  const r = sampleRadius(42, RMAX * 0.95) + 5;
  const k = Math.floor(R() * ARMS);
  const theta = armAngle(r, k) + R.gauss() * 0.08;
  const cx = r * Math.cos(theta);
  const cz = r * Math.sin(theta);
  const size = lerp(0.8, 2.6, R() ** 2);
  const n = Math.floor(lerp(20, 70, R()));
  for (let i = 0; i < n; i++) {
    push(
      cx + R.gauss() * size,
      R.gauss() * size * 0.4,
      cz + R.gauss() * size,
      lerp(0.25, 0.8, R()),
      jitter(mix(HII, [1, 0.8, 0.9], R() * 0.3), 0.08),
      lerp(0.04, 0.1, R())
    );
  }
  // a hot blue star or two at the heart of the knot
  push(cx, 0, cz, 0.3, [0.85, 0.92, 1], 0.5);
}

fs.writeFileSync(path.join(out, "galaxy.spz"), encodeSpz(galaxy, { fractionalBits: 12 }));
fs.writeFileSync(path.join(out, "galaxy-dust.spz"), encodeSpz(dust, { fractionalBits: 12 }));

// Starfield: a shell of stars around the viewer, independent of the galaxy
const stars = [];
const STAR_COLORS = [
  [1, 1, 1],
  [0.78, 0.86, 1],
  [1, 0.93, 0.8],
  [1, 0.8, 0.62],
  [0.7, 0.8, 1]
];
for (let i = 0; i < 26000; i++) {
  const u = R() * 2 - 1;
  const phi = R() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  const dist = lerp(700, 900, R());
  const mag = R() ** 6; // few bright stars, many faint
  const [r, g, b] = STAR_COLORS[Math.floor(R() * STAR_COLORS.length)];
  const size = lerp(0.45, 2.2, mag);
  stars.push({ x: dist * s * Math.cos(phi), y: dist * u, z: dist * s * Math.sin(phi), sx: size, sy: size, sz: size, r, g, b, a: lerp(0.35, 1, mag) });
}
fs.writeFileSync(path.join(out, "stars.spz"), encodeSpz(stars, { fractionalBits: 11 }));

console.log(`galaxy: ${galaxy.length} splats, dust: ${dust.length}, stars: ${stars.length} splats`);
