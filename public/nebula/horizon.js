// Horizon uses native Anura apps/windows; only shortcuts and Start are new.
export function installHorizon(os, { make, button, save }) {
	const css = make("link");
	css.rel = "stylesheet";
	css.href = "/nebula/horizon.css";
	document.head.append(css);
	const desktop = make("div", "nebula-horizon-desktop");
	desktop.setAttribute("aria-label", "Horizon desktop shortcuts");
	const menu = make("section", "nebula-horizon-start");
	menu.hidden = true;
	menu.setAttribute("aria-label", "Horizon Start");
	const search = make("input");
	search.type = "search";
	search.placeholder = "Search applications";
	search.setAttribute("aria-label", "Horizon app search");
	const apps = make("div", "nh-apps");
	const status = make("p", "nh-status");
	status.setAttribute("role", "status");
	menu.append(
		make("h2", "", "Horizon"),
		search,
		make("p", "", "Drag an app onto the desktop, or choose Add shortcut."),
		apps,
		status,
	);
	const actions = make("div", "nh-actions");
	actions.append(
		button("Game Mode", () => {
			menu.hidden = true;
			os.apps["nebula.gamemode"].open();
		}),
		button("Settings", () => {
			menu.hidden = true;
			os.apps["anura.settings"].open();
		}),
		button("Wallpapers", () => {
			menu.hidden = true;
			os.apps["anura.wallpaper"].open();
		}),
		button("Lock", () => {
			menu.hidden = true;
			window.dispatchEvent(new Event("nebula:lock-request"));
		}),
	);
	menu.append(actions);
	const start = button(
		"✦ Start",
		() => {
			menu.hidden = !menu.hidden;
			if (!menu.hidden) {
				renderApps();
				search.focus();
			}
		},
		"nebula-horizon-start-button",
	);
	start.setAttribute("aria-expanded", "false");
	new MutationObserver(() =>
		start.setAttribute("aria-expanded", String(!menu.hidden)),
	).observe(menu, { attributes: true, attributeFilter: ["hidden"] });
	document.querySelector("body > footer")?.prepend(start);
	document.body.append(desktop, menu);
	let shortcuts = os.settings.get("nebula.horizon.shortcuts");
	if (!Array.isArray(shortcuts))
		shortcuts = ["anura.fsapp", "nebula.music", "nebula.games"].map(
			(id, i) => ({ id, x: 20, y: 20 + i * 100 }),
		);
	shortcuts = shortcuts.filter(
		(s) =>
			typeof s.id === "string" && Number.isFinite(s.x) && Number.isFinite(s.y),
	);
	const persist = () =>
		save(
			"nebula.horizon.shortcuts",
			shortcuts.map((s) => ({ ...s })),
		);
	function clamp(s) {
		s.x = Math.max(0, Math.min(s.x, Math.max(0, innerWidth - 100)));
		s.y = Math.max(0, Math.min(s.y, Math.max(0, innerHeight - 170)));
	}
	function add(id, x, y) {
		if (!os.apps[id] || os.apps[id].hidden) return;
		const existing = shortcuts.find((s) => s.id === id);
		if (existing) {
			status.textContent = "That app already has a desktop shortcut.";
			return;
		}
		if (x === undefined) {
			const rows = Math.max(1, Math.floor((innerHeight - 100) / 100));
			let slot = 0;
			do {
				x = 20 + Math.floor(slot / rows) * 100;
				y = 20 + (slot % rows) * 100;
				slot++;
			} while (
				slot < 200 &&
				shortcuts.some((s) => Math.abs(s.x - x) < 90 && Math.abs(s.y - y) < 90)
			);
		}
		const entry = { id, x, y };
		clamp(entry);
		shortcuts.push(entry);
		persist();
		render();
		status.textContent = "Shortcut added to your desktop.";
	}
	function renderApps() {
		apps.replaceChildren();
		for (const app of Object.values(os.apps)
			.filter(
				(a) =>
					!a.hidden &&
					a.name?.toLowerCase().includes(search.value.toLowerCase()),
			)
			.sort((a, b) => a.name.localeCompare(b.name))) {
			const row = make("div", "nh-app");
			const launch = button(app.name, () => {
				menu.hidden = true;
				app.open();
			});
			if (app.icon) {
				const image = make("img");
				image.src = app.icon;
				image.alt = "";
				launch.prepend(image);
			}
			launch.draggable = true;
			launch.ondragstart = (e) => {
				e.dataTransfer.setData("application/x-nebula-app", app.package);
				e.dataTransfer.effectAllowed = "copy";
			};
			const pin = button("+", () => add(app.package));
			pin.setAttribute("aria-label", `Add ${app.name} shortcut`);
			row.append(launch, pin);
			apps.append(row);
		}
	}
	function render() {
		desktop.replaceChildren();
		for (const item of shortcuts) {
			const app = os.apps[item.id];
			if (!app) continue;
			clamp(item);
			const icon = button("", () => {}, "nh-shortcut");
			icon.setAttribute("aria-label", `${app.name} desktop shortcut`);
			icon.title =
				"Double-click to open. Drag to move. Delete removes the shortcut. Arrow keys move it.";
			const image = make("img");
			image.src = app.icon;
			image.alt = "";
			image.draggable = false;
			icon.append(image, make("span", "", app.name));
			icon.style.left = item.x + "px";
			icon.style.top = item.y + "px";
			icon.ondblclick = () => app.open();
			icon.onkeydown = (e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					app.open();
				}
				if (e.key === "Delete") {
					e.preventDefault();
					shortcuts = shortcuts.filter((s) => s !== item);
					persist();
					render();
				}
				const delta = {
					ArrowLeft: [-20, 0],
					ArrowRight: [20, 0],
					ArrowUp: [0, -20],
					ArrowDown: [0, 20],
				}[e.key];
				if (delta) {
					e.preventDefault();
					item.x += delta[0];
					item.y += delta[1];
					clamp(item);
					icon.style.left = item.x + "px";
					icon.style.top = item.y + "px";
					persist();
				}
			};
			icon.onpointerdown = (e) => {
				if (e.button !== 0) return;
				const x = e.clientX,
					y = e.clientY,
					original = { x: item.x, y: item.y };
				icon.setPointerCapture(e.pointerId);
				icon.onpointermove = (move) => {
					item.x = original.x + move.clientX - x;
					item.y = original.y + move.clientY - y;
					clamp(item);
					icon.style.left = item.x + "px";
					icon.style.top = item.y + "px";
				};
				const finish = () => {
					icon.onpointermove = null;
					icon.onpointerup = null;
					icon.onpointercancel = null;
					persist();
				};
				icon.onpointerup = finish;
				icon.onpointercancel = finish;
			};
			desktop.append(icon);
		}
	}
	desktop.ondragover = (e) => {
		if (e.dataTransfer.types.includes("application/x-nebula-app")) {
			e.preventDefault();
			e.dataTransfer.dropEffect = "copy";
		}
	};
	desktop.ondrop = (e) => {
		e.preventDefault();
		add(
			e.dataTransfer.getData("application/x-nebula-app"),
			e.clientX - 44,
			e.clientY - 32,
		);
		menu.hidden = true;
	};
	search.oninput = renderApps;
	document.addEventListener("pointerdown", (e) => {
		if (!menu.contains(e.target) && !start.contains(e.target))
			menu.hidden = true;
	});
	menu.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			menu.hidden = true;
			start.focus();
		}
	});
	window.addEventListener("nebula:environment", () => {
		menu.hidden = true;
		render();
	});
	window.addEventListener("nebula:lock", () => (menu.hidden = true));
	window.addEventListener("resize", render);
	render();
}
