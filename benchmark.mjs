#!/usr/bin/env node

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Polyfill ImageData for Node.js (WebP decoder needs it)
globalThis.ImageData = class ImageData {
  constructor(data, width, height) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
};

// Polyfill fetch for Node.js to read local files
globalThis.fetch = async (url) => {
  const buffer = readFileSync(join(__dirname, url));
  return {
    ok: true,
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  };
};

// Disable streaming instantiation (Node doesn't support it well)
WebAssembly.instantiateStreaming = async (source, imports) => {
  const response = await source;
  const buffer = await response.arrayBuffer();
  return WebAssembly.instantiate(buffer, imports);
};

// Load PNG module (denosaurs)
const pngModule = await import('./web-wasm-png/pngs.js');
await pngModule.init('./web-wasm-png/pngs.wasm');

// Load PNG module (Squoosh + OxiPNG)
const pngSquooshModule = await import('./web-wasm-png-squoosh/pngs.js');
await pngSquooshModule.init(
  './web-wasm-png-squoosh/squoosh_png_bg.wasm',
  './web-wasm-png-squoosh/squoosh_oxipng_bg.wasm'
);

// Load WebP module
const webpModule = await import('./web-wasm-webp/webp.js');
await webpModule.init('./web-wasm-webp/webp_enc.wasm', './web-wasm-webp/webp_dec.wasm');

// Read test image - detect format by magic bytes
const imageFile = readFileSync(join(__dirname, 'image.png'));
const imageData = new Uint8Array(imageFile);
const isWebP = imageData[0] === 0x52 && imageData[1] === 0x49; // "RI" for RIFF
const isPNG = imageData[0] === 0x89 && imageData[1] === 0x50;  // PNG signature

console.log(`\nTest image: image.png (${(imageData.length / 1024).toFixed(1)} KB)`);
console.log(`Detected format: ${isWebP ? 'WebP' : isPNG ? 'PNG' : 'Unknown'}\n`);

const iterations = 5;

// Benchmark function
function benchmark(name, fn, iterations) {
  // Warmup
  fn();

  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    times.push(end - start);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);

  return { name, avg, min, max };
}

// Store results
const results = [];
let pixels, width, height;

// First, get raw pixels from the input image
if (isWebP) {
  const decoded = webpModule.decode(imageData);
  pixels = decoded.data;
  width = decoded.width;
  height = decoded.height;
} else if (isPNG) {
  const decoded = pngModule.decodePng(imageData);
  pixels = decoded.image;
  width = decoded.width;
  height = decoded.height;
} else {
  console.error('Unknown image format');
  process.exit(1);
}

console.log(`Image dimensions: ${width} x ${height}`);

// Create ImageData-like object
const imgData = { data: pixels, width, height };

// PNG Decode benchmark (encode first, then benchmark decode)
const pngEncoded = pngModule.encodePng(pixels, width, height, { color: pngModule.ColorType.RGBA });

const pngDecodeResult = benchmark('PNG Decode', () => {
  return pngModule.decodePng(pngEncoded);
}, iterations);
results.push(pngDecodeResult);

// PNG Encode (denosaurs)
const pngEncodeResult = benchmark('PNG Encode', () => {
  return pngModule.encodePng(pixels, width, height, { color: pngModule.ColorType.RGBA });
}, iterations);
results.push(pngEncodeResult);

// PNG Squoosh Decode benchmark
const pngSquooshEncoded = pngSquooshModule.encode(imgData);

const pngSquooshDecodeResult = benchmark('PNG Decode (Squoosh)', () => {
  return pngSquooshModule.decode(pngSquooshEncoded);
}, iterations);
results.push(pngSquooshDecodeResult);

// PNG Squoosh Encode
const pngSquooshEncodeResult = benchmark('PNG Encode (Squoosh)', () => {
  return pngSquooshModule.encode(imgData);
}, iterations);
results.push(pngSquooshEncodeResult);

// OxiPNG Encode (level 1)
const oxipngEncodeL1Result = benchmark('PNG OxiPNG (level 1)', () => {
  return pngSquooshModule.encodeOptimized(imgData, null, null, 1);
}, iterations);
results.push(oxipngEncodeL1Result);

// OxiPNG Encode (level 2)
const oxipngEncodeL2Result = benchmark('PNG OxiPNG (level 2)', () => {
  return pngSquooshModule.encodeOptimized(imgData, null, null, 2);
}, iterations);
results.push(oxipngEncodeL2Result);

// WebP Decode benchmark (encode first, then benchmark decode)
const webpEncoded = webpModule.encode(imgData, { quality: 80 });

const webpDecodeResult = benchmark('WebP Decode', () => {
  return webpModule.decode(webpEncoded);
}, iterations);
results.push(webpDecodeResult);

// WebP Encode (lossy q80)
const webpEncode80Result = benchmark('WebP Encode (q80)', () => {
  return webpModule.encode(imgData, { quality: 80 });
}, iterations);
results.push(webpEncode80Result);

// WebP Encode (lossless)
const webpEncodeLosslessResult = benchmark('WebP Encode (lossless)', () => {
  return webpModule.encode(imgData, { lossless: 1 });
}, iterations);
results.push(webpEncodeLosslessResult);

// Print results
console.log(`\n${'Operation'.padEnd(25)} ${'Avg (ms)'.padStart(10)} ${'Min'.padStart(10)} ${'Max'.padStart(10)}`);
console.log('-'.repeat(57));

for (const r of results) {
  console.log(`${r.name.padEnd(25)} ${r.avg.toFixed(2).padStart(10)} ${r.min.toFixed(2).padStart(10)} ${r.max.toFixed(2).padStart(10)}`);
}

// Print sizes
const oxipngL1 = pngSquooshModule.encodeOptimized(imgData, null, null, 1);
const oxipngL2 = pngSquooshModule.encodeOptimized(imgData, null, null, 2);
const webpLossless = webpModule.encode(imgData, { lossless: 1 });

console.log(`\n${'Format'.padEnd(25)} ${'Size'.padStart(15)}`);
console.log('-'.repeat(42));
console.log(`${'Original file'.padEnd(25)} ${(imageData.length / 1024).toFixed(1).padStart(12)} KB`);
console.log(`${'PNG (denosaurs)'.padEnd(25)} ${(pngEncoded.length / 1024).toFixed(1).padStart(12)} KB`);
console.log(`${'PNG (Squoosh)'.padEnd(25)} ${(pngSquooshEncoded.length / 1024).toFixed(1).padStart(12)} KB`);
console.log(`${'PNG OxiPNG (level 1)'.padEnd(25)} ${(oxipngL1.length / 1024).toFixed(1).padStart(12)} KB`);
console.log(`${'PNG OxiPNG (level 2)'.padEnd(25)} ${(oxipngL2.length / 1024).toFixed(1).padStart(12)} KB`);
console.log(`${'WebP (q80)'.padEnd(25)} ${(webpEncoded.length / 1024).toFixed(1).padStart(12)} KB`);
console.log(`${'WebP (lossless)'.padEnd(25)} ${(webpLossless.length / 1024).toFixed(1).padStart(12)} KB`);

console.log('');
