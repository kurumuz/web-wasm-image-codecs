#!/bin/sh

# Download latest WebP WASM binaries from Squoosh

curl -o webp_dec.wasm "https://raw.githubusercontent.com/GoogleChromeLabs/squoosh/dev/codecs/webp/dec/webp_node_dec.wasm"
curl -o webp_enc.wasm "https://raw.githubusercontent.com/GoogleChromeLabs/squoosh/dev/codecs/webp/enc/webp_node_enc.wasm"

echo "\nDone."
