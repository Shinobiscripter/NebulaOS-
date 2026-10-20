import { test } from "node:test";
import assert from "node:assert/strict";
import { installDefaults, defaults } from "../public/cinema/default-addons.js";
function setup() {
	let addons = [];
	const data = new Map();
	const storage = {
		getItem: (k) => data.get(k),
		setItem: (k, v) => data.set(k, v),
	};
	return {
		storage,
		getAddons: () => addons,
		saveAddons: (a) => (addons = a),
		fetchManifest: async (url) => ({
			id: defaults.find((d) => d.url === url).id,
			name: "Provider",
			resources: ["stream"],
			types: ["movie"],
			catalogs: [],
		}),
	};
}
test("Defaults migrate existing profiles once and honor removal", async () => {
	const ctx = setup();
	assert.deepEqual(await installDefaults(ctx), []);
	assert.equal(ctx.getAddons().length, 2);
	ctx.saveAddons([]);
	await installDefaults(ctx);
	assert.equal(ctx.getAddons().length, 0);
});
test("Configured provider URLs are preserved; failed installs retry", async () => {
	const ctx = setup();
	ctx.saveAddons([
		{
			url: "https://example.test/private/manifest.json",
			manifest: { id: defaults[0].id },
		},
	]);
	const fetch = ctx.fetchManifest;
	ctx.fetchManifest = async () => {
		throw Error("offline");
	};
	assert.equal((await installDefaults(ctx)).length, 1);
	assert.equal(
		ctx.getAddons()[0].url,
		"https://example.test/private/manifest.json",
	);
	ctx.fetchManifest = fetch;
	await installDefaults(ctx);
	assert.equal(ctx.getAddons().length, 2);
});
