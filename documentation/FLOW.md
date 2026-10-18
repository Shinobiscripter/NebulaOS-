# Flow desktop

Choose **Settings → General → Desktop environment → Flow**. Orbit preserves the classic Nebula desktop. Changes apply immediately and survive refresh. The environment wallpaper can be disabled to keep your selected wallpaper.

Flow takes visual inspiration from [Ilyamiro's Hyprland clip](https://www.tiktok.com/@ilyamiro.dev/video/7694777386625256722) and the [Serpantinum shell](https://github.com/ilyamiro/serpantinum): separated top-bar sections, workspace indicators, a right-side scratchpad, and a central dashboard. The implementation and illustrated space wallpaper are original; no video artwork or shell source was copied.

## Controls

- Four workspace buttons switch between groups of real Anura windows. Shift-click moves the focused window to that workspace.
- Ctrl+Alt+1–4 switches workspaces; Ctrl+Alt+Shift+1–4 moves the focused window and switches.
- Tile (Ctrl+Alt+T) arranges visible windows in a grid; Float restores their previous positions.
- Notes opens a persistent scratchpad. Dashboard (Ctrl+Alt+D) shows the clock, session uptime, actual window/app counts, app shortcuts and notifications.
- Widgets are initially hidden in Flow; use Widgets to show them. Orbit's widget visibility is preserved separately.
- Maximized apps fill the browser viewport in either environment. Move to the bottom edge to reveal the dock, or the top edge to reveal desktop controls. Minimizing, restoring or closing the app returns the desktop chrome.

Shortcuts require keyboard focus in the desktop; embedded applications may capture their own keys. Workspace membership lasts for the current session; environment choice, notes and widget preferences persist. Background apps continue running on other workspaces; the Music player pauses when hidden.

## Implementation

`public/nebula/environments.js` and its stylesheet implement the optional shell using native Anura settings and windows. `window-layout.js` manages fullscreen geometry and dock visibility without replacing the upstream window manager. Settings adds the environment selector; `flow-wallpaper.svg` is a lightweight static vector image.

This is a browser desktop inspired by the clip, not the Linux Hyprland compositor. Tiling is explicitly triggered, not a dynamic compositor layout. The dashboard does not simulate weather, hardware telemetry or system controls unavailable to a web application. Upstream AnuraOS, Mercury Workshop and third-party attribution remain intact.
