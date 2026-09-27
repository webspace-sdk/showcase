// A shooting star: bright head, long fading tail along -x. Usage: node meteor.mjs <outdir>
import fs from "node:fs";
import path from "node:path";
import { encodeSpz, rng } from "./spz-writer.mjs";
const R = rng(99);
const splats = [];
const LEN = 30;
for (let i = 0; i < 2600; i++) {
  const t = R() ** 1.7; // denser near the head
  const x = -t * LEN;
  const spread = 0.05 + t * 0.35;
  const warm = Math.min(1, t * 1.6);
  splats.push({
    x, y: R.gauss() * spread, z: R.gauss() * spread,
    sx: 0.18 + t * 0.5, sy: 0.12, sz: 0.12,
    r: 1, g: 1 - warm * 0.25, b: 1 - warm * 0.6,
    a: (1 - t) ** 2 * 0.35
  });
}
for (let i = 0; i < 60; i++) splats.push({ x: R.gauss() * 0.15, y: R.gauss() * 0.15, z: R.gauss() * 0.15, sx: 0.35, sy: 0.35, sz: 0.35, r: 1, g: 1, b: 1, a: 0.5 });
fs.writeFileSync(path.join(process.argv[2] || ".", "meteor.spz"), encodeSpz(splats, { fractionalBits: 14 }));
console.log("meteor", splats.length);
