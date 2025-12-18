// Benchmark Web Worker - runs WASM encoding/decoding off the main thread

import { init as initPng, decodePng, encodePng, ColorType } from './web-wasm-png/pngs.js';
import { init as initSquoosh, decode as squooshDecode, encode as squooshEncode, encodeOptimized } from './web-wasm-png-squoosh/pngs.js';
import { init as initWebp, decode as webpDecode, encode as webpEncode } from './web-wasm-webp/webp.js';

let icodecPng = null;
let modulesReady = [];
let referenceBuffer = null;
let referenceWidth = 0;
let referenceHeight = 0;

// Compare two buffers, return true if identical
function buffersEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Compare decoded result to reference, return { correct, diffPixels }
function checkCorrectness(decoded, reference) {
  const data = decoded.data || decoded.image || decoded;
  if (!reference) return { correct: null, diffPixels: null }; // No reference loaded

  if (data.length !== reference.length) {
    return { correct: false, diffPixels: -1, reason: `size mismatch: ${data.length} vs ${reference.length}` };
  }

  let diffPixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    // Compare RGBA values
    if (data[i] !== reference[i] || data[i+1] !== reference[i+1] ||
        data[i+2] !== reference[i+2] || data[i+3] !== reference[i+3]) {
      diffPixels++;
    }
  }

  return { correct: diffPixels === 0, diffPixels };
}

// Initialize all WASM modules
async function initModules() {
  // Load reference buffer
  try {
    const [rawBuffer, dimensions] = await Promise.all([
      fetch('./image.raw').then(r => r.arrayBuffer()),
      fetch('./image.raw.json').then(r => r.json())
    ]);
    referenceBuffer = new Uint8Array(rawBuffer);
    referenceWidth = dimensions.width;
    referenceHeight = dimensions.height;
    console.log('Reference buffer loaded:', referenceWidth, 'x', referenceHeight);
  } catch (e) {
    console.warn('Could not load reference buffer:', e);
  }

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

// Benchmark runner - returns timing + last result for correctness check
function benchmark(fn, iterations, warmupCount = 3) {
  // Warmup
  let result;
  try {
    for (let i = 0; i < warmupCount; i++) result = fn();
  } catch (e) { return { error: e.message }; }

  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    result = fn();
    times.push(performance.now() - start);
  }

  return {
    avg: times.reduce((a, b) => a + b, 0) / times.length,
    min: Math.min(...times),
    max: Math.max(...times),
    size: result?.length || result?.byteLength,
    result // Keep result for correctness checking
  };
}

// Benchmark decode and check correctness against reference
function benchmarkDecode(name, decodeFn, iterations) {
  const timing = benchmark(decodeFn, iterations);
  if (timing.error) return { name, ...timing };

  // Check correctness
  const correctness = checkCorrectness(timing.result, referenceBuffer);
  return { name, ...timing, ...correctness, result: undefined };
}

// Benchmark encode and verify by decoding with reference decoder
function benchmarkEncode(name, encodeFn, iterations, verifyDecodeFn) {
  const timing = benchmark(encodeFn, iterations);
  if (timing.error) return { name, ...timing };

  // Verify by decoding and comparing to reference
  if (verifyDecodeFn && referenceBuffer) {
    try {
      const decoded = verifyDecodeFn(timing.result);
      const correctness = checkCorrectness(decoded, referenceBuffer);
      return { name, ...timing, ...correctness, result: undefined };
    } catch (e) {
      return { name, ...timing, correct: false, reason: e.message, result: undefined };
    }
  }

  return { name, ...timing, correct: null, result: undefined };
}

// Run all benchmarks - streams results one by one
function runBenchmarks(imageData, pngBytes, iterations, isPng) {
  const { width, height } = imageData;
  const pixels = imageData.data;
  const imgDataObj = { data: pixels, width, height };
  const imgDataWithDepth = { data: new Uint8ClampedArray(pixels), width, height, depth: 8 };

  // Use icodec or Squoosh as the reference decoder for verifying encodes (fastest correct decoder)
  const verifyPngDecode = icodecPng
    ? (data) => icodecPng.decode(data)
    : (data) => squooshDecode(data);

  // === DECODE BENCHMARKS ===
  if (isPng) {
    self.postMessage({ type: 'progress', message: 'Decoding: PNG (denosaurs)...' });
    self.postMessage({ type: 'result', category: 'decode', data: benchmarkDecode('PNG (denosaurs)', () => decodePng(pngBytes), iterations) });

    self.postMessage({ type: 'progress', message: 'Decoding: PNG (Squoosh)...' });
    self.postMessage({ type: 'result', category: 'decode', data: benchmarkDecode('PNG (Squoosh)', () => squooshDecode(pngBytes), iterations) });

    if (icodecPng) {
      self.postMessage({ type: 'progress', message: 'Decoding: icodec...' });
      self.postMessage({ type: 'result', category: 'decode', data: benchmarkDecode('icodec PNG', () => icodecPng.decode(pngBytes), iterations) });
    }
  }

  // WebP decode - no reference comparison for WebP (lossy)
  self.postMessage({ type: 'progress', message: 'Encoding WebP for decode test...' });
  const webpBytes = webpEncode(imgDataObj, { quality: 80 });
  self.postMessage({ type: 'progress', message: 'Decoding: WebP...' });
  const webpDecodeResult = benchmark(() => webpDecode(webpBytes), iterations);
  self.postMessage({ type: 'result', category: 'decode', data: { name: 'WebP', ...webpDecodeResult, correct: null, result: undefined } });

  // === ENCODE BENCHMARKS ===
  self.postMessage({ type: 'progress', message: 'Encoding: PNG (denosaurs)...' });
  self.postMessage({ type: 'result', category: 'encode', data: benchmarkEncode('PNG (denosaurs)', () => encodePng(pixels, width, height, { color: ColorType.RGBA }), iterations, verifyPngDecode) });

  self.postMessage({ type: 'progress', message: 'Encoding: PNG (Squoosh)...' });
  self.postMessage({ type: 'result', category: 'encode', data: benchmarkEncode('PNG (Squoosh)', () => squooshEncode(imgDataObj), iterations, verifyPngDecode) });

  self.postMessage({ type: 'progress', message: 'Encoding: OxiPNG L0...' });
  self.postMessage({ type: 'result', category: 'encode', data: benchmarkEncode('OxiPNG L0 (Squoosh)', () => encodeOptimized(imgDataObj, null, null, 0), iterations, verifyPngDecode) });

  self.postMessage({ type: 'progress', message: 'Encoding: OxiPNG L1...' });
  self.postMessage({ type: 'result', category: 'encode', data: benchmarkEncode('OxiPNG L1 (Squoosh)', () => encodeOptimized(imgDataObj, null, null, 1), iterations, verifyPngDecode) });

  self.postMessage({ type: 'progress', message: 'Encoding: OxiPNG L2...' });
  self.postMessage({ type: 'result', category: 'encode', data: benchmarkEncode('OxiPNG L2 (Squoosh)', () => encodeOptimized(imgDataObj, null, null, 2), iterations, verifyPngDecode) });

  if (icodecPng) {
    self.postMessage({ type: 'progress', message: 'Encoding: icodec L0...' });
    self.postMessage({ type: 'result', category: 'encode', data: benchmarkEncode('icodec PNG L0', () => icodecPng.encode(imgDataWithDepth, { quantize: false, level: 0 }), iterations, verifyPngDecode) });

    self.postMessage({ type: 'progress', message: 'Encoding: icodec L1...' });
    self.postMessage({ type: 'result', category: 'encode', data: benchmarkEncode('icodec PNG L1', () => icodecPng.encode(imgDataWithDepth, { quantize: false, level: 1 }), iterations, verifyPngDecode) });

    self.postMessage({ type: 'progress', message: 'Encoding: icodec L2...' });
    self.postMessage({ type: 'result', category: 'encode', data: benchmarkEncode('icodec PNG L2', () => icodecPng.encode(imgDataWithDepth, { quantize: false, level: 2 }), iterations, verifyPngDecode) });
  }

  // WebP lossy - no correctness check (lossy compression)
  self.postMessage({ type: 'progress', message: 'Encoding: WebP q80...' });
  const webpQ80Result = benchmark(() => webpEncode(imgDataObj, { quality: 80 }), iterations);
  self.postMessage({ type: 'result', category: 'encode', data: { name: 'WebP (q80)', ...webpQ80Result, correct: null, result: undefined } });

  // WebP lossless - verify with webp decoder
  self.postMessage({ type: 'progress', message: 'Encoding: WebP lossless...' });
  self.postMessage({ type: 'result', category: 'encode', data: benchmarkEncode('WebP (lossless)', () => webpEncode(imgDataObj, { lossless: 1 }), iterations, webpDecode) });

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
