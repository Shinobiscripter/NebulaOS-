import {
	safeURL,
	manifestURL,
	resourceURL,
	supports,
	json,
} from "./protocol.js";
import { installDefaults } from "./default-addons.js";
const $ = (s) => document.querySelector(s);
const el = (tag, text, cls) => {
	const n = document.createElement(tag);
	if (text) n.textContent = text;
	if (cls) n.className = cls;
	return n;
};
const button = (text, action) => {
	const b = el("button", text);
	b.onclick = action;
	return b;
};
let addons = [];
try {
	addons = JSON.parse(localStorage.getItem("nebula.cinema.addons") || "[]");
	if (!Array.isArray(addons)) addons = [];
} catch {}
let endpoint = localStorage.getItem("nebula.cinema.server") || "",
	token = "",
	generation = 0,
	detailGeneration = 0;
const demo = {
	id: "nebula:sintel",
	type: "movie",
	name: "Sintel",
	description:
		"A Blender Foundation open movie. Directed by Colin Levy, 2010. CC BY 3.0.",
	poster: "https://webtorrent.io/img/poster.jpg",
};
const notice = (message, settings = false) => {
	$(settings ? "#settings-status" : "#status").textContent = message;
};
function save() {
	localStorage.setItem("nebula.cinema.addons", JSON.stringify(addons));
}
function renderAddons() {
	const root = $("#addons");
	root.replaceChildren();
	for (const a of addons) {
		const row = el("div", null, "row");
		row.append(
			el(
				"span",
				a.manifest.name +
					(a.manifest.catalogs.length ? " · Catalogs" : " · Stream provider"),
			),
			button("Remove", () => {
				addons = addons.filter((x) => x !== a);
				save();
				renderAddons();
				discover();
			}),
		);
		root.append(row);
	}
}
$("#settings").onclick = () => {
	renderAddons();
	$("#server").elements.endpoint.value = endpoint;
	$("#preferences").showModal();
};
document
	.querySelectorAll(".close")
	.forEach((b) => (b.onclick = () => b.closest("dialog").close()));
$("#details").addEventListener("close", () => {
	detailGeneration++;
	const video = $("video");
	if (video) {
		video.pause();
		video.removeAttribute("src");
		video.load();
	}
});
$("#install").onsubmit = async (e) => {
	e.preventDefault();
	notice("Checking manifest…", true);
	try {
		const url = manifestURL(e.target.elements.url.value);
		const manifest = await json(url);
		if (
			!manifest.id ||
			!manifest.name ||
			!Array.isArray(manifest.resources) ||
			!Array.isArray(manifest.types) ||
			!Array.isArray(manifest.catalogs)
		)
			throw new Error("Invalid Stremio manifest.");
		if (manifest.behaviorHints?.configurationRequired)
			throw new Error(
				"Configure this add-on on its website first, then paste its configured manifest URL.",
			);
		addons = addons.filter((a) => a.url !== url);
		addons.push({ url, manifest });
		save();
		renderAddons();
		notice("Add-on installed.", true);
		discover();
	} catch (error) {
		notice(error.message + " Add-ons must allow browser CORS requests.", true);
	}
};
$("#server").onsubmit = async (e) => {
	e.preventDefault();
	try {
		endpoint = safeURL(e.target.elements.endpoint.value).replace(/\/$/, "");
		token = e.target.elements.token.value;
		const result = await fetch(endpoint + "/health", {
			headers: { Authorization: "Bearer " + token },
			signal: AbortSignal.timeout(10000),
		});
		if (!result.ok) throw new Error("Connection rejected: " + result.status);
		localStorage.setItem("nebula.cinema.server", endpoint);
		notice("Companion connected.", true);
	} catch (error) {
		notice(error.message, true);
	}
};
function cards(root, items) {
	const grid = el("div", null, "grid");
	for (const item of items.filter((x) => x?.id && x?.type).slice(0, 100)) {
		const b = button("", () => show(item));
		b.className = "poster";
		if (item.poster) {
			try {
				const img = el("img");
				img.src = safeURL(item.poster);
				img.alt = "";
				img.loading = "lazy";
				img.referrerPolicy = "no-referrer";
				b.append(img);
			} catch {
				b.append(el("span", "✦", "placeholder"));
			}
		} else b.append(el("span", "✦", "placeholder"));
		b.append(
			el("strong", item.name || item.id),
			el("small", item.releaseInfo || item.type),
		);
		grid.append(b);
	}
	root.append(grid);
}
async function discover(query = "") {
	const run = ++generation;
	const root = $("#catalogs");
	root.replaceChildren();
	notice("");
	if (!query) {
		const section = el("section");
		section.append(el("h2", "Open cinema"));
		cards(section, [demo]);
		root.append(section);
	}
	let failures = 0,
		count = 0;
	const jobs = [];
	for (const a of addons)
		for (const c of a.manifest.catalogs) {
			const extras = c.extra || [];
			if (query && !extras.some((x) => x.name === "search")) continue;
			if (extras.some((x) => x.isRequired && !(x.name === "search" && query)))
				continue;
			const section = el("section");
			section.append(
				el("h2", `${a.manifest.name} · ${c.name || c.id}`),
				el("p", "Loading…"),
			);
			root.append(section);
			jobs.push(
				(async () => {
					try {
						const data = await json(
							resourceURL(
								a,
								"catalog",
								c.type,
								c.id,
								query ? { search: query } : {},
							),
						);
						if (run !== generation) return;
						section.lastChild.remove();
						const items = data.metas || [];
						count += items.length;
						if (items.length) cards(section, items);
						else section.append(el("p", "No titles found."));
					} catch {
						if (run !== generation) return;
						failures++;
						section.lastChild.textContent =
							"This catalog could not be reached. Check its URL and CORS support.";
					}
				})(),
			);
		}
	await Promise.allSettled(jobs);
	if (run !== generation) return;
	if (query && !count)
		notice(
			"No matching titles. Search requires an installed add-on with search support.",
		);
	else if (!addons.length)
		notice(
			"Install Stremio add-ons to browse your catalogs. Sintel is available to try now.",
		);
	else if (failures)
		notice(`${failures} catalog(s) unavailable; other catalogs remain usable.`);
}
$("#home").onclick = () => discover();
$("#search").onsubmit = (e) => {
	e.preventDefault();
	discover(e.target.querySelector("input").value.trim());
};
async function show(item) {
	const run = ++detailGeneration;
	const root = $("#detail-content");
	root.replaceChildren(
		el("h2", item.name || item.id),
		el("p", "Loading details…"),
	);
	if (!$("#details").open) $("#details").showModal();
	let meta = item;
	for (const a of addons.filter((a) =>
		supports(a.manifest, "meta", item.type, item.id),
	)) {
		try {
			const data = await json(resourceURL(a, "meta", item.type, item.id));
			if (data.meta) {
				meta = { ...item, ...data.meta };
				break;
			}
		} catch {}
	}
	if (run !== detailGeneration) return;
	root.replaceChildren(
		el("h2", meta.name || item.id),
		el("p", meta.description || "Select a source to watch."),
	);
	const sourceRoot = el("div", null, "sources");
	root.append(sourceRoot);
	if (meta.videos?.length && item.type !== "tv") {
		for (const v of meta.videos) {
			sourceRoot.append(
				button(
					`${v.season != null ? "S" + v.season + " E" + v.episode + " · " : ""}${v.title || v.name || v.id}`,
					() => streams(meta.type, v.id, sourceRoot, run),
				),
			);
		}
	} else await streams(item.type, item.id, sourceRoot, run);
}
async function streams(type, id, root, run) {
	root.replaceChildren(el("p", "Finding sources…"));
	let list = [],
		failures = 0;
	if (id === demo.id)
		list = [
			{
				name: "Blender Foundation · MP4",
				url: "https://webtorrent.io/torrents/Sintel/Sintel.mp4",
			},
			{
				name: "Sintel · BitTorrent (companion required)",
				infoHash: "08ada5a7a6183aae1e09d831df6748d566095a10",
			},
		];
	else {
		const results = await Promise.allSettled(
			addons
				.filter((a) => supports(a.manifest, "stream", type, id))
				.map(async (a) => {
					const data = await json(resourceURL(a, "stream", type, id));
					return (data.streams || []).map((s) => ({
						...s,
						provider: a.manifest.name,
					}));
				}),
		);
		for (const r of results)
			if (r.status === "fulfilled") list.push(...r.value);
			else failures++;
	}
	if (run !== detailGeneration) return;
	root.replaceChildren();
	if (!list.length)
		root.append(
			el(
				"p",
				failures
					? "Stream providers could not be reached."
					: "No streams returned. Install a stream add-on for this title.",
			),
		);
	for (const s of list) {
		root.append(
			button(
				`${s.name || s.provider || "Watch"}${s.title ? " · " + s.title : ""}`,
				async () => {
					try {
						await play(s, root, run);
					} catch (error) {
						let msg = root.querySelector(".error");
						if (!msg) {
							msg = el("p", null, "error");
							root.append(msg);
						}
						msg.textContent = error.message;
					}
				},
			),
		);
	}
}
async function play(source, root, run) {
	if (source.behaviorHints?.proxyHeaders)
		throw new Error(
			"This source requires custom HTTP headers; the browser player cannot apply them.",
		);
	if (source.externalUrl) {
		const a = el("a", "Open in source website ↗");
		a.href = safeURL(source.externalUrl);
		a.target = "_blank";
		a.rel = "noopener noreferrer";
		root.append(a);
		return;
	}
	let url = source.url;
	if (source.infoHash) {
		if (!endpoint || !token)
			throw new Error(
				"Connect your torrent companion in Add-ons & server first.",
			);
		const response = await fetch(endpoint + "/sessions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: "Bearer " + token,
			},
			body: JSON.stringify({
				infoHash: source.infoHash,
				fileIdx: source.fileIdx,
			}),
			signal: AbortSignal.timeout(70000),
		});
		const data = await response.json();
		if (!response.ok)
			throw new Error(data.error || "Torrent connection failed.");
		url = endpoint + data.path;
	}
	if (!url)
		throw new Error("This stream type is not supported by the browser player.");
	if (run !== detailGeneration) return;
	let video = $("#detail-content video");
	if (!video) {
		video = el("video");
		video.controls = true;
		video.playsInline = true;
		$("#detail-content").append(video);
	}
	video.src = safeURL(url);
	video.onerror = () => {
		let p = $("#playback-error");
		if (!p) {
			p = el("p", null, "error");
			p.id = "playback-error";
			$("#detail-content").append(p);
		}
		p.textContent =
			"Playback failed. The source may be offline, blocked by browser policy, or use an unsupported codec. Try another source.";
	};
	$("#playback-error")?.remove();
	await video.play().catch(() => {});
}
discover();
installDefaults({
	storage: localStorage,
	getAddons: () => addons,
	saveAddons: (value) => {
		addons = value;
		save();
	},
}).then((failed) => {
	renderAddons();
	discover($("#search input").value.trim());
	if (failed.length) {
		const warning = el(
			"p",
			"Some default add-ons could not be reached. They will retry next time Cinema opens.",
			"error",
		);
		$("#catalogs").before(warning);
	}
});
