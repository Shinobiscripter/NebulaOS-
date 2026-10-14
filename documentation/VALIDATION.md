# Validation and deployment limits

Core validated locally on 11 October 2026; desktop enhancements validated on 12 October 2026. Tests exercise the actual Anura-derived production site, not mocked desktop screens.

## Build environment

- Windows host with Ubuntu under WSL2, x86-64.
- Node 24.21.0; pnpm 10.12.1.
- Rust 1.101.0-nightly (2026-10-10 commit; nightly installed 2026-10-11), rust-src and wasm32 target.
- wasm-bindgen 0.2.105; r58playz/wasm-snip 0.4.0 at e9c9e133.
- Binaryen 120, clang 21, OpenJDK 25. Upstream accepts Java 11+ and does not pin the native compiler versions.
- All recursive submodules initialized at the upstream fork's recorded revisions.

The production `npm run build` command runs `make static`, packaging, five catalog/music unit tests and static-output verification. It completed with exit code 0. v86 and Scramjet were actually compiled during initial toolchain setup; subsequent production builds reuse their compiled intermediates when unchanged.

Output is `static/`, approximately 49.1 MiB. `static/nebula/build-report.json` records exact sizes and build commit. Largest file: `x86images/bzResize` (10,488,224 bytes). No file exceeds 50 MiB. The optional 1 GiB Linux disk is downloaded separately, not bundled.

The upstream browser.js build emits TypeScript declaration-generation diagnostics in its Scramjet core. Its runtime build completes; the main OS `npm run check` passes. Those dependency declaration diagnostics are not claimed to be fixed. Do not use the generated upstream types as evidence of a clean declaration build.

## Automated checks

`npm test`: five tests validate all 46 launcher hashes/URLs, search/favorites/sorting, recent-play ordering, YouTube link validation and public search-result parsing.

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


## Nebula Music replacement — 13 October 2026

Production source `8d9ed961722529477ce9aa1796c51d0a533ff992` replaces the Spotify widget and browser adapter with Nebula Music. Published Netlify deploy: `6ace1a67ade0d3a4cefce370`. Full production build, five unit tests, static verification and the main TypeScript check passed. Output: 51,500,768 bytes across 600 files; no file above 50 MiB.

The native maximized app and draggable widget share playlists and a single playback controller. Live public YouTube search returned 20 real results. Local playback inspection confirmed an advancing playhead (11.63 seconds), duration 11,392 seconds, unpaused media and no media error. This is full-length YouTube video playback, not an extracted audio stream or a Spotify preview. Browser checks cover playlist creation/synchronization/persistence, invalid links, real discovery, both-view song metadata, player loading, window shell and widget movement. The relay-default migration check is intentionally skipped on localhost. Game launch testing was stopped at the user's request for this update.

Discovery uses YouTube's public search/oEmbed pages through the existing relay without an API key. It is not an official YouTube Music API and can fail if YouTube changes its page structure, rate-limits or requires consent. Song-link lookup provides an alternative. Playback uses the official YouTube iframe API inside a same-origin credentialless bridge, preserving desktop cross-origin isolation. YouTube controls advertisements, embedding, region restrictions and sign-in. Playlists are saved locally to this OS installation, not to a Google account. Hidden/minimized players pause; changing playback views recreates the visible player near the saved position.


## Rebuilt Music interface - 13 October 2026

The search-only update was published first as `a70a8a3`, deploy `6ace1bb89159f3a0faae1c07`, before the visual rebuild. Production source `5945c7177e7dd5a8606d49bc8f1c7360d5eb0a21` replaces the previous shared-layout interface with a Spotify-inspired desktop app and a separately designed 344px widget. The app has playlist navigation, discovery, a listening pane and bottom transport. Both views retain shared search/playlists and expose real seeking; the app also exposes volume control. A native-window flex sizing bug that let the transport cover search actions was fixed.

Netlify reports the renamed canonical site as https://nebulahub-nebulasoftwares.netlify.app/ (same site ID), deploy `6ace98dc49e98a5eb4913813`. Build, five unit tests, TypeScript check and static verification passed. All three browser checks passed locally and on the live deployment (33.8 seconds): search in both views, playlist persistence, actual full-length YouTube playback, seeking to 60 seconds, volume set to 35%, and pause. No game launch checks were repeated. Free-relay timeouts remain possible and now display a retry message. Production output is 51,518,732 bytes, 600 files.

## Flow desktop and fullscreen — 14 October 2026 UTC

Production source `4102fb9`, Netlify deploy `6acedfa372d2c5274eb649b8`. The deployment API now reports https://nebulahub-shinobiscripter.netlify.app/ as the active URL for the same site ID; this supersedes the URL recorded above. The production build, five unit checks, TypeScript check and static asset verification passed. Output: 604 files, 49.2 MiB; no file exceeds 50 MiB.

All three focused browser checks passed locally and on the live site (40.7 seconds live). Coverage includes viewport-filling maximized windows, dock edge reveal/retraction, viewport resize, minimize/restore/unmaximize/close, Settings environment switching and refresh persistence, workspace visibility, saved scratchpad, dashboard counts, tiling/float restoration, desktop menus, widgets, app search and window overview. Game launch checks were not repeated, as requested. Music streaming was validated in the preceding release; this update does not claim a new online playback validation.

Flow is opt-in in Settings, with controls and reference attribution in FLOW.md. It uses real Anura windows and local settings; workspace assignments are session-only. It does not implement the Linux Hyprland compositor or invent hardware/weather telemetry. Original wallpaper and UI code were inspired by the supplied Ilyamiro clip, not copied from it.

## Personalization, Account Center and motion — 14 October 2026

Production source `14de6b129446eda572d435c2f4383116eb9d9177`, Netlify deployment `6acf63dd3c85062222503294`, live at https://nebulahub-shinobiscripter.netlify.app/. Production build (including TypeScript compilation), nine unit checks and static verification passed. Output is `static/`: 611 files, 49.2 MiB, none above 50 MiB. The downloadable static archive has been refreshed.

Nine browser checks passed on the preceding combined deployment (`f67a15a`, 1.7 minutes): account creation adopting existing files, password rejection, lock before desktop startup, new-account filesystem/settings separation, switching back without losing data, locked keyboard suppression, shortcut conflicts/persistence, actual public GitHub wallpaper loading/import, wallpaper and accent persistence, fullscreen/dock, Flow workspaces and existing shell controls. The final change synchronizes reduced motion from any native Settings control. Both Account Center and reduced-motion checks passed again on the final live deployment (20.0 seconds).

Account Center checks cover localStorage persistence, favorites, rename, search, removal/undo and opening the configured GitHub sign-in URL in a separate tab. That external login destination is intercepted in the automated test; no real service account was signed into or linked. The app stores account metadata only and intentionally does not claim provider authentication status. Live GitHub wallpaper catalog/image requests were not intercepted. Game launches were not repeated, as requested. No new Linux disk installation or full emulator session was run for each new profile.

Visual screenshots cover the lock screen, wallpaper picker and Account Center. Browser tests caught and resolved SVG image decoding, while visual review caught inherited dock positioning on the wallpaper pagination. Existing shell and fullscreen tests passed with the new motion layer; system reduced motion and the stored native setting disable effects. Settings logging no longer prints entire preference values or wallpaper previews.

Details, account security boundaries, source references and provider-session limitations are in `documentation/PERSONALIZATION.md`. Local filesystem namespaces are organization boundaries, not encryption; website cookies can remain shared at browser-origin scope. AGPL source and upstream attribution remain available.

## Horizon, lock controls, wallpaper integration and discovery — 14 October 2026

Production source `7f6fe7b`, Netlify deploy `6ad007e21ae8d6863eec1d77`, live at https://nebulahub-shinobiscripter.netlify.app/. Full production build, TypeScript and all 11 unit tests passed; static/PWA/WASM verification passed. Deployment archive refreshed.

Nine browser checks passed on the live release: fullscreen/dock and Flow environments; Horizon drag-to-desktop, repositioning, refresh persistence, opening native apps and removing shortcuts; music discovery UI and shared playlist additions; no-account lock/return; password visibility, wrong-password rejection, account switching and pre-boot authentication; custom keybindings; wallpaper image and accent persistence; app/widget playlist persistence. Two optional online checks were skipped in that suite. Discovery UI's deterministic test supplies fixture YouTube metadata; separate, unmocked live checks returned eight tracks in each of the three new sections.

The optional live music test was then run separately and passed: YouTube metadata, shared playlist addition, actual playback (duration over two minutes), seeking to 60 seconds, volume set to 35 via the player API and pause. The initial volume assertion read YouTube's internal video element and failed despite successful playback/seeking; the test now checks the public player API for the requested volume. No production player changes were required. New discovery sections are search-based recommendations, not official popularity charts. Free relay availability and YouTube embedding restrictions remain external limitations.

Visual checks covered Horizon Start/shortcuts, music covers and shelves, the wallpaper picker and the lock screen. The Settings environment selector now correctly restores its selected option after reload. Horizon widgets are opt-in to avoid covering desktop shortcuts. Individual games and Linux disk installation were not retested for this release.

The preceding `.hub` transfer release (`45759ef`, deploy `6acf6ce0ca8bb5ae2da82f4c`) passed local and live cross-browser-context download/import, duplicate handling, invalid-file rejection and reload persistence. Files contain saved profile metadata only, not login sessions or credentials.
