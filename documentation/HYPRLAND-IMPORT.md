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


## GitHub repository scanning and full themes

Paste a **public GitHub URL or owner/repository** in the importer. An optional branch/tag field selects the revision; all file downloads are pinned to the resolved commit. A recursive tree scan discovers configurations, palette files, shell installers, README command blocks and images. Choose the entry config, palette and optional wallpaper before applying. You can also upload the same files as an extracted folder. ZIP archives still need extraction.

The scanner reads at most 120 candidate text files (256 KiB each, 2 MiB total). Skipped files are listed; truncated GitHub trees fail visibly rather than being presented as complete. Symlinks, submodules, binaries and dependency folders are not followed. GitHub rate limits or private repositories can prevent a scan; upload an extracted folder instead. Images are downloaded only when selected for application (12 MiB limit). Network requests go directly to GitHub without credentials. Nothing is run on your device or a server.

Named palette declarations are recognized in Kitty/INI/TOML, CSS/Waybar, rofi and similar text files; literal Lua color assignments such as `M.base = 'rgb(1e1e2e)'` are also supported. Lua programs are never evaluated. Themes are separate options, with file/line evidence in the preview. Background, foreground, surface, accent and muted text colors are translated; poor foreground contrast is corrected for readability. Missing tokens use Nebula defaults. This is a compatibility translator, not a renderer for arbitrary CSS, GTK themes or Linux layouts.

**Installer analysis** explains recognizable copy/link operations, package installation and desktop preference commands. Literal `hyprctl keyword` cosmetic assignments and `swww img` / `swaybg -i` image paths become candidates. They are off by default because a script may wrap them in conditions; the user must select **Include candidate cosmetic commands** to use them. Unknown logic, substitutions, command chains, downloaded scripts and native tool settings remain visible as unresolved or unsupported. The scanner does not claim to determine arbitrary program behavior. Copy/link commands are described, not emulated; choose their source config through the entry selector.

**Theme the entire desktop and Nebula apps** is a persistent animated switch. Apply a preview to update its theme, and use the switch to enable/disable that theme without losing it. It covers desktop/window controls, widgets, dialogs, Music, AI, Account Center, Game Mode, and owned Games/Files app pages. NebulaCraft's host chrome is themed, but its standalone cross-origin launcher, embedded websites, game canvases and third-party app content retain their own UI. It changes supported visual tokens, not arbitrary layouts, icon packs, fonts or executable plugins. Reduced-motion preferences disable transitions. Existing same-origin Games/Files installations also receive the theme when opened, through a restricted host adapter.

Undo restores the last pre-import style, palette, theme switch, shortcuts and wallpaper. Switching the full theme off restores original app styling. Theme state is account-local under `nebula.import.theme` / `nebula.import.themeEnabled`. No imported CSS or script is inserted into the page.

Additional modules: `dotfiles-repo.js` handles bounded GitHub reads and static analysis; `import-theme.js`, `import-theme.css` and the owned-app `import-theme-client.js` share validated theme tokens. GitHub tree behavior follows [the official API documentation](https://docs.github.com/en/rest/git/trees).
