import {
	communityRequest,
	getGoogleSession,
	beginGoogleSignIn,
	googleProfileHint,
} from "./google-auth.js";
import { profileId, currentLocalAccount } from "./accounts.js";
import { mountMembers } from "./community-members.js";
import { showRestriction, showSignIn } from "./community-access.js";
const el = (tag, text, props = {}) =>
	Object.assign(document.createElement(tag), {
		...(text == null ? {} : { textContent: text }),
		...props,
	});
const button = (text, fn) => {
	const b = el("button", text, { type: "button" });
	b.onclick = fn;
	return b;
};
const field = (name, tag = "input") => {
	const i = el(tag);
	i.setAttribute("aria-label", name);
	return i;
};
export function installCommunity(os) {
	const css = el("link", null, {
		rel: "stylesheet",
		href: "/nebula/community.css",
	});
	document.head.append(css);
	const consentKey = () => `nebula.activity.optin.${profileId()}`;
	const privacySignal =
		navigator.globalPrivacyControl === true || navigator.doNotTrack === "1";
	const sharingEnabled = () =>
		!privacySignal && localStorage.getItem(consentKey()) !== "false";
	let analyticsLoaded = false;
	function loadAnalytics() {
		if (
			analyticsLoaded ||
			!sharingEnabled() ||
			location.hostname !== "nebulahub-shinobiscripter.netlify.app"
		)
			return;
		analyticsLoaded = true;
		const script = el("script", null, {
			type: "module",
			src: "https://static.cloudflareinsights.com/beacon.min.js",
			crossOrigin: "anonymous",
			referrerPolicy: "no-referrer",
		});
		script.dataset.cfBeacon = JSON.stringify({
			token: "84ec9e89b5924ac680116eded9cc6b8b",
		});
		document.head.append(script);
	}
	let activityReady = false,
		queue = [],
		pending = false,
		win,
		developerWin,
		session = { configured: false, user: null, owner: false };
	async function consent(enabled) {
		activityReady = false;
		queue = [];
		enabled = enabled && !privacySignal;
		localStorage.setItem(consentKey(), String(enabled));
		await communityRequest("consent", { enabled });
		activityReady = enabled;
		if (enabled) loadAnalytics();
		if (enabled) record("visit", "desktop");
	}
	const trackedApps = new Set([
		"nebula.games",
		"nebula.gamemode",
		"nebula.minecraft",
		"nebula.music",
		"nebula.cinema",
		"nebula.accounts",
		"nebula.ai",
		"nebula.welcome",
		"anura.fsapp",
		"anura.settings",
		"anura.browser",
		"anura.terminal",
		"anura.xterm",
		"anura.explore",
		"anura.appmanager",
	]);
	function record(type, target) {
		if (type === "app.open" && !trackedApps.has(target)) return;
		if (
			activityReady &&
			!document.body.classList.contains("nebula-locked") &&
			queue.length < 20
		)
			queue.push({ type, target });
	}
	async function flush() {
		if (!activityReady || pending || !queue.length) return;
		pending = true;
		const events = queue.splice(0, 20);
		try {
			await communityRequest("events", { events });
		} catch {
			/* Best-effort optional counters. Never block app use or replay batches. */
		} finally {
			pending = false;
		}
	}
	window.addEventListener("nebula:game-open", (e) =>
		record("game.open", e.detail),
	);
	const wrapped = new WeakSet();
	function wrap(app) {
		if (wrapped.has(app) || typeof app.open !== "function") return;
		wrapped.add(app);
		const original = app.open;
		app.open = function (...args) {
			const result = original.apply(this, args);
			record("app.open", app.package);
			return result;
		};
	}
	for (const app of Object.values(os.apps)) wrap(app);
	const register = os.registerApp;
	os.registerApp = function (app, ...args) {
		wrap(app);
		return register.call(this, app, ...args);
	};
	setInterval(() => {
		if (!document.hidden) flush();
	}, 60000);
	document.addEventListener("visibilitychange", () => {
		if (document.hidden) flush();
	});
	function notify(text) {
		os.notifications.add({ title: "NebulaHub community", description: text });
	}
	const app = {
		name: "Google & Privacy",
		package: "nebula.community",
		icon: "/nebula/accounts.svg",
		hidden: false,
		windows: [],
		async open() {
			if (win?.element.isConnected) {
				win.unminimize();
				win.focus();
				return;
			}
			win = os.wm.create(app, {
				title: "Google sign-in & privacy",
				width: "740px",
				height: "650px",
				resizable: true,
			});
			const root = el("div", null, { className: "nebula-community" });
			win.content.append(root);
			const status = el("p", "Loading Google connection…", { role: "status" });
			root.append(status);
			session = await getGoogleSession();
			root.replaceChildren(
				el("p", "NEBULAHUB / CONNECTIONS", { className: "nc-eyebrow" }),
				el("h1", "Google & Privacy"),
			);
			const linked = currentLocalAccount()?.google;
			let hint;
			try {
				hint = googleProfileHint(
					JSON.parse(
						localStorage.getItem("nebula.google.import." + profileId()) ||
							"null",
					),
				);
			} catch {
				hint = null;
			}
			root.append(
				el(
					"p",
					session.user
						? `Signed in to NebulaHub as ${session.user.email}.`
						: "Connect Google to sign in to your NebulaHub profile on this browser.",
				),
				el(
					"p",
					"Google shares your name, email and account identifier for authentication. NebulaHub does not receive your Google password or access Gmail, Drive or other Google content. Files and settings remain local; Google sign-in does not sync them.",
				),
			);
			if (linked)
				root.append(el("p", `This desktop is linked to ${linked.email}.`));
			if (hint)
				root.append(
					el(
						"p",
						`Imported Google profile: ${hint.email}. Sign in with that account to verify the reference. A .hub file never restores a login session.`,
					),
				);
			const sign = button(
				session.user ? "Choose Google account" : "Continue with Google",
				() => beginGoogleSignIn(currentLocalAccount()?.id),
			);
			sign.disabled = !session.configured;
			root.append(sign);
			if (!session.configured)
				root.append(
					el(
						"p",
						"Google sign-in is awaiting OAuth configuration by the site owner. Local accounts still work.",
					),
				);
			if (session.user)
				root.append(
					button("Sign out of Google in NebulaHub", async () => {
						try {
							await communityRequest("logout", {});
							session = { ...session, user: null, owner: false };
							sessionStorage.setItem("nebula.google.locked", "1");
							location.reload();
						} catch (e) {
							status.textContent = e.message;
						}
					}),
				);
			root.append(
				el("h2", "Community Update · usage reports"),
				el(
					"p",
					"Basic reports are enabled for new profiles. An earlier opt-out is preserved, and Do Not Track / Global Privacy Control disables reporting. Reports include desktop visits, app opens and game opens, using temporary random identifiers rather than your Google account. No messages, searches, files, browsing URLs, passwords or keystrokes are collected. Events expire within 8 days. Signed-in account details and sign-in times are stored separately for account moderation. Hosting providers process normal request logs.",
				),
			);
			const label = el("label", null, { className: "nc-consent" }),
				toggle = field("Share basic usage activity");
			toggle.type = "checkbox";
			toggle.checked = sharingEnabled();
			toggle.disabled = privacySignal;
			label.append(
				toggle,
				el(
					"span",
					privacySignal
						? "Reporting disabled by your browser privacy preference"
						: "Share basic usage activity",
				),
			);
			root.append(label);
			root.append(
				el(
					"p",
					"Cloudflare Web Analytics provides aggregate page views and performance statistics. It does not identify individual visitors. Turning reporting off reloads the desktop to stop the loaded analytics script; save your work first.",
				),
			);
			toggle.onchange = async () => {
				toggle.disabled = true;
				try {
					await consent(toggle.checked);
					if (!toggle.checked && analyticsLoaded) {
						location.reload();
						return;
					}
					status.textContent = toggle.checked
						? "Activity sharing enabled."
						: "Activity sharing stopped. Previously shared events expire automatically.";
				} catch (e) {
					toggle.checked = false;
					localStorage.setItem(consentKey(), "false");
					status.textContent = e.message;
				} finally {
					toggle.disabled = false;
				}
			};
			if (session.owner)
				root.append(button("Open developer panel", () => developer.open()));
			root.append(
				button("Open Account Center", () => os.apps["nebula.accounts"]?.open()),
				status,
			);
			status.textContent = "";
		},
	};
	const developer = {
		name: "Developer Panel",
		package: "nebula.developer",
		icon: "/nebula/accounts.svg",
		hidden: false,
		windows: [],
		async open() {
			if (developerWin?.element.isConnected) {
				developerWin.unminimize();
				developerWin.focus();
				return;
			}
			developerWin = os.wm.create(developer, {
				title: "NebulaHub Developer Panel",
				width: "980px",
				height: "760px",
				resizable: true,
			});
			const root = el("div", null, { className: "nebula-community" });
			developerWin.content.append(root);
			const status = el("p", "Verifying developer access…", { role: "status" });
			root.append(
				el("p", "NEBULAHUB / DEVELOPER", { className: "nc-eyebrow" }),
				el("h1", "Community control"),
				status,
			);
			session = await getGoogleSession();
			if (!session.owner) {
				status.textContent =
					"Restricted to the verified Google account gamergeek1107@gmail.com.";
				root.append(button("Google sign-in", () => app.open()));
				return;
			}
			const form = el("form"),
				message = field("Announcement", "textarea");
			message.required = true;
			message.maxLength = 1000;
			message.rows = 4;
			const hours = field("Announcement duration in hours");
			hours.type = "number";
			hours.min = "1";
			hours.max = "168";
			hours.value = "24";
			hours.required = true;
			const preview = el("p", "Your announcement preview appears here.", {
				className: "nc-preview",
			});
			message.oninput = () => (preview.textContent = message.value);
			const publish = el("button", "Publish announcement", { type: "submit" });
			const withdraw = button("Withdraw announcement", async () => {
				try {
					await communityRequest("announcement", {
						text: message.value || "Announcement withdrawn.",
						active: false,
						hours: 1,
					});
					status.textContent = "Announcement withdrawn.";
				} catch (e) {
					status.textContent = e.message;
				}
			});
			form.append(
				el("h2", "Live announcement"),
				el(
					"p",
					"Plain text, up to 1,000 characters. Open desktops check for updates about once a minute while visible.",
				),
				message,
				el("label", "Duration (hours)"),
				hours,
				preview,
				publish,
				withdraw,
			);
			form.onsubmit = async (e) => {
				e.preventDefault();
				publish.disabled = true;
				try {
					await communityRequest("announcement", {
						text: message.value,
						active: true,
						hours: Number(hours.value),
					});
					status.textContent = "Published to NebulaHub.";
				} catch (e) {
					status.textContent = e.message;
				} finally {
					publish.disabled = false;
				}
			};
			const stats = el("section");
			async function refresh() {
				status.textContent = "Loading report…";
				try {
					const data = await communityRequest("dashboard");
					if (data.announcement) {
						message.value = data.announcement.text;
						preview.textContent = message.value;
					}
					stats.replaceChildren(
						el("h2", "Usage · last 24 hours"),
						el(
							"p",
							`${data.sessions} reporting browser sessions. Opt-outs, blockers and offline use are excluded; these are client-reported counts, not an audit log.${data.truncated ? " Report capped at 500 batches." : ""}`,
						),
					);
					const table = el("table"),
						head = el("tr");
					head.append(el("th", "Action"), el("th", "Count"));
					table.append(head);
					for (const [key, value] of Object.entries(data.counts).sort(
						(a, b) => b[1] - a[1],
					)) {
						const row = el("tr");
						row.append(el("td", key), el("td", String(value)));
						table.append(row);
					}
					stats.append(table);
					if (!Object.keys(data.counts).length)
						stats.append(el("p", "No shared activity yet."));
					stats.append(el("h3", "Recent activity"));
					for (const batch of data.recent)
						stats.append(
							el(
								"p",
								new Date(batch.at).toLocaleTimeString() +
									" · " +
									batch.events.map((e) => e.type + " / " + e.target).join(", "),
							),
						);
					status.textContent = "Report updated.";
				} catch (e) {
					stats.replaceChildren();
					status.textContent = e.message;
				}
			}
			root.append(form, button("Refresh usage report", refresh), stats);
			mountMembers(root);
			const analyticsLink = el("a", "Open Cloudflare Web Analytics", {
				href: "https://dash.cloudflare.com/8f336a7fd88e6e8fce2bdcd4fd1f192b/web-analytics",
				target: "_blank",
				rel: "noopener noreferrer",
			});
			root.append(analyticsLink);
			await refresh();
		},
	};
	os.registerApp(app);
	window.addEventListener("nebula:community", () => app.open());
	getGoogleSession().then((s) => {
		session = s;
		if (s.owner && !os.apps[developer.package]) os.registerApp(developer);
	});
	if (sharingEnabled()) consent(true).catch(() => {});
	let announcementPending = false;
	window.addEventListener("nebula:access-restricted", () => {
		activityReady = false;
		queue = [];
	});
	async function announcement() {
		if (
			document.hidden ||
			document.body.classList.contains("nebula-locked") ||
			announcementPending
		)
			return;
		announcementPending = true;
		try {
			const access = await communityRequest("session");
			if (access.restriction) {
				showRestriction(access.restriction);
				return;
			}
			if (access.requireSignIn && !access.user) {
				showSignIn();
				return;
			}
			const { announcement: a } = await communityRequest("announcements");
			let banner = document.getElementById("nebula-announcement");
			if (!a) {
				banner?.remove();
				return;
			}
			if (
				localStorage.getItem("nebula.announcement.dismissed." + profileId()) ===
					a.id ||
				banner?.dataset.id === a.id
			)
				return;
			banner?.remove();
			banner = el("aside", null, {
				id: "nebula-announcement",
				className: "nebula-announcement",
			});
			banner.dataset.id = a.id;
			banner.setAttribute("aria-label", "Developer announcement");
			banner.append(
				el("strong", "From the developer"),
				el("p", a.text),
				button("Dismiss announcement", () => {
					localStorage.setItem(
						"nebula.announcement.dismissed." + profileId(),
						a.id,
					);
					banner.remove();
				}),
			);
			document.body.append(banner);
		} catch {
			/* Offline desktops remain usable. */
		} finally {
			announcementPending = false;
		}
	}
	announcement();
	setInterval(announcement, 60000);
	document.addEventListener("visibilitychange", () => {
		if (!document.hidden) announcement();
	});
}
