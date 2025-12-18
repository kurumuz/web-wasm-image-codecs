#!/bin/bash

echo "=== WASM SIMD Instruction Count ==="
echo ""

FILES=(
  "web-wasm-png/pngs.wasm"
  "web-wasm-png-squoosh/squoosh_png_bg.wasm"
  "web-wasm-png-squoosh/squoosh_oxipng_bg.wasm"
  "web-wasm-webp/webp_enc.wasm"
  "web-wasm-webp/webp_dec.wasm"
  "node_modules/icodec/dist/pngquant_bg.wasm"
  "node_modules/icodec/dist/webp-dec.wasm"
)

for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    count=$(wasm-objdump -d "$f" 2>/dev/null | grep -c "v128")
    size=$(ls -lh "$f" | awk '{print $5}')
    printf "%-50s %6s  %4d SIMD ops\n" "$f" "$size" "$count"
  else
    printf "%-50s NOT FOUND\n" "$f"
  fi
done
