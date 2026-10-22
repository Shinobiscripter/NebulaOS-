import { createWidgets } from "./widgets.js";
import { installMusic } from "./music.js";
import { installWindowLayout } from "./window-layout.js";
import { installEnvironments } from "./environments.js";
import { installAccounts } from "./accounts.js";
import { installWallpapers } from "./wallpapers.js";
import { installAccountCenter } from "./account-center.js";
import { installMotion } from "./motion.js";
import { showAccountNotice } from "./startup-notice.js";
import { installHorizon } from "./horizon.js";
import { installMinecraft } from "./minecraft.js";
import { installAI } from "./ai.js";
import { installCinema } from "./cinema.js";
import { installWelcome } from "./welcome.js";
import { installCommunity } from './community.js';
import { installGameMode } from "./game-mode.js";
// Nebula desktop conveniences use the existing Anura apps, windows and settings.
export default function installDesktop(os) {
	showAccountNotice();
	installAccounts(os);
	installWallpapers(os);
	installAccountCenter(os);
	installMinecraft(os);
	installAI(os);
	installCinema(os);
	installGameMode(os);
	// Let synchronous desktop registration finish before showing the first-run guide.
	queueMicrotask(() => installWelcome(os));
	queueMicrotask(() => installCommunity(os));
	if (
		document.getElementById("nebula-menubar") ||
		os.platform.type === "mobile"
	)
		return;
	document.body.classList.add("nebula-desktop");
	const make = (tag, className, text) => {
		const node = document.createElement(tag);
		if (className) node.className = className;
		if (text !== undefined) node.textContent = text;
		return node;
	};
	const button = (label, action, className = "") => {
		const node = make("button", className, label);
		node.type = "button";
		node.onclick = action;
		return node;
	};
	let saves = Promise.resolve();
	const save = (key, value) => {
		saves = saves
			.then(() => os.settings.set(key, value))
			.then(() => true)
			.catch((error) => {
				os.notifications.add({
					title: "Could not save desktop preferences",
					description: error.message,
				});
				return false;
			});
		return saves;
	};
	const windows = () =>
		[
			...new Set(Object.values(os.apps).flatMap((app) => app.windows || [])),
		].filter((win) => win.element?.isConnected);
	const open = (id) => os.apps[id]?.open();
	installHorizon(os, { make, button, save });
	const bar = make("nav", "nebula-menubar");
	bar.id = "nebula-menubar";
	bar.setAttribute("aria-label", "Desktop menu");
	const brand = button("✦", () => open("anura.about"), "nebula-brand");
	brand.setAttribute("aria-label", "About NebulaHub");
	const current = make("strong", "nebula-current", "NebulaHub");
	bar.append(
		brand,
		current,
		button("Files", () => open("anura.fsapp")),
		button("Settings", () => open("anura.settings")),
		button("Game Mode", () => open("nebula.gamemode")),
	);
	document.body.append(bar);

	const dialog = make("dialog", "nebula-command");
	const heading = make("h2", "", "Search apps");
	heading.id = "nebula-command-title";
	dialog.setAttribute("aria-labelledby", heading.id);
	const close = button("Close", () => dialog.close(), "nebula-dialog-close");
	const search = make("input");
	search.type = "search";
	search.placeholder = "Search applications…";
	search.setAttribute("aria-label", "Search applications");
	const results = make("div", "nebula-results");
	dialog.append(close, heading, search, results);
	document.body.append(dialog);
	dialog.addEventListener("click", (event) => {
		if (event.target === dialog) {
			const r = dialog.getBoundingClientRect();
			if (
				event.clientX < r.left ||
				event.clientX > r.right ||
				event.clientY < r.top ||
				event.clientY > r.bottom
			)
				dialog.close();
		}
	});
	function searchApps() {
		results.replaceChildren();
		const apps = Object.values(os.apps)
			.filter(
				(app) =>
					!app.hidden &&
					app.name?.toLowerCase().includes(search.value.trim().toLowerCase()),
			)
			.sort((a, b) => a.name.localeCompare(b.name));
		for (const app of apps) {
			const row = button(
				app.name,
				() => {
					dialog.close();
					app.open();
				},
				"nebula-result",
			);
			if (app.icon) {
				const icon = make("img");
				icon.src = app.icon;
				icon.alt = "";
				row.prepend(icon);
			}
			results.append(row);
		}
		if (!apps.length)
			results.append(make("p", "nebula-muted", "No matching applications."));
	}
	function spotlight() {
		heading.textContent = "Search apps";
		search.hidden = false;
		search.value = "";
		searchApps();
		if (!dialog.open) dialog.showModal();
		search.focus();
	}
	search.oninput = searchApps;
	search.onkeydown = (event) => {
		if (event.key === "ArrowDown" || event.key === "Enter") {
			event.preventDefault();
			const first = results.querySelector("button");
			if (event.key === "Enter") first?.click();
			else first?.focus();
		}
	};
	function overview() {
		heading.textContent = "Open windows";
		search.hidden = true;
		results.replaceChildren();
		for (const win of windows()) {
			const row = make("div", "nebula-window-row");
			row.append(
				button(
					win.title || win.app?.name || "Window",
					() => {
						dialog.close();
						win.unminimize();
						win.focus();
					},
					"nebula-result",
				),
			);
			row.append(
				button("Tile left", () => {
					dialog.close();
					win.unminimize();
					win.snap("left");
				}),
				button("Tile right", () => {
					dialog.close();
					win.unminimize();
					win.snap("right");
				}),
			);
			results.append(row);
		}
		if (!results.children.length)
			results.append(
				make(
					"p",
					"nebula-muted",
					"No open windows. Launch an app from the dock.",
				),
			);
		if (!dialog.open) dialog.showModal();
	}
	let hiddenWindows = [];
	let desktopTransition = false;
	const showDesktop = button("Show Desktop", () => {
		if (desktopTransition) return;
		desktopTransition = true;
		showDesktop.disabled = true;
		if (hiddenWindows.length) {
			hiddenWindows
				.filter((win) => win.element.isConnected)
				.forEach((win) => win.unminimize());
			hiddenWindows = [];
			showDesktop.textContent = "Show Desktop";
		} else {
			hiddenWindows = windows().filter(
				(win) => win.element.style.display !== "none",
			);
			hiddenWindows.forEach((win) => win.minimize());
			showDesktop.textContent = "Restore Windows";
		}
		setTimeout(() => {
			desktopTransition = false;
			showDesktop.disabled = false;
		}, 250);
	});
	bar.append(button("Windows", overview), showDesktop);
	const utilities = make("div", "nebula-menu-utilities");
	const searchButton = button("Search", spotlight);
	searchButton.title = "Search apps (Ctrl/⌘ K)";
	const widgetsButton = button("Widgets", () => widgetManager.menu());
	utilities.append(searchButton, widgetsButton);
	bar.append(utilities);
	// Move the existing live battery/network/clock controls into the menu bar.
	const status = document.getElementById("taskbar-right");
	if (status) bar.append(status);
	document.addEventListener("keydown", (event) => {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
			event.preventDefault();
			spotlight();
		}
	});

	const widgetManager = createWidgets(os, {
		make,
		button,
		save,
		dialog,
		heading,
		search,
		results,
	});
	const { widget } = widgetManager;
	const clock = widget("Today", "nebula-date-widget");
	const time = make("time", "nebula-widget-time");
	const date = make("p", "nebula-muted");
	clock.append(time, date);
	function tickClock() {
		const now = new Date();
		time.dateTime = now.toISOString();
		time.textContent = now.toLocaleTimeString([], {
			hour: "numeric",
			minute: "2-digit",
		});
		date.textContent = now.toLocaleDateString([], {
			weekday: "long",
			month: "long",
			day: "numeric",
		});
	}
	tickClock();
	setInterval(tickClock, 30000);
	clock.append(
		button("Open calendar", () =>
			document.getElementById("date-container")?.click(),
		),
	);
	const notes = widget("Quick note", "nebula-note-widget");
	const note = make("textarea");
	note.setAttribute("aria-label", "Quick note");
	note.placeholder = "A thought worth keeping…";
	note.maxLength = 5000;
	note.value = os.settings.get("nebula.desktop.note") || "";
	const saved = make("span", "nebula-muted", "Saved on this device");
	let noteTimer;
	const saveNote = () => {
		clearTimeout(noteTimer);
		saved.textContent = "Saving…";
		save("nebula.desktop.note", note.value).then((ok) => {
			saved.textContent = ok
				? "Saved on this device"
				: "Could not save this note";
		});
	};
	note.oninput = () => {
		saved.textContent = "Editing…";
		clearTimeout(noteTimer);
		noteTimer = setTimeout(saveNote, 350);
	};
	note.onblur = saveNote;
	notes.append(note, saved);
	const reminders = widget("Reminders");
	let tasks = os.settings.get("nebula.desktop.reminders");
	if (!Array.isArray(tasks)) tasks = [];
	const taskList = make("div", "nebula-reminders");
	const taskForm = make("form", "nebula-task-form");
	const taskInput = make("input");
	taskInput.placeholder = "Add a reminder";
	taskInput.maxLength = 160;
	taskInput.setAttribute("aria-label", "New reminder");
	const add = make("button", "", "+");
	add.setAttribute("aria-label", "Add reminder");
	taskForm.append(taskInput, add);
	function renderTasks() {
		taskList.replaceChildren();
		for (const task of tasks) {
			const row = make("div", "nebula-reminder");
			const label = make("label");
			const check = make("input");
			check.type = "checkbox";
			check.checked = !!task.done;
			check.onchange = () => {
				task.done = check.checked;
				persistTasks();
			};
			label.append(check, make("span", task.done ? "done" : "", task.text));
			const remove = button("×", () => {
				tasks = tasks.filter((item) => item.id !== task.id);
				persistTasks();
			});
			remove.setAttribute("aria-label", `Delete ${task.text}`);
			row.append(label, remove);
			taskList.append(row);
		}
		if (!tasks.length)
			taskList.append(
				make("p", "nebula-muted", "A little space to clear your mind."),
			);
	}
	function persistTasks() {
		save("nebula.desktop.reminders", structuredClone(tasks));
		renderTasks();
	}
	taskForm.onsubmit = (event) => {
		event.preventDefault();
		const text = taskInput.value.trim();
		if (text && tasks.length < 30) {
			tasks.push({ id: crypto.randomUUID(), text, done: false });
			taskInput.value = "";
			persistTasks();
		}
	};
	reminders.append(taskList, taskForm);
	renderTasks();
	const focus = widget("Focus timer");
	let deadline = Number(os.settings.get("nebula.desktop.focusDeadline")) || 0;
	let remaining =
		Number(os.settings.get("nebula.desktop.focusRemaining")) || 25 * 60;
	let timer;
	const countdown = make("output", "nebula-focus-time");
	countdown.setAttribute("aria-label", "Focus time remaining");
	const start = button("Start 25 minutes", () => {
		if (deadline) {
			remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
			deadline = 0;
		} else {
			if (!remaining) remaining = 25 * 60;
			deadline = Date.now() + remaining * 1000;
		}
		save("nebula.desktop.focusRemaining", remaining);
		save("nebula.desktop.focusDeadline", deadline);
		runTimer();
	});
	const reset = button("Reset", () => {
		deadline = 0;
		remaining = 25 * 60;
		save("nebula.desktop.focusRemaining", remaining);
		save("nebula.desktop.focusDeadline", 0);
		runTimer();
	});
	function tickFocus() {
		if (deadline) {
			remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
			if (!remaining) {
				deadline = 0;
				clearInterval(timer);
				save("nebula.desktop.focusDeadline", 0);
				os.notifications.add({
					title: "Focus session complete",
					description: "Time for a short break.",
				});
			}
		}
		countdown.textContent = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
		start.textContent = deadline
			? "Pause"
			: remaining === 1500
				? "Start 25 minutes"
				: "Resume";
	}
	function runTimer() {
		clearInterval(timer);
		tickFocus();
		if (deadline) timer = setInterval(tickFocus, 1000);
	}
	focus.append(countdown, start, reset);
	runTimer();
	installMusic(os, { widget, make, button, save });
	installWindowLayout({ windows, make, button, bar });
	installMotion(os, { windows });
	installEnvironments(os, {
		windows,
		make,
		button,
		save,
		bar,
		spotlight,
		overview,
	});

	const decorated = new WeakSet();
	function constrain(win) {
		const el = win.element;
		if (win.maximized) return;
		if (el.getBoundingClientRect().top < 34) el.style.top = "34px";
		if (win.snapped)
			el.style.height = `${Math.min(el.offsetHeight, innerHeight - 112)}px`;
	}
	function decorate() {
		for (const win of windows()) {
			if (decorated.has(win)) continue;
			decorated.add(win);
			constrain(win);
			for (const action of ["close", "minimize", "maximize"]) {
				const control = win.element.querySelector(`.windowButton.${action}`);
				control?.setAttribute(
					"aria-label",
					`${action[0].toUpperCase() + action.slice(1)} ${win.title}`,
				);
			}
			win.addEventListener("focus", () => {
				current.textContent = win.app?.name || win.title || "NebulaHub";
			});
			win.addEventListener("close", () => {
				current.textContent = "NebulaHub";
			});
			for (const event of ["maximize", "snap"])
				win.addEventListener(event, () => queueMicrotask(() => constrain(win)));
			win.element.addEventListener("pointerup", () => constrain(win));
		}
	}
	new MutationObserver(decorate).observe(document.body, { childList: true });
	decorate();
}
