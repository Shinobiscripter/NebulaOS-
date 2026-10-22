// Native Anura windows remain in charge; this layer supplies desktop work-area bounds.
export function installWindowLayout({ windows, make, button, bar }) {
	const observed = new WeakSet(),
		closing = new WeakSet(),
		restoring = new WeakSet();
	let queued = false;
	const dock = document.querySelector("body > footer");
	const bottom = button(
		"Reveal dock",
		() => document.body.classList.add("nebula-dock-reveal"),
		"nebula-dock-edge",
	);
	const top = button(
		"Reveal desktop menu",
		() => document.body.classList.add("nebula-menu-reveal"),
		"nebula-menu-edge",
	);
	document.body.append(bottom, top);
	bottom.onpointerenter = () =>
		document.body.classList.add("nebula-dock-reveal");
	top.onpointerenter = () => document.body.classList.add("nebula-menu-reveal");
	dock?.addEventListener("pointerleave", () =>
		document.body.classList.remove("nebula-dock-reveal"),
	);
	bar.addEventListener("pointerleave", () =>
		document.body.classList.remove("nebula-menu-reveal"),
	);
	function schedule() {
		if (!queued) {
			queued = true;
			requestAnimationFrame(sync);
		}
	}
	document.addEventListener(
		"pointermove",
		(event) => {
			if (event.clientY < innerHeight - 95)
				document.body.classList.remove("nebula-dock-reveal");
			if (event.clientY > 48)
				document.body.classList.remove("nebula-menu-reveal");
		},
		{ passive: true },
	);
	function sync() {
		queued = false;
		let fullscreen = false;
		for (const win of windows()) {
			const el = win.element;
			if (!observed.has(win)) {
				observed.add(win);
				const observer = new MutationObserver(schedule);
				observer.observe(el, {
					attributes: true,
					attributeFilter: ["style", "class", "hidden"],
				});
				for (const event of [
					"maximize",
					"unmaximize",
					"resize",
					"snap",
					"focus",
				])
					win.addEventListener(event, schedule);
				win.addEventListener("unmaximize", () => restoring.add(win));
				win.addEventListener("maximize", () => restoring.delete(win));
				win.addEventListener("resize", () => {
					if (!win.maximized) restoring.delete(win);
				});
				win.addEventListener("close", () => {
					closing.add(win);
					observer.disconnect();
					schedule();
				});
			}
			const maximized =
				!!win.maximized && !closing.has(win) && !restoring.has(win);
			if (el.classList.contains("nebula-maximized") !== maximized)
				el.classList.toggle("nebula-maximized", maximized);
			if (maximized) {
				for (const [key, value] of Object.entries({
					top: "0px",
					left: "0px",
					width: `${innerWidth}px`,
					height: `${innerHeight}px`,
				}))
					if (el.style[key] !== value) el.style[key] = value;
				if (
					el.style.display !== "none" &&
					!el.hidden &&
					!el.classList.contains("opacity0")
				)
					fullscreen = true;
			}
		}
		document.body.classList.toggle("nebula-fullscreen", fullscreen);
		if (!fullscreen)
			document.body.classList.remove(
				"nebula-dock-reveal",
				"nebula-menu-reveal",
			);
	}
	new MutationObserver(schedule).observe(document.body, { childList: true });
	window.addEventListener("resize", schedule);
	window.addEventListener("nebula:workspace", schedule);
	schedule();
}
