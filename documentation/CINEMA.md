# Nebula Cinema

Nebula Cinema is an independent Stremio-compatible media application. Open it from the NebulaHub launcher or visit `/cinema/` directly. The files in `public/cinema` can also be published as their own static website without Anura. No build dependencies are required for the standalone client.

## Add-ons

Torrentio and Cinemeta install automatically on first launch (including existing Cinema profiles). Torrentio exposes streams, not catalogs; Cinemeta supplies browsable/searchable movies and series. Existing configured URLs are preserved by add-on ID. Removing a default is remembered, and a failed first install retries next launch. Torrentio's infoHash/fileIdx streams require the companion, available peers, and a browser-compatible video file. Automatic installation does not supply a public torrent server or transcoding.

In **Add-ons & server**, paste the configured HTTPS `/manifest.json` URL (or `stremio://` installation URL). Installed manifests and the server address are stored locally in this origin's localStorage. Configured add-on URLs can contain private credentials; treat browser storage accordingly. The companion token stays in memory for the current tab only. Different website origins have separate preferences.

Supported: HTTP manifests; catalog feeds and search; metadata; series episode selection; resource-specific type/ID filters; direct HTTP(S) video sources; external source links; BitTorrent v1 info hashes and file indices through the companion. Failed providers do not prevent other catalogs from loading. Remove add-ons from the connection dialog.

Limitations: add-ons must permit CORS. Required catalog filters other than search, subtitle add-ons, DRM, embedded YouTube IDs, custom stream HTTP headers, native-only protocols and transcoding are not implemented. HLS depends on native browser support; MP4/WebM support depends on their codecs. No promise of universal Stremio compatibility. The sample Sintel film is a Blender Foundation open movie, CC BY 3.0, served by WebTorrent's public demo host. No commercial-content providers are bundled.

## Free torrent companion

The included Node companion runs on your own computer without a hosting subscription. Your machine must remain on; traffic uses your internet connection. It is a real BitTorrent client, not a Netlify function. Install Node 24, then:

```sh
cd companions/cinema
npm ci
npm start
```

Copy the temporary access token printed in **your terminal** into Cinema, with address `http://127.0.0.1:8787`. Save and test the connection. Each restart generates a new token unless `CINEMA_TOKEN` is set to a secret of at least 24 characters. Browser local-network permission may be required; browsers that block HTTPS-to-loopback requests need a trusted HTTPS reverse proxy or a locally hosted Cinema page. Do not disable browser security.

The companion binds only to loopback by default. `HOST`, `PORT`, `CINEMA_TOKEN`, and comma-separated `CINEMA_ORIGINS` configure self-hosting. The default allowed origins are the main NebulaHub site, standalone Cinema site, and `http://localhost:8000`. For another static host, add its exact origin. Remote hosting requires HTTPS, a private token, and a network that permits BitTorrent. Do not place the token in public source or frontend configuration.

One active torrent at a time; starting a new session replaces the previous torrent. Maximum torrent size is 2 GiB. Only MP4/M4V/WebM/Ogg files are exposed; unsupported codecs are not converted. HTTP byte ranges support seeking. Inactive downloads expire after 15 minutes. Downloads use a temporary directory and are removed when their session is replaced, expires, or the service shuts down normally. Force-killing the process can leave temporary files behind. Session media URLs are random bearer capabilities: do not share them. Use content you have permission to access.

## Hosting findings

Netlify serves the static client, not long-lived torrent sessions. Render's free service hours are shared per workspace, its filesystem is ephemeral, outbound bandwidth is metered, and heavy service-initiated internet traffic can cause suspension. It is not a reliable unlimited free torrent server. No new cloud torrent service or paid plan is provisioned by this implementation. A persistent public torrent backend needs an appropriate host and bandwidth budget; the free working option supplied here is self-hosting.

## Tests and deployment

```sh
npm test
npx playwright test tests/browser/cinema.spec.mjs
cd companions/cinema
npm test
```

The companion integration test seeds real bytes with a second local BitTorrent client and checks authentication, origin restrictions, transfer integrity and seeking. Browser tests cover add-on installation, persistence, search, source selection and the Anura window. A provider fixture makes these tests independent of third-party catalog uptime.

The normal NebulaHub production build packages `/cinema/`. `scripts/package-nebula.mjs` supplies credentialless COEP for these documents so remote media can load within the isolated desktop. For a separate Netlify site publish `public/cinema`; no functions or build command are required. Keep the main site's functions when deploying the desktop.

## Attribution

NebulaHub derives from AnuraOS / Mercury Workshop under AGPL-3.0. Cinema is an original client using the [Stremio add-on protocol](https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/protocol.md); it is not affiliated with Stremio. The companion uses [WebTorrent](https://webtorrent.io/docs), MIT licensed. Retain dependency license notices. Hosting limits: https://render.com/docs/free .
