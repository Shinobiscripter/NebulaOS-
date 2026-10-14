import { youtubeID, searchTracks } from "./music-data.js";

// A single OS-owned model/player serves both views. No media downloads or hidden audio extraction.
export function installMusic(os, { widget, make, button, save }) {
	const css = make("link");
	css.rel = "stylesheet";
	css.href = "/nebula/music.css";
	document.head.append(css);
	const stored = os.settings.get("nebula.music.library");
	const library = stored?.playlists?.length
		? stored
		: {
				selected: "orbit",
				playlists: [{ id: "orbit", name: "My orbit", tracks: [] }],
			};
	const selected = () =>
		library.playlists.find((p) => p.id === library.selected) ||
		library.playlists[0];
	const views = new Set();
	const shelves = [
		{ title: "Popular picks", query: "popular songs official music video" },
		{
			title: "Fresh signals",
			query: "new music releases official music video",
		},
		{ title: "Deep space", query: "space ambient chill electronic music" },
	].map((shelf) => ({
		...shelf,
		tracks: [],
		loading: false,
		loaded: false,
		error: "",
	}));
	let recent = os.settings.get("nebula.music.recent") || [];
	if (!Array.isArray(recent)) recent = [];
	async function loadShelf(shelf) {
		if (shelf.loading) return;
		shelf.loading = true;
		shelf.error = "";
		paintShelves();
		try {
			const response = await remote(
				`https://www.youtube.com/results?search_query=${encodeURIComponent(shelf.query)}&sp=EgIQAQ%3D%3D`,
			);
			shelf.tracks = searchTracks(await response.text()).slice(0, 8);
			if (!shelf.tracks.length)
				throw Error("No songs returned. Try refreshing this section.");
			shelf.loaded = true;
		} catch (error) {
			shelf.error = error.message;
		} finally {
			shelf.loading = false;
			paintShelves();
		}
	}
	function paintShelves() {
		for (const view of views) {
			if (!view.shelves) continue;
			view.shelves.replaceChildren();
			for (const shelf of [
				{ title: "Recently played", tracks: recent, recent: true },
				...shelves,
			]) {
				const section = make("section", "nm-shelf");
				section.setAttribute("aria-label", shelf.title);
				const head = make("div", "nm-shelf-heading");
				head.append(make("h2", "", shelf.title));
				if (!shelf.recent) {
					const refresh = button(shelf.loading ? "Loading…" : "Refresh", () =>
						loadShelf(shelf),
					);
					refresh.disabled = shelf.loading;
					refresh.setAttribute("aria-label", `Refresh ${shelf.title}`);
					head.append(refresh);
				}
				section.append(head);
				if (shelf.loading || shelf.error || !shelf.tracks.length)
					section.append(
						make(
							"p",
							"nm-muted",
							shelf.error ||
								(shelf.loading
									? "Finding songs on YouTube… The relay may need a moment."
									: shelf.recent
										? "Songs you play will appear here."
										: "Discover songs from YouTube."),
						),
					);
				const row = make("div", "nm-shelf-row");
				for (const track of shelf.tracks) {
					const card = make("article", "nm-shelf-card");
					const cover = make("img");
					cover.src = `https://i.ytimg.com/vi/${track.id}/mqdefault.jpg`;
					cover.alt = "";
					cover.loading = "lazy";
					card.append(
						cover,
						make("h3", "", track.title),
						make("p", "nm-muted", track.artist),
						button("Play", () => play(track, view, shelf.tracks)),
						button("Add to playlist", () => add(track)),
					);
					row.append(card);
				}
				section.append(row);
				view.shelves.append(section);
			}
		}
	}
	let current = null,
		player = null,
		owner = null,
		ready = false,
		playing = false,
		win = null;
	let status = "Search for music or add a YouTube Music song link.",
		results = [],
		searchGeneration = 0;
	let searchQuery = "",
		searchStatus = "",
		searching = false;
	let lastTime = 0,
		duration = 0,
		volumeLevel = 70;
	let queue = [],
		index = -1;
	const persist = () => save("nebula.music.library", structuredClone(library));
	const setStatus = (text) => {
		status = text;
		render();
	};
	async function remote(url) {
		if (!os.net.libcurl?.fetch)
			throw Error("The network service is starting. Try again shortly.");
		const response = await os.net.fetch(url, {
			signal: AbortSignal.timeout(75000),
		});
		if (!response.ok)
			throw Error(
				`YouTube returned ${response.status}. Try again or paste a song link.`,
			);
		return response;
	}
	async function discover(query) {
		const generation = ++searchGeneration;
		searchQuery = query;
		searching = true;
		results = [];
		searchStatus =
			"Searching YouTube… The free relay may need a minute to wake.";
		for (const view of views) view.search.value = query;
		render();
		try {
			const html = await (
				await remote(
					`https://www.youtube.com/results?search_query=${encodeURIComponent(query + " music")}&sp=EgIQAQ%3D%3D`,
				)
			).text();
			const found = searchTracks(html);
			if (generation !== searchGeneration) return;
			results = found;
			searchStatus = found.length
				? `${found.length} results for ${query}`
				: `No songs found for ${query}. Try another search or paste a song link.`;
		} catch (error) {
			if (generation === searchGeneration)
				searchStatus =
					error.name === "AbortError" || error.name === "TimeoutError"
						? "Search timed out. The free relay may be waking up; please try again."
						: error.message;
		} finally {
			if (generation === searchGeneration) {
				searching = false;
				render();
			}
		}
	}
	async function addLink(value) {
		try {
			const id = youtubeID(value);
			setStatus("Looking up your song…");
			const metadata = await (
				await remote(
					`https://www.youtube.com/oembed?url=${encodeURIComponent("https://www.youtube.com/watch?v=" + id)}&format=json`,
				)
			).json();
			add({ id, title: metadata.title, artist: metadata.author_name });
		} catch (error) {
			setStatus(error.message);
		}
	}
	function add(track) {
		if (!selected().tracks.some((t) => t.id === track.id))
			selected().tracks.push({ ...track });
		persist();
		setStatus(`Saved to ${selected().name}.`);
	}
	let playGeneration = 0;
	async function play(track, view, list = selected().tracks, offset = 0) {
		const generation = ++playGeneration;
		queue = [...list];
		index = queue.findIndex((t) => t.id === track.id);
		if (index < 0) {
			queue = [track];
			index = 0;
		}
		if (current?.id !== track.id) {
			lastTime = 0;
			duration = 0;
		}
		current = track;
		playing = false;
		setStatus("Loading YouTube player…");
		try {
			if (generation !== playGeneration || !view.root.isConnected) return;
			if (owner !== view || !player) {
				player?.destroy();
				ready = false;
				owner = view;
				const frame = make("iframe");
				frame.title = "YouTube music player";
				frame.credentialless = true;
				frame.allow =
					"autoplay; encrypted-media; fullscreen; picture-in-picture";
				frame.allowFullscreen = true;
				frame.src = `/nebula/music-player.html?v=${track.id}&start=${Math.floor(offset)}`;
				view.player.replaceChildren(frame);
				let time = offset;
				const send = (command, value) =>
					frame.contentWindow?.postMessage(
						{ type: "nebula-music-command", command, value },
						location.origin,
					);
				const receive = (event) => {
					if (
						event.source !== frame.contentWindow ||
						event.origin !== location.origin ||
						event.data?.type !== "nebula-music-state"
					)
						return;
					const data = event.data;
					if (data.event === "time") {
						time = Number(data.value?.time) || 0;
						duration = Number(data.value?.duration) || 0;
						lastTime = time;
						updateProgress();
						return;
					}
					if (data.event === "ready") {
						ready = true;
						send("volume", volumeLevel);
						send("play");
					}
					if (data.event === "state") {
						playing = data.value === 1;
						if (playing && current && recent[0]?.id !== current.id) {
							recent = [
								{ ...current },
								...recent.filter((track) => track.id !== current.id),
							].slice(0, 12);
							save("nebula.music.recent", structuredClone(recent));
							paintShelves();
						}
						if (data.value === 0) next(1);
						else
							setStatus(
								playing
									? "Playing from YouTube"
									: "Press Play in the YouTube player to listen.",
							);
					}
					if (data.event === "blocked")
						setStatus("Press Play in the YouTube player to start.");
					if (data.event === "error")
						setStatus(
							`YouTube could not play this song (${data.value}). It may restrict embedding, your region, or require sign-in. Choose another song or open it on YouTube.`,
						);
				};
				window.addEventListener("message", receive);
				player = {
					playVideo: () => send("play"),
					pauseVideo: () => send("pause"),
					getCurrentTime: () => time,
					seekTo: (value) => send("seek", value),
					setVolume: (value) => send("volume", value),
					loadVideoById: (value) => send("load", value),
					destroy: () => {
						window.removeEventListener("message", receive);
						frame.remove();
					},
				};
			} else {
				player.loadVideoById({ videoId: track.id, startSeconds: offset });
			}
			render();
		} catch (error) {
			if (generation === playGeneration) setStatus(error.message);
		}
	}
	function pause() {
		if (ready) player.pauseVideo();
		playing = false;
		render();
	}
	function next(direction) {
		const target = index + direction;
		if (target >= 0 && target < queue.length && owner)
			play(queue[target], owner, queue);
		else pause();
	}
	function toggle(view) {
		if (playing) {
			pause();
			return;
		}
		if (current && owner === view && ready) player.playVideo();
		else if (current)
			play(current, view, queue, ready ? player.getCurrentTime() : lastTime);
		else if (selected().tracks[0]) play(selected().tracks[0], view);
		else setStatus("Add a song to your playlist first.");
	}
	function updateProgress() {
		const format = (n) => {
			n = Math.max(0, Math.floor(n || 0));
			return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
		};
		for (const view of views) {
			view.seek.disabled = !ready || !duration;
			view.seek.max = String(duration || 100);
			if (document.activeElement !== view.seek)
				view.seek.value = String(lastTime);
			view.time.textContent = `${format(lastTime)} / ${format(duration)}`;
		}
	}
	function render() {
		updateProgress();
		for (const view of views) {
			view.title.textContent = current?.title || "Nothing playing yet";
			view.artist.textContent = current?.artist || "YouTube • Nebula Music";
			view.status.textContent = status;
			view.searchStatus.textContent = searchStatus;
			view.searchButton.disabled = searching;
			view.searchButton.textContent = searching ? "Searching" : "Search";
			view.results.setAttribute("aria-busy", String(searching));
			view.play.textContent = playing ? "Pause" : "Play";
			view.play.setAttribute("aria-label", playing ? "Pause" : "Play");
			view.previous.disabled = index <= 0;
			view.next.disabled = index < 0 || index >= queue.length - 1;
			view.cover.src = current
				? `https://i.ytimg.com/vi/${current.id}/mqdefault.jpg`
				: "/nebula/music.svg";
			if (view.playlists)
				view.playlists.replaceChildren(
					...library.playlists.map((p) => {
						const item = button(
							p.name,
							() => {
								library.selected = p.id;
								persist();
								view.showLibrary();
								render();
							},
							"nm-playlist-button",
						);
						item.setAttribute("aria-pressed", String(p.id === selected().id));
						return item;
					}),
				);
			view.select.replaceChildren(
				...library.playlists.map((p) => {
					const option = make("option", "", p.name);
					option.value = p.id;
					return option;
				}),
			);
			view.select.value = selected().id;
			view.list.replaceChildren();
			for (const track of selected().tracks) {
				const row = make("div", "nm-track");
				row.append(
					button(track.title, () => play(track, view)),
					button("×", () => {
						selected().tracks = selected().tracks.filter(
							(t) => t.id !== track.id,
						);
						persist();
						render();
					}),
				);
				row.lastChild.setAttribute("aria-label", `Remove ${track.title}`);
				view.list.append(row);
			}
			if (!selected().tracks.length)
				view.list.append(
					make(
						"p",
						"nm-muted",
						"No songs yet. Search below or add a song link.",
					),
				);
			if (view.renderedResults !== results) {
				view.renderedResults = results;
				view.results.replaceChildren(
					...results.map((track) => {
						const row = make("article", "nm-result");
						const image = make("img");
						image.src = `https://i.ytimg.com/vi/${track.id}/mqdefault.jpg`;
						image.alt = "";
						image.loading = "lazy";
						row.append(
							image,
							make("h3", "", track.title),
							make("p", "nm-muted", `${track.artist} ${track.duration || ""}`),
							button("Play", () => play(track, view, results)),
							button("Add to playlist", () => add(track)),
						);
						return row;
					}),
				);
			}
		}
	}

	function createView(root, full) {
		root.classList.add("nebula-music", full ? "nm-app" : "nm-widget");
		const view = {
			root,
			full,
			title: make("h2"),
			artist: make("p", "nm-muted"),
			status: make("p", "nm-status"),
			player: make("div", "nm-player"),
			select: make("select"),
			list: make("div", "nm-library"),
		};
		view.title.className = "nm-song-title";
		view.status.setAttribute("role", "status");
		view.select.setAttribute("aria-label", "Music playlist");
		view.select.onchange = () => {
			library.selected = view.select.value;
			persist();
			render();
		};
		view.search = make("input");
		view.search.type = "search";
		view.search.placeholder = full
			? "What do you want to listen to?"
			: "Find a song or artist";
		view.search.setAttribute("aria-label", "Search music");
		view.search.value = searchQuery;
		view.searchButton = button("Search", () => {});
		view.searchButton.type = "submit";
		const searchForm = make("form", "nm-search");
		searchForm.setAttribute("role", "search");
		searchForm.setAttribute(
			"aria-label",
			full ? "App music search" : "Widget music search",
		);
		searchForm.append(view.search, view.searchButton);
		view.searchStatus = make("p", "nm-search-status");
		view.searchStatus.setAttribute("aria-live", "polite");
		view.results = make(
			"div",
			full ? "nm-results" : "nm-results nm-compact-results",
		);
		view.results.setAttribute("aria-label", "Music search results");
		const discovery = make("section", "nm-discovery");
		searchForm.onsubmit = (event) => {
			event.preventDefault();
			const query = view.search.value.trim().slice(0, 200);
			if (query) {
				showPanel("search");
				discover(query);
			} else {
				view.searchStatus.textContent = "Enter a song or artist to search.";
				view.search.focus();
			}
		};
		view.cover = make("img", "nm-cover");
		view.cover.src = "/nebula/music.svg";
		view.cover.alt = "";
		const identity = make("div", "nm-identity");
		identity.append(view.cover);
		const identityText = make("div");
		identityText.append(view.title, view.artist);
		identity.append(identityText);
		view.previous = button("Previous", () => next(-1), "nm-previous");
		view.play = button("Play", () => toggle(view), "nm-primary-play");
		view.next = button("Next", () => next(1), "nm-next");
		const controls = make("div", "nm-controls");
		controls.append(view.previous, view.play, view.next);
		view.seek = make("input", "nm-seek");
		view.seek.type = "range";
		view.seek.min = "0";
		view.seek.max = "100";
		view.seek.value = "0";
		view.seek.setAttribute("aria-label", "Seek in song");
		view.seek.onchange = () => {
			if (ready) {
				lastTime = Number(view.seek.value);
				player.seekTo(lastTime);
				updateProgress();
			}
		};
		view.time = make("span", "nm-time", "0:00 / 0:00");
		const progress = make("div", "nm-progress");
		progress.append(view.seek, view.time);
		const transport = make("div", "nm-transport");
		transport.append(controls, progress);
		const link = make("input");
		link.placeholder = "YouTube or YouTube Music link";
		link.setAttribute("aria-label", "YouTube song link");
		const form = make("form", "nm-link");
		form.append(
			link,
			button("Add song", () => {}),
		);
		form.lastChild.type = "submit";
		form.onsubmit = (event) => {
			event.preventDefault();
			addLink(link.value);
		};
		const libraryPanel = make("section", "nm-library-panel");
		libraryPanel.append(
			make("h2", "", "Your collection"),
			view.select,
			view.list,
		);
		const importDetails = make("details", "nm-import");
		importDetails.append(make("summary", "", "Add a song link"), form);
		libraryPanel.append(importDetails);
		const youtube = make("a", "nm-youtube", "Open on YouTube");
		youtube.target = "_blank";
		youtube.rel = "noopener";
		youtube.href = "https://music.youtube.com/";
		youtube.onclick = () => {
			youtube.href = current
				? `https://www.youtube.com/watch?v=${current.id}`
				: "https://music.youtube.com/";
		};
		const tabs = make("nav", "nm-tabs");
		tabs.setAttribute(
			"aria-label",
			full ? "Music navigation" : "Widget music panels",
		);
		const homeButton = button(full ? "Discover" : "Search", () =>
			showPanel("search"),
		);
		const libraryButton = button("Your library", () => showPanel("library"));
		tabs.append(homeButton, libraryButton);
		function showPanel(panel) {
			discovery.hidden = panel !== "search";
			libraryPanel.hidden = panel !== "library";
			homeButton.setAttribute("aria-pressed", String(panel === "search"));
			libraryButton.setAttribute("aria-pressed", String(panel === "library"));
		}
		view.showLibrary = () => showPanel("library");
		if (full) {
			const shell = make("div", "nm-shell");
			const sidebar = make("aside", "nm-sidebar");
			const brand = make("div", "nm-brand");
			const mark = make("img");
			mark.src = "/nebula/music.svg";
			mark.alt = "";
			brand.append(
				mark,
				make("strong", "", "nebula"),
				make("span", "", "MUSIC"),
			);
			sidebar.append(brand, tabs, make("p", "nm-eyebrow", "YOUR PLAYLISTS"));
			view.playlists = make("div", "nm-playlists");
			sidebar.append(view.playlists);
			const name = make("input");
			name.placeholder = "Playlist name";
			name.setAttribute("aria-label", "New playlist name");
			const createForm = make("form", "nm-create");
			createForm.append(
				name,
				button("Create playlist", () => {}),
			);
			createForm.lastChild.type = "submit";
			createForm.onsubmit = (event) => {
				event.preventDefault();
				const value = name.value.trim().slice(0, 80);
				if (!value) return;
				const id = crypto.randomUUID();
				library.playlists.push({ id, name: value, tracks: [] });
				library.selected = id;
				name.value = "";
				persist();
				showPanel("library");
				render();
			};
			sidebar.append(
				createForm,
				make("p", "nm-sidebar-note", "Your music. A little further out."),
			);
			const main = make("main", "nm-main");
			const top = make("header", "nm-topbar");
			top.append(
				searchForm,
				make("span", "nm-source", "YouTube / Free streaming"),
			);
			const hero = make("div", "nm-hero");
			hero.append(
				make("p", "nm-eyebrow", "NEBULA SESSIONS"),
				make("h1", "", "Find your frequency."),
				make("p", "", "A universe of sound, collected by you."),
			);
			const shortcuts = make("div", "nm-discover-shortcuts");
			for (const [label, query] of [
				["Deep space", "space ambient"],
				["After dark", "synthwave night"],
				["Zero gravity", "chill electronic"],
				["Focus", "instrumental focus"],
			])
				shortcuts.append(button(label, () => discover(query)));
			discovery.append(
				hero,
				shortcuts,
				make("h2", "nm-section-title", "Discover your next favorite"),
				view.searchStatus,
				view.results,
			);
			view.shelves = make("div", "nm-shelves");
			discovery.append(
				make(
					"p",
					"nm-muted",
					"Explore YouTube selections — not an official chart or personalized ranking.",
				),
				view.shelves,
			);
			main.append(top, discovery, libraryPanel);
			const rail = make("aside", "nm-listening");
			rail.append(make("p", "nm-eyebrow", "NOW PLAYING"));
			const art = make("div", "nm-orbit-art");
			art.setAttribute("aria-hidden", "true");
			art.append(make("span", "", "N"));
			rail.append(art, view.player, view.status, youtube);
			const footer = make("footer", "nm-bottom-player");
			const volume = make("input", "nm-volume");
			volume.type = "range";
			volume.min = "0";
			volume.max = "100";
			volume.value = String(volumeLevel);
			volume.setAttribute("aria-label", "Volume");
			volume.oninput = () => {
				volumeLevel = Number(volume.value);
				if (ready) player.setVolume(volumeLevel);
			};
			footer.append(identity, transport, volume);
			shell.append(sidebar, main, rail, footer);
			root.append(shell);
		} else {
			const top = make("div", "nm-widget-now");
			top.append(
				identity,
				button("Open Music app", () => app.open(), "nm-expand"),
			);
			discovery.append(view.searchStatus, view.results);
			const panels = make("div", "nm-widget-panels");
			panels.append(tabs, searchForm, discovery, libraryPanel);
			root.append(top, view.player, transport, view.status, panels, youtube);
		}
		showPanel("search");
		views.add(view);
		paintShelves();
		render();
		return view;
	}

	const card = widget("Music", "nebula-music-widget");
	const mini = createView(card, false);
	card.addEventListener("widgethide", () => {
		if (owner === mini) pause();
	});
	const app = {
		name: "Nebula Music",
		package: "nebula.music",
		icon: "/nebula/music.svg",
		hidden: false,
		windows: [],
		open() {
			if (win?.element.isConnected) {
				win.unminimize();
				win.focus();
				return;
			}
			win = os.wm.create(app, {
				title: "Nebula Music",
				width: "1100px",
				height: "760px",
				resizable: true,
			});
			const root = make("div", "nm-full");
			Object.assign(win.content.style, {
				position: "relative",
				minHeight: "0",
				overflow: "hidden",
			});
			Object.assign(root.style, {
				position: "absolute",
				inset: "0",
				height: "auto",
			});
			win.content.append(root);
			const view = createView(root, true);
			win.maximize();
			if (playing && current)
				play(current, view, queue, ready ? player.getCurrentTime() : lastTime);
			win.addEventListener("close", () => {
				if (owner === view) {
					pause();
					player?.destroy();
					player = null;
					ready = false;
					owner = null;
				}
				views.delete(view);
			});
			const observer = new MutationObserver(() => {
				if (owner === view && win.element.style.display === "none") pause();
			});
			observer.observe(win.element, {
				attributes: true,
				attributeFilter: ["style"],
			});
			win.addEventListener("close", () => observer.disconnect());
			win.element.addEventListener("nebula:visibility", (event) => {
				if (!event.detail && owner === view) pause();
			});
			// Fetch only when the full app is opened; keep results for this desktop session.
			for (const shelf of shelves)
				if (!shelf.loaded && !shelf.loading) loadShelf(shelf);
		},
	};
	os.registerApp(app);
}
