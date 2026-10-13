# NebulaHub

A browser desktop powered by **[AnuraOS](https://github.com/MercuryWorkshop/anuraOS)** from **[Mercury Workshop](https://mercurywork.shop)**. NebulaHub replaces the old hub frontend with Anura's real window manager, apps, filesystem, terminal, browser, settings, service worker and optional Linux/v86 subsystem.

The Nebula layer adds a space theme, boot UI tied to real initialization, a native Games app and Netlify packaging. Internal `anura.*` APIs, package IDs, storage names and worker paths remain compatible.

Live deployment: **[nebulahub-shinobiscripter.netlify.app](https://nebulahub-shinobiscripter.netlify.app)**. This site was uploaded from the tested production output; Git pushes do not automatically deploy it. The Netlify badge is disabled in site settings so it does not overlay application windows.

## Desktop features

The desktop uses a macOS-inspired top menu, centered dock and colored window controls while retaining Anura's actual window manager. Search launches installed apps; Ctrl/Command+K opens it when the desktop has keyboard focus. Windows provides an overview with left/right tiling, and Show Desktop minimizes and restores open windows.

Desktop widgets include a live clock/calendar shortcut, saved quick note, reminders with completion/deletion, and a pausable 25-minute focus timer with a completion notification. Notes, reminders, timer state and widget visibility use the existing OS settings storage. The Widgets menu toggles the panel. Mobile retains the upstream layout. No Apple assets or macOS application compatibility are included.

## Build setup

Use x86-64 Linux or WSL2; upstream does not support native Windows builds.

```sh
git clone --recurse-submodules --branch nebula/rebrand-and-games https://github.com/Shinobiscripter/NebulaOS-
cd NebulaOS-
```

| Dependency | Requirement |
| --- | --- |
| Node.js | 24+, selected version 24.21.0 |
| pnpm | 10.12.1, pinned by browser.js and CI |
| Rust | nightly; wasm32-unknown-unknown target and rust-src component |
| wasm-bindgen CLI | **0.2.105**, exact match |
| wasm-snip | r58playz fork, setup selects revision e9c9e133 |
| Binaryen | wasm-opt; version 120 used in this environment |
| Java | 11+ for v86 Closure compiler |
| Native tools | make, clang, gcc, gcc-multilib, jq, uuidgen, curl, wget, Git |
| Linux disk generation only | Docker, sudo, loop devices, i686-unknown-linux-gnu Rust target |

Upstream uses an undated Rust nightly and does not pin Java/clang/gcc or Binaryen versions. Selected setup versions above are distinct from upstream requirements.

Install Node 24.21.0 through your preferred installer, then on Ubuntu/Debian:

```sh
sudo apt-get update
sudo apt-get install -y build-essential clang lld default-jre gcc-multilib jq uuid-runtime curl wget git binaryen
npm install -g pnpm@10.12.1
bash scripts/netlify-build.sh
```

The setup script installs missing Rust/wasm tools and runs the production build. With dependencies installed, use `npm run build`. This runs upstream **`make static`**, packages deployment metadata, and validates the result. **Output: `static/`.** Deploy that directory, not the source tree.

Main dependencies use `npm ci`; browser.js retains its lockfile. `make lint` remains available but no longer mutates the source as a side effect of production builds.

## Local testing

```sh
npm run preview
# http://localhost:8000
npm run check
npm test
npx playwright install chromium
npm run test:browser
# Optional online checks (Linux downloads about 1 GiB):
NEBULA_ONLINE_TESTS=1 npx playwright test tests/browser/online.spec.mjs
NEBULA_LINUX_TESTS=1 npx playwright test tests/browser/linux.spec.mjs
```

The production preview applies the generated Netlify headers, supplies a local Wisp relay, and proxies Linux images. HTTPS or localhost is required. Browser tests cover the real desktop, app windows, game metadata, persistence, PWA and WASM. See [validation results](documentation/VALIDATION.md) for actual results and online compatibility checks.

Files/settings live in browser storage. Refresh preserves them; clearing site data deletes the installation. Different origins have separate installations. Export important files through Files.

## Netlify

Connect this repository and select `nebula/rebrand-and-games` in Netlify (or your default branch after merging the change). `netlify.toml` selects `bash scripts/netlify-build.sh` and publishes `static/`. Use a Linux image with the native tools above. A cold compiler build can exceed restrictive build-time allowances.

Alternatively, build locally or download the `nebulahub-static` GitHub Actions artifact and upload with the Netlify CLI:

```sh
npx netlify-cli login
npx netlify-cli deploy --dir=static --no-build
# Review the draft, then publish the same output:
npx netlify-cli deploy --dir=static --no-build --prod
```

The operator supplies Netlify credentials/site selection. CI builds/tests/uploads artifacts only; it does not publish upstream npm packages or replace releases.

`static/_headers` applies COOP `same-origin` and COEP `require-corp` to the OS documents/workers, with CORP `same-origin`. WASM uses `application/wasm`. The worker retains scope `/` and is revalidated. Mutable bundles are not marked immutable. No SPA catch-all is used: missing JS/WASM must return 404.

`/Games/` and `/play/` documents deliberately omit COEP and bypass the OS worker route, allowing third-party game downloads. Do not replace this with blanket COEP headers. The desktop's isolation remains enabled.

### External infrastructure

- **Wisp relay:** Netlify cannot run Anura's long-lived WebSocket service. Set build environment `NEBULA_WISP_URL=wss://your-relay.example/`, or Custom Wisp URL in Settings, for proxied browsing and Linux networking. Local preview supplies a relay. No arbitrary public relay is hard-coded.
- **Linux image host:** default redirects proxy `https://anura.pro/x86images/alpine-*` on demand, avoiding upstream's absent browser CORS headers. This keeps the **1 GiB** disk out of every deployment, but installation still consumes about 1 GiB of bandwidth and browser storage. Availability depends on upstream. To self-host matching kernel/initrd/chunks with CORS, set `NEBULA_X86_BASE_URL=https://images.example/x86images/` with a trailing slash. A separate static image host can serve the split chunks; check its current free storage/file/bandwidth allowances.
- **Games:** launchers fetch code/assets from their original external providers. They are not offline game binaries. Remote removal, URL changes, embedding restrictions and provider failures can break individual titles.

### Large assets

Each build writes `static/nebula/build-report.json`: total size, largest files and assets over 10/50 MiB. Packaging rejects files over a conservative 50 MiB review threshold; this is a project guardrail, not a universal Netlify limit. Use the CLI for large uploads, following [Netlify's guidance](https://answers.netlify.com/t/support-guide-my-drag-and-drop-deploy-is-stuck-in-uploading-status/112).

v86, libcurl, Scramjet WASM, BIOS and resize support remain in the site. Linux disks remain optional. To generate your own disk:

```sh
rustup target add i686-unknown-linux-gnu
make rootfs-alpine
```

The upstream Docker workflow produces `build/x86images/alpine-boot/` and 50 MiB disk chunks in `build/x86images/alpine-rootfs/`. It requires sudo/loop devices and is separate from the desktop build. Do not upload intermediate `alpine-rootfs.bin` or tar files to Netlify.

## Nebula architecture

- `public/nebula/`: wallpaper, icons, desktop styling, catalog, source/credits page.
- `apps/nebula-games.app/`: native Anura iframe app. Catalog loads when opened; search, sorting, favorites and recent history use the OS settings filesystem.
- `public/Games/`: 46 original launchers with stable filenames. Migration reads exact Git blobs, records source commit and SHA-256 hashes, and avoids platform newline conversion.
- `public/play/`: compatibility player. Play opens a separate browser tab; Chromium credentialless frames also allow managed OS windows. Their game storage is temporary; use a tab for persistent saves or incompatible embeds.
- `scripts/migrate-games.mjs`: repeatable migration from a local NebulaHub-2 checkout. The original library has no curated covers/categories/tags; initials are explicit fallback artwork.
- `scripts/package-nebula.mjs`: headers, offline inventory, license files, image routes and asset audit.

The old Ps5 app was a game selector, not an emulator. Its library is migrated. Launcher entries for missing Cine, Spotify, Discord, Android and other app files are not presented as functioning apps. The old Web wrapper is superseded by Anura's browser.

Wallpaper, accent, theme, blur, window clamping, taskbar pins, offline support, filesystem preferences and Linux controls stay in Anura's existing settings. Fresh installs boot directly to the desktop with Linux and blur disabled. Existing saved preferences take precedence.

## PWA and offline

Use your browser's install control to install NebulaHub. Enable **Allow offline use** in Settings to populate Anura's filesystem cache. Its inventory includes the browser bundle and Nebula app. Offline mode does not make external games/pages, relay networking or uninstalled Linux images available offline. Favorites and recents remain local.

## Upstream updates

```sh
git remote add upstream https://github.com/MercuryWorkshop/anuraOS
git fetch upstream
git merge upstream/main
git submodule update --init --recursive
npm run build
npm run test:browser
```

Review conflicts in Boot, Settings/OOBE, worker routes, PWA metadata, Makefile and CI. Keep package IDs/storage keys stable. [Original README](documentation/UPSTREAM-README.md), upstream API docs and [migration notes](documentation/NEBULA-WORKLOG.md) are retained.

## License

This OS is an AGPL-3.0-only derivative. [LICENSE](LICENSE), [CREDITS.md](CREDITS.md), third-party notices and Mercury Workshop attribution are preserved. About NebulaHub links to credits and this fork's source. Publish the complete corresponding source, changes and build scripts for the version you serve over a network. Keep the visible source link pointed at that version when moving or modifying the project.

Games and remote assets retain their own licenses/ownership. The OS license does not relicense them or grant game redistribution rights. Original launcher notices remain intact. Review individual game rights before public distribution. See the [GNU AGPLv3 text](https://www.gnu.org/licenses/agpl-3.0.html).
