// Browser-compatible WebP encoder/decoder
// Wrapper for webp-wasm

import createEncoderModule from './webp_enc.js';
import createDecoderModule from './webp_dec.js';

let encoder = null;
let decoder = null;
let initialized = false;

// Default encoding options
const DEFAULT_ENCODE_OPTS = {
  quality: 80,
  target_size: 0,
  target_PSNR: 0,
  method: 4,
  sns_strength: 50,
  filter_strength: 60,
  filter_sharpness: 0,
  filter_type: 1,
  partitions: 0,
  segments: 4,
  pass: 1,
  show_compressed: 0,
  preprocessing: 0,
  autofilter: 0,
  partition_limit: 0,
  alpha_compression: 1,
  alpha_filtering: 1,
  alpha_quality: 100,
  lossless: 0,
  exact: 0,
  image_hint: 0,
  emulate_jpeg_size: 0,
  thread_level: 0,
  low_memory: 0,
  near_lossless: 100,
  use_delta_palette: 0,
  use_sharp_yuv: 0
};

// Initialize both encoder and decoder
export async function init(encoderWasmUrl = './webp_enc.wasm', decoderWasmUrl = './webp_dec.wasm') {
  if (initialized) return;

  // Load WASM binaries
  const [encWasm, decWasm] = await Promise.all([
    fetch(encoderWasmUrl).then(r => r.arrayBuffer()),
    fetch(decoderWasmUrl).then(r => r.arrayBuffer())
  ]);

  // Initialize both modules
  const [encModule, decModule] = await Promise.all([
    createEncoderModule({ wasmBinary: encWasm }),
    createDecoderModule({ wasmBinary: decWasm })
  ]);

  encoder = encModule;
  decoder = decModule;
  initialized = true;
}

// Decode WebP to ImageData
export function decode(webpData) {
  if (!decoder) {
    throw new Error('Decoder not initialized. Call init() first.');
  }

  // Ensure we have an ArrayBuffer
  const buffer = webpData.buffer || webpData;
  return decoder.decode(buffer);
}

// Encode ImageData to WebP
export function encode(imageData, options = {}) {
  if (!encoder) {
    throw new Error('Encoder not initialized. Call init() first.');
  }

  const opts = { ...DEFAULT_ENCODE_OPTS, ...options };
  const result = encoder.encode(imageData.data, imageData.width, imageData.height, opts);
  return new Uint8Array(result.buffer || result);
}

// Export default options for reference
export { DEFAULT_ENCODE_OPTS };

export default init;
