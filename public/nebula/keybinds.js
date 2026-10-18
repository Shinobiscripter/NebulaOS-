export const DEFAULT_BINDINGS = Object.freeze({
	...Object.fromEntries(
		[1, 2, 3, 4].flatMap((n) => [
			[`workspace${n}`, `Ctrl+Alt+Digit${n}`],
			[`move${n}`, `Ctrl+Alt+Shift+Digit${n}`],
		]),
	),
	terminal: "",
	files: "",
	browser: "",
	close: "",
	fullscreen: "",
	tile: "Ctrl+Alt+KeyT",
	float: "Ctrl+Alt+KeyF",
	dashboard: "Ctrl+Alt+KeyD",
	notes: "Ctrl+Alt+KeyN",
	apps: "Ctrl+Alt+Space",
	wallpaper: "Ctrl+Alt+KeyW",
	lock: "Ctrl+Alt+KeyL",
});
export function chord(event) {
	if (["Control", "Alt", "Shift", "Meta"].some((key) => event.key === key))
		return "";
	return [
		...(event.ctrlKey ? ["Ctrl"] : []),
		...(event.altKey ? ["Alt"] : []),
		...(event.shiftKey ? ["Shift"] : []),
		...(event.metaKey ? ["Meta"] : []),
		event.code,
	].join("+");
}
export function bindingError(value, bindings, action) {
	if (!value) return "";
	if (!/^(Ctrl|Alt|Meta)\+/.test(value))
		return "Include Ctrl, Alt or Meta in the shortcut.";
	if (
		/^(Ctrl|Meta)\+(Shift\+)?(Key[WTRNLQ]|Digit[0-9]|Tab|Delete)$/.test(
			value,
		) ||
		value === "Alt+F4" ||
		value === "Alt+Tab" ||
		value === "Ctrl+Alt+Delete"
	)
		return "That shortcut is reserved by the browser or device.";
	if (
		Object.entries(bindings).some(([id, key]) => id !== action && key === value)
	)
		return "That shortcut is already assigned.";
	return "";
}
export function installKeybinds(os, actions) {
	const bindings = () => ({
		...DEFAULT_BINDINGS,
		...os.settings.get("nebula.flow.keybinds"),
	});
	const label = (id) =>
		id.startsWith("workspace")
			? `Workspace ${id.slice(-1)}`
			: id.startsWith("move")
				? `Move window to ${id.slice(-1)}`
				: {
						terminal: "Terminal adapter",
						files: "Files adapter",
						browser: "Browser adapter",
						close: "Close focused window",
						fullscreen: "Fullscreen focused window",
						tile: "Tile windows",
						float: "Restore floating windows",
						dashboard: "Dashboard",
						notes: "Scratchpad",
						apps: "Application search",
						wallpaper: "Wallpaper switcher",
						lock: "Lock screen",
					}[id];
	const pretty = (value) =>
		value ? value.replace(/Key|Digit/g, "").replace(/\+/g, " + ") : "Disabled";
	window.addEventListener(
		"keydown",
		(event) => {
			if (
				event.defaultPrevented ||
				event.repeat ||
				document.body.classList.contains("nebula-locked") ||
				document.querySelector("dialog[open]") ||
				os.settings.get("nebula.desktop.environment") !== "flow"
			)
				return;
			const action = Object.entries(bindings()).find(
				([, value]) => value && value === chord(event),
			)?.[0];
			if (action && actions[action]) {
				event.preventDefault();
				event.stopImmediatePropagation();
				actions[action]();
			}
		},
		true,
	);
	window.addEventListener("nebula:keybinds", () => {
		const dialog = document.createElement("dialog");
		dialog.className = "nebula-preferences";
		dialog.setAttribute("aria-label", "Flow keyboard shortcuts");
		const heading = document.createElement("h2");
		heading.textContent = "Flow keyboard shortcuts";
		dialog.append(heading);
		const hint = document.createElement("p");
		hint.textContent =
			"Select a shortcut, then press your preferred combination. Escape cancels recording; Backspace disables it. Shortcuts work while the desktop has keyboard focus.";
		dialog.append(hint);
		const status = document.createElement("p");
		status.setAttribute("role", "status");
		const list = document.createElement("div");
		let recording = null;
		function render() {
			list.replaceChildren();
			for (const [id, value] of Object.entries(bindings())) {
				const row = document.createElement("div");
				row.className = "nebula-bind-row";
				const name = document.createElement("span");
				name.textContent = label(id);
				const button = document.createElement("button");
				button.textContent = pretty(value);
				button.setAttribute("aria-label", `Change ${label(id)}`);
				button.onclick = () => {
					recording = { id, button };
					renderRecording();
				};
				row.append(name, button);
				list.append(row);
			}
		}
		function renderRecording() {
			for (const button of list.querySelectorAll("button"))
				button.disabled = button !== recording.button;
			recording.button.textContent = "Press shortcut…";
			recording.button.focus();
			status.textContent = "Listening for your shortcut.";
		}
		dialog.addEventListener("keydown", async (event) => {
			if (!recording) return;
			event.preventDefault();
			event.stopPropagation();
			if (event.key === "Escape") {
				recording = null;
				render();
				status.textContent = "Recording cancelled.";
				return;
			}
			const value = event.key === "Backspace" ? "" : chord(event);
			if (!value && event.key !== "Backspace") return;
			const error = bindingError(value, bindings(), recording.id);
			if (error) {
				status.textContent = error;
				return;
			}
			const next = { ...bindings(), [recording.id]: value };
			try {
				await os.settings.set("nebula.flow.keybinds", next);
				recording = null;
				render();
				status.textContent = "Shortcut saved.";
			} catch {
				status.textContent = "Could not save shortcut.";
			}
		});
		const reset = document.createElement("button");
		reset.textContent = "Restore default shortcuts";
		reset.onclick = async () => {
			await os.settings.set("nebula.flow.keybinds", {});
			recording = null;
			render();
			status.textContent = "Defaults restored.";
		};
		const close = document.createElement("button");
		close.textContent = "Close shortcuts";
		close.onclick = () => dialog.close();
		dialog.addEventListener("close", () => dialog.remove(), { once: true });
		render();
		dialog.append(list, status, reset, close);
		document.body.append(dialog);
		dialog.showModal();
	});
}
