// Dedicated Anura application. The game remains on its own persistent HTTPS origin.
export function installMinecraft(os) {
	const url = "https://nebulacraft-shinobiscripter.netlify.app/";
	let win = null;
	const app = {
		name: "NebulaCraft Launcher",
		package: "nebula.minecraft",
		icon: "/nebula/minecraft.svg",
		hidden: false,
		windows: [],
		open() {
			if (win?.element.isConnected) {
				win.unminimize();
				win.focus();
				return;
			}
			win = os.wm.create(app, {
				title: "NebulaCraft Launcher",
				width: "1100px",
				height: "760px",
				resizable: true,
			});
			Object.assign(win.content.style, {
				position: "relative",
				overflow: "hidden",
				minHeight: "0",
			});
			const root = document.createElement("div");
			Object.assign(root.style, {
				position: "absolute",
				inset: "0",
				display: "flex",
				flexDirection: "column",
				background: "#141620",
			});
			const bar = document.createElement("div");
			Object.assign(bar.style, {
				padding: "8px 14px",
				font: "12px system-ui",
				color: "#cbd0df",
				background: "#202430",
				display: "flex",
				gap: "16px",
				alignItems: "center",
			});
			const hint = document.createElement("span");
			hint.textContent = "NebulaCraft · Java, Classic & Pocket editions";
			hint.style.flex = "1";
			const external = document.createElement("a");
			external.textContent = "Open standalone website ↗";
			external.href = url;
			external.target = "_blank";
			external.rel = "noopener noreferrer";
			external.style.color = "#d3bfef";
			bar.append(hint, external);
			const frame = document.createElement("iframe");
			frame.title = "NebulaCraft Launcher";
			frame.src = url;
			frame.allow = "autoplay; fullscreen; gamepad";
			frame.allowFullscreen = true;
			Object.assign(frame.style, {
				flex: "1",
				width: "100%",
				border: "0",
				minHeight: "0",
			});
			root.append(bar, frame);
			win.content.append(root);
			const pause = () =>
				frame.contentWindow?.postMessage(
					{ type: "nebulacraft-pause" },
					new URL(url).origin,
				);
			win.element.addEventListener("nebula:visibility", (event) => {
				if (!event.detail) pause();
			});
			const observer = new MutationObserver(() => {
				if (win.element.style.display === "none") pause();
			});
			observer.observe(win.element, {
				attributes: true,
				attributeFilter: ["style"],
			});
			win.addEventListener("close", () => observer.disconnect());
		},
	};
	os.registerApp(app);
}
