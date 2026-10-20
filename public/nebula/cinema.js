export function installCinema(os) {
	let win;
	const app = {
		name: "Nebula Cinema",
		package: "nebula.cinema",
		icon: "/cinema/icon.svg",
		hidden: false,
		windows: [],
		open() {
			if (win?.element.isConnected) {
				win.unminimize();
				win.focus();
				return;
			}
			win = os.wm.create(app, {
				title: "Nebula Cinema",
				width: "1100px",
				height: "760px",
				resizable: true,
			});
			const frame = document.createElement("iframe");
			frame.src = "/cinema/";
			frame.title = "Nebula Cinema";
			frame.allow = "autoplay; fullscreen";
			frame.allowFullscreen = true;
			Object.assign(frame.style, {
				width: "100%",
				height: "100%",
				border: "0",
			});
			Object.assign(win.content.style, { overflow: "hidden", height: "100%" });
			win.content.append(frame);
		},
	};
	os.registerApp(app);
}
