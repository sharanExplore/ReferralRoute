// ReferralRoute Icon Generator
// Creates professional, crisp PNG icons using anti-aliased signed distance field (SDF) rendering
// Sizes: 16x16, 32x32, 48x48, 128x128, and 300x300 store logo.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, '../public/icons');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// CRC-32 table for standard PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function encodePng(width, height, rgbaBuffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace method

  const rowLen = 1 + width * 4;
  const rawScanlines = Buffer.alloc(height * rowLen);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLen;
    rawScanlines[rowOffset] = 0; // Filter: None
    rgbaBuffer.copy(rawScanlines, rowOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressedData = zlib.deflateSync(rawScanlines, { level: 9 });

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressedData),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// Distance to 2D line segment
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// Distance to quarter-circle circular arc (top-right quarter: angle -PI/2 to 0)
function distToArcQuarter(px, py, cx, cy, r) {
  const angle = Math.atan2(py - cy, px - cx);
  // Quarter arc from -PI/2 (top) to 0 (right)
  if (angle >= -Math.PI / 2 && angle <= 0) {
    return Math.abs(Math.hypot(px - cx, py - cy) - r);
  }
  // Otherwise distance to endpoints: (cx, cy - r) and (cx + r, cy)
  const d1 = Math.hypot(px - cx, py - (cy - r));
  const d2 = Math.hypot(px - (cx + r), py - cy);
  return Math.min(d1, d2);
}

// Distance to rounded rectangle (normalized 0 to 1)
function distToRoundedRect(u, v, widthRatio, heightRatio, cornerRadius) {
  const halfW = widthRatio / 2;
  const halfH = heightRatio / 2;
  const r = cornerRadius;
  const qx = Math.abs(u - 0.5) - (halfW - r);
  const qy = Math.abs(v - 0.5) - (halfH - r);
  if (qx > 0 && qy > 0) {
    return Math.hypot(qx, qy) - r;
  }
  return Math.max(qx, qy) - r;
}

// Render an icon of size x size with 4x supersampling
function renderIcon(size) {
  const superFactor = size <= 32 ? 4 : (size <= 128 ? 3 : 2);
  const sWidth = size * superFactor;
  const sHeight = size * superFactor;
  const sBuffer = Buffer.alloc(sWidth * sHeight * 4);

  // Geometry configuration (proportional)
  const cornerR = 0.22; // rounded corner radius (0 to 0.5)
  const rectSize = 0.94; // slightly inset from canvas edge for crisp outer antialiasing

  // Stroke width tuning based on target resolution
  const strokeW = size === 16 ? 0.125 : (size === 32 ? 0.11 : 0.095);
  const halfStroke = strokeW / 2;

  // Node centers (in 0..1 coordinates)
  const n1x = 0.27;
  const n1y = 0.27;
  const n1r = size === 16 ? 0.12 : 0.115;
  const dot1r = size === 16 ? 0.05 : 0.045;

  const n2x = 0.73;
  const n2y = 0.73;
  const n2r = size === 16 ? 0.12 : 0.115;
  const dot2r = size === 16 ? 0.05 : 0.045;

  // Route path geometry:
  // Starts at right edge of Node 1: (n1x + n1r, n1y)
  // Horizontal line to arc start: (arcCx, n1y)
  // Arc center: (arcCx, arcCy) where arcCx + arcR = n2x and arcCy - arcR = n1y
  const arcR = 0.16;
  const arcCx = n2x - arcR;
  const arcCy = n1y + arcR;

  // Sample each subpixel
  for (let sy = 0; sy < sHeight; sy++) {
    const v = (sy + 0.5) / sHeight;
    for (let sx = 0; sx < sWidth; sx++) {
      const u = (sx + 0.5) / sWidth;

      // 1. Container distance
      const distBg = distToRoundedRect(u, v, rectSize, rectSize, cornerR);

      if (distBg > 0.015) {
        // Completely outside rounded rect
        const offset = (sy * sWidth + sx) * 4;
        sBuffer[offset] = 0;
        sBuffer[offset + 1] = 0;
        sBuffer[offset + 2] = 0;
        sBuffer[offset + 3] = 0;
        continue;
      }

      // Background color: diagonal gradient #2563eb (top-left) to #1d4ed8 (bottom-right)
      const gradT = Math.max(0, Math.min(1, (u + v) * 0.5));
      let bgR = Math.round(37 + (29 - 37) * gradT);
      let bgG = Math.round(99 + (78 - 99) * gradT);
      let bgB = Math.round(235 + (216 - 235) * gradT);

      // Subtle top/left ambient illumination
      if (v < 0.3) {
        const light = (0.3 - v) * 0.25;
        bgR = Math.min(255, Math.round(bgR + 40 * light));
        bgG = Math.min(255, Math.round(bgG + 40 * light));
        bgB = Math.min(255, Math.round(bgB + 20 * light));
      }

      // Smooth alpha for rounded rect boundary
      let bgAlpha = 1.0;
      if (distBg > -0.01) {
        bgAlpha = Math.max(0, Math.min(1, (0.01 - distBg) / 0.02));
      }

      // 2. Foreground Graphic Distances
      // Node 1 circle outline
      const distN1Outline = Math.abs(Math.hypot(u - n1x, v - n1y) - n1r) - halfStroke;
      // Node 1 center dot
      const distN1Dot = Math.hypot(u - n1x, v - n1y) - dot1r;

      // Node 2 circle outline
      const distN2Outline = Math.abs(Math.hypot(u - n2x, v - n2y) - n2r) - halfStroke;
      // Node 2 center dot
      const distN2Dot = Math.hypot(u - n2x, v - n2y) - dot2r;

      // Route line 1: horizontal segment from (n1x + n1r, n1y) to (arcCx, n1y)
      const distSeg1 = distToSegment(u, v, n1x + n1r, n1y, arcCx, n1y) - halfStroke;

      // Route line 2: quarter arc from (arcCx, n1y) to (n2x, arcCy)
      const distArc = distToArcQuarter(u, v, arcCx, arcCy, arcR) - halfStroke;

      // Route line 3: vertical segment from (n2x, arcCy) to (n2x, n2y - n2r)
      const distSeg2 = distToSegment(u, v, n2x, arcCy, n2x, n2y - n2r) - halfStroke;

      // Combine graphic distances (union = minimum distance)
      const fgDist = Math.min(
        distN1Outline,
        distN1Dot,
        distN2Outline,
        distN2Dot,
        distSeg1,
        distArc,
        distSeg2
      );

      // Antialiased blending
      let finalR = bgR;
      let finalG = bgG;
      let finalB = bgB;
      let finalA = bgAlpha;

      if (fgDist < 0.012) {
        const fgAlpha = Math.max(0, Math.min(1, (0.012 - fgDist) / 0.024));
        // Route stroke & node color: pure crisp white #ffffff
        finalR = Math.round(finalR * (1 - fgAlpha) + 255 * fgAlpha);
        finalG = Math.round(finalG * (1 - fgAlpha) + 255 * fgAlpha);
        finalB = Math.round(finalB * (1 - fgAlpha) + 255 * fgAlpha);
      }

      const offset = (sy * sWidth + sx) * 4;
      sBuffer[offset] = finalR;
      sBuffer[offset + 1] = finalG;
      sBuffer[offset + 2] = finalB;
      sBuffer[offset + 3] = Math.round(finalA * 255);
    }
  }

  // Downsample to target size
  const outBuffer = Buffer.alloc(size * size * 4);
  const boxSamples = superFactor * superFactor;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let sumA = 0;

      for (let dy = 0; dy < superFactor; dy++) {
        const sy = y * superFactor + dy;
        for (let dx = 0; dx < superFactor; dx++) {
          const sx = x * superFactor + dx;
          const sOffset = (sy * sWidth + sx) * 4;
          const a = sBuffer[sOffset + 3] / 255;
          sumR += sBuffer[sOffset] * a;
          sumG += sBuffer[sOffset + 1] * a;
          sumB += sBuffer[sOffset + 2] * a;
          sumA += sBuffer[sOffset + 3];
        }
      }

      const outOffset = (y * size + x) * 4;
      const avgA = sumA / boxSamples;
      if (avgA > 0) {
        outBuffer[outOffset] = Math.min(255, Math.round(sumR / (sumA / 255)));
        outBuffer[outOffset + 1] = Math.min(255, Math.round(sumG / (sumA / 255)));
        outBuffer[outOffset + 2] = Math.min(255, Math.round(sumB / (sumA / 255)));
        outBuffer[outOffset + 3] = Math.round(avgA);
      } else {
        outBuffer[outOffset] = 0;
        outBuffer[outOffset + 1] = 0;
        outBuffer[outOffset + 2] = 0;
        outBuffer[outOffset + 3] = 0;
      }
    }
  }

  return encodePng(size, size, outBuffer);
}

// Generate SVG vector icon
function generateSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>
    <filter id="subtleGlow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#0f172a" flood-opacity="0.35"/>
    </filter>
  </defs>
  <!-- Rounded Container -->
  <rect x="24" y="24" width="464" height="464" rx="104" fill="url(#bgGrad)" />
  <!-- Referral Route Network Symbol -->
  <g filter="url(#subtleGlow)">
    <!-- Route Connector Path -->
    <path d="M 196 138 H 314 A 60 60 0 0 1 374 198 V 316" fill="none" stroke="#ffffff" stroke-width="48" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Node 1 (Candidate) -->
    <circle cx="138" cy="138" r="58" fill="none" stroke="#ffffff" stroke-width="48" />
    <circle cx="138" cy="138" r="22" fill="#ffffff" />
    <!-- Node 2 (Target Company / Contact) -->
    <circle cx="374" cy="374" r="58" fill="none" stroke="#ffffff" stroke-width="48" />
    <circle cx="374" cy="374" r="22" fill="#ffffff" />
  </g>
</svg>
`;
}

console.log('Generating ReferralRoute branded extension icons...');

const iconsToGenerate = [
  { name: 'icon-16.png', size: 16 },
  { name: 'icon-32.png', size: 32 },
  { name: 'icon-48.png', size: 48 },
  { name: 'icon-128.png', size: 128 },
  { name: 'store-logo-300.png', size: 300 },
];

for (const { name, size } of iconsToGenerate) {
  const pngData = renderIcon(size);
  const outPath = path.join(outDir, name);
  fs.writeFileSync(outPath, pngData);
  console.log(`✓ Generated ${name} (${size}x${size}, ${pngData.length} bytes)`);
}

const svgPath = path.join(outDir, 'icon.svg');
fs.writeFileSync(svgPath, generateSvg());
console.log(`✓ Generated icon.svg (512x512 vector source)`);

console.log('All icons successfully created in extension/public/icons/');
