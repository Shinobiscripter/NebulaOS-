# NebulaHub implementation log

Base: `08136cc0f0e51fcb2a4ce18edc54bb180e61c915` of Shinobiscripter/NebulaOS-.
Content source: `02caa20be6aff63a27beacfe0cf36e5368501876` of Shinobiscripter/NebulaHub-2.

The Anura core, package identifiers, filesystem paths and worker URLs are retained.
Nebula additions live in `apps/nebula-games.app` and `public/nebula`.
Upstream license and credits remain intact.

## Inspection

- All recursive submodules initialized.
- Current upstream uses Node 24+, pnpm 10.12.1 in browser.js/CI, nightly Rust,
  wasm-bindgen 0.2.105, the r58playz wasm-snip fork, Binaryen, Java 11+,
  clang, make, jq and uuidgen. Upstream does not pin a dated Rust nightly,
  Binaryen release, or wasm-snip revision.
- `make static` is the actual upstream production target; output is `static/`.
- Linux disk image generation is a separate Docker-dependent target.
- The old game library discovers 46 HTML launchers through GitHub at runtime.
  It supplies filenames/titles, but no curated categories, tags or covers.
- Only Web and Ps5 app directories exist in the old repository. Ps5 is the game
  library, not a PlayStation emulator. Other advertised app files are missing.
- Existing game launchers depend heavily on remote CDNs; they are not offline games.
- The OS requires isolation; third-party launchers need a separate top-level
  browser context with their own response policy. The root service worker must
  bypass these routes instead of rewriting their headers.

## Validation

Implemented native Nebula Games, restrained desktop branding, real boot lifecycle
integration, Netlify packaging, offline cache fixes and optional Linux delivery.
Production build and real browser checks completed. See [VALIDATION.md](VALIDATION.md)
for measured results, tested scope, build diagnostics and deployment limitations.
