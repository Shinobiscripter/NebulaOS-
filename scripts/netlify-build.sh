#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Netlify's build image supplies the native compiler/JRE; verify before downloads.
for tool in make jq uuidgen java clang gcc; do
  command -v "$tool" >/dev/null || { echo "Netlify image lacks $tool. Build with GitHub Actions and deploy its static artifact using the CLI; see README." >&2; exit 1; }
done
TOOLS="$PWD/.cache/nebula-tools"
mkdir -p "$TOOLS"
export PATH="$TOOLS/bin:$HOME/.cargo/bin:$PATH"
mkdir -p "$TOOLS/bin"
if ! command -v rustup >/dev/null; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain nightly
fi
rustup toolchain install nightly --profile minimal --component rust-src --target wasm32-unknown-unknown
if ! command -v wasm-bindgen >/dev/null || [[ "$(wasm-bindgen --version)" != 'wasm-bindgen 0.2.105' ]]; then
  curl -fsSL https://github.com/wasm-bindgen/wasm-bindgen/releases/download/0.2.105/wasm-bindgen-0.2.105-x86_64-unknown-linux-musl.tar.gz | tar -xz -C "$TOOLS"
  cp "$TOOLS/wasm-bindgen-0.2.105-x86_64-unknown-linux-musl/wasm-bindgen" "$TOOLS/bin/"
fi
if ! command -v wasm-opt >/dev/null; then
  curl -fsSL https://github.com/WebAssembly/binaryen/releases/download/version_120/binaryen-version_120-x86_64-linux.tar.gz | tar -xz -C "$TOOLS"
  cp "$TOOLS/binaryen-version_120/bin/wasm-opt" "$TOOLS/bin/"
fi
if ! command -v wasm-snip >/dev/null; then
  cargo install --git https://github.com/r58playz/wasm-snip --rev e9c9e133 --locked
fi
if ! command -v pnpm >/dev/null || [[ "$(pnpm --version)" != '10.12.1' ]]; then
  npm install --prefix "$TOOLS" pnpm@10.12.1
  export PATH="$TOOLS/node_modules/.bin:$PATH"
fi
bash scripts/build.sh
