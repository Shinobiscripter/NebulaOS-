# Hyprland dotfiles in NebulaHub

Open Settings → Flow keyboard controls → **Import Hyprland dotfiles**, or Flow's **Import config** button. Choose `.conf` files together or an extracted dotfiles folder. Select the entry file (normally `hyprland.conf`), review the compatibility report, then choose **Apply to Flow**. Settings persist in the current local account. **Undo last import** restores the setup saved immediately before the most recent import, including desktop selection, shortcuts and wallpaper.

This translates declarative Hyprland configuration into NebulaHub's existing Flow desktop. It does not run Hyprland or reproduce an entire Linux rice. Existing settings are retained for omitted or unsupported properties.

Supported:

- Variables, nested config blocks, colon-qualified assignments and explicit `source` includes resolved only within uploaded files. Includes retain their order. Cycles, missing and ambiguous references appear in the report.
- Single-value `general:gaps_in` (0–48), `gaps_out` (0–64), `border_size` (0–8), `decoration:rounding` (0–40), and `active_opacity` (0.4–1). Use **Tile** after importing to arrange windows with the new gaps. These are CSS pixels; no monitor scaling is imported.
- `rgb(RRGGBB)` and `rgba(RRGGBBAA)` active/inactive border colors. Gradients use the first color and are reported as approximations. Active color also accents Flow controls.
- `animations:enabled` toggles Flow window transitions. Existing reduced-motion preferences still apply. Custom animation curves and compositor effects are unsupported.
- Plain `bind` for workspaces 1–4, moving a window to those workspaces, closing the focused window, and fullscreen. `togglesplit` maps to Flow's grid tiling; `movetoworkspacesilent` also switches workspace and is explicitly reported as adapted. Conflicting/reserved shortcuts are skipped. Super maps to Meta, which the host OS may intercept; customize shortcuts in Settings. Shortcuts require desktop keyboard focus, not focus inside an embedded app.
- A legacy `wallpaper = monitor,path` entry in an included config or uploaded `hyprpaper.conf`, when its PNG/JPEG/WebP is included. One desktop wallpaper is supported. Images are decoded, resized and stored in Anura's local filesystem for offline use. Missing images retain the existing wallpaper.

Not supported: ZIP archives (extract first), wildcard includes, Lua configs, shell execution, `exec` bindings, scripts, plugins, Waybar/rofi configuration, monitor/input hardware settings, window rules, native apps, custom tiling layouts, advanced bind flags, or new Hyprpaper block syntax. Every unsupported assignment is listed with its file and line. Do not expect native Hyprland configs to be fully portable to a browser.

Uploads stay in the browser. No config content is sent to a server or evaluated as JavaScript, shell or CSS. The UI renders untrusted text as text, uses a fixed mapping of supported settings, and never fetches `source` paths. Limits: 256 selected files / 32 MiB total, 2 MiB config text, 20,000 processed lines, 16 include levels, 12 MiB per wallpaper, and 32 megapixels before resizing. Wallpaper files from earlier imports remain in `/.nebula-wallpapers` so restoring a previous setup remains possible.

Implementation: `public/nebula/hyprland-parser.js` is the pure compatibility translator; `hyprland.js` owns preview/import/rollback UI and scoped Flow styles. `environments.js` consumes imported gaps and connects native window actions. Storage keys are `nebula.flow.importStyle`, `nebula.flow.importBackup`, and the existing `nebula.flow.keybinds`. No upstream APIs or compositor code are replaced.

Syntax references: [Hyprland keywords](https://wiki.hypr.land/0.51.0/Configuring/Keywords/), [variables](https://wiki.hypr.land/0.51.0/Configuring/Variables/), and [binds](https://wiki.hypr.land/0.51.0/Configuring/Binds/). The documented compatibility subset is intentionally narrower than native Hyprland.
