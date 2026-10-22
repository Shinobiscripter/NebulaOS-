// Loaded only by owned same-origin applications, never by third-party games.
import { applyThemeDocument, THEME_KEY, THEME_ON } from "./import-theme.js";
try {
	const os = parent.anura;
	if (os) {
		const refresh = () =>
			applyThemeDocument(
				document,
				os.settings.get(THEME_KEY) || {},
				os.settings.get(THEME_ON),
			);
		parent.addEventListener("nebula:theme", refresh);
		refresh();
		addEventListener(
			"pagehide",
			() => parent.removeEventListener("nebula:theme", refresh),
			{ once: true },
		);
	}
} catch {
	/* Standalone or cross-origin host: retain the application's own theme. */
}
