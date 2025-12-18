// Browser PNG encoder/decoder using Squoosh codecs
// - squoosh_png: fast encode/decode
// - squoosh_oxipng: optimized encode with compression levels

import initSquoosh, { encode as squooshEncode, decode as squooshDecode } from './squoosh_png.js';
import initOxipng, { optimise as oxipngEncode } from './squoosh_oxipng.js';

let initialized = false;

// Initialize the WASM modules
export async function init(pngWasmUrl = './squoosh_png_bg.wasm', oxipngWasmUrl = './squoosh_oxipng_bg.wasm') {
  if (initialized) return;

  // Fetch WASM binaries and init both modules
  const [pngWasm, oxipngWasm] = await Promise.all([
    fetch(pngWasmUrl).then(r => r.arrayBuffer()),
    fetch(oxipngWasmUrl).then(r => r.arrayBuffer())
  ]);

  await Promise.all([
    initSquoosh(pngWasm),
    initOxipng(oxipngWasm)
  ]);

  initialized = true;
}

// Decode PNG to ImageData
export function decode(pngData) {
  if (!initialized) {
    throw new Error('Not initialized. Call init() first.');
  }
  const data = pngData instanceof Uint8Array ? pngData : new Uint8Array(pngData);
  return squooshDecode(data);
}

// Encode RGBA pixels to PNG (fast, default compression)
export function encode(imageData, width, height) {
  if (!initialized) {
    throw new Error('Not initialized. Call init() first.');
  }

  const { pixels, w, h } = extractPixels(imageData, width, height);
  return squooshEncode(pixels, w, h);
}

// Encode RGBA pixels to PNG with OxiPNG (better compression)
// level: 0-6 (higher = smaller file but slower)
export function encodeOptimized(imageData, width, height, level = 2, interlace = false) {
  if (!initialized) {
    throw new Error('Not initialized. Call init() first.');
  }

  const { pixels, w, h } = extractPixels(imageData, width, height);
  const clamped = pixels instanceof Uint8ClampedArray ? pixels : new Uint8ClampedArray(pixels);
  return oxipngEncode(clamped, w, h, level, interlace);
}

// Helper to extract pixels from ImageData or raw array
function extractPixels(imageData, width, height) {
  let pixels, w, h;
  if (imageData.data) {
    pixels = imageData.data;
    w = imageData.width;
    h = imageData.height;
  } else {
    pixels = imageData;
    w = width;
    h = height;
  }
  return { pixels, w, h };
}

export default init;
