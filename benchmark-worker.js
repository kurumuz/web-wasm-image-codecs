// Benchmark Web Worker - runs WASM encoding/decoding off the main thread

import { init as initPng, decodePng, encodePng, ColorType } from './web-wasm-png/pngs.js';
import { init as initSquoosh, decode as squooshDecode, encode as squooshEncode, encodeOptimized } from './web-wasm-png-squoosh/pngs.js';
import { init as initWebp, decode as webpDecode, encode as webpEncode } from './web-wasm-webp/webp.js';

let icodecPng = null;
let modulesReady = [];

// Initialize all WASM modules
async function initModules() {
  try {
    await initPng('./web-wasm-png/pngs.wasm');
    modulesReady.push('PNG (denosaurs)');
  } catch (e) { console.error('PNG init failed:', e); }

  try {
    await initSquoosh('./web-wasm-png-squoosh/squoosh_png_bg.wasm', './web-wasm-png-squoosh/squoosh_oxipng_bg.wasm');
    modulesReady.push('PNG (Squoosh)');
  } catch (e) { console.error('Squoosh init failed:', e); }

  try {
    await initWebp('./web-wasm-webp/webp_enc.wasm', './web-wasm-webp/webp_dec.wasm');
    modulesReady.push('WebP');
  } catch (e) { console.error('WebP init failed:', e); }

  try {
    const { png } = await import('./node_modules/icodec/lib/index.js');
    await png.loadEncoder();
    icodecPng = png;
    modulesReady.push('icodec');
  } catch (e) { console.error('icodec init failed:', e); }

  return modulesReady;
}

// Benchmark runner
function benchmark(fn, iterations, warmupCount = 3) {
  // Warmup
  try {
    for (let i = 0; i < warmupCount; i++) fn();
  } catch (e) { return { error: e.message }; }

  const times = [];
  let result;
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    result = fn();
    times.push(performance.now() - start);
  }

  return {
    avg: times.reduce((a, b) => a + b, 0) / times.length,
    min: Math.min(...times),
    max: Math.max(...times),
    size: result?.length || result?.byteLength
  };
}

// Run all benchmarks - streams results one by one
function runBenchmarks(imageData, pngBytes, iterations, isPng) {
  const { width, height } = imageData;
  const pixels = imageData.data;
  const imgDataObj = { data: pixels, width, height };
  const imgDataWithDepth = { data: new Uint8ClampedArray(pixels), width, height, depth: 8 };

  // === DECODE BENCHMARKS ===
  if (isPng) {
    self.postMessage({ type: 'progress', message: 'Decoding: PNG (denosaurs)...' });
    self.postMessage({ type: 'result', category: 'decode', data: { name: 'PNG (denosaurs)', ...benchmark(() => decodePng(pngBytes), iterations) }});

    self.postMessage({ type: 'progress', message: 'Decoding: PNG (Squoosh)...' });
    self.postMessage({ type: 'result', category: 'decode', data: { name: 'PNG (Squoosh)', ...benchmark(() => squooshDecode(pngBytes), iterations) }});

    if (icodecPng) {
      self.postMessage({ type: 'progress', message: 'Decoding: icodec...' });
      self.postMessage({ type: 'result', category: 'decode', data: { name: 'icodec PNG', ...benchmark(() => icodecPng.decode(pngBytes), iterations) }});
    }
  }

  // WebP decode
  self.postMessage({ type: 'progress', message: 'Encoding WebP for decode test...' });
  const webpBytes = webpEncode(imgDataObj, { quality: 80 });
  self.postMessage({ type: 'progress', message: 'Decoding: WebP...' });
  self.postMessage({ type: 'result', category: 'decode', data: { name: 'WebP', ...benchmark(() => webpDecode(webpBytes), iterations) }});

  // === ENCODE BENCHMARKS ===
  self.postMessage({ type: 'progress', message: 'Encoding: PNG (denosaurs)...' });
  self.postMessage({ type: 'result', category: 'encode', data: { name: 'PNG (denosaurs)', ...benchmark(() => encodePng(pixels, width, height, { color: ColorType.RGBA }), iterations) }});

  self.postMessage({ type: 'progress', message: 'Encoding: PNG (Squoosh)...' });
  self.postMessage({ type: 'result', category: 'encode', data: { name: 'PNG (Squoosh)', ...benchmark(() => squooshEncode(imgDataObj), iterations) }});

  self.postMessage({ type: 'progress', message: 'Encoding: OxiPNG L0...' });
  self.postMessage({ type: 'result', category: 'encode', data: { name: 'OxiPNG L0 (Squoosh)', ...benchmark(() => encodeOptimized(imgDataObj, null, null, 0), iterations) }});

  self.postMessage({ type: 'progress', message: 'Encoding: OxiPNG L1...' });
  self.postMessage({ type: 'result', category: 'encode', data: { name: 'OxiPNG L1 (Squoosh)', ...benchmark(() => encodeOptimized(imgDataObj, null, null, 1), iterations) }});

  self.postMessage({ type: 'progress', message: 'Encoding: OxiPNG L2...' });
  self.postMessage({ type: 'result', category: 'encode', data: { name: 'OxiPNG L2 (Squoosh)', ...benchmark(() => encodeOptimized(imgDataObj, null, null, 2), iterations) }});

  if (icodecPng) {
    self.postMessage({ type: 'progress', message: 'Encoding: icodec L0...' });
    self.postMessage({ type: 'result', category: 'encode', data: { name: 'icodec PNG L0', ...benchmark(() => icodecPng.encode(imgDataWithDepth, { quantize: false, level: 0 }), iterations) }});

    self.postMessage({ type: 'progress', message: 'Encoding: icodec L1...' });
    self.postMessage({ type: 'result', category: 'encode', data: { name: 'icodec PNG L1', ...benchmark(() => icodecPng.encode(imgDataWithDepth, { quantize: false, level: 1 }), iterations) }});

    self.postMessage({ type: 'progress', message: 'Encoding: icodec L2...' });
    self.postMessage({ type: 'result', category: 'encode', data: { name: 'icodec PNG L2', ...benchmark(() => icodecPng.encode(imgDataWithDepth, { quantize: false, level: 2 }), iterations) }});
  }

  self.postMessage({ type: 'progress', message: 'Encoding: WebP q80...' });
  self.postMessage({ type: 'result', category: 'encode', data: { name: 'WebP (q80)', ...benchmark(() => webpEncode(imgDataObj, { quality: 80 }), iterations) }});

  self.postMessage({ type: 'progress', message: 'Encoding: WebP lossless...' });
  self.postMessage({ type: 'result', category: 'encode', data: { name: 'WebP (lossless)', ...benchmark(() => webpEncode(imgDataObj, { lossless: 1 }), iterations) }});

  // Signal completion
  self.postMessage({ type: 'done' });
}

// Handle messages from main thread
self.onmessage = async (e) => {
  const { type, data } = e.data;

  if (type === 'init') {
    const ready = await initModules();
    self.postMessage({ type: 'ready', modules: ready });
  } else if (type === 'benchmark') {
    const { imageData, pngBytes, iterations, isPng } = data;
    runBenchmarks(imageData, pngBytes, iterations, isPng);
  }
};
