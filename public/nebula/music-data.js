export function youtubeID(value) {
	const u = new URL(value.trim());
	if (u.protocol !== "https:" || u.username || u.password)
		throw Error("Use an HTTPS YouTube or YouTube Music song link.");
	const hosts = [
		"youtube.com",
		"www.youtube.com",
		"music.youtube.com",
		"youtu.be",
	];
	if (!hosts.includes(u.hostname))
		throw Error("Use a YouTube or YouTube Music song link.");
	const id =
		u.hostname === "youtu.be" ? u.pathname.slice(1) : u.searchParams.get("v");
	if (!/^[\w-]{11}$/.test(id || ""))
		throw Error("Paste a song link containing a video ID.");
	return id;
}
export function searchTracks(html) {
	const match = html.match(
		/(?:var\s+ytInitialData\s*=|window\["ytInitialData"\]\s*=)\s*/,
	);
	if (!match)
		throw Error(
			"YouTube did not return search results. Try again or paste a song link.",
		);
	const rest = html.slice(match.index + match[0].length);
	let depth = 0,
		quoted = false,
		escape = false,
		end = 0;
	for (; end < rest.length; end++) {
		const c = rest[end];
		if (quoted) {
			if (escape) escape = false;
			else if (c === "\\") escape = true;
			else if (c === '"') quoted = false;
		} else if (c === '"') quoted = true;
		else if (c === "{") depth++;
		else if (c === "}" && --depth === 0) break;
	}
	const data = JSON.parse(rest.slice(0, end + 1)),
		tracks = new Map();
	const text = (x) =>
		x?.simpleText || x?.runs?.map((r) => r.text).join("") || "";
	function walk(obj) {
		if (!obj || typeof obj !== "object") return;
		const v = obj.videoRenderer;
		if (v && /^[\w-]{11}$/.test(v.videoId))
			tracks.set(v.videoId, {
				id: v.videoId,
				title: text(v.title),
				artist: text(v.ownerText),
				duration: text(v.lengthText),
			});
		for (const value of Object.values(obj)) walk(value);
	}
	walk(data);
	return [...tracks.values()].slice(0, 24);
}
