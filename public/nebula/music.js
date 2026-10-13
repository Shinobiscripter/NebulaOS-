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
	let current = null,
		player = null,
		owner = null,
		ready = false,
		playing = false,
		win = null;
	let status = "Search for music or add a YouTube Music song link.",
		results = [],
		searchGeneration = 0;
	let lastTime = 0;
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
		setStatus("Searching YouTube… The free relay may need a minute to wake.");
		try {
			const html = await (
				await remote(
					`https://www.youtube.com/results?search_query=${encodeURIComponent(query + " music")}&sp=EgIQAQ%3D%3D`,
				)
			).text();
			const found = searchTracks(html);
			if (generation !== searchGeneration) return;
			results = found;
			setStatus(
				found.length
					? `${found.length} results from YouTube`
					: "No songs found. Try another search or paste a song link.",
			);
		} catch (error) {
			if (generation === searchGeneration) setStatus(error.message);
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
		if (current?.id !== track.id) lastTime = 0;
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
						time = data.value;
						lastTime = time;
						return;
					}
					if (data.event === "ready") {
						ready = true;
						send("play");
					}
					if (data.event === "state") {
						playing = data.value === 1;
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
	function render() {
		for (const view of views) {
			view.title.textContent = current?.title || "Your next discovery awaits";
			view.artist.textContent = current?.artist || "YouTube • Nebula Music";
			view.status.textContent = status;
			view.play.textContent = playing ? "Pause" : "Play";
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
						"No songs yet. Add a link or discover music in the app.",
					),
				);
			if (view.results) {
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
		root.classList.add("nebula-music");
		const view = {
			root,
			title: make("h2"),
			artist: make("p", "nm-muted"),
			status: make("p", "nm-status"),
			player: make("div", "nm-player"),
			select: make("select"),
			list: make("div", "nm-library"),
		};
		view.status.setAttribute("role", "status");
		view.select.setAttribute("aria-label", "Music playlist");
		view.select.onchange = () => {
			library.selected = view.select.value;
			persist();
			render();
		};
		const body = make("div", full ? "nm-app-layout" : "nm-mini-layout");
		const sidebar = make("section", "nm-sidebar");
		view.play = button("Play", () => toggle(view));
		const controls = make("div", "nm-controls");
		controls.append(
			button("Previous", () => next(-1)),
			view.play,
			button("Next", () => next(1)),
		);
		const link = make("input");
		link.placeholder = "Paste a YouTube Music song link";
		link.setAttribute("aria-label", "YouTube song link");
		const form = make("form", "nm-link");
		form.append(
			link,
			button("Add song", () => {}),
		);
		form.onsubmit = (event) => {
			event.preventDefault();
			addLink(link.value);
		};
		form.lastChild.type = "submit";
		sidebar.append(
			make(
				"p",
				"nm-eyebrow",
				full ? "NEBULA MUSIC / YOUR ORBIT" : "NEBULA MUSIC",
			),
			view.title,
			view.artist,
			view.player,
			controls,
			view.status,
			view.select,
			view.list,
			form,
		);
		if (full) {
			const name = make("input");
			name.placeholder = "New playlist name";
			name.setAttribute("aria-label", "New playlist name");
			sidebar.append(
				name,
				button("Create playlist", () => {
					const value = name.value.trim().slice(0, 80);
					if (!value) return;
					const id = crypto.randomUUID();
					library.playlists.push({ id, name: value, tracks: [] });
					library.selected = id;
					name.value = "";
					persist();
					render();
				}),
			);
			const main = make("section", "nm-discovery");
			main.append(
				make("h1", "", "Signals from deep space"),
				make(
					"p",
					"nm-muted",
					"Discover music on YouTube. Collect your favorites in one shared library.",
				),
			);
			const search = make("input");
			search.type = "search";
			search.placeholder = "Songs, artists, albums…";
			search.setAttribute("aria-label", "Search music");
			const searchForm = make("form", "nm-search");
			searchForm.append(
				search,
				button("Search", () => {}),
			);
			searchForm.lastChild.type = "submit";
			searchForm.onsubmit = (event) => {
				event.preventDefault();
				if (search.value.trim()) discover(search.value.trim());
			};
			view.results = make("div", "nm-results");
			main.append(searchForm, view.results);
			body.append(sidebar, main);
		} else {
			sidebar.append(button("Open Music app", () => app.open()));
			body.append(sidebar);
		}
		const youtube = make("a", "", "Open current song on YouTube");
		youtube.target = "_blank";
		youtube.rel = "noopener";
		youtube.href = "https://music.youtube.com/";
		youtube.onclick = () => {
			youtube.href = current
				? `https://www.youtube.com/watch?v=${current.id}`
				: "https://music.youtube.com/";
		};
		sidebar.append(youtube);
		root.append(body);
		views.add(view);
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
			if (!results.length) discover("space ambient");
		},
	};
	os.registerApp(app);
}
