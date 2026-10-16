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
			sound: false,
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
		page = next;
		query = "";
		filter = "all";
		render();
		main.querySelector("button,input,select")?.focus();
	}
	function header() {
		nav.replaceChildren(make("strong", "ng-brand", "✦ " + modes[mode].name));
		for (const [id, label] of [
			["home", modes[mode].home],
			["library", "Library"],
			["store", modes[mode].store],
			["settings", "Settings"],
		]) {
			const b = btn(label, () => navigate(id));
			b.setAttribute("aria-current", String(page === id));
			nav.append(b);
		}
		nav.append(
			btn("Fullscreen", async () => {
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
			btn("Desktop", exit, "ng-desktop"),
		);
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
								: game.title.slice(0, 2).toUpperCase(),
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
		if (page === "settings") {
			settings();
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
			...root.querySelectorAll("button,input,select,a[href]"),
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
			else navigate("home");
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
	root.addEventListener("cancel", (e) => {
		e.preventDefault();
		exit();
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
