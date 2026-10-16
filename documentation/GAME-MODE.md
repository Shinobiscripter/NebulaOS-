# NebulaHub Game Mode

Open **Game Mode** from Files, Explore, the desktop menu, Horizon Start, or the application launcher. It works in Orbit, Flow and Horizon. Desktop windows stay open behind the shell; Desktop returns to them. Fullscreen also requests browser fullscreen when supported.

Choose a presentation in Game Mode → Settings:

- **Nova**: cinematic horizontal rail inspired by modern PlayStation menus.
- **Deck**: compact sidebar and portrait library inspired by Steam Deck.
- **Pulse**: broad, squared dashboard tiles inspired by Xbox.

These are original Nebula interfaces, with original synthesized navigation sounds, not console firmware or copied console assets. Sounds are opt-in. Animations respect reduced-motion preferences and the OS animation setting.

## Library and store

All three modes share the same local-profile library. The 49-entry catalog includes 2048 and Hextris as downloadable source packages; the other 47 entries are online launchers, including OvO and A Bite at Freddy’s. Online games open a new tab for compatibility with isolation policies and host restrictions. Their availability is controlled by their hosts. No proxy is needed for the store or downloaded games.

Downloads fetch the real package into Cache Storage before adding it to the library. The install presentation lasts at least 2.2 seconds; slow downloads can take longer than five seconds and show file progress. Failed downloads do not create library entries. Online entries explicitly say Add online game and do not pretend to download the game. There are no purchases or payments.

Downloaded games work offline after installation. Browser storage eviction can remove packages; Play detects a missing entry point and re-downloads. Removing a game removes its profile's download and library entry, but leaves game saves. The game library is profile-specific; the games' own localStorage saves are shared among local profiles on the same site. They are not included in Account Center .hub exports.

## Controls and performance

Tab, directional arrows, Enter, controller D-pad / left stick and A navigate menus; B returns to Home. Games retain their own controls and are not guaranteed controller-compatible. Physical controller compatibility varies; keyboard navigation is also available. Close game asks before removing a running game. Locking closes a running game so its input is not left exposed; save first.

Each mode separately saves sound, animation and overlay settings. Configure shell FPS, shell frame time, approximate JS heap where supported, position and opacity. These are **shell** measurements, not game engine benchmarks. Browser APIs do not expose reliable cross-origin game FPS, CPU/GPU temperature or hardware load. Sampling stops when disabled, on desktop, and while the tab is hidden. The overlay is unavailable over games opened in separate tabs.

## Source and deployment

Catalog repository: https://github.com/Shinobiscripter/NebulaGames (initial snapshot 9dfb5b2). `public/game-library/` is a checked-in snapshot so a normal NebulaOS clone builds without an extra checkout. Sync catalog/package changes from that repository, excluding `.git`, then run the normal production build. `public/nebula/game-mode.js` and `.css` implement the shell; existing Anura windows and filesystem remain intact.

The separate `/game-library/sw.js` worker controls only `/game-library/` and serves explicitly downloaded package files. The Anura root worker remains in place. The production packager applies COEP to game-library routes and excludes game package files from OS precaching, avoiding automatic downloads on boot. Catalog and shell remain available through normal OS caching. Netlify requires no new service or paid infrastructure.

2048 retains its MIT license. Hextris retains GPL-3.0-or-later and full source. Per-package UPSTREAM.txt records original commits and modifications (removed analytics, ads, remote font, obsolete upload). Online-only games are linked because redistribution permission has not been established. The Nebula shell remains AGPL-3.0 with Anura/Mercury Workshop attribution preserved.
