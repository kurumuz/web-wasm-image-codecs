# wasm-image-codecs

Browser-compatible PNG and WebP image encoders/decoders using WebAssembly.

## Benchmark

Test image: 1024 x 1536 PNG (2.3 MB)

| Operation | Avg (ms) | Min | Max |
|-----------|----------|-----|-----|
| PNG Decode | 132.40 | 130.74 | 136.05 |
| PNG Encode | 78.42 | 77.52 | 79.13 |
| WebP Decode | 25.94 | 24.18 | 30.90 |
| WebP Encode (q80) | 178.86 | 177.58 | 182.09 |
| WebP Encode (lossless) | 814.99 | 809.40 | 820.95 |

| Format | Size |
|--------|------|
| Original PNG | 2268.9 KB |
| Re-encoded PNG (default) | 2836.3 KB |
| WebP (q80) | 153.1 KB |
| WebP (lossless) | 1521.3 KB |

*Note: Re-encoded PNG is larger because it uses default compression. Use `compression: Compression.Best` for smaller files (but 30x slower).*

Run `node benchmark.mjs` to run the benchmark yourself.

## Packages

### web-wasm-png

PNG encoder/decoder using WASM. Based on [denosaurs/pngs](https://github.com/denosaurs/pngs).

```js
import { init, encodePng, decodePng } from './pngs.js';

await init();

// Decode PNG to raw pixels
const decoded = decodePng(pngBytes);
// { width, height, image: Uint8Array, colorType, bitDepth }

// Encode raw pixels to PNG
const encoded = encodePng(pixels, width, height, { color: ColorType.RGBA });
```

### web-wasm-webp

WebP encoder/decoder using WASM. Based on [jhuckaby/webp-wasm](https://github.com/jhuckaby/webp-wasm) (Squoosh codecs).

```js
import { init, encode, decode } from './webp.js';

await init();

// Decode WebP to ImageData
const imageData = decode(webpBytes);
// { width, height, data: Uint8ClampedArray }

// Encode ImageData to WebP
const webpBytes = encode(imageData, { quality: 80, lossless: 0 });
```

## Running the Demos

Each package includes an `index.html` demo:

```bash
cd web-wasm-png && npm start   # http://localhost:8090
cd web-wasm-webp && npm start  # http://localhost:8091
```

## License

MIT - See [LICENSE](./LICENSE) for attribution to original projects.
