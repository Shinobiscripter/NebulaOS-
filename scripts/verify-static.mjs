import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
const text = (path) => readFile(`static/${path}`, "utf8");
const exists = async (path) =>
	assert.ok((await stat(`static/${path}`)).isFile(), path);
const html = (await text("index.html")).replace(/<!--[\s\S]*?-->/g, "");
assert.match(html, /<title>NebulaHub<\/title>/);
for (const match of html.matchAll(/(?:src|href)="\/(?!\/)([^"]+)"/g))
	await exists(match[1]);
for (const path of [
	"anura-sw.js",
	"lib/v86.wasm",
	"libs/libcurl/libcurl.wasm",
	"browser/controller.sw.js",
	"browser/index.html",
	"nebula/LICENSE.txt",
	"nebula/CREDITS.txt",
	"_headers",
	"_redirects",
])
	await exists(path);
for (const path of ["lib/v86.wasm", "libs/libcurl/libcurl.wasm"])
	assert.deepEqual(
		[...new Uint8Array(await readFile(`static/${path}`)).slice(0, 4)],
		[0, 97, 115, 109],
	);
const manifest = JSON.parse(await text("manifest.json"));
assert.equal(manifest.name, "NebulaHub");
assert.equal(manifest.scope, "/");
for (const icon of manifest.icons) await exists(icon.src.slice(1));
const config = JSON.parse(await text("config.json"));
for (const app of config.apps) {
	if ((await stat(`static/${app}`)).isFile()) JSON.parse(await text(app));
	else await exists(`${app}/manifest.json`);
}
for (const lib of config.libs)
	await exists(`${lib.replace(/^\//, "")}/manifest.json`);
const { games } = JSON.parse(await text("nebula/games.json"));
assert.equal(games.length, 46);
for (const game of games) await exists(decodeURIComponent(game.path.slice(1)));
const cache = JSON.parse(await text("cache-load.json"));
assert.ok(cache.includes("browser/index.html"));
assert.ok(cache.includes("apps/nebula-games.app/index.html"));
assert.ok(
	cache.every((path) => !path.split("/").some((part) => part.startsWith("."))),
	"Netlify excludes hidden files; do not precache them",
);
for (const path of cache) await exists(path.replace(/^\.\//, ""));
console.log(
	"Production entry points, 46 game launchers, PWA assets, WASM signatures, app manifests and offline cache paths verified.",
);
