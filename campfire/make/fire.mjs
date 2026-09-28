// Campfire light as Gaussian splats: flame tongues (flickered by the world script), a glow, and embers.
// Usage: node fire.mjs <outdir>
import fs from "node:fs";
import path from "node:path";
import { encodeSpz, rng } from "./spz-writer.mjs";
const out = process.argv[2] || ".";
const lerp = (a, b, t) => a + (b - a) * t;
const ramp = t => // white-yellow core -> orange -> deep red at the tips
  t < 0.35 ? [1, lerp(0.95, 0.72, t / 0.35), lerp(0.7, 0.25, t / 0.35)]
  : t < 0.75 ? [1, lerp(0.72, 0.38, (t - 0.35) / 0.4), lerp(0.25, 0.08, (t - 0.35) / 0.4)]
  : [lerp(1, 0.75, (t - 0.75) / 0.25), lerp(0.38, 0.15, (t - 0.75) / 0.25), 0.05];

// A flame tongue: teardrop profile, leaning and curling a little
const tongue = (seed, height, lean) => {
  const R = rng(seed), s = [];
  for (let i = 0; i < 5200; i++) {
    const t = R() ** 0.8;                      // 0 base .. 1 tip
    const radius = 0.22 * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08)) * (1 - t * 0.6);
    const a = R() * Math.PI * 2, r = radius * Math.sqrt(R());
    const curl = Math.sin(t * 5 + seed) * 0.04 * t;
    const [cr, cg, cb] = ramp(t);
    const size = lerp(0.07, 0.035, t);
    s.push({ x: Math.cos(a) * r + lean * t * t + curl, y: t * height, z: Math.sin(a) * r * 0.8,
      sx: size, sy: size * 1.6, sz: size, r: cr, g: cg, b: cb, a: lerp(0.07, 0.015, t) });
  }
  return s;
};
fs.writeFileSync(path.join(out, "flame-a.spz"), encodeSpz(tongue(1, 1.25, 0.12), { fractionalBits: 16 }));
fs.writeFileSync(path.join(out, "flame-b.spz"), encodeSpz(tongue(2, 0.95, -0.15), { fractionalBits: 16 }));
fs.writeFileSync(path.join(out, "flame-c.spz"), encodeSpz(tongue(3, 0.8, 0.05), { fractionalBits: 16 }));

// Glow: a soft, wide halo that lights the ground and the smoke
{
  const R = rng(9), s = [];
  for (let i = 0; i < 1400; i++) {
    const a = R() * Math.PI * 2, r = Math.abs(R.gauss()) * 0.45, y = Math.abs(R.gauss()) * 0.35;
    s.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r, sx: 0.3, sy: 0.22, sz: 0.3, r: 1, g: 0.45, b: 0.12, a: 0.01 });
  }
  fs.writeFileSync(path.join(out, "glow.spz"), encodeSpz(s, { fractionalBits: 14 }));
}

// Embers: sparks in a tall column; the script slides it upward and wraps it for endless rising
{
  const R = rng(4), s = [];
  for (let i = 0; i < 260; i++) {
    const y = R() * 4, spread = 0.1 + y * 0.12, size = 0.012 + R() * 0.012;
    s.push({ x: R.gauss() * spread, y, z: R.gauss() * spread, sx: size, sy: size * 1.8, sz: size,
      r: 1, g: 0.55 + R() * 0.3, b: 0.15, a: 0.9 * (1 - y / 4.5) });
  }
  fs.writeFileSync(path.join(out, "embers.spz"), encodeSpz(s, { fractionalBits: 16 }));
}
console.log("fire assets written");
