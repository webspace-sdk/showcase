// Convert a Gaussian splat file (.ply / .splat / .spz) to a compact .spz.
// Usage: node splat2spz.mjs in.ply out.spz [--flip] [--center] [--crop-below=Y] [--scale=S] [--max-splats=N] [--min-alpha=0.02]
//   --flip        rotate 180 degrees about x (most captures and 3DGS training outputs are y-down)
//   --center      center on the median x/z and put the bottom of the capture at y = 0
//   --crop-below  after centering, drop splats below this height (e.g. a turntable or floor)
import fs from "node:fs";
import { parseSplat } from "./splat-loader.mjs";
import { encodeSpz } from "./spz-writer.mjs";

const [input, output] = process.argv.slice(2);
const flag = n => process.argv.find(a => a.startsWith(`--${n}`));
const buf = fs.readFileSync(input);
const s = await parseSplat(input, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

const minAlpha = parseFloat((flag("min-alpha") || "--min-alpha=0.02").split("=")[1]) * 255;
if (flag("flip")) {
  // 180 degrees about x: (x, y, z) -> (x, -y, -z); q -> qx180 * q
  for (let i = 0; i < s.count; i++) {
    s.positions[i * 3 + 1] *= -1;
    s.positions[i * 3 + 2] *= -1;
    const [x, y, z, w] = s.rotations.subarray(i * 4, i * 4 + 4);
    s.rotations.set([w, -z, y, -x], i * 4);
  }
}

let idx = [...Array(s.count).keys()].filter(i => s.colors[i * 4 + 3] >= minAlpha);

const max = flag("max-splats") ? parseInt(flag("max-splats").split("=")[1], 10) : Infinity;
if (idx.length > max) {
  // keep the most significant splats: opacity x volume
  const w = i => s.colors[i * 4 + 3] * s.scales[i * 3] * s.scales[i * 3 + 1] * s.scales[i * 3 + 2];
  idx.sort((a, b) => w(b) - w(a));
  idx = idx.slice(0, max);
}

let cx = 0, cy = 0, cz = 0;
if (flag("center")) {
  // center on the median in x/z, and put the lowest dense layer at y = 0
  const med = arr => arr.sort((a, b) => a - b)[Math.floor(arr.length / 2)];
  cx = med(idx.map(i => s.positions[i * 3]));
  cz = med(idx.map(i => s.positions[i * 3 + 2]));
  cy = idx.map(i => s.positions[i * 3 + 1]).sort((a, b) => a - b)[Math.floor(idx.length * 0.01)];
}

const cropBelow = flag("crop-below") ? parseFloat(flag("crop-below").split("=")[1]) : -Infinity;
const scale = flag("scale") ? parseFloat(flag("scale").split("=")[1]) : 1;
idx = idx.filter(i => s.positions[i * 3 + 1] - cy >= cropBelow);

const out = idx.map(i => ({
  x: (s.positions[i * 3] - cx) * scale, y: (s.positions[i * 3 + 1] - cy) * scale, z: (s.positions[i * 3 + 2] - cz) * scale,
  sx: s.scales[i * 3] * scale, sy: s.scales[i * 3 + 1] * scale, sz: s.scales[i * 3 + 2] * scale,
  r: s.colors[i * 4] / 255, g: s.colors[i * 4 + 1] / 255, b: s.colors[i * 4 + 2] / 255, a: s.colors[i * 4 + 3] / 255,
  qx: s.rotations[i * 4], qy: s.rotations[i * 4 + 1], qz: s.rotations[i * 4 + 2], qw: s.rotations[i * 4 + 3]
}));

const extent = out.reduce((m, p) => Math.max(m, Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)), 0);
const fractionalBits = Math.max(4, Math.min(16, 22 - Math.ceil(Math.log2(extent + 1))));
fs.writeFileSync(output, encodeSpz(out, { fractionalBits }));
console.log(`${input}: ${s.count} splats -> ${out.length} (extent ${extent.toFixed(2)}, bits ${fractionalBits}) -> ${output} ${(fs.statSync(output).size / 1e6).toFixed(1)}MB`);
