#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
for tool in node npm pnpm make jq uuidgen cargo rustc wasm-bindgen wasm-snip wasm-opt java clang gcc; do
  command -v "$tool" >/dev/null || { echo "Missing $tool; see README.md development setup." >&2; exit 1; }
done
[[ "$(wasm-bindgen --version)" == "wasm-bindgen 0.2.105" ]] || { echo 'wasm-bindgen 0.2.105 is required.' >&2; exit 1; }
[[ "$(pnpm --version)" == "10.12.1" ]] || { echo 'pnpm 10.12.1 is required by browser.js.' >&2; exit 1; }
node -e 'if (+process.versions.node.split(".")[0] < 24) process.exit(1)'
git submodule update --init --recursive
make static
node scripts/package-nebula.mjs
node --test tests/*.test.mjs
node scripts/verify-static.mjs
