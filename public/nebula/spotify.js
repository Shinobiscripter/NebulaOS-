export function spotifyURL(value) {
	const url = new URL(value.trim());
	const match = url.pathname.match(
		/^\/(?:embed\/)?(track|album|playlist|artist|show|episode)\/([a-zA-Z0-9]{22})\/?$/,
	);
	if (
		url.protocol !== "https:" ||
		url.hostname !== "open.spotify.com" ||
		!match ||
		url.username ||
		url.password
	)
		throw new Error(
			"Paste an open.spotify.com track, album, playlist, artist, show or episode link.",
		);
	return `https://open.spotify.com/embed/${match[1]}/${match[2]}`;
}
export function installSpotify(os, { widget, make, button, save }) {
	const card = widget("Spotify", "nebula-spotify-widget");
	const description = make(
		"p",
		"nebula-muted",
		"Paste a Spotify link to listen. Playback availability is controlled by Spotify.",
	);
	const input = make("input");
	input.type = "url";
	input.placeholder = "https://open.spotify.com/playlist/…";
	input.setAttribute("aria-label", "Spotify link");
	input.value = os.settings.get("nebula.desktop.spotifyURL") || "";
	const status = make("p", "nebula-muted");
	status.setAttribute("role", "status");
	const player = make("div", "nebula-spotify-player");
	let generation = 0,
		controller;
	const stop = () => {
		generation++;
		controller?.abort();
		player.replaceChildren();
		status.textContent = "Player stopped.";
	};
	async function load(proxy) {
		stop();
		const request = generation;
		let url;
		try {
			url = spotifyURL(input.value);
		} catch (error) {
			status.textContent = error.message;
			return;
		}
		save("nebula.desktop.spotifyURL", input.value.trim());
		if (proxy) {
			const relay = os.settings.get("wisp-url");
			if (
				location.hostname.endsWith(".netlify.app") &&
				(!relay || new URL(relay).hostname === location.hostname)
			) {
				status.textContent =
					"No proxy relay is configured. Set a Custom Wisp URL in Settings, then reload the desktop. You can also use the direct player.";
				return;
			}
			status.textContent =
				"Connecting through the desktop proxy… A sleeping relay can take about a minute to wake.";
			controller = new AbortController();
			let timeout;
			try {
				await Promise.race([
					(async () => {
						if (!os.net.libcurl?.fetch)
							throw new Error(
								"The network service is still starting. Try again.",
							);
						const response = await os.net.fetch(url, {
							method: "GET",
							signal: controller.signal,
						});
						if (!response.ok)
							throw new Error(`Spotify returned ${response.status}.`);
						await response.body?.cancel();
					})(),
					new Promise((_, reject) => {
						timeout = setTimeout(() => {
							controller.abort();
							reject(
								new Error(
									"The relay did not respond. Check your Custom Wisp URL.",
								),
							);
						}, 75000);
					}),
				]);
			} catch (error) {
				if (request === generation)
					status.textContent = `Proxy unavailable: ${error.message} Try the direct player below.`;
				return;
			} finally {
				clearTimeout(timeout);
			}
		}
		if (request !== generation) return;
		const frame = make("iframe");
		frame.title = "Spotify player";
		frame.allow =
			"autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
		frame.allowFullscreen = true;
		if (proxy)
			frame.src = `/browser/index.html?nebulaSpotify=${encodeURIComponent(url)}`;
		else {
			frame.credentialless = true;
			frame.src = url;
		}
		player.replaceChildren(frame);
		status.textContent = proxy
			? "Proxy player opened. If Spotify cannot play, try the direct player."
			: "Direct Spotify player. Sign-in or browser restrictions may limit playback to previews.";
	}
	const controls = make("div", "nebula-spotify-controls");
	controls.append(
		button("Load through proxy", () => load(true)),
		button("Use direct player", () => load(false)),
		button("Stop", stop),
		button("Proxy settings", () => os.apps["anura.settings"].open()),
	);
	card.append(description, input, controls, status, player);
	card.addEventListener("widgethide", stop);
}
