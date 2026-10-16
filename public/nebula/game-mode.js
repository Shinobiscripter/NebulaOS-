// Console-inspired shells share a real catalog/library, not a second OS.
export function installGameMode(os) {
	const make = (tag, cls, text) => {
		const e = document.createElement(tag);
		if (cls) e.className = cls;
		if (text !== undefined) e.textContent = text;
		return e;
	};
	const css = make("link");
	css.rel = "stylesheet";
	css.href = "/nebula/game-mode.css";
	document.head.append(css);
	const consoleCSS = make("link");
	consoleCSS.rel = "stylesheet";
	consoleCSS.href = "/nebula/console-ui.css";
	document.head.append(consoleCSS);
	const modes = {
		nova: {
			name: "Nova",
			subtitle: "A constellation of games",
			home: "Games",
			store: "Discover",
		},
		deck: {
			name: "Deck",
			subtitle: "Your entire library. In reach.",
			home: "Home",
			store: "Store",
		},
		pulse: {
			name: "Pulse",
			subtitle: "Jump into your next adventure",
			home: "Home",
			store: "Marketplace",
		},
	};
	let mode = os.settings.get("nebula.gaming.mode") || "nova";
	if (!modes[mode]) mode = "nova";
	let prefs = os.settings.get("nebula.gaming.preferences") || {},
		library = os.settings.get("nebula.gaming.library") || {},
		catalog = [],
		page = "home",
		selected = null,
		query = "",
		filter = "all",
		busy = false,
		frame = null,
		raf = 0,
		padTimer = 0,
		audio,
		previousFocus,
		fullscreenOwned = false;
	let saves = Promise.resolve();
	const save = (key, value) => {
		const snapshot = structuredClone(value);
		saves = saves.catch(() => {}).then(() => os.settings.set(key, snapshot));
		return saves;
	};
	const config = () =>
		prefs[mode] || {
			sound: true,
			motion: true,
			overlay: false,
			fps: true,
			frametime: true,
			memory: false,
			position: "top-right",
			opacity: 90,
		};
	const root = make("dialog", "ng-mode");
	root.setAttribute("aria-label", "NebulaHub Game Mode");
	const nav = make("nav", "ng-nav"),
		main = make("main", "ng-main"),
		status = make("p", "ng-status"),
		hud = make("aside", "ng-hud"),
		session = make("section", "ng-session");
	status.setAttribute("role", "status");
	hud.setAttribute("aria-label", "Performance overlay");
	session.hidden = true;
	root.append(nav, main, status, session, hud);
	const scene = make("div", "ng-scene"),
		sceneMark = make("div", "ng-scene-mark"),
		controls = make("div", "ng-controls"),
		drawer = make("aside", "ng-drawer");
	scene.setAttribute("aria-hidden", "true");
	scene.append(sceneMark);
	drawer.hidden = true;
	drawer.setAttribute("aria-label", "Console menu");
	root.prepend(scene);
	root.append(controls, drawer);
	document.body.append(root);
	const btn = (text, fn, cls = "") => {
		const b = make("button", cls, text);
		b.type = "button";
		b.onclick = () => {
			tone();
			fn();
		};
		return b;
	};
	function tone() {
		if (!config().sound) return;
		try {
			audio ||= new AudioContext();
			audio.resume();
			const o = audio.createOscillator(),
				g = audio.createGain();
			o.type = mode === "deck" ? "triangle" : "sine";
			o.frequency.setValueAtTime(
				mode === "pulse" ? 330 : mode === "deck" ? 440 : 660,
				audio.currentTime,
			);
			o.frequency.exponentialRampToValueAtTime(220, audio.currentTime + 0.12);
			g.gain.setValueAtTime(0.035, audio.currentTime);
			g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.15);
			o.connect(g).connect(audio.destination);
			o.start();
			o.stop(audio.currentTime + 0.16);
		} catch {}
	}
	function notify(text) {
		status.textContent = text;
	}
	function apply() {
		root.dataset.mode = mode;
		root.classList.toggle(
			"ng-still",
			!config().motion || !!os.settings.get("disable-animation"),
		);
		hud.dataset.position = config().position || "top-right";
		hud.style.opacity = (config().opacity || 90) / 100;
		metrics();
	}
	function navigate(next) {
		drawer.hidden = true;
		page = next;
		query = "";
		filter = "all";
		render();
		main.querySelector("button,input,select")?.focus();
	}
	function header() {
		nav.replaceChildren();
		const left = make("div", "ng-nav-left"),
			center = make("div", "ng-nav-center"),
			right = make("div", "ng-nav-right");
		const icon = (symbol, label, fn) => {
			const b = btn("", fn, "ng-icon");
			b.append(glyph(symbol));
			b.setAttribute("aria-label", label);
			b.title = label;
			return b;
		};
		const route = (symbol, label, id) =>
			icon(symbol, label, () => navigate(id));
		if (mode === "nova")
			left.append(
				btn(
					"Games",
					() => navigate("home"),
					"ng-tab " + (page !== "media" ? "active" : ""),
				),
				btn(
					"Media",
					() => navigate("media"),
					"ng-tab " + (page === "media" ? "active" : ""),
				),
			);
		else if (mode === "pulse") {
			const profile = btn("✦", () => openDrawer(), "ng-avatar");
			profile.setAttribute("aria-label", "Open guide");
			left.append(profile, make("div", "ng-user", "Nebula Player"));
		} else
			left.append(
				icon("⌂", "Home", () => navigate("home")),
				make(
					"span",
					"ng-deck-title",
					page === "home"
						? ""
						: page === "game"
							? selected?.title
							: page === "library"
								? "Library"
								: page === "settings"
									? "Settings"
									: "Store",
				),
			);
		if (mode === "pulse")
			center.append(
				route("▥", "Library", "library"),
				route("▢", "Marketplace", "store"),
				route("⊕", "Home", "home"),
				route("⌕", "Search", "store"),
				route("⚙", "Settings", "settings"),
			);
		else
			right.append(
				route("⌕", "Search", "store"),
				route("▥", "Library", "library"),
				route("▢", modes[mode].store, "store"),
				route("⚙", "Settings", "settings"),
			);
		right.append(
			icon("⛶", "Fullscreen", async () => {
				try {
					if (!document.fullscreenElement) {
						await document.documentElement.requestFullscreen();
						fullscreenOwned = true;
					} else {
						await document.exitFullscreen();
						fullscreenOwned = false;
					}
				} catch {
					notify(
						"Browser fullscreen is unavailable. Game Mode still fills the desktop.",
					);
				}
			}),
		);
		if (mode !== "pulse")
			right.append(icon("✦", "Open console menu", () => openDrawer()));
		right.append(
			make(
				"span",
				"ng-time",
				new Date().toLocaleTimeString([], {
					hour: "numeric",
					minute: "2-digit",
				}),
			),
			icon("⏻", "Desktop", exit),
		);
		nav.append(left, center, right);
		controls.replaceChildren(
			btn(
				mode === "deck"
					? "NEBULA  Menu"
					: mode === "pulse"
						? "⊕  Guide"
						: "✦  Control Center",
				() => openDrawer(),
				"ng-guide-button",
			),
			make(
				"span",
				"ng-control-hints",
				mode === "nova" ? "✕ Select    ○ Back" : "Ⓐ Select    Ⓑ Back",
			),
			btn("•••  Quick settings", () => openDrawer(true)),
		);
	}
	function glyph(symbol) {
		const paths = {
			"⌕": "M21 21l-6-6 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
			"▥": "M3 4h4v16H3z M10 4h4v16h-4z M17 5l4-1 3 15-4 1z",
			"▢": "M4 7h16v14H4z M8 8V6a4 4 0 0 1 8 0v2",
			"⚙": "M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
			"⛶": "M8 3H3v5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5",
			"⌂": "M3 11l9-8 9 8 M5 9v12h5v-7h4v7h5V9",
			"⊕": "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 6v12 M6 12h12",
			"⏻": "M12 2v10 M6 5a9 9 0 1 0 12 0",
		};
		if (!paths[symbol]) return document.createTextNode(symbol);
		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"),
			p = document.createElementNS(svg.namespaceURI, "path");
		svg.setAttribute("viewBox", "0 0 26 24");
		svg.setAttribute("width", "25");
		svg.setAttribute("height", "25");
		svg.setAttribute("aria-hidden", "true");
		p.setAttribute("d", paths[symbol]);
		p.setAttribute("fill", "none");
		p.setAttribute("stroke", "currentColor");
		p.setAttribute("stroke-width", "1.6");
		p.setAttribute("stroke-linejoin", "round");
		p.setAttribute("stroke-linecap", "round");
		svg.append(p);
		return svg;
	}
	function openDrawer(quick = false) {
		drawer.classList.toggle("ng-quick", quick);
		drawer.replaceChildren();
		drawer.hidden = false;
		drawer.append(
			btn(
				"× Close",
				() => {
					drawer.hidden = true;
					controls.querySelector("button")?.focus();
				},
				"ng-drawer-close",
			),
			make(
				"h2",
				"",
				quick
					? "Quick settings"
					: mode === "nova"
						? "Control Center"
						: mode === "pulse"
							? "Guide"
							: "NEBULA",
			),
		);
		if (quick) {
			for (const [key, label] of [
				["overlay", "Performance overlay"],
				["sound", "Navigation sounds"],
				["motion", "Animations"],
			]) {
				const b = btn(label, () => {
					prefs = { ...prefs, [mode]: { ...config(), [key]: !config()[key] } };
					save("nebula.gaming.preferences", prefs).catch((e) =>
						notify(e.message),
					);
					apply();
					openDrawer(true);
				});
				b.setAttribute("aria-pressed", String(!!config()[key]));
				drawer.append(b);
			}
			drawer.append(btn("All settings", () => navigate("settings")));
		} else {
			for (const [id, label, symbol] of [
				["home", "Home", "⌂"],
				["library", "Library", "▥"],
				["store", modes[mode].store, "▢"],
				["settings", "Settings", "⚙"],
			])
				drawer.append(btn(symbol + "   " + label, () => navigate(id)));
			drawer.append(btn("⏻   Return to desktop", exit));
		}
		drawer.querySelector("button")?.focus();
	}
	function backdrop(game) {
		if (scene.dataset.game === game.id) return;
		scene.dataset.game = game.id;
		scene.style.setProperty(
			"--scene-art",
			["2048", "hextris"].includes(game.id)
				? `url('/nebula/covers/${game.id}.svg')`
				: "none",
		);
		scene.dataset.hasArt = String(["2048", "hextris"].includes(game.id));
		const hue = [...game.id].reduce((n, c) => n + c.charCodeAt(0), 0) % 360;
		root.style.setProperty("--scene-hue", String(hue));
		sceneMark.textContent =
			game.id === "hextris"
				? "⬡"
				: game.id === "ovo"
					? "OvO"
					: game.id === "2048"
						? "2048"
						: game.title;
		sceneMark.classList.remove("ng-scene-enter");
		void sceneMark.offsetWidth;
		sceneMark.classList.add("ng-scene-enter");
	}
	function art(game) {
		const e = make("div", "ng-art");
		e.dataset.game = game.id;
		e.style.setProperty(
			"--tile-hue",
			String([...game.id].reduce((n, c) => n + c.charCodeAt(0), 0) % 360),
		);
		e.append(
			make(
				"span",
				"ng-symbol",
				game.id === "2048"
					? "2048"
					: game.id === "hextris"
						? "⬡"
						: game.id === "ovo"
							? "OvO"
							: game.id === "abaf"
								? "◉"
								: game.title,
			),
		);
		return e;
	}
	function card(game) {
		const b = btn(
			"",
			() => {
				selected = game;
				render();
				main.querySelector(".ng-primary")?.focus();
			},
			"ng-card",
		);
		b.setAttribute("aria-label", game.title);
		b.append(
			art(game),
			make("strong", "", game.title),
			make(
				"small",
				"",
				library[game.id]
					? "In library"
					: game.kind === "download"
						? "Download · " + game.license
						: "Online",
			),
		);
		b.onfocus = () =>
			root.style.setProperty(
				"--scene-hue",
				String([...game.id].reduce((n, c) => n + c.charCodeAt(0), 0) % 360),
			);
		return b;
	}
	function detail(game) {
		const hero = make("section", "ng-hero");
		hero.append(art(game));
		const info = make("div", "ng-info");
		info.append(
			make("p", "ng-eyebrow", game.category),
			make("h1", "", game.title),
			make("p", "", game.description),
		);
		const owned = !!library[game.id];
		const action = btn(
			owned
				? "Play"
				: game.kind === "download"
					? "Download — free"
					: "Add online game",
			() => (owned ? play(game) : install(game)),
			"ng-primary",
		);
		action.disabled = busy;
		info.append(action);
		if (owned) {
			const remove = btn("Remove from library", async () => {
				if (
					!confirm(
						"Remove " +
							game.title +
							" from your library? Game saves will remain.",
					)
				)
					return;
				try {
					await caches.delete(cacheName(game));
					const next = { ...library };
					delete next[game.id];
					await save("nebula.gaming.library", next);
					library = next;
					render();
				} catch (e) {
					notify("Could not remove game: " + e.message);
				}
			});
			remove.disabled = busy;
			info.append(remove);
		}
		const source = make("a", "", "Source & credits ↗");
		source.href = game.source;
		source.target = "_blank";
		source.rel = "noopener noreferrer";
		info.append(
			source,
			make(
				"small",
				"ng-delivery",
				game.kind === "download"
					? `${(game.bytes / 1048576).toFixed(1)} MB · ${game.license} · browser download; saves stay in this browser`
					: "Online launcher · internet required · opens a separate tab",
			),
		);
		hero.append(info);
		return hero;
	}
	function render() {
		apply();
		header();
		main.dataset.page = page;
		main.replaceChildren();
		root.dataset.page = page;
		if (page === "settings") {
			settings();
			return;
		}
		if (page === "home") {
			home();
			return;
		}
		if (page === "game" && selected) {
			backdrop(selected);
			main.append(
				btn("‹ Back to Home", () => navigate("home"), "ng-back"),
				detail(selected),
			);
			return;
		}
		if (page === "media") {
			main.append(make("h1", "", "Media"));
			for (const [id, label] of [
				["nebula.music", "Nebula Music"],
				["anura.browser", "Nebula Browser"],
			]) {
				if (os.apps[id])
					main.append(
						btn(
							label,
							() => {
								exit();
								os.apps[id].open();
							},
							"ng-media-tile",
						),
					);
			}
			return;
		}
		let games =
			page === "library" ? catalog.filter((g) => library[g.id]) : catalog;
		const intro = make("div", "ng-intro");
		intro.append(
			make("p", "ng-eyebrow", "NEBULAHUB / " + modes[mode].name.toUpperCase()),
			make(
				"h2",
				"",
				page === "store"
					? modes[mode].store
					: page === "library"
						? "Your library"
						: modes[mode].subtitle,
			),
		);
		main.append(intro);
		if (page === "home") {
			const recent = catalog
				.filter((g) => library[g.id])
				.sort(
					(a, b) =>
						(library[b.id].lastPlayed || 0) - (library[a.id].lastPlayed || 0),
				);
			games = [...recent, ...catalog.filter((g) => !library[g.id])];
		}
		if (page !== "home") {
			const tools = make("div", "ng-tools"),
				search = make("input");
			search.type = "search";
			search.placeholder = "Search games";
			search.setAttribute("aria-label", "Search games");
			search.value = query;
			const select = make("select");
			select.setAttribute("aria-label", "Game filter");
			for (const [value, label] of [
				["all", "All games"],
				["download", "Downloadable"],
				["online", "Online games"],
			]) {
				const o = make("option", "", label);
				o.value = value;
				select.append(o);
			}
			select.value = filter;
			const sort = make("select");
			sort.setAttribute("aria-label", "Sort games");
			for (const value of ["Featured", "Title"])
				sort.append(make("option", "", value));
			tools.append(search, select, sort);
			main.append(tools);
			const grid = make("div", "ng-grid");
			const populate = () => {
				grid.replaceChildren();
				let list = games.filter(
					(g) =>
						g.title.toLowerCase().includes(query.toLowerCase()) &&
						(filter === "all" || g.kind === filter),
				);
				if (sort.value === "Title")
					list = [...list].sort((a, b) => a.title.localeCompare(b.title));
				grid.append(...list.map(card));
				if (!list.length)
					grid.append(
						make("p", "", "No games here yet. Visit the store to add games."),
					);
			};
			search.oninput = () => {
				query = search.value;
				populate();
			};
			select.onchange = () => {
				filter = select.value;
				populate();
			};
			sort.onchange = populate;
			if (selected && games.includes(selected)) main.append(detail(selected));
			populate();
			main.append(grid);
		} else {
			selected = selected || games[0];
			if (selected) main.append(detail(selected));
			const row = make("div", "ng-grid ng-featured");
			row.append(...games.slice(0, 12).map(card));
			main.append(row);
		}
	}
	function home() {
		const recent = catalog
			.filter((g) => library[g.id])
			.sort(
				(a, b) =>
					(library[b.id].lastPlayed || 0) - (library[a.id].lastPlayed || 0),
			);
		const games = [...recent, ...catalog.filter((g) => !library[g.id])];
		selected = selected || games[0];
		if (!selected) return;
		backdrop(selected);
		const rail = make("div", "ng-console-rail"),
			preview = make("div", "ng-console-preview");
		rail.setAttribute("aria-label", "Recent games");
		const choose = (game) => {
			selected = game;
			backdrop(game);
			for (const tile of rail.querySelectorAll("[data-game-id]"))
				tile.classList.toggle("ng-selected", tile.dataset.gameId === game.id);
			preview.replaceChildren();
			if (mode === "nova") preview.append(detail(game));
			else if (mode === "deck") {
				preview.append(
					make("strong", "", game.title),
					make(
						"small",
						"",
						library[game.id]
							? "▶  IN YOUR LIBRARY"
							: game.kind === "download"
								? "DOWNLOADABLE · " + game.license
								: "ONLINE GAME",
					),
				);
			} else {
				const action = btn(
					library[game.id]
						? "Play"
						: game.kind === "download"
							? "Download — free"
							: "Add online game",
					() => (library[game.id] ? play(game) : install(game)),
					"ng-primary",
				);
				action.disabled = busy;
				preview.append(make("strong", "", game.title), action);
			}
		};
		if (mode === "nova") {
			const store = btn("▢", () => navigate("store"), "ng-system-tile");
			store.setAttribute("aria-label", "Open store");
			rail.append(store);
		}
		for (const game of games.slice(0, mode === "nova" ? 11 : 10)) {
			const tile = btn(
				"",
				() => {
					if (mode === "nova") {
						choose(game);
						preview.querySelector("button")?.focus();
					} else {
						selected = game;
						page = "game";
						render();
						main.querySelector(".ng-primary")?.focus();
					}
				},
				"ng-console-tile",
			);
			tile.dataset.gameId = game.id;
			tile.setAttribute("aria-label", game.title);
			tile.append(art(game), make("span", "ng-tile-title", game.title));
			tile.onfocus = () => {
				choose(game);
				tile.scrollIntoView({
					block: "nearest",
					inline: "nearest",
					behavior: config().motion ? "smooth" : "instant",
				});
			};
			tile.onpointerenter = () => choose(game);
			rail.append(tile);
		}
		const libraryTile = btn("▥", () => navigate("library"), "ng-system-tile");
		libraryTile.setAttribute("aria-label", "Open game library");
		rail.append(libraryTile);
		if (mode === "deck")
			main.append(
				make(
					"h2",
					"ng-recent-heading",
					recent.length ? "Recent games" : "Ready to discover",
				),
			);
		main.append(rail, preview);
		choose(selected);
		if (mode === "deck") {
			const tabs = make("div", "ng-home-tabs");
			const panel = make("div", "ng-home-feed");
			const feed = (which) => {
				panel.replaceChildren();
				for (const b of tabs.querySelectorAll("button"))
					b.classList.toggle("active", b.textContent === which);
				if (which === "Downloads") {
					const owned = games.filter((g) => library[g.id]);
					panel.append(
						make("h3", "", "Your library · " + owned.length + " games"),
						btn("Manage library", () => navigate("library")),
					);
				} else {
					const g =
						games.find((g) => g.kind === "download" && g.id !== selected.id) ||
						games[0];
					const tile = btn(
						"",
						() => {
							selected = g;
							page = "game";
							render();
						},
						"ng-feed-feature",
					);
					tile.append(
						art(g),
						make(
							"div",
							"",
							which === "Recommended"
								? "Discover " + g.title
								: "Play anywhere. Download " + g.title,
						),
					);
					panel.append(
						tile,
						btn("Explore the store", () => navigate("store"), "ng-feed-store"),
					);
				}
			};
			for (const label of ["What's new", "Downloads", "Recommended"])
				tabs.append(btn(label, () => feed(label)));
			main.append(tabs, panel);
			feed("What's new");
		} else if (mode === "pulse") {
			const promos = make("div", "ng-pulse-promos");
			for (const [title, subtitle, symbol, action] of [
				[
					"Browse your games",
					"Your collection, all together",
					"▥",
					() => navigate("library"),
				],
				[
					"Customize your Home",
					"Make this space yours",
					"⚙",
					() => navigate("settings"),
				],
				[
					"Discover free games",
					"Explore Nebula Marketplace",
					"⊕",
					() => navigate("store"),
				],
				["Back to your desktop", "Orbit · Flow · Horizon", "✦", exit],
			]) {
				const b = btn("", action);
				b.append(
					make("span", "ng-promo-symbol", symbol),
					make("strong", "", title),
					make("small", "", subtitle),
				);
				promos.append(b);
			}
			main.append(promos);
		}
	}
	const cacheName = (g) =>
		"nebula-game-" +
		(window.nebulaProfileId || "default") +
		"-" +
		g.id +
		"-" +
		g.version;
	async function install(game) {
		if (busy) return;
		busy = true;
		render();
		notify(
			game.kind === "download"
				? "Downloading " + game.title + "…"
				: "Adding online launcher…",
		);
		const start = performance.now();
		try {
			if (game.kind === "download") {
				await navigator.serviceWorker.register("/game-library/sw.js", {
					scope: "/game-library/",
				});
				const cache = await caches.open(cacheName(game));
				let done = 0;
				// Bounded batches avoid flooding modest devices; reject partial downloads.
				for (let i = 0; i < game.files.length; i += 6)
					await Promise.all(
						game.files.slice(i, i + 6).map(async (url) => {
							const response = await fetch(url, {
								cache: "reload",
								signal: AbortSignal.timeout(30000),
							});
							if (!response.ok)
								throw new Error("Download failed (" + response.status + ")");
							await cache.put(url, response);
							notify(
								`Downloading ${game.title} · ${++done}/${game.files.length} files`,
							);
						}),
					);
			}
			await new Promise((resolve) =>
				setTimeout(resolve, Math.max(0, 2200 - (performance.now() - start))),
			);
			const next = {
				...library,
				[game.id]: { added: Date.now(), version: game.version || null },
			};
			await save("nebula.gaming.library", next);
			library = next;
			notify(
				game.title +
					(game.kind === "download"
						? " downloaded. Browser storage can be cleared or evicted."
						: " added. An internet connection is required."),
			);
		} catch (e) {
			if (game.kind === "download")
				await caches.delete(cacheName(game)).catch(() => {});
			notify("Not added: " + e.message + ". Please try again.");
		} finally {
			busy = false;
			render();
		}
	}
	async function play(game) {
		if (game.kind === "online") {
			const tab = window.open(game.url, "_blank", "noopener,noreferrer");
			notify(
				"Opening " +
					game.title +
					" in a separate tab. Allow popups if it does not open.",
			);
		} else {
			try {
				const cache = await caches.open(cacheName(game));
				if (!(await cache.match(game.url))) {
					notify(
						"This download was cleared by the browser. Downloading it again…",
					);
					await install(game);
					if (!(await cache.match(game.url))) return;
				}
			} catch (e) {
				notify(e.message);
				return;
			}
			session.replaceChildren();
			const bar = make("div", "ng-session-bar");
			bar.append(
				make("strong", "", game.title),
				btn("Close game", () => {
					if (confirm("Close this game? Unsaved progress may be lost."))
						stopGame();
				}),
			);
			frame = make("iframe");
			frame.title = game.title;
			frame.src = game.url;
			frame.allow = "fullscreen; gamepad; autoplay";
			frame.allowFullscreen = true;
			session.append(bar, frame);
			session.hidden = false;
			frame.focus();
		}
		library = {
			...library,
			[game.id]: { ...library[game.id], lastPlayed: Date.now() },
		};
		save("nebula.gaming.library", library).catch((e) => notify(e.message));
	}
	function stopGame() {
		frame?.remove();
		frame = null;
		session.hidden = true;
		session.replaceChildren();
		nav.querySelector("button")?.focus();
	}
	function settings() {
		main.append(
			make("h1", "", "Game Mode settings"),
			make(
				"p",
				"",
				"One library, three ways to play. Desktop apps remain open when you switch.",
			),
		);
		const choices = make("div", "ng-mode-choices");
		for (const [id, data] of Object.entries(modes)) {
			const b = btn(
				data.name +
					" · " +
					{
						nova: "cinematic console",
						deck: "handheld library",
						pulse: "tile dashboard",
					}[id],
				() => {
					mode = id;
					selected = null;
					save("nebula.gaming.mode", mode).catch((e) => notify(e.message));
					render();
				},
			);
			b.setAttribute("aria-pressed", String(mode === id));
			choices.append(b);
		}
		main.append(choices);
		const form = make("div", "ng-settings");
		const update = (key, value) => {
			prefs = { ...prefs, [mode]: { ...config(), [key]: value } };
			save("nebula.gaming.preferences", prefs).catch((e) => notify(e.message));
			apply();
		};
		for (const [key, label] of [
			["sound", "Navigation sounds"],
			["motion", "Interface animations"],
			["overlay", "Performance overlay"],
			["fps", "Shell FPS"],
			["frametime", "Shell frame time"],
			["memory", "JS heap (supported browsers)"],
		]) {
			const row = make("label"),
				input = make("input");
			input.type = "checkbox";
			input.checked = !!config()[key];
			input.onchange = () => update(key, input.checked);
			row.append(input, document.createTextNode(label));
			form.append(row);
		}
		const pos = make("label", "", "Overlay position "),
			select = make("select");
		for (const id of ["top-right", "top-left", "bottom-right", "bottom-left"]) {
			const o = make("option", "", id.replace("-", " "));
			o.value = id;
			select.append(o);
		}
		select.value = config().position;
		select.onchange = () => update("position", select.value);
		pos.append(select);
		form.append(pos);
		const opacity = make("label", "", "Overlay opacity "),
			range = make("input");
		range.type = "range";
		range.min = "25";
		range.max = "100";
		range.value = config().opacity;
		range.oninput = () => update("opacity", Number(range.value));
		opacity.append(range);
		form.append(opacity);
		main.append(
			form,
			make(
				"p",
				"ng-note",
				"Statistics measure the Nebula shell, not cross-origin game FPS, GPU load or temperature. JS heap is approximate and may be unavailable. Settings are saved separately for each mode. Tab / arrows / D-pad navigate; Enter / A select; B returns home. Games use their own controls. Downloaded game saves are shared by local profiles in this browser.",
			),
		);
	}
	function metrics() {
		cancelAnimationFrame(raf);
		hud.hidden = !root.open || !config().overlay;
		if (hud.hidden) return;
		let count = 0,
			start = performance.now(),
			last = start,
			sum = 0;
		const tick = (now) => {
			if (!root.open || !config().overlay || document.hidden) return;
			sum += now - last;
			last = now;
			count++;
			if (now - start >= 750) {
				const c = config(),
					rows = [modes[mode].name + " · SHELL"];
				if (c.fps)
					rows.push(((count * 1000) / (now - start)).toFixed(0) + " FPS");
				if (c.frametime) rows.push((sum / count).toFixed(1) + " ms/frame");
				if (c.memory)
					rows.push(
						performance.memory
							? (performance.memory.usedJSHeapSize / 1048576).toFixed(0) +
									" MB JS heap"
							: "JS heap unavailable",
					);
				hud.textContent = rows.join("\n");
				start = now;
				count = 0;
				sum = 0;
			}
			raf = requestAnimationFrame(tick);
		};
		hud.textContent = "Measuring shell…";
		raf = requestAnimationFrame(tick);
	}
	function focusStep(dx, dy) {
		const all = [
			...(drawer.hidden ? root : drawer).querySelectorAll(
				"button,input,select,a[href]",
			),
		].filter(
			(e) =>
				!e.disabled &&
				e.getBoundingClientRect().width &&
				e.getBoundingClientRect().height,
		);
		const current = document.activeElement,
			rect = current?.getBoundingClientRect();
		if (!rect || !all.includes(current)) {
			all[0]?.focus();
			return;
		}
		const x = rect.x + rect.width / 2,
			y = rect.y + rect.height / 2;
		const next = all
			.filter((e) => e !== current)
			.map((e) => {
				const r = e.getBoundingClientRect(),
					xx = r.x + r.width / 2 - x,
					yy = r.y + r.height / 2 - y;
				return {
					e,
					along: xx * dx + yy * dy,
					across: Math.abs(xx * dy - yy * dx),
				};
			})
			.filter((e) => e.along > 2)
			.sort((a, b) => a.along + a.across * 3 - (b.along + b.across * 3))[0];
		next?.e.focus();
		next?.e.scrollIntoView({ block: "nearest", inline: "nearest" });
	}
	root.addEventListener("keydown", (event) => {
		if (event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			back();
			return;
		}
		if (!drawer.hidden && event.key === "Tab") {
			const buttons = [...drawer.querySelectorAll("button")];
			const i = buttons.indexOf(document.activeElement);
			event.preventDefault();
			buttons[
				(i + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length
			]?.focus();
			return;
		}
		if (frame || ["INPUT", "SELECT"].includes(event.target.tagName)) return;
		const dirs = {
			ArrowLeft: [-1, 0],
			ArrowRight: [1, 0],
			ArrowUp: [0, -1],
			ArrowDown: [0, 1],
		};
		if (dirs[event.key]) {
			event.preventDefault();
			event.stopPropagation();
			focusStep(...dirs[event.key]);
			tone();
		}
	});
	let lastPad = 0,
		held = false;
	function pollPad() {
		if (!root.open || document.hidden || frame) return;
		const p = navigator.getGamepads?.().find((p) => p);
		if (!p) return;
		const now = performance.now(),
			pressed = p.buttons[0]?.pressed || p.buttons[1]?.pressed;
		if (pressed && !held) {
			if (p.buttons[0]?.pressed) document.activeElement?.click();
			else if (!drawer.hidden) {
				drawer.hidden = true;
				controls.querySelector("button")?.focus();
			} else navigate("home");
		}
		held = pressed;
		if (now - lastPad < 200) return;
		const dx = p.buttons[15]?.pressed
				? 1
				: p.buttons[14]?.pressed
					? -1
					: Math.abs(p.axes[0]) > 0.6
						? Math.sign(p.axes[0])
						: 0,
			dy = p.buttons[13]?.pressed
				? 1
				: p.buttons[12]?.pressed
					? -1
					: Math.abs(p.axes[1]) > 0.6
						? Math.sign(p.axes[1])
						: 0;
		if (dx || dy) {
			focusStep(dx, dy);
			tone();
			lastPad = now;
		}
	}
	async function open() {
		if (root.open) return;
		previousFocus = document.activeElement;
		root.showModal();
		document.body.classList.add("nebula-gaming");
		apply();
		notify("Loading library…");
		padTimer = setInterval(pollPad, 100);
		try {
			if (!catalog.length) {
				const r = await fetch("/game-library/catalog.json");
				if (!r.ok) throw new Error("Catalog unavailable");
				catalog = (await r.json()).games;
			}
			render();
			notify("");
			nav.querySelector("button")?.focus();
		} catch (e) {
			notify(e.message);
			header();
			main.replaceChildren(
				btn("Retry", () => {
					exit();
					open();
				}),
			);
		}
	}
	function exit() {
		if (
			frame &&
			!confirm(
				"Return to desktop and close this game? Unsaved progress may be lost.",
			)
		)
			return;
		stopGame();
		drawer.hidden = true;
		root.close();
		document.body.classList.remove("nebula-gaming");
		cancelAnimationFrame(raf);
		clearInterval(padTimer);
		audio?.suspend();
		if (fullscreenOwned && document.fullscreenElement)
			document.exitFullscreen().catch(() => {});
		fullscreenOwned = false;
		previousFocus?.focus();
	}
	function back() {
		if (!drawer.hidden) {
			drawer.hidden = true;
			controls.querySelector("button")?.focus();
		} else if (page !== "home") navigate("home");
		else exit();
	}
	root.addEventListener("cancel", (e) => {
		e.preventDefault();
		back();
	});
	document.addEventListener("visibilitychange", () => {
		if (document.hidden) {
			cancelAnimationFrame(raf);
			audio?.suspend();
		} else metrics();
	});
	window.addEventListener("nebula:lock", () => {
		if (root.open) {
			stopGame();
			exit();
		}
	});
	os.registerApp({
		name: "Game Mode",
		package: "nebula.gamemode",
		icon: "/nebula/gamemode.svg",
		hidden: false,
		windows: [],
		open,
	});
	window.addEventListener("nebula:game-mode", open);
}
