# Validation and deployment limits

Core validated locally on 11 October 2026; desktop enhancements validated on 12 October 2026. Tests exercise the actual Anura-derived production site, not mocked desktop screens.

## Build environment

- Windows host with Ubuntu under WSL2, x86-64.
- Node 24.21.0; pnpm 10.12.1.
- Rust 1.101.0-nightly (2026-10-10 commit; nightly installed 2026-10-11), rust-src and wasm32 target.
- wasm-bindgen 0.2.105; r58playz/wasm-snip 0.4.0 at e9c9e133.
- Binaryen 120, clang 21, OpenJDK 25. Upstream accepts Java 11+ and does not pin the native compiler versions.
- All recursive submodules initialized at the upstream fork's recorded revisions.

The production `npm run build` command runs `make static`, packaging, three catalog unit tests and static-output verification. It completed with exit code 0. v86 and Scramjet were actually compiled during initial toolchain setup; subsequent production builds reuse their compiled intermediates when unchanged.

Output is `static/`, approximately 49.1 MiB. `static/nebula/build-report.json` records exact sizes and build commit. Largest file: `x86images/bzResize` (10,488,224 bytes). No file exceeds 50 MiB. The optional 1 GiB Linux disk is downloaded separately, not bundled.

The upstream browser.js build emits TypeScript declaration-generation diagnostics in its Scramjet core. Its runtime build completes; the main OS `npm run check` passes. Those dependency declaration diagnostics are not claimed to be fixed. Do not use the generated upstream types as evidence of a clean declaration build.

## Automated checks

`npm test`: three tests validate all 46 launcher hashes/URLs, search/favorites/sorting and recent-play ordering.

`npx playwright test tests/browser/desktop.spec.mjs`: four Chromium production tests cover:

1. Fresh desktop boot, removed boot splash, title, isolation, controlled service worker, lazy Linux default, launcher, Settings/Files/Terminal/Games windows, catalog/search/favorites, window close and persisted files/settings across refresh; no uncaught page errors during this flow.
2. Production headers, non-isolated game player, missing-file 404, manifest icons and valid v86/libcurl WASM.
3. An actual shell `echo` result, plus loaded browser UI.
4. The offline setting's reboot/update path, saved OS cache, disconnected reload and full Games catalog offline.

`NEBULA_ONLINE_TESTS=1 npx playwright test tests/browser/online.spec.mjs`: Awesome Tanks opens a separate non-isolated browser tab and its Ruffle runtime reaches ready state; n-gon renders its game canvas in a managed credentialless desktop window. This validates representative launch paths, not every level of every game.

`NEBULA_LINUX_TESTS=1 npx playwright test tests/browser/linux.spec.mjs`: opt-in real Linux image download, browser-storage installation, reload, v86 subsystem readiness and a real Linux terminal `uname -s` result. All six browser tests passed together in 3.6 minutes on the final production build. This consumes about 1 GiB of network traffic per run. Linux remains disabled on fresh ordinary installations until requested.

## Scope of evidence

`tests/browser/shell.spec.mjs` additionally verifies the desktop menu, calendar and quick settings, persistent notes/reminders, timer controls, application search, actual window tiling, Show Desktop/Restore Windows, widget visibility and window close without uncaught page errors. The five local desktop/core checks passed after the desktop update. The Linux installation test predates this presentation-only update; it was not repeated for the new dock/widgets.

Production commit `7526ee4` was published on 12 October 2026, Netlify deploy `6acd941b965cbdaae986f916`. All six live checks (desktop, online games and desktop shell) passed in 1.1 minutes against the public URL. The full Linux production build, catalog unit tests and static verification also passed. The desktop screenshot in the deliverables was captured from this live deployment after boot completed.

- Chromium tested; Firefox/Safari/mobile, physical Chromebook performance, actual PWA installation UI and gamepad input were not tested.
- The production site now uses the owner's existing `nebulahub-browser.onrender.com/wisp/` relay. Its health endpoint and Spotify preview playback were verified on 13 October 2026. A separate new Render service was not created: the connector rejected the repository and the Dashboard returned "This action is not allowed". The existing relay was sufficient and was left unchanged. Free-plan sleep/bandwidth limits still apply.
- Published to https://nebulahub-shinobiscripter.netlify.app using the Netlify CLI. Live desktop, isolation, WASM, terminal and representative game checks were run. Linux kernel and disk-chunk proxy HEAD requests returned HTTP 200 with the expected sizes; the full 1 GiB install/boot test was local. The cloud build pipeline and sustained proxy bandwidth limits were not certified.
- Only two representative games were loaded. All 46 original launcher files and URLs are preserved; external content can change or disappear. The source had no curated categories, tags or covers, so none were fabricated.
- Offline support caches the OS and catalog, not third-party game downloads. Enable it in Settings before disconnecting. Games in credentialless windows have temporary storage; separate tabs are the default for persistent saves.
- Compatible dependency updates reduced the root npm audit findings from 29 to 11. Remaining findings are in inherited build/watch/CLI dependency chains (including Workbox CLI, PostCSS CLI, temporary-file helpers and serialization). No automatic major-version downgrade/forced migration was applied. The static Netlify site does not execute those Node CLI packages; this is not a claim that all upstream dependencies or remote games are security-audited.

## Source and maintenance

The 13 October widget update adds individual visibility, pointer/keyboard movement, viewport clamping, layout persistence, Spotify URL validation, lazy loading and stop-on-hide. Live checks cover migration of the old Netlify proxy default while preserving custom relay settings. Spotify's server-rendered Play button appears before hydration; the online test waits for initialization and then verifies an actual playing media element with advancing time. Initial testing exposed and fixed cross-frame streamed POST bodies missing Chromium's `duplex` option. Full-track DRM/authenticated playback was not tested and remains controlled by Spotify.

Boot tests hold the real configuration request to observe the splash, verify SVG rendering and actual stage state, then release initialization and assert the desktop appears. Both animated and reduced-motion modes pass. Repeat production builds now clear only the generated `static/` tree, avoiding stale hashed browser bundles in the deploy and offline inventory.

The fork retains the upstream AGPL license, copyright and third-party credits. About/credits provide a source link. Publish the matching branch/commit alongside any deployed build; deployments of further modifications must include their corresponding source.

Focused upstream changes: boot completion/SW readiness, persistent settings writes, branding and accessibility, safe theme propagation to cross-origin frames, worker route matching/cache write completion, explicit Linux download failures and production build packaging. Native application IDs, filesystem paths, APIs and submodule revisions are preserved.
