import { animateFlow } from "./flow-layout.js";
// Short event-driven animations; no permanent animation loop or per-frame layout polling.
export function installMotion(os, { windows }) {
	const media = matchMedia("(prefers-reduced-motion: reduce)");
	const enabled = () =>
		!media.matches &&
		!os.settings.get("disable-animation") &&
		os.settings.get("nebula.motion") !== "reduced";
	const apply = () => {
		document.body.classList.toggle("nebula-motion", enabled());
		document.body.classList.toggle("nebula-motion-reduced", !enabled());
		if (!enabled())
			for (const animation of document.getAnimations()) animation.cancel();
	};
	media.addEventListener("change", apply);
	window.addEventListener("nebula:motion", apply);
	apply();
	const seen = new WeakSet();
	function scan() {
		for (const win of windows()) {
			if (seen.has(win)) continue;
			seen.add(win);
			let entrance;
			if (enabled())
				entrance = animateFlow(
					win.element,
					os.settings.get("nebula.desktop.environment") === "flow"
						? os.settings.get("nebula.flow.importStyle") || {}
						: {},
					"windowsIn",
				);
			win.addEventListener("close", () => entrance?.cancel());
		}
	}
	new MutationObserver(scan).observe(document.body, { childList: true });
	scan();
	window.addEventListener("nebula:workspace-motion", (event) => {
		if (!enabled()) return;
		for (const win of windows()) {
			if (win.element.hidden || win.element.style.display === "none") continue;
			animateFlow(
				win.element,
				os.settings.get("nebula.flow.importStyle") || {},
				"workspaces",
				false,
				event.detail,
			);
		}
	});
	window.addEventListener("nebula:wallpaper-changed", () => {
		if (!enabled() || document.body.classList.contains("nebula-locked")) return;
		const style = getComputedStyle(document.body),
			overlay = document.createElement("div");
		overlay.className = "nebula-wallpaper-fade";
		Object.assign(overlay.style, {
			backgroundImage: style.backgroundImage,
			backgroundSize: style.backgroundSize,
			backgroundPosition: style.backgroundPosition,
		});
		document.body.append(overlay);
		const animation = overlay.animate([{ opacity: 1 }, { opacity: 0 }], {
			duration: 420,
			easing: "ease-out",
		});
		animation.finished.catch(() => {}).finally(() => overlay.remove());
	});
	window.addEventListener("nebula:lock", () => {
		for (const node of document.querySelectorAll(".nebula-wallpaper-fade"))
			node.remove();
	});
}
