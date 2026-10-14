// Original browser-native implementation inspired by the user's Ilyamiro/Serpantinum clip.
export function installEnvironments(
	os,
	{ windows, make, button, save, bar, spotlight, overview },
) {
	const css = make("link");
	css.rel = "stylesheet";
	css.href = "/nebula/environments.css";
	document.head.append(css);
	let environment = "orbit",
		active = 1,
		focused = null,
		tiling = false;
	const assignments = new Map(),
		originals = new Map();
	const workspaces = make("nav", "nebula-workspaces");
	workspaces.setAttribute("aria-label", "Workspaces");
	const clock = button("", () => dashboard.showModal(), "nebula-flow-clock");
	clock.setAttribute("aria-label", "Open desktop dashboard");
	const actions = make("div", "nebula-flow-actions");
	const notes = make("aside", "nebula-flow-notes");
	notes.hidden = true;
	notes.setAttribute("aria-label", "Scratchpad");
	const note = make("textarea");
	note.setAttribute("aria-label", "Scratchpad text");
	note.placeholder = "Capture a thought…";
	note.value = os.settings.get("nebula.flow.note") || "";
	let noteTimer;
	note.oninput = () => {
		clearTimeout(noteTimer);
		noteTimer = setTimeout(() => save("nebula.flow.note", note.value), 250);
	};
	notes.append(
		make("h2", "", "Scratchpad"),
		button("Close scratchpad", () => (notes.hidden = true)),
		note,
	);
	const dashboard = make("dialog", "nebula-flow-dashboard");
	dashboard.setAttribute("aria-label", "Desktop dashboard");
	const dashboardContent = make("div", "nebula-dashboard-grid");
	dashboard.append(
		button(
			"Close dashboard",
			() => dashboard.close(),
			"nebula-dashboard-close",
		),
		dashboardContent,
	);
	function renderDashboard() {
		dashboardContent.replaceChildren();
		const time = make("section", "nebula-dashboard-time");
		time.append(
			make("p", "nebula-flow-label", "YOUR WORKSPACE"),
			make(
				"h2",
				"",
				new Date().toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit",
				}),
			),
			make(
				"p",
				"",
				new Date().toLocaleDateString([], {
					weekday: "long",
					month: "long",
					day: "numeric",
				}),
			),
		);
		const stats = make("section", "nebula-dashboard-stats");
		stats.append(
			make("h3", "", "This session"),
			make("p", "", `${windows().length} open windows`),
			make("p", "", `${Object.keys(os.apps).length} installed applications`),
			make(
				"p",
				"",
				`${Math.floor(performance.now() / 60000)} minutes since startup`,
			),
			make("p", "", `Workspace ${active} of 4`),
		);
		const apps = make("section", "nebula-dashboard-apps");
		apps.append(make("h3", "", "Launch something"));
		for (const id of [
			"nebula.music",
			"nebula.games",
			"anura.fsapp",
			"anura.settings",
		]) {
			const app = os.apps[id];
			if (app)
				apps.append(
					button(app.name, () => {
						dashboard.close();
						app.open();
					}),
				);
		}
		apps.append(
			button("Search all apps", () => {
				dashboard.close();
				spotlight();
			}),
			button("Wallpaper & style", () => {
				dashboard.close();
				os.apps["anura.wallpaper"].open();
			}),
		);
		const notifications = make("section", "nebula-dashboard-notifications");
		notifications.append(make("h3", "", "Notifications"));
		for (const notification of os.notifications.notifications
			.slice(-5)
			.reverse()) {
			const entry = make("div");
			entry.append(
				make("strong", "", notification.title),
				make("p", "", notification.description),
				button("Dismiss", () => {
					notification.close();
					renderDashboard();
				}),
			);
			notifications.append(entry);
		}
		if (!os.notifications.notifications.length)
			notifications.append(make("p", "", "All caught up."));
		dashboardContent.append(time, stats, apps, notifications);
	}
	clock.onclick = () => {
		renderDashboard();
		dashboard.showModal();
	};
	actions.append(
		button("Dashboard", () => clock.click()),
		button("Notes", () => {
			notes.hidden = !notes.hidden;
			if (!notes.hidden) note.focus();
		}),
		button("Tile", () => tile()),
		button("Float", () => float()),
		button("Apps", spotlight),
	);
	bar.append(workspaces, clock, actions);
	document.body.append(notes, dashboard);
	function notify() {
		window.dispatchEvent(new Event("nebula:workspace"));
	}
	function update() {
		for (const win of windows()) {
			if (!assignments.has(win)) {
				assignments.set(win, active);
				focused = win;
				win.addEventListener("focus", () => {
					focused = win;
					const target = assignments.get(win);
					if (environment === "flow" && target !== active)
						switchWorkspace(target);
				});
				win.addEventListener("close", () => {
					assignments.delete(win);
					originals.delete(win);
					setTimeout(update, 400);
				});
			}
			const hidden = environment === "flow" && assignments.get(win) !== active;
			if (win.element.hidden !== hidden) {
				win.element.hidden = hidden;
				win.element.dispatchEvent(
					new CustomEvent("nebula:visibility", { detail: !hidden }),
				);
			}
		}
		workspaces.replaceChildren();
		for (let i = 1; i <= 4; i++) {
			const count = windows().filter(
				(win) => assignments.get(win) === i,
			).length;
			const tab = button(String(i), (event) => {
				if (event.shiftKey && focused?.element.isConnected)
					assignments.set(focused, i);
				switchWorkspace(i);
			});
			tab.onclick = (event) => {
				if (event.shiftKey && focused?.element.isConnected)
					assignments.set(focused, i);
				switchWorkspace(i);
			};
			tab.setAttribute("aria-label", `Workspace ${i}, ${count} windows`);
			tab.setAttribute("aria-current", i === active ? "page" : "false");
			tab.title = "Click to switch; Shift-click moves the focused window";
			tab.dataset.occupied = String(count > 0);
			workspaces.append(tab);
		}
		notify();
	}
	function switchWorkspace(number) {
		active = Math.max(1, Math.min(4, number || 1));
		update();
	}
	async function tile() {
		if (tiling) return;
		tiling = true;
		try {
			const list = windows().filter(
				(win) => !win.element.hidden && win.element.style.display !== "none",
			);
			const columns = Math.ceil(Math.sqrt(list.length));
			const rows = Math.ceil(list.length / columns);
			const gap = 12,
				top = 52,
				width = (innerWidth - gap * (columns + 1)) / columns,
				height = (innerHeight - top - gap * (rows + 1)) / rows;
			for (const [i, win] of list.entries()) {
				if (!originals.has(win))
					originals.set(win, win.oldstyle || win.element.getAttribute("style"));
				if (win.maximized || win.snapped) await win.unmaximize();
				Object.assign(win.element.style, {
					left: `${gap + (i % columns) * (width + gap)}px`,
					top: `${top + gap + Math.floor(i / columns) * (height + gap)}px`,
					width: `${width}px`,
					height: `${height}px`,
				});
				win.element.dataset.nebulaTiled = "true";
				win.dispatchEvent(
					new MessageEvent("resize", { data: { width, height } }),
				);
				win.onresize(width, height);
			}
		} finally {
			tiling = false;
			notify();
		}
	}
	function float() {
		for (const [win, style] of originals) {
			if (win.element.isConnected) {
				win.element.setAttribute("style", style || "");
				delete win.element.dataset.nebulaTiled;
			}
		}
		originals.clear();
		notify();
	}
	function apply() {
		environment =
			os.settings.get("nebula.desktop.environment") === "flow"
				? "flow"
				: "orbit";
		document.body.classList.toggle("nebula-env-flow", environment === "flow");
		const widgets = document.querySelector(".nebula-widgets");
		if (widgets)
			widgets.hidden =
				environment === "flow"
					? os.settings.get("nebula.flow.widgets") !== true
					: os.settings.get("nebula.desktop.widgets") === false;
		document.body.classList.toggle(
			"nebula-flow-landscape",
			environment === "flow" &&
				os.settings.get("nebula.desktop.environmentWallpaper") !== false,
		);
		if (environment !== "flow") {
			float();
			notes.hidden = true;
			dashboard.close();
		}
		update();
	}
	const tick = () =>
		(clock.textContent = new Date().toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		}));
	tick();
	setInterval(tick, 30000);
	new MutationObserver(update).observe(document.body, { childList: true });
	window.addEventListener("nebula:environment", apply);
	window.addEventListener("keydown", (event) => {
		if (environment !== "flow" || !event.ctrlKey || !event.altKey) return;
		if (/^[1-4]$/.test(event.key)) {
			event.preventDefault();
			if (event.shiftKey && focused)
				assignments.set(focused, Number(event.key));
			switchWorkspace(Number(event.key));
		}
		if (event.code === "KeyT") {
			event.preventDefault();
			tile();
		}
		if (event.code === "KeyD") {
			event.preventDefault();
			clock.click();
		}
	});
	apply();
}
