import { rememberLockWallpaper } from "./accounts.js";
const DEFAULT_REPOS = ["dharmx/walls", "D3Ext/aesthetic-wallpapers"];
export function parseRepository(input) {
	const value = input
		.trim()
		.replace(/^https:\/\/github\.com\//, "")
		.replace(/\/$/, "");
	if (!/^[A-Za-z0-9][A-Za-z0-9_-]*\/[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(value))
		throw Error("Enter a public GitHub repository as owner/repository.");
	return value;
}
export function paletteFromPixels(data) {
	const bins = new Map();
	for (let i = 0; i < data.length; i += 4) {
		const [r, g, b] = data.slice(i, i + 3),
			max = Math.max(r, g, b),
			min = Math.min(r, g, b);
		if (max < 35 || min > 225 || data[i + 3] < 200) continue;
		const key = [r, g, b].map((n) => Math.round(n / 32) * 32).join(",");
		const bin = bins.get(key) || { rgb: [0, 0, 0], count: 0, score: 0 };
		bin.count++;
		bin.score += 1 + (max - min) / 64;
		bin.rgb[0] += r;
		bin.rgb[1] += g;
		bin.rgb[2] += b;
		bins.set(key, bin);
	}
	const colors = [...bins.values()]
		.sort((a, b) => b.score - a.score)
		.slice(0, 5)
		.map((bin) => bin.rgb.map((n) => Math.round(n / bin.count)));
	if (!colors.length) colors.push([150, 173, 201]);
	return colors.map((rgb) => {
		const max = Math.max(...rgb);
		const factor = max < 170 ? 170 / max : 1;
		return (
			"#" +
			rgb
				.map((n) =>
					Math.min(235, Math.round(n * factor * 0.65 + 255 * 0.35))
						.toString(16)
						.padStart(2, "0"),
				)
				.join("")
		);
	});
}
const element = (tag, text, props = {}) =>
	Object.assign(document.createElement(tag), {
		...(text == null ? {} : { textContent: text }),
		...props,
	});
const button = (text, fn) => {
	const b = element("button", text, { type: "button" });
	b.onclick = fn;
	return b;
};
export function installWallpapers(os) {
	let applying = false,
		revision = 0;
	async function imageData(url) {
		const response = await fetch(url, {
			credentials: "omit",
			signal: AbortSignal.timeout(20000),
		});
		if (!response.ok) throw Error(`Image request failed (${response.status}).`);
		if (Number(response.headers.get("content-length")) > 20 * 1024 * 1024)
			throw Error("Choose an image smaller than 20 MiB.");
		const blob = await response.blob();
		if (blob.size > 20 * 1024 * 1024)
			throw Error("Choose an image smaller than 20 MiB.");
		const bitmap = new Image();
		const imageURL = URL.createObjectURL(blob);
		bitmap.src = imageURL;
		try {
			await bitmap.decode();
		} catch (error) {
			URL.revokeObjectURL(imageURL);
			throw error;
		}
		const canvas = document.createElement("canvas");
		const scale = Math.min(1, 2560 / bitmap.width, 1440 / bitmap.height);
		canvas.width = Math.max(1, Math.round(bitmap.width * scale));
		canvas.height = Math.max(1, Math.round(bitmap.height * scale));
		canvas
			.getContext("2d")
			.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		URL.revokeObjectURL(imageURL);
		const sample = document.createElement("canvas");
		sample.width = 96;
		sample.height = 64;
		sample.getContext("2d").drawImage(canvas, 0, 0, 96, 64);
		const palette = paletteFromPixels(
			sample.getContext("2d").getImageData(0, 0, 96, 64).data,
		);
		const small = document.createElement("canvas");
		const previewScale = Math.min(1, 960 / canvas.width, 540 / canvas.height);
		small.width = Math.max(1, Math.round(canvas.width * previewScale));
		small.height = Math.max(1, Math.round(canvas.height * previewScale));
		small.getContext("2d").drawImage(canvas, 0, 0, small.width, small.height);
		return {
			blob: await new Promise((resolve) =>
				canvas.toBlob(resolve, "image/jpeg", 0.9),
			),
			palette,
			preview: small.toDataURL("image/jpeg", 0.65),
		};
	}
	async function accent(palette) {
		await os.settings.set("nebula.wallpaper.palette", palette);
		if (os.settings.get("nebula.wallpaper.autoAccent") !== false) {
			os.ui.theme.accent = palette[0];
			os.ui.theme.apply();
			await os.settings.set("theme", { ...os.ui.theme.state });
		}
	}
	async function sync() {
		if (applying) return;
		const token = ++revision;
		const url =
			os.settings.get("nebula.desktop.environment") === "flow" &&
			os.settings.get("nebula.desktop.environmentWallpaper") !== false
				? "/nebula/flow-wallpaper.svg"
				: os.settings.get("wallpaper") || "/nebula/wallpaper.svg";
		try {
			if (
				os.settings.get("nebula.wallpaper.paletteURL") === url &&
				os.settings.get("nebula.wallpaper.palette")?.length
			) {
				const preview = os.settings.get("nebula.wallpaper.lockPreview");
				if (preview) rememberLockWallpaper(preview);
				await accent(os.settings.get("nebula.wallpaper.palette"));
				return;
			}
			const data = await imageData(url);
			if (token !== revision) return;
			rememberLockWallpaper(data.preview);
			await accent(data.palette);
			await os.settings.set("nebula.wallpaper.paletteURL", url);
			await os.settings.set("nebula.wallpaper.lockPreview", data.preview);
		} catch (error) {
			console.warn("Wallpaper palette unavailable:", error.message);
		}
	}
	window.addEventListener("nebula:wallpaper-changed", sync);
	window.addEventListener("nebula:environment", sync);
	sync();
	window.addEventListener("nebula:wallpapers", () => open());
	async function open() {
		const dialog = element("dialog", null, {
			className: "nebula-wallpaper-picker",
		});
		dialog.setAttribute("aria-label", "Wallpaper switcher");
		let items = [],
			page = 0,
			loadVersion = 0,
			busy = false;
		const head = element("header");
		head.append(
			element("span", "PERSONALIZE / YOUR ORBIT"),
			button("Close wallpaper switcher", () => dialog.close()),
		);
		const heading = element("h2", "Find your atmosphere");
		const toolbar = element("div", null, {
				className: "nebula-wallpaper-toolbar",
			}),
			source = element("select");
		source.setAttribute("aria-label", "Wallpaper source");
		source.append(element("option", "Nebula collection", { value: "bundled" }));
		for (const repo of [
			...new Set([
				...DEFAULT_REPOS,
				...(os.settings.get("nebula.wallpaper.repos") || []),
			]),
		])
			source.append(element("option", repo, { value: repo }));
		const search = element("input", null, {
			placeholder: "Search names or folders",
			type: "search",
		});
		search.setAttribute("aria-label", "Search wallpapers");
		const auto = element("input", null, {
			type: "checkbox",
			checked: os.settings.get("nebula.wallpaper.autoAccent") !== false,
		});
		auto.setAttribute("aria-label", "Match accent to wallpaper");
		const autolabel = element("label", "Match accent to wallpaper ");
		autolabel.append(auto);
		const palette = element("div", null, {
			className: "nebula-wallpaper-palette",
		});
		palette.setAttribute("aria-label", "Wallpaper palette");
		function drawPalette() {
			palette.replaceChildren();
			for (const color of os.settings.get("nebula.wallpaper.palette") || []) {
				const swatch = button(color, async () => {
					auto.checked = false;
					await os.settings.set("nebula.wallpaper.autoAccent", false);
					os.ui.theme.accent = color;
					os.ui.theme.apply();
					await os.settings.set("theme", { ...os.ui.theme.state });
				});
				swatch.style.background = color;
				swatch.setAttribute("aria-label", `Use accent ${color}`);
				palette.append(swatch);
			}
		}
		auto.onchange = async () => {
			await os.settings.set("nebula.wallpaper.autoAccent", auto.checked);
			if (auto.checked)
				await accent(
					os.settings.get("nebula.wallpaper.palette") || ["#a7d4c4"],
				);
		};
		drawPalette();
		toolbar.append(source, search, autolabel);
		const strip = element("div", null, { className: "nebula-wallpaper-strip" });
		strip.setAttribute("aria-label", "Wallpaper previews");
		const status = element("p", null, { className: "nebula-wallpaper-status" });
		status.setAttribute("role", "status");
		const footer = element("div", null, {
				className: "nebula-wallpaper-pagination",
			}),
			prev = button("Previous", () => {
				page--;
				render();
			}),
			next = button("Next", () => {
				page++;
				render();
			}),
			counter = element("span");
		footer.append(prev, counter, next);
		const attribution = element("a", "Browse source repository", {
			target: "_blank",
			rel: "noopener noreferrer",
		});
		attribution.hidden = true;
		async function choose(item) {
			if (busy) return;
			busy = true;
			applying = true;
			revision++;
			status.textContent = `Loading ${item.name}…`;
			try {
				const data = await imageData(item.url);
				const bytes = new Uint8Array(await data.blob.arrayBuffer());
				const hash = [
					...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
				]
					.slice(0, 12)
					.map((n) => n.toString(16).padStart(2, "0"))
					.join("");
				try {
					await os.fs.promises.mkdir("/.nebula-wallpapers");
				} catch (error) {
					if (error.code !== "EEXIST") throw error;
				}
				const path = `/.nebula-wallpapers/${hash}.jpg`;
				await os.fs.promises.writeFile(path, bytes);
				await os.settings.set("wallpaper", `/fs${path}`);
				await os.settings.set("wallpaper-name", item.name);
				await os.settings.set("nebula.desktop.environmentWallpaper", false);
				os.apps["anura.wallpaper"].setWallpaper(`/fs${path}`);
				window.dispatchEvent(new Event("nebula:environment"));
				await accent(data.palette);
				await os.settings.set("nebula.wallpaper.paletteURL", `/fs${path}`);
				await os.settings.set("nebula.wallpaper.lockPreview", data.preview);
				rememberLockWallpaper(data.preview);
				drawPalette();
				status.textContent = `Applied ${item.name}. Saved for offline use.`;
				await os.settings.set(
					"nebula.wallpaper.source",
					item.source || "Local collection",
				);
			} catch (error) {
				status.textContent = `Could not apply wallpaper: ${error.message}`;
			} finally {
				applying = false;
				busy = false;
			}
		}
		function render() {
			const filtered = items.filter((item) =>
				item.name.toLowerCase().includes(search.value.toLowerCase()),
			);
			page = Math.max(0, Math.min(page, Math.ceil(filtered.length / 12) - 1));
			strip.replaceChildren();
			for (const item of filtered.slice(page * 12, page * 12 + 12)) {
				const card = button("", () => choose(item));
				card.className = "nebula-wallpaper-card";
				card.setAttribute("aria-label", `Apply ${item.name}`);
				const img = element("img", null, {
					src: item.url,
					alt: "",
					loading: "lazy",
					crossOrigin: "anonymous",
					decoding: "async",
					referrerPolicy: "no-referrer",
				});
				img.onerror = () => {
					img.hidden = true;
				};
				card.append(img, element("span", item.name));
				strip.append(card);
			}
			counter.textContent = filtered.length
				? `${page * 12 + 1}–${Math.min(filtered.length, page * 12 + 12)} of ${filtered.length}`
				: "No matching wallpapers";
			prev.disabled = page === 0;
			next.disabled = (page + 1) * 12 >= filtered.length;
		}
		async function load() {
			const token = ++loadVersion;
			items = [];
			render();
			status.textContent = "Loading collection…";
			attribution.hidden = source.value === "bundled";
			try {
				let result;
				if (source.value === "bundled") {
					result = (
						await (
							await fetch("/assets/wallpaper/bundled_wallpapers/manifest.json")
						).json()
					).wallpapers;
					result.unshift({
						name: "Flow — Ringed horizon",
						url: "/nebula/flow-wallpaper.svg",
					});
				} else {
					const repo = parseRepository(source.value);
					attribution.href = `https://github.com/${repo}`;
					const request = async (url) => {
						const r = await fetch(url, {
							credentials: "omit",
							signal: AbortSignal.timeout(20000),
						});
						if (!r.ok)
							throw Error(
								r.status === 403 || r.status === 429
									? "GitHub rate limit reached. Try later or use the local collection."
									: `Repository request failed (${r.status}).`,
							);
						return r.json();
					};
					const metadata = await request(
						`https://api.github.com/repos/${repo}`,
					);
					const tree = await request(
						`https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(metadata.default_branch)}?recursive=1`,
					);
					result = tree.tree
						.filter(
							(item) =>
								item.type === "blob" &&
								/\.(png|jpe?g|webp)$/i.test(item.path) &&
								item.size <= 20 * 1024 * 1024,
						)
						.map((item) => ({
							name: item.path,
							url: `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(metadata.default_branch)}/${item.path.split("/").map(encodeURIComponent).join("/")}`,
							source: `https://github.com/${repo}`,
						}));
					if (tree.truncated)
						status.textContent =
							"Repository is large; showing the files returned by GitHub.";
				}
				if (token !== loadVersion) return;
				items = result;
				render();
				status.textContent = `${items.length} wallpapers. Select a preview to apply it.`;
			} catch (error) {
				if (token === loadVersion) status.textContent = error.message;
			}
		}
		source.onchange = () => {
			page = 0;
			load();
		};
		search.oninput = () => {
			page = 0;
			render();
		};
		const repoForm = element("form", null, {
				className: "nebula-wallpaper-repo",
			}),
			repoInput = element("input", null, {
				placeholder: "owner/repository or GitHub repository URL",
			});
		repoInput.setAttribute("aria-label", "GitHub wallpaper repository");
		const add = element("button", "Connect repository", { type: "submit" });
		repoForm.append(repoInput, add);
		repoForm.onsubmit = async (e) => {
			e.preventDefault();
			try {
				const repo = parseRepository(repoInput.value);
				if (![...source.options].some((o) => o.value === repo))
					source.append(element("option", repo, { value: repo }));
				await os.settings.set("nebula.wallpaper.repos", [
					...new Set([
						...(os.settings.get("nebula.wallpaper.repos") || []),
						repo,
					]),
				]);
				source.value = repo;
				await load();
			} catch (error) {
				status.textContent = error.message;
			}
		};
		const local = element("input", null, {
			type: "file",
			accept: "image/png,image/jpeg,image/webp",
		});
		local.setAttribute("aria-label", "Import wallpaper");
		local.onchange = async () => {
			const file = local.files[0];
			if (!file) return;
			if (file.size > 20 * 1024 * 1024) {
				status.textContent = "Choose an image smaller than 20 MiB.";
				return;
			}
			const url = URL.createObjectURL(file);
			try {
				await choose({ name: file.name, url });
			} finally {
				URL.revokeObjectURL(url);
			}
		};
		dialog.append(
			head,
			heading,
			toolbar,
			palette,
			strip,
			footer,
			status,
			repoForm,
			local,
			attribution,
			element(
				"p",
				"Repository images remain credited to their original creators. Check the source for individual image rights. Only your selected wallpaper is saved locally.",
			),
		);
		document.body.append(dialog);
		dialog.addEventListener(
			"close",
			() => {
				loadVersion++;
				dialog.remove();
			},
			{ once: true },
		);
		dialog.showModal();
		load();
	}
}
