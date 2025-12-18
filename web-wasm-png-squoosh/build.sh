#!/bin/sh

# Download latest PNG and OxiPNG WASM binaries from Squoosh

curl -O "https://raw.githubusercontent.com/GoogleChromeLabs/squoosh/dev/codecs/png/pkg/squoosh_png.js"
curl -O "https://raw.githubusercontent.com/GoogleChromeLabs/squoosh/dev/codecs/png/pkg/squoosh_png_bg.wasm"
curl -O "https://raw.githubusercontent.com/GoogleChromeLabs/squoosh/dev/codecs/oxipng/pkg/squoosh_oxipng.js"
curl -O "https://raw.githubusercontent.com/GoogleChromeLabs/squoosh/dev/codecs/oxipng/pkg/squoosh_oxipng_bg.wasm"

echo "\nDone."
