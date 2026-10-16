# NebulaGames

Game packages and catalog for NebulaHub Game Mode. The catalog includes 49 games: two downloadable open-source games and online launchers for the original NebulaHub collection, OvO and A Bite at Freddy’s.

## Licensing
2048 is MIT, Hextris is GPL-3.0-or-later. Complete source and original licenses are inside each game folder, along with pinned upstream commits in UPSTREAM.txt. Their authors retain their copyrights. Modifications remove remote advertising, analytics, obsolete score submission and external fonts.

OvO and A Bite at Freddy’s are online links only: no redistribution permission for their assets has been confirmed. Online entries do not imply endorsement or guaranteed availability. Original NebulaHub links are preserved.

## Integration
Copy this repository (excluding .git) into NebulaOS public/game-library. The catalog uses /game-library/ paths. Game Mode downloads listed files into browser Cache Storage and commits library membership only after successful completion. Browser storage may be evicted. Library membership is per Nebula profile; bundled games keep saves in their own browser storage, shared by local profiles on that origin.

No storefront payments, account login or console assets. Game Mode itself is maintained in the AGPL NebulaOS repository.
