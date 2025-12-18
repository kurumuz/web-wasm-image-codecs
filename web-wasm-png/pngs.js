// Browser-compatible PNG encoder/decoder using WASM
// Adapted from https://github.com/denosaurs/pngs

// WASM module instance
let wasm = null;

// Initialization flag
let initialized = false;

// Text decoder for string handling
const textDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
textDecoder.decode();

// Memory views (updated when memory grows)
let cachedUint8Memory = null;
let cachedInt32Memory = null;

function getUint8Memory() {
  if (cachedUint8Memory === null || cachedUint8Memory.buffer !== wasm.memory.buffer) {
    cachedUint8Memory = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8Memory;
}

function getInt32Memory() {
  if (cachedInt32Memory === null || cachedInt32Memory.buffer !== wasm.memory.buffer) {
    cachedInt32Memory = new Int32Array(wasm.memory.buffer);
  }
  return cachedInt32Memory;
}

function getStringFromWasm(ptr, len) {
  return textDecoder.decode(getUint8Memory().subarray(ptr, ptr + len));
}

// Object heap for passing JS objects to WASM
const heap = new Array(32).fill(void 0);
heap.push(void 0, null, true, false);
let heapNext = heap.length;

function addToHeap(obj) {
  if (heapNext === heap.length) {
    heap.push(heap.length + 1);
  }
  const idx = heapNext;
  heapNext = heap[idx];
  heap[idx] = obj;
  return idx;
}

function getFromHeap(idx) {
  return heap[idx];
}

function dropFromHeap(idx) {
  if (idx < 36) return;
  heap[idx] = heapNext;
  heapNext = idx;
}

function takeFromHeap(idx) {
  const obj = getFromHeap(idx);
  dropFromHeap(idx);
  return obj;
}

// Memory allocation tracking
let WASM_VECTOR_LEN = 0;

function passArrayToWasm(arr, allocFn) {
  const ptr = allocFn(arr.length);
  getUint8Memory().set(arr, ptr);
  WASM_VECTOR_LEN = arr.length;
  return ptr;
}

function isLikeNone(x) {
  return x === undefined || x === null;
}

function getArrayFromWasm(ptr, len) {
  return getUint8Memory().subarray(ptr, ptr + len);
}

// Public encode function
export function encode(
  image,
  width,
  height,
  palette,
  trns,
  color,
  depth,
  compression,
  filter
) {
  if (!initialized) {
    throw new Error("WASM module not initialized. Call init() first.");
  }

  try {
    const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);

    const ptr0 = passArrayToWasm(image, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;

    const ptr1 = isLikeNone(palette) ? 0 : passArrayToWasm(palette, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;

    const ptr2 = isLikeNone(trns) ? 0 : passArrayToWasm(trns, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;

    wasm.encode(
      retptr,
      ptr0, len0,
      width, height,
      ptr1, len1,
      ptr2, len2,
      isLikeNone(color) ? 0xFFFFFF : color,
      isLikeNone(depth) ? 0xFFFFFF : depth,
      isLikeNone(compression) ? 0xFFFFFF : compression,
      isLikeNone(filter) ? 0xFFFFFF : filter
    );

    const mem = getInt32Memory();
    const resultPtr = mem[retptr / 4 + 0];
    const resultLen = mem[retptr / 4 + 1];

    const result = getArrayFromWasm(resultPtr, resultLen).slice();
    wasm.__wbindgen_free(resultPtr, resultLen);

    return result;
  } finally {
    wasm.__wbindgen_add_to_stack_pointer(16);
  }
}

// Public decode function
export function decode(image) {
  if (!initialized) {
    throw new Error("WASM module not initialized. Call init() first.");
  }

  const ptr = passArrayToWasm(image, wasm.__wbindgen_malloc);
  const len = WASM_VECTOR_LEN;

  return takeFromHeap(wasm.decode(ptr, len));
}

// Initialize the WASM module
export async function init(wasmUrl = './pngs.wasm') {
  if (initialized) return;

  const imports = {
    wbg: {
      __wbindgen_string_new: function(ptr, len) {
        return addToHeap(getStringFromWasm(ptr, len));
      },
      __wbindgen_json_parse: function(ptr, len) {
        return addToHeap(JSON.parse(getStringFromWasm(ptr, len)));
      },
      __wbindgen_throw: function(ptr, len) {
        throw new Error(getStringFromWasm(ptr, len));
      },
      __wbindgen_rethrow: function(idx) {
        throw takeFromHeap(idx);
      }
    }
  };

  // Use streaming instantiation for best performance
  const { instance } = await WebAssembly.instantiateStreaming(
    fetch(wasmUrl),
    imports
  );

  wasm = instance.exports;
  initialized = true;
}

// Color types enum
export const ColorType = {
  Grayscale: 0,
  RGB: 2,
  Indexed: 3,
  GrayscaleAlpha: 4,
  RGBA: 6,
};

// Bit depth enum
export const BitDepth = {
  One: 1,
  Two: 2,
  Four: 4,
  Eight: 8,
  Sixteen: 16,
};

// Compression enum
export const Compression = {
  Default: 0,
  Fast: 1,
  Best: 2,
  Huffman: 3,
  Rle: 4,
};

// Filter type enum
export const FilterType = {
  NoFilter: 0,
  Sub: 1,
  Up: 2,
  Avg: 3,
  Paeth: 4,
};

// High-level encode function (matches mod.ts interface)
export function encodePng(
  image,
  width,
  height,
  options = {}
) {
  if (options.stripAlpha) {
    // Remove alpha channel from RGBA data
    const rgbImage = new Uint8Array((image.length / 4) * 3);
    let j = 0;
    for (let i = 0; i < image.length; i += 4) {
      rgbImage[j++] = image[i];
      rgbImage[j++] = image[i + 1];
      rgbImage[j++] = image[i + 2];
    }
    image = rgbImage;
  }

  return encode(
    image,
    width,
    height,
    options.palette,
    options.trns,
    options.color ?? ColorType.RGBA,
    options.depth ?? BitDepth.Eight,
    options.compression,
    options.filter
  );
}

// High-level decode function (matches mod.ts interface)
export function decodePng(image) {
  const res = decode(image);

  return {
    image: new Uint8Array(res.image),
    width: res.width,
    height: res.height,
    colorType: res.colorType,
    bitDepth: res.bitDepth,
    lineSize: res.lineSize,
  };
}

export default init;
