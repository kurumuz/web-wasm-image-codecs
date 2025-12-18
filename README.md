# wasm-image-codecs

Browser-compatible PNG and WebP image encoders/decoders using WebAssembly.

## Benchmark

Test image: 1024 x 1536 PNG (2.3 MB)

| Operation | Avg (ms) | Min | Max |
|-----------|----------|-----|-----|
| PNG Decode | 138.21 | 134.24 | 142.37 |
| PNG Encode | 81.43 | 81.04 | 81.95 |
| PNG Decode (Squoosh) | 52.61 | 50.96 | 56.22 |
| PNG Encode (Squoosh) | 90.98 | 87.45 | 96.30 |
| PNG OxiPNG (level 1) | 1113.27 | 1091.09 | 1130.81 |
| PNG OxiPNG (level 2) | 2244.14 | 2201.69 | 2292.24 |
| WebP Decode | 24.38 | 23.81 | 25.04 |
| WebP Encode (q80) | 183.22 | 177.61 | 186.03 |
| WebP Encode (lossless) | 839.75 | 821.62 | 855.59 |

| Format | Size |
|--------|------|
| Original PNG | 2268.9 KB |
| PNG (default) | 2836.3 KB |
| PNG OxiPNG (level 1) | 2107.8 KB |
| PNG OxiPNG (level 2) | 2101.4 KB |
| WebP (q80) | 153.1 KB |
| WebP (lossless) | 1521.3 KB |

Run `node benchmark.mjs` to run the benchmark yourself.

## Packages

### web-wasm-png

PNG encoder/decoder. Based on [denosaurs/pngs](https://github.com/denosaurs/pngs).

```js
import { init, encodePng, decodePng } from './pngs.js';

await init();
const decoded = decodePng(pngBytes);
const encoded = encodePng(pixels, width, height, { color: ColorType.RGBA });
```

### web-wasm-png-squoosh

PNG encoder/decoder with OxiPNG optimization. Based on [GoogleChromeLabs/squoosh](https://github.com/GoogleChromeLabs/squoosh).

```js
import { init, encode, decode, encodeOptimized } from './pngs.js';

await init();

// Fast decode (2.5x faster than denosaurs)
const decoded = decode(pngBytes);

// Fast encode (default compression)
const encoded = encode(imageData);

// Optimized encode (smaller files, slower)
// level: 0-6 (1 recommended for best speed/size balance)
const optimized = encodeOptimized(imageData, null, null, 1);
```

### web-wasm-webp

WebP encoder/decoder. Based on [GoogleChromeLabs/squoosh](https://github.com/GoogleChromeLabs/squoosh) via [jhuckaby/webp-wasm](https://github.com/jhuckaby/webp-wasm).

```js
import { init, encode, decode } from './webp.js';

await init();
const imageData = decode(webpBytes);
const webpBytes = encode(imageData, { quality: 80, lossless: 0 });
```

## Running the Demos

```bash
cd web-wasm-png && npm start          # http://localhost:8090
cd web-wasm-png-squoosh && npm start  # http://localhost:8092
cd web-wasm-webp && npm start         # http://localhost:8091
```

## License

MIT - See [LICENSE](./LICENSE) for attribution.
