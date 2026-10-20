import {
	currentLocalAccount,
	createLocalAccount,
	profileId,
} from "./accounts.js";

const features = [
	[
		"Play",
		"Nebula Games",
		"Search the catalog, star favorites and revisit recently played games. External ports open on their own hosts; downloads in Game Mode are marked separately.",
		"nebula.games",
	],
	[
		"Play",
		"Game Mode",
		"Switch to console-style lounges, browse the store, build your library and configure the performance overlay.",
		"nebula.gamemode",
	],
	[
		"Play",
		"NebulaCraft",
		"Choose a Minecraft web build in the launcher. Availability and multiplayer depend on that build and its servers.",
		"nebula.minecraft",
	],
	[
		"Listen & watch",
		"Nebula Music",
		"Search music, build playlists and control the same player from the desktop widget. Online playback needs a connection.",
		"nebula.music",
	],
	[
		"Listen & watch",
		"Nebula Cinema",
		"Browse Stremio add-ons and play compatible video links. Torrent playback needs a separate companion; cloud hosting is not set up.",
		"nebula.cinema",
	],
	[
		"Make it yours",
		"Wallpapers",
		"Browse wallpaper repositories, change the background and pair accents with it.",
		"event:nebula:wallpapers",
	],
	[
		"Make it yours",
		"Flow themes",
		"Import Hyprland configurations or GitHub repositories, preview supported cosmetics and configure browser-native extensions. Linux packages do not run unchanged.",
		"event:nebula:hyprland",
	],
	[
		"Make it yours",
		"Settings & widgets",
		"Switch Orbit, Flow or Horizon desktops. Adjust motion and appearance, toggle widgets and drag them into place.",
		"anura.settings",
	],
	[
		"Your space",
		"Account Center",
		"Save service profile names and links, then export/import a .hub backup. Service sign-ins stay with their providers; backups do not transfer authenticated sessions.",
		"nebula.accounts",
	],
	[
		"Your space",
		"Local accounts",
		"Keep separate browser profiles and lock your desktop. Passwords gate the interface; local files are not encrypted. Clearing browser data removes local data.",
		"event:nebula:accounts",
	],
	[
		"Your space",
		"Files",
		"Manage your local filesystem and import or export files. Keep backups outside the browser.",
		"anura.fsapp",
	],
	[
		"Create & explore",
		"Nebula AI",
		"Chat with the configured models. Access depends on the AI provider, quotas and deployment configuration.",
		"nebula.ai",
	],
	[
		"Create & explore",
		"Apps, browser & terminal",
		"Use the launcher for installed apps and multitasking. Browser networking needs a relay; Linux needs its emulator assets. Install NebulaHub through your browser when PWA installation is available.",
		"anura.settings",
	],
];
const node = (tag, text, className) =>
	Object.assign(document.createElement(tag), {
		...(text === undefined ? {} : { textContent: text }),
		...(className ? { className } : {}),
	});
const button = (text, action) => {
	const b = node("button", text);
	b.type = "button";
	b.onclick = action;
	return b;
};
export function installWelcome(os) {
	const css = node("link");
	css.rel = "stylesheet";
	css.href = "/nebula/welcome.css";
	document.head.append(css);
	let dialog;
	const key = () => `nebula.welcome.v1.${profileId()}`;
	function open() {
		if (dialog?.isConnected) return;
		let step = 0;
		dialog = node("dialog", undefined, "nebula-welcome");
		dialog.setAttribute("aria-label", "Welcome to NebulaHub");
		const shell = node("div", undefined, "nw-shell");
		const sidebar = node("aside", undefined, "nw-sidebar");
		sidebar.append(
			node("span", "✦", "nw-emblem"),
			node("p", "NEBULAHUB"),
			node("p", "Your next session starts here.", "nw-tagline"),
		);
		const progress = node("ol");
		const titles = [
			"Welcome aboard",
			"Your local account",
			"Choose your desktop",
			"Explore NebulaHub",
			"Ready to launch",
		];
		for (const title of titles) progress.append(node("li", title));
		sidebar.append(progress);
		const main = node("section", undefined, "nw-main");
		const content = node("div", undefined, "nw-content");
		const status = node("p", "", "nw-status");
		status.setAttribute("role", "status");
		const footer = node("footer");
		const back = button("Back", () => {
			step--;
			render();
		});
		const later = button("Continue later", () => dialog.close());
		const next = button("Get started", () => {
			step++;
			render();
		});
		footer.append(back, later, next);
		main.append(content, status, footer);
		shell.append(sidebar, main);
		dialog.append(shell);
		const launch = (target) => {
			dialog.close();
			if (target.startsWith("event:"))
				window.dispatchEvent(new Event(target.slice(6)));
			else os.apps[target]?.open();
		};
		function render() {
			content.replaceChildren();
			status.textContent = "";
			content.scrollTop = 0;
			progress.querySelectorAll("li").forEach((li, i) => {
				li.toggleAttribute("data-active", i === step);
				if (i === step) li.setAttribute("aria-current", "step");
				else li.removeAttribute("aria-current");
			});
			back.hidden = step === 0;
			next.hidden = false;
			next.disabled = false;
			next.textContent =
				step === 0
					? "Get started"
					: step === 4
						? "Enter NebulaHub"
						: "Continue";
			next.onclick = () => {
				step++;
				render();
			};
			const heading = node("h1", titles[step]);
			heading.tabIndex = -1;
			content.append(heading);
			if (step === 0) {
				content.append(
					node(
						"p",
						"Games. Music. A desktop that feels like yours.",
						"nw-lead",
					),
					node("div", "✦", "nw-orbit"),
					node(
						"p",
						"Set up a local account, choose a workspace and take a quick look around. No email or cloud account is needed.",
					),
					node(
						"small",
						"Built on AnuraOS by Mercury Workshop. Open source under AGPL-3.0.",
					),
				);
			}
			if (step === 1) {
				const account = currentLocalAccount();
				content.append(
					node(
						"p",
						"Your files and settings live in this browser. This password locks the interface; it does not encrypt browser storage. There is no email password recovery.",
					),
				);
				if (account)
					content.append(
						node(
							"p",
							`You're set, ${account.name}. Your existing account and files are preserved.`,
							"nw-lead",
						),
					);
				else {
					next.hidden = true;
					const form = node("form");
					const inputs = [
						"Account name",
						"New password",
						"Confirm password",
					].map((label, i) => {
						const wrap = node("label", label),
							input = node("input");
						input.type = i ? "password" : "text";
						input.required = true;
						input.autocomplete = i ? "new-password" : "username";
						input.setAttribute("aria-label", label);
						if (i) input.minLength = 8;
						else input.maxLength = 40;
						wrap.append(input);
						form.append(wrap);
						return input;
					});
					const submit = node("button", "Create local account");
					submit.type = "submit";
					form.append(submit);
					form.onsubmit = async (event) => {
						event.preventDefault();
						submit.disabled = true;
						back.disabled = later.disabled = true;
						try {
							await createLocalAccount(
								...inputs.map((i) => i.value),
								os.settings.get("nebula.wallpaper.lockPreview"),
							);
							inputs.forEach((i) => (i.value = ""));
							step++;
							render();
						} catch (e) {
							status.textContent = e.message;
						} finally {
							submit.disabled = false;
							back.disabled = later.disabled = false;
						}
					};
					content.append(form);
				}
			}
			if (step === 2) {
				content.append(
					node("p", "Try a desktop now. You can switch again in Settings."),
				);
				const choices = node("div", undefined, "nw-choices");
				for (const [id, title, description] of [
					["orbit", "Orbit", "A familiar dock and floating windows."],
					["flow", "Flow", "Workspaces, tiling and customizable keybinds."],
					["horizon", "Horizon", "A taskbar and draggable desktop shortcuts."],
				]) {
					const b = button("", async () => {
						choices
							.querySelectorAll("button")
							.forEach((x) => (x.disabled = true));
						try {
							await os.settings.set("nebula.desktop.environment", id);
							window.dispatchEvent(new Event("nebula:environment"));
							render();
						} catch (e) {
							status.textContent = e.message;
							choices
								.querySelectorAll("button")
								.forEach((x) => (x.disabled = false));
						}
					});
					b.setAttribute("aria-label", title);
					b.setAttribute(
						"aria-pressed",
						String(
							(os.settings.get("nebula.desktop.environment") || "orbit") === id,
						),
					);
					const preview = node("div", undefined, `nw-preview nw-${id}`);
					preview.setAttribute("aria-hidden", "true");
					for (let i = 0; i < 3; i++) preview.append(node("i"));
					b.append(preview, node("strong", title), node("p", description));
					choices.append(b);
				}
				content.append(choices);
			}
			if (step === 3) {
				content.append(
					node(
						"p",
						"Choose a section. Open any feature to try it; return through Welcome in the launcher.",
					),
				);
				const tabs = node("nav", undefined, "nw-tabs");
				tabs.setAttribute("aria-label", "Feature categories");
				const list = node("div", undefined, "nw-features");
				const show = (group) => {
					tabs
						.querySelectorAll("button")
						.forEach((b) =>
							b.setAttribute("aria-pressed", String(b.textContent === group)),
						);
					list.replaceChildren();
					for (const [, title, description, target] of features.filter(
						(f) => f[0] === group,
					)) {
						const card = node("article");
						card.append(node("h2", title), node("p", description));
						const b = button(`Open ${title}`, () => launch(target));
						b.disabled = !target.startsWith("event:") && !os.apps[target];
						if (b.disabled) b.textContent = "Not installed";
						card.append(b);
						list.append(card);
					}
				};
				for (const group of new Set(features.map((f) => f[0])))
					tabs.append(button(group, () => show(group)));
				content.append(tabs, list);
				show("Play");
			}
			if (step === 4) {
				content.append(
					node("p", "Make yourself at home.", "nw-lead"),
					node(
						"p",
						"Find apps in the launcher. Move windows by their title bars, maximize for more room, and return to Settings whenever you want a different look.",
					),
					node(
						"p",
						"Welcome stays in your launcher so you can revisit this guide. Back up important files: clearing site data or changing browsers does not carry your desktop with you.",
					),
				);
				next.onclick = () => {
					try {
						localStorage.setItem(key(), "complete");
						dialog.close();
					} catch (e) {
						status.textContent = `Could not save setup: ${e.message}`;
					}
				};
			}
			if (
				!matchMedia("(prefers-reduced-motion: reduce)").matches &&
				!os.settings.get("disable-animation") &&
				!document.body.classList.contains("nebula-motion-reduced")
			)
				content.animate(
					[
						{ opacity: 0, transform: "translateY(20px)" },
						{ opacity: 1, transform: "none" },
					],
					{ duration: 450, easing: "cubic-bezier(.16,1,.3,1)" },
				);
			heading.focus();
		}
		dialog.addEventListener("close", () => dialog.remove(), { once: true });
		document.body.append(dialog);
		dialog.showModal();
		render();
	}
	os.registerApp({
		name: "Welcome",
		package: "nebula.welcome",
		icon: "/nebula/accounts.svg",
		hidden: false,
		windows: [],
		open,
	});
	if (localStorage.getItem(key()) !== "complete") open();
}
