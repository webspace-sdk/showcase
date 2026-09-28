// A soft curtain of light that sweeps across the Tone Garden: thin in x, spans the rows in z, fades upward.
import fs from "node:fs";
import path from "node:path";
import { encodeSpz, rng } from "./spz-writer.mjs";
const R = rng(7);
const splats = [];
for (let i = 0; i < 9000; i++) {
  const z = -(R() * 5.2 - 0.3); // rows run toward -z
  const h = R() ** 1.8 * 2.6;
  const fade = 1 - h / 2.6;
  splats.push({
    x: R.gauss() * 0.05, y: h, z,
    sx: 0.04, sy: 0.16 + fade * 0.1, sz: 0.1,
    r: 1, g: 0.82 + 0.1 * fade, b: 0.5 + 0.25 * fade,
    a: 0.011 * fade * fade + 0.001
  });
}
// Motes of light drifting in the beam
for (let i = 0; i < 400; i++) {
  const s = 0.012 + R() * 0.02;
  splats.push({ x: R.gauss() * 0.12, y: R() * 2.2, z: -R() * 5, sx: s, sy: s, sz: s, r: 1, g: 0.95, b: 0.8, a: 0.35 });
}
fs.writeFileSync(path.join(process.argv[2] || ".", "sweep.spz"), encodeSpz(splats, { fractionalBits: 16 }));
console.log("sweep", splats.length);
