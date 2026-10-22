export const THEME_KEY = "nebula.import.theme",
	THEME_ON = "nebula.import.themeEnabled";
export function themeTokens(input = {}) {
	const valid = (v, fallback) =>
		/^#[a-f0-9]{6}(?:[a-f0-9]{2})?$/i.test(v || "") ? v.slice(0, 7) : fallback;
	const background = valid(input.background, "#10141f");
	const luminance = (c) => {
		const rgb = c
			.slice(1)
			.match(/../g)
			.map((x) => parseInt(x, 16) / 255)
			.map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
		return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
	};
	let foreground = valid(input.foreground, "#f3f5fa");
	const contrast = (a, b) =>
		(Math.max(luminance(a), luminance(b)) + 0.05) /
		(Math.min(luminance(a), luminance(b)) + 0.05);
	if (contrast(background, foreground) < 4.5)
		foreground = luminance(background) > 0.18 ? "#111111" : "#f5f5f5";
	return {
		background,
		foreground,
		surface: valid(input.surface, background),
		accent: valid(input.accent, "#a7c8fa"),
		muted: valid(input.muted, foreground),
		rounding: Math.max(
			0,
			Math.min(
				40,
				Number.isFinite(Number(input.rounding)) && input.rounding != null
					? Number(input.rounding)
					: 9,
			),
		),
	};
}
export function applyThemeDocument(doc, config, enabled) {
	const root = doc.documentElement;
	if (!doc.getElementById("nebula-import-theme-css")) {
		const link = doc.createElement("link");
		link.id = "nebula-import-theme-css";
		link.rel = "stylesheet";
		link.href = "/nebula/import-theme.css";
		doc.head.append(link);
	}
	const tokens = themeTokens(config);
	for (const [key, value] of Object.entries(tokens))
		root.style.setProperty(
			`--import-${key}`,
			`${value}${key === "rounding" ? "px" : ""}`,
		);
	root.classList.toggle("nebula-import-theme", Boolean(enabled));
}
export function installImportTheme(os) {
	// Also cover existing installed copies predating the opt-in child bridge.
	const syncOwnedFrame = (frame) => {
		if (!(frame instanceof HTMLIFrameElement)) return;
		try {
			const url = new URL(frame.src, location.href);
			if (
				url.origin !== location.origin ||
				!/\/(nebula-games|fsapp)\.app\/index\.html$/.test(url.pathname)
			)
				return;
			const doc = frame.contentDocument;
			if (!doc?.head || !doc.body) return;
			doc.body.classList.add("nebula-owned-app");
			applyThemeDocument(
				doc,
				os.settings.get(THEME_KEY) || {},
				os.settings.get(THEME_ON),
			);
		} catch {
			/* A sandboxed or cross-origin app retains its own presentation. */
		}
	};
	document.addEventListener(
		"load",
		(event) => syncOwnedFrame(event.target),
		true,
	);
	const refresh = () => {
		applyThemeDocument(
			document,
			os.settings.get(THEME_KEY) || {},
			os.settings.get(THEME_ON),
		);
		window.dispatchEvent(new Event("nebula:theme"));
		document.querySelectorAll("iframe").forEach(syncOwnedFrame);
	};
	window.addEventListener("nebula:environment", refresh);
	refresh();
}
