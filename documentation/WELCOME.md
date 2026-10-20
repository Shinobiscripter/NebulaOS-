# Welcome and local setup

The Welcome launcher app runs once per local profile until the user completes it.
Existing profiles and files are preserved. Continue later and Escape dismiss the
guide for the current visit without marking setup complete. Welcome can always
be reopened from the launcher.

The five steps introduce the desktop, create a local account with the existing
salted PBKDF2 verifier, apply an Orbit/Flow/Horizon desktop choice, present grouped
feature guides with real launch actions, and finish setup. No password is stored
in plaintext or sent to a server. This is a local UI lock, not encrypted storage
or a replacement for device security. There is no email recovery. Clear-site-data
removes accounts and local files; users should export important data separately.

Implementation: `public/nebula/welcome.js` and `welcome.css`; account validation is
shared with the existing Local accounts dialog in `accounts.js`. Completion is
stored at `nebula.welcome.v1.<profileId>`. Motion respects reduced-motion settings.

## External web ports

Both catalogs include three externally hosted launchers, with GitHub provenance:

- DELTARUNE Chapters 1 & 2 demo: Orangeify/deltarune-port.
- UNDERTALE: heavenorcayt/Undertale-Web-Port-main.
- Pizza Tower: RealestXenoxx/Pizza-Tower-Web-Port.

These are unofficial ports, not bundled game downloads or AGPL-licensed assets.
Original games remain the property of Toby Fox and Tour De Pizza respectively.
Catalog entries open in separate browser tabs to preserve the hosts' storage and
avoid isolation/embedding conflicts. Their availability is controlled by the
external hosts. HTTP checks confirmed the entry pages respond, not full gameplay
or every chapter/level. No claim of game redistribution permission is made.

Tests: `npx playwright test tests/browser/welcome.spec.mjs` covers first-run
creation, mismatched passwords, desktop switching, feature sections, refresh and
unlock, replay without duplicate accounts, small screens and reduced motion.
