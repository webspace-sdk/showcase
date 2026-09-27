// Minimal SPZ (v2) writer for procedurally generated Gaussian splats.
// Input splats: { x, y, z, sx, sy, sz (linear meters), r, g, b (0..1 sRGB), a (0..1), qx, qy, qz, qw }
import zlib from "node:zlib";

const SH_C0 = 0.28209479177387814;
const COLOR_SCALE = 0.15;
const clampByte = v => Math.max(0, Math.min(255, Math.round(v)));

export function encodeSpz(splats, { fractionalBits = 12 } = {}) {
  const n = splats.length;
  const header = Buffer.alloc(16);
  header.writeUInt32LE(0x5053474e, 0); // "NGSP"
  header.writeUInt32LE(2, 4); // version
  header.writeUInt32LE(n, 8);
  header.writeUInt8(0, 12); // SH degree
  header.writeUInt8(fractionalBits, 13);
  header.writeUInt8(0, 14); // flags
  header.writeUInt8(0, 15);

  const positions = Buffer.alloc(n * 9);
  const alphas = Buffer.alloc(n);
  const colors = Buffer.alloc(n * 3);
  const scales = Buffer.alloc(n * 3);
  const rotations = Buffer.alloc(n * 3);
  const fixed = 1 << fractionalBits;
  const maxCoord = (1 << 23) / fixed;

  for (let i = 0; i < n; i++) {
    const s = splats[i];
    [s.x, s.y, s.z].forEach((v, k) => {
      if (Math.abs(v) >= maxCoord) throw new Error(`coordinate ${v} exceeds ±${maxCoord}; lower fractionalBits`);
      const q = Math.round(v * fixed) & 0xffffff;
      positions[i * 9 + k * 3] = q & 0xff;
      positions[i * 9 + k * 3 + 1] = (q >> 8) & 0xff;
      positions[i * 9 + k * 3 + 2] = (q >> 16) & 0xff;
    });

    alphas[i] = clampByte(s.a * 255);

    [s.r, s.g, s.b].forEach((c, k) => {
      const dc = (c - 0.5) / SH_C0;
      colors[i * 3 + k] = clampByte((dc * COLOR_SCALE + 0.5) * 255);
    });

    [s.sx, s.sy, s.sz].forEach((v, k) => {
      scales[i * 3 + k] = clampByte((Math.log(Math.max(v, 1e-7)) + 10) * 16);
    });

    let { qx = 0, qy = 0, qz = 0, qw = 1 } = s;
    const len = Math.hypot(qx, qy, qz, qw) || 1;
    qx /= len;
    qy /= len;
    qz /= len;
    qw /= len;
    if (qw < 0) {
      qx = -qx;
      qy = -qy;
      qz = -qz;
    }
    rotations[i * 3] = clampByte((qx + 1) * 127.5);
    rotations[i * 3 + 1] = clampByte((qy + 1) * 127.5);
    rotations[i * 3 + 2] = clampByte((qz + 1) * 127.5);
  }

  return zlib.gzipSync(Buffer.concat([header, positions, alphas, colors, scales, rotations]), { level: 9 });
}

// Deterministic PRNG so generated worlds are reproducible
export function rng(seed = 1) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (a, b) => a + (b - a) * next();
  next.gauss = () => {
    const u = Math.max(next(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  return next;
}

// Quaternion rotating +x onto direction (dx,dy,dz): for elongated splats aligned to a direction
export function quatFromX(dx, dy, dz) {
  const len = Math.hypot(dx, dy, dz) || 1;
  dx /= len;
  dy /= len;
  dz /= len;
  const d = dx; // dot((1,0,0), v)
  if (d < -0.999999) return { qx: 0, qy: 0, qz: 1, qw: 0 };
  // axis = (1,0,0) x v = (0, -dz, dy)
  const qx = 0;
  const qy = -dz;
  const qz = dy;
  const qw = 1 + d;
  const n = Math.hypot(qx, qy, qz, qw);
  return { qx: qx / n, qy: qy / n, qz: qz / n, qw: qw / n };
}
