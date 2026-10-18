// Original web equivalents; no native plugin binaries or installer scripts execute.
export function installFlowPlugins(
	os,
	{ windows, assignments, active, switchWorkspace, update },
) {
	const node = (tag, text) => {
		const n = document.createElement(tag);
		if (text) n.textContent = text;
		return n;
	};
	const button = (text, action) => {
		const n = node("button", text);
		n.onclick = action;
		return n;
	};
	const css = node("link");
	css.rel = "stylesheet";
	css.href = "/nebula/flow-plugins.css";
	document.head.append(css);
	const config = () => ({
		overview: true,
		idle: false,
		minutes: 15,
		...os.settings.get("nebula.flow.plugins"),
	});
	let expo;
	function showOverview() {
		if (expo?.open) {
			expo.close();
			return;
		}
		if (
			!config().overview ||
			os.settings.get("nebula.desktop.environment") !== "flow" ||
			document.body.classList.contains("nebula-locked")
		)
			return;
		expo = node("dialog");
		expo.className = "nebula-expo";
		expo.setAttribute("aria-label", "Workspace overview");
		expo.append(
			node("h2", "Your workspaces"),
			node(
				"p",
				"Choose a window to focus it. Drag a window to another workspace, or use its Move menu. Press 1–4 to switch.",
			),
		);
		const grid = node("div");
		grid.className = "nebula-expo-grid";
		expo.append(grid);
		let dragged = null;
		function render() {
			grid.replaceChildren();
			for (let number = 1; number <= 4; number++) {
				const pane = node("section");
				pane.dataset.workspace = number;
				pane.classList.toggle("current", number === active());
				pane.append(
					button(`Workspace ${number}`, () => {
						expo.close();
						switchWorkspace(number);
					}),
				);
				pane.ondragover = (e) => {
					if (dragged) {
						e.preventDefault();
						e.dataTransfer.dropEffect = "move";
					}
				};
				pane.ondrop = (e) => {
					e.preventDefault();
					if (dragged?.element.isConnected) {
						assignments.set(dragged, number);
						dragged = null;
						update();
						render();
					}
				};
				const members = windows().filter(
					(w) => w.element.isConnected && assignments.get(w) === number,
				);
				if (!members.length) pane.append(node("p", "Empty workspace"));
				for (const win of members) {
					const card = node("div");
					card.className = "nebula-expo-window";
					card.draggable = true;
					card.ondragstart = (e) => {
						dragged = win;
						e.dataTransfer.setData("text/plain", "Nebula window");
						e.dataTransfer.effectAllowed = "move";
					};
					card.ondragend = () => {
						dragged = null;
					};
					card.append(
						button(win.title || win.app?.name || "Window", () => {
							expo.close();
							switchWorkspace(number);
							win.unminimize?.();
							win.focus();
						}),
					);
					const move = node("select");
					move.setAttribute(
						"aria-label",
						`Move ${win.title || "window"} to workspace`,
					);
					for (let i = 1; i <= 4; i++) {
						const option = node("option", `Move to ${i}`);
						option.value = i;
						move.append(option);
					}
					move.value = number;
					move.onchange = () => {
						assignments.set(win, Number(move.value));
						update();
						render();
					};
					card.append(move);
					pane.append(card);
				}
				grid.append(pane);
			}
		}
		expo.append(button("Close overview", () => expo.close()));
		expo.onkeydown = (e) => {
			if (e.target.tagName === "SELECT") return;
			if (/^[1-4]$/.test(e.key)) {
				e.preventDefault();
				expo.close();
				switchWorkspace(Number(e.key));
			}
		};
		const refresh = () => {
			if (expo?.open) render();
		};
		expo.onclose = () => {
			window.removeEventListener("nebula:workspace", refresh);
			expo.remove();
		};
		window.addEventListener("nebula:workspace", refresh);
		document.body.append(expo);
		render();
		expo.showModal();
	}
	function preferences() {
		if (document.querySelector(".nebula-plugin-settings")) return;
		const dialog = node("dialog");
		dialog.className = "nebula-preferences nebula-plugin-settings";
		dialog.setAttribute("aria-label", "Flow extensions");
		dialog.append(
			node("h2", "Flow extensions"),
			node("p", "Browser-native features inspired by hyprexpo and hypridle."),
		);
		const values = config();
		const overview = node("input");
		overview.type = "checkbox";
		overview.checked = values.overview;
		const idle = node("input");
		idle.type = "checkbox";
		idle.checked = values.idle;
		const minutes = node("input");
		minutes.type = "number";
		minutes.min = 1;
		minutes.max = 240;
		minutes.value = values.minutes;
		for (const [label, control] of [
			["Workspace overview", overview],
			["Automatically lock when idle", idle],
			["Idle timeout (minutes)", minutes],
		]) {
			const wrap = node("label", label);
			wrap.append(control);
			dialog.append(wrap);
		}
		dialog.append(
			node(
				"p",
				"Idle lock applies while using the desktop. Embedded apps pause the timer because their activity cannot reliably be measured. This locks NebulaHub, not your device.",
			),
		);
		const status = node("p");
		status.setAttribute("role", "status");
		dialog.append(status);
		dialog.append(
			button("Save extensions", async () => {
				if (
					!minutes.checkValidity() ||
					!Number.isFinite(Number(minutes.value)) ||
					!minutes.value
				) {
					status.textContent = "Choose a timeout from 1 to 240 minutes.";
					return;
				}
				try {
					await os.settings.set("nebula.flow.plugins", {
						overview: overview.checked,
						idle: idle.checked,
						minutes: Number(minutes.value),
					});
					reset();
					dialog.close();
				} catch {
					status.textContent = "Could not save extensions. Please try again.";
				}
			}),
			button("Cancel", () => dialog.close()),
		);
		dialog.onclose = () => dialog.remove();
		document.body.append(dialog);
		dialog.showModal();
	}
	let timer;
	function reset() {
		clearTimeout(timer);
		const settings = config();
		if (!settings.idle || document.body.classList.contains("nebula-locked"))
			return;
		timer = setTimeout(
			() => {
				// Cross-origin frames cannot report activity; never interrupt a game on a guess.
				if (document.activeElement?.tagName === "IFRAME") {
					reset();
					return;
				}
				window.dispatchEvent(new Event("nebula:lock-request"));
			},
			Math.max(1, Math.min(240, Number(settings.minutes) || 15)) * 60000,
		);
	}
	for (const event of [
		"pointerdown",
		"pointermove",
		"keydown",
		"wheel",
		"focus",
	])
		window.addEventListener(event, reset, { passive: true });
	window.addEventListener("nebula:lock", () => {
		clearTimeout(timer);
		if (expo?.open) expo.close();
	});
	new MutationObserver(reset).observe(document.body, {
		attributes: true,
		attributeFilter: ["class"],
	});
	window.addEventListener("nebula:flow-overview", showOverview);
	window.addEventListener("nebula:flow-extensions", preferences);
	window.addEventListener("nebula:environment", () => {
		if (expo?.open) expo.close();
		reset();
	});
	reset();
	return { showOverview, preferences };
}
