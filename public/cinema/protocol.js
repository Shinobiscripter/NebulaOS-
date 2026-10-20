export function safeURL(value, base) {
	const url = new URL(value, base);
	if (
		!["https:", "http:"].includes(url.protocol) ||
		url.username ||
		url.password
	)
		throw new Error("Use an HTTP(S) URL without embedded credentials.");
	return url.href;
}
export function manifestURL(value) {
	const url = new URL(
		safeURL(value.trim().replace(/^stremio:\/\//i, "https://")),
	);
	if (!url.pathname.endsWith("/manifest.json") || url.search || url.hash)
		throw new Error("Paste the full configured /manifest.json URL.");
	return url.href;
}
export function resourceURL(addon, resource, type, id, extra = {}) {
	const suffix = Object.entries(extra)
		.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
		.join("&");
	return `${addon.url.slice(0, -"manifest.json".length)}${resource}/${encodeURIComponent(type)}/${encodeURIComponent(id)}${suffix ? "/" + suffix : ""}.json`;
}
export function supports(manifest, resource, type, id) {
	return (manifest.resources || []).some((r) => {
		const spec =
			typeof r === "string"
				? { name: r, types: manifest.types, idPrefixes: manifest.idPrefixes }
				: r;
		return (
			spec.name === resource &&
			(spec.types || manifest.types || []).includes(type) &&
			(!spec.idPrefixes || spec.idPrefixes.some((p) => id.startsWith(p)))
		);
	});
}
export async function json(url) {
	const response = await fetch(url, {
		signal: AbortSignal.timeout(20000),
		credentials: "omit",
		referrerPolicy: "no-referrer",
	});
	if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
	return response.json();
}
