# Lock screen, accounts and personalization

## Lock screen and local accounts

Open **Settings → General → Manage accounts**. The first account adopts your existing desktop, files and settings; creating it does not reset them. Further accounts receive separate Anura filesystems, settings (including notes, Music playlists and desktop preferences), OPFS directories and Linux disk databases. Choose a name and a password of at least eight characters. Change your password by supplying the current one in Manage accounts.

Once an account exists, each reload waits at the lock screen before opening the filesystem and starting Anura. **Lock** in Flow, **Lock screen** in Settings, or the default **Ctrl+Alt+L** shortcut locks the current session. The clock and blurred wallpaper are inspired by [the supplied Ilyamiro clip](https://www.tiktok.com/@ilyamiro.dev/video/7682914831942569223). The artwork and interface implementation are original.

Choose another account on the lock screen and select **Switch account**. Switching restarts the OS, then requests that account's password. Save open work before switching. The original account remains on its existing database; new accounts use unique database names. The Music player pauses on lock.

These are local browser accounts, not a server identity service or a secure multi-user operating system. Passwords use a random salt and PBKDF2-SHA-256 with 600,000 iterations; plaintext passwords are never stored. The lock blocks normal interface access, but files are **not encrypted**. Same-origin applications, developer tools and anyone with access to the browser profile can access storage. Website cookies and third-party application storage can still be shared at browser-origin scope. Use your device's login for stronger protection. There is no cloud password recovery. Clearing browser storage removes local accounts and their data; export important files before doing so.

An existing installation without configured accounts continues to boot normally. No default password is installed. Linux disk namespace selection is implemented; the emulator was not re-downloaded for every new account during this update. Public deployment and the PWA cache remain shared, while profile data stays local.

## Flow shortcuts

Choose **Settings → General → Customize shortcuts**. Select an action and press a combination; Escape cancels recording, Backspace disables that action, and Restore defaults resets assignments. Duplicate and common browser-reserved combinations are rejected. Bindings are saved per local account.

Supported actions include each workspace, moving a window to each workspace, tile/float, dashboard, scratchpad, app search, wallpaper switcher and lock. Defaults retain the original workspace keys and add Ctrl+Alt+W for wallpapers, Ctrl+Alt+L for lock and Ctrl+Alt+N for notes. Shortcuts run in Flow when the desktop has keyboard focus. Browsers or embedded apps may reserve combinations; the system cannot capture every global operating-system key.

## Wallpaper switcher and matching colors

Open **Wallpapers** in Flow, **Wallpaper switcher** in Settings, or Ctrl+Alt+W. A horizontal strip of angled previews and color swatches takes inspiration from the supplied clips. Search names/folders, browse pages, select an image or import a local PNG/JPEG/WebP.

Built-in collections include the bundled Nebula/Anura wallpapers and live links to [dharmx/walls](https://github.com/dharmx/walls) and [D3Ext/aesthetic-wallpapers](https://github.com/D3Ext/aesthetic-wallpapers). Connect another public GitHub repository using `owner/repository` or its root URL. The GitHub API lists raster images from the repository's default branch. No credentials or proxy are required. Unauthenticated API limits, unavailable repositories and unavailable images are reported rather than simulated. Very large truncated repository trees expose only the returned files.

Only the selected image is imported into the account's `/.nebula-wallpapers/` directory, normalized to JPEG at up to 2560×1440. Input size is limited to 20 MiB. This local copy survives refresh and remains usable offline; browsing remote repositories needs a connection. Files are content-addressed, so selecting the same image again does not duplicate it. Existing imports remain available through Files.

**Match accent to wallpaper** samples the actual image and applies the dominant palette to the native Anura theme and Flow accent states. It is enabled by default. Choose a palette swatch to set an accent manually and turn automatic matching off. Choosing a wallpaper disables Flow's default environment wallpaper so your selection is visible. The selected wallpaper also supplies the lock-screen backdrop. Palette extraction is cached by wallpaper URL.

Remote repository images are not bundled or relicensed by NebulaHub. The picker links to the source; check individual creator rights before redistributing images. Repository-level licenses do not necessarily cover every collected artwork. Upstream AGPL and third-party notices remain intact.

## Upstream integration

`public/nebula/accounts.js`, `keybinds.js`, `wallpapers.js` and `personalization.css` contain the isolated additions. Boot awaits the account gate; the filesystem provider, OPFS mount and v86 disk select an account namespace. Native Settings opens the new controls. The upstream wallpaper app emits a wallpaper-change event for palette updates. The OS window manager, filesystem API, PWA and applications remain in use.

## Account Center and desktop motion

Open **Account Center** from the launcher, Flow dashboard, or **Settings → General → Account Center**. Add multiple labeled profiles for GitHub, Google, Discord, Instagram, Reddit, TikTok, Microsoft, or a custom HTTPS service. Search, favorites, editing, last-opened information and undoable removal work locally. Entries are stored under `nebula.account-center.v1.<local-profile-id>` in localStorage, separate for each Nebula desktop account.

**Sign in** opens the service's real login/account chooser in a new browser tab; **Open** opens the service's website. Finish authentication there. Provider cookies and sessions are managed by that website and your browser, not copied into NebulaHub storage. This Account Center is a saved-profile launcher, not an OAuth connection broker or password vault. It does not claim to verify login state or isolate provider cookies. It never stores passwords, access tokens or refresh tokens. Removing a saved entry does not sign out of the website. Sites with multiple active logins provide their own account switcher: see [GitHub account switching](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/switching-between-accounts) and [Google multiple sign-ins](https://support.google.com/accounts/answer/1721977).

Animations use short easing transitions for window opening/closing/maximizing, dock visibility, workspace changes, panels, notes, wallpaper fades and button feedback. They run on events, without a continuous rendering loop. **Settings → General → Reduce motion** and the operating system's reduced-motion preference disable these effects. Dragging remains direct, without delayed position interpolation. Native window animations keep within their existing lifecycle timers. Account Center is registered as a real Anura app; motion is isolated in `public/nebula/motion.js`.
