// توليد أيقونات PWA بدون أي اعتماد خارجي: PNG truecolor مكتوب يدويًا مع zlib.
// شغّل: npm run icons
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(size, rgb) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // عمق البت
  ihdr[9] = 2; // truecolor
  const stride = size * 3;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];
const clamp01 = (v) => Math.min(1, Math.max(0, v));

function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const dx = Math.abs(px - cx) - (hw - r);
  const dy = Math.abs(py - cy) - (hh - r);
  const ax = Math.max(dx, 0);
  const ay = Math.max(dy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(dx, dy), 0) - r;
}

const sdCircle = (px, py, cx, cy, r) => Math.hypot(px - cx, py - cy) - r;

// تصميم: خلفية خضراء + بطاقة بيضاء بزوايا دائرية + أسطر نصوص + نقطة ذهبية.
// المحتوى داخل 20%..80% فيصلح أيضًا كأيقونة maskable (المنطقة الآمنة 80%).
function render(size) {
  const bg = hex('#0d5c3f');
  const white = hex('#ffffff');
  const green = hex('#0d5c3f');
  const gold = hex('#f0b429');

  const card = (x, y) => sdRoundRect(x, y, 0.5, 0.5, 0.3, 0.28, 0.07);
  const bars = [
    (x, y) => sdRoundRect(x, y, 0.455, 0.385, 0.155, 0.028, 0.028),
    (x, y) => sdRoundRect(x, y, 0.425, 0.475, 0.125, 0.028, 0.028),
    (x, y) => sdRoundRect(x, y, 0.46, 0.565, 0.16, 0.028, 0.028),
  ];
  const dot = (x, y) => sdCircle(x, y, 0.665, 0.385, 0.045);

  const buf = Buffer.alloc(size * size * 3);
  const SUB = 2;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SUB; sy++) {
        for (let sx = 0; sx < SUB; sx++) {
          const x = (px + (sx + 0.5) / SUB) / size;
          const y = (py + (sy + 0.5) / SUB) / size;
          let col = bg;
          const covCard = clamp01(0.5 - card(x, y) * size);
          if (covCard > 0) col = mix(col, white, covCard);
          for (const bar of bars) {
            const cov = clamp01(0.5 - bar(x, y) * size);
            if (cov > 0) col = mix(col, green, cov);
          }
          const covDot = clamp01(0.5 - dot(x, y) * size);
          if (covDot > 0) col = mix(col, gold, covDot);
          r += col[0];
          g += col[1];
          b += col[2];
        }
      }
      const n = SUB * SUB;
      const i = (py * size + px) * 3;
      buf[i] = Math.round(r / n);
      buf[i + 1] = Math.round(g / n);
      buf[i + 2] = Math.round(b / n);
    }
  }
  return buf;
}

const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
];

for (const [name, size] of targets) {
  writeFileSync(join(outDir, name), encodePng(size, render(size)));
  console.log(`wrote public/icons/${name} (${size}x${size})`);
}
