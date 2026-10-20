import { json } from "./protocol.js";

export const defaults = [
	{
		id: "com.stremio.torrentio.addon",
		url: "https://torrentio.strem.fun/manifest.json",
	},
	{
		id: "com.linvo.cinemeta",
		url: "https://v3-cinemeta.strem.io/manifest.json",
	},
];
// Remember each successful migration separately. Removing an installed default
// must not reinstall it at the next launch; an unavailable provider can retry.
export async function installDefaults({
	storage,
	getAddons,
	saveAddons,
	fetchManifest = json,
}) {
	let done = [];
	try {
		done = JSON.parse(storage.getItem("nebula.cinema.defaults.v1") || "[]");
		if (!Array.isArray(done)) done = [];
	} catch {}
	const failed = [];
	for (const source of defaults) {
		if (done.includes(source.id)) continue;
		try {
			if (!getAddons().some((a) => a.manifest.id === source.id)) {
				const manifest = await fetchManifest(source.url);
				if (
					manifest.id !== source.id ||
					!manifest.name ||
					!Array.isArray(manifest.resources) ||
					!Array.isArray(manifest.types) ||
					!Array.isArray(manifest.catalogs)
				)
					throw new Error("Invalid default manifest");
				if (!getAddons().some((a) => a.manifest.id === source.id))
					saveAddons([...getAddons(), { url: source.url, manifest }]);
			}
			done.push(source.id);
			storage.setItem("nebula.cinema.defaults.v1", JSON.stringify(done));
		} catch {
			failed.push(source.id);
		}
	}
	return failed;
}
