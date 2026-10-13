const params = new URLSearchParams(location.search);
const id = params.get("v");
const send = (event, value) =>
	parent.postMessage(
		{ type: "nebula-music-state", event, value },
		location.origin,
	);
let player, timer;
window.onYouTubeIframeAPIReady = () => {
	if (!/^[\w-]{11}$/.test(id || "")) return;
	player = new YT.Player("player", {
		width: "100%",
		height: "100%",
		videoId: id,
		playerVars: {
			origin: location.origin,
			playsinline: 1,
			autoplay: 1,
			start: Math.max(0, Number(params.get("start")) || 0),
		},
		events: {
			onReady: () => {
				document.getElementById("status")?.remove();
				send("ready");
			},
			onStateChange: (event) => {
				send("state", event.data);
				clearInterval(timer);
				if (event.data === 1)
					timer = setInterval(
						() => send("time", player.getCurrentTime()),
						1000,
					);
			},
			onAutoplayBlocked: () => send("blocked"),
			onError: (event) => send("error", event.data),
		},
	});
};
window.addEventListener("message", (event) => {
	if (
		event.source !== parent ||
		event.origin !== location.origin ||
		event.data?.type !== "nebula-music-command" ||
		!player?.playVideo
	)
		return;
	const { command, value } = event.data;
	if (command === "play") player.playVideo();
	if (command === "pause") player.pauseVideo();
	if (command === "load" && /^[\w-]{11}$/.test(value?.videoId || ""))
		player.loadVideoById(value);
});
const script = document.createElement("script");
script.src = "https://www.youtube.com/iframe_api";
script.onerror = () => send("error", "network");
document.head.append(script);
setTimeout(() => {
	if (!player) send("error", "network timeout");
}, 30000);
