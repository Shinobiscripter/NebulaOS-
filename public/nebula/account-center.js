import { profileId } from "./accounts.js";
export const SERVICES = Object.freeze({
	github: {
		name: "GitHub",
		login: "https://github.com/login",
		home: "https://github.com/",
		color: "#becde2",
	},
	google: {
		name: "Google",
		login: "https://accounts.google.com/AccountChooser",
		home: "https://myaccount.google.com/",
		color: "#a6c6ff",
	},
	discord: {
		name: "Discord",
		login: "https://discord.com/login",
		home: "https://discord.com/channels/@me",
		color: "#aca6ff",
	},
	instagram: {
		name: "Instagram",
		login: "https://www.instagram.com/accounts/login/",
		home: "https://www.instagram.com/",
		color: "#e9a9cc",
	},
	reddit: {
		name: "Reddit",
		login: "https://www.reddit.com/login/",
		home: "https://www.reddit.com/",
		color: "#ecb197",
	},
	tiktok: {
		name: "TikTok",
		login: "https://www.tiktok.com/login",
		home: "https://www.tiktok.com/",
		color: "#91d9d5",
	},
	microsoft: {
		name: "Microsoft",
		login: "https://login.live.com/",
		home: "https://account.microsoft.com/",
		color: "#a2cae1",
	},
	other: { name: "Other service", color: "#b9b1dc" },
});
export function safeAccountURL(value) {
	const url = new URL(value);
	if (url.protocol !== "https:" || url.username || url.password)
		throw Error("Use an HTTPS address without embedded credentials.");
	return url.href;
}
export function normalizeAccount(input) {
	const service =
		input && Object.hasOwn(SERVICES, input.service) && SERVICES[input.service];
	if (!service) throw Error("Choose a supported service.");
	const label = String(input.label || "")
			.trim()
			.slice(0, 60),
		handle = String(input.handle || "")
			.trim()
			.slice(0, 100);
	if (!label) throw Error("Enter a name for this account.");
	return {
		id: input.id || crypto.randomUUID(),
		service: input.service,
		label,
		handle,
		url: input.service === "other" ? safeAccountURL(input.url) : service.home,
		favorite: !!input.favorite,
		lastOpened: Number(input.lastOpened) || 0,
	};
}
export function exportHub(accounts) {
	return JSON.stringify(
		{
			format: "nebulahub-account-center",
			version: 1,
			accounts: accounts.map((account) => {
				const { id, ...profile } = normalizeAccount(account);
				return profile;
			}),
		},
		null,
		2,
	);
}
export function importHub(text, existing) {
	if (text.length > 1024 * 1024)
		throw Error("This .hub file is too large (maximum 1 MB).");
	let data;
	try {
		data = JSON.parse(text);
	} catch {
		throw Error("This is not a valid .hub file.");
	}
	if (
		data?.format !== "nebulahub-account-center" ||
		data.version !== 1 ||
		!Array.isArray(data.accounts)
	)
		throw Error("Choose a supported Account Center .hub file (version 1).");
	if (data.accounts.length > 1000)
		throw Error("A .hub file can contain up to 1,000 profiles.");
	// Validate the entire file before changing storage; never import credentials or IDs.
	const incoming = data.accounts.map((account) => {
		if (
			!account ||
			typeof account !== "object" ||
			typeof account.label !== "string" ||
			(account.handle !== undefined && typeof account.handle !== "string")
		)
			throw Error("The .hub file contains an invalid profile.");
		return normalizeAccount({ ...account, id: crypto.randomUUID() });
	});
	const rows = [...existing];
	let skipped = 0;
	for (const account of incoming) {
		if (
			rows.some(
				(row) =>
					row.service === account.service &&
					row.label.toLowerCase() === account.label.toLowerCase(),
			)
		) {
			skipped++;
		} else rows.push(account);
	}
	return { rows, added: rows.length - existing.length, skipped };
}
const el = (tag, text, props = {}) =>
	Object.assign(document.createElement(tag), {
		...(text == null ? {} : { textContent: text }),
		...props,
	});
const button = (label, fn) => {
	const b = el("button", label, { type: "button" });
	b.onclick = fn;
	return b;
};
const input = (label, props = {}) => {
	const i = el("input", null, props);
	i.setAttribute("aria-label", label);
	i.placeholder = label;
	return i;
};
export function installAccountCenter(os) {
	let win = null;
	const storageKey = () => `nebula.account-center.v1.${profileId()}`;
	const read = () => {
		try {
			return JSON.parse(localStorage.getItem(storageKey()) || "[]").map(
				normalizeAccount,
			);
		} catch {
			return [];
		}
	};
	const store = (rows) =>
		localStorage.setItem(storageKey(), JSON.stringify(rows));
	const app = {
		name: "Account Center",
		package: "nebula.accounts",
		icon: "/nebula/accounts.svg",
		hidden: false,
		windows: [],
		open() {
			if (win?.element.isConnected) {
				win.unminimize();
				win.focus();
				return;
			}
			win = os.wm.create(app, {
				title: "Account Center",
				width: "930px",
				height: "700px",
				resizable: true,
			});
			const root = el("div", null, { className: "nebula-account-center" });
			win.content.append(root);
			Object.assign(win.content.style, {
				position: "relative",
				overflow: "hidden",
				minHeight: "0",
				containerType: "inline-size",
			});
			const sidebar = el("aside"),
				content = el("main"),
				header = el("header");
			sidebar.append(
				el("span", "NEBULAHUB", { className: "nac-eyebrow" }),
				el("h2", "Account\nCenter"),
				el("p", "Your identities,\none place to start."),
			);
			let filter = "all",
				query = "",
				editing = null,
				undo = null;
			const tabs = el("nav");
			tabs.setAttribute("aria-label", "Account collections");
			for (const [id, name] of [
				["all", "All accounts"],
				["favorites", "Favorites"],
			]) {
				const b = button(name, () => {
					filter = id;
					render();
				});
				b.dataset.filter = id;
				tabs.append(b);
			}
			sidebar.append(
				tabs,
				button("Local desktop accounts", () =>
					window.dispatchEvent(new Event("nebula:accounts")),
				),
				el(
					"p",
					"Sign in on each service’s website. Your browser keeps its own sessions.",
					{ className: "nac-sidebar-note" },
				),
			);
			const search = input("Search saved accounts", { type: "search" });
			search.oninput = () => {
				query = search.value;
				render();
			};
			header.append(
				el("h1", "Your accounts"),
				button("Add account", () => edit()),
			);
			const description = el(
				"p",
				"Save several account profiles per service, then open its sign-in page or website. Account details stay in local storage for this Nebula profile.",
			);
			const count = el("p", null, { className: "nac-count" }),
				list = el("div", null, { className: "nac-list" }),
				status = el("p", null, { className: "nac-status" });
			status.setAttribute("role", "status");
			const transfer = el("div", null, { className: "nac-transfer" });
			const file = input("Import .hub file", {
				type: "file",
				accept: ".hub",
				hidden: true,
			});
			file.onchange = async () => {
				const selected = file.files[0];
				if (!selected) return;
				try {
					if (selected.size > 1024 * 1024)
						throw Error("This .hub file is too large (maximum 1 MB).");
					const text = await selected.text();
					const result = importHub(text, read());
					store(result.rows);
					filter = "all";
					query = search.value = "";
					render();
					status.textContent = `Imported ${result.added} profiles. ${result.skipped} duplicate labels skipped; existing profiles kept. Sign in again on each service in this browser.`;
				} catch (error) {
					status.textContent = `Import failed: ${error.message}`;
				} finally {
					file.value = "";
				}
			};
			transfer.append(
				button("Export .hub", () => {
					try {
						const blob = new Blob([exportHub(read())], {
							type: "application/json",
						});
						const url = URL.createObjectURL(blob);
						const link = el("a", null, {
							href: url,
							download: "NebulaHub-accounts.hub",
						});
						link.click();
						setTimeout(() => URL.revokeObjectURL(url), 30000);
						status.textContent =
							"Exported saved profiles. Import this .hub file in Account Center in your other browser.";
					} catch (error) {
						status.textContent = error.message;
					}
				}),
				button("Import .hub", () => file.click()),
				file,
				el(
					"small",
					"Transfer names, links and favorites. No passwords or login sessions. Existing profiles are kept. The file is readable text; keep it private.",
				),
			);
			const undoButton = button("Undo removal", () => {
				if (!undo) return;
				const rows = read();
				rows.push(undo);
				try {
					store(rows);
					undo = null;
					undoButton.hidden = true;
					status.textContent = "Account restored.";
					render();
				} catch (error) {
					status.textContent = error.message;
				}
			});
			undoButton.hidden = true;
			const editor = el("form", null, { className: "nac-editor" });
			editor.hidden = true;
			const provider = el("select");
			provider.setAttribute("aria-label", "Service");
			for (const [key, value] of Object.entries(SERVICES))
				provider.append(el("option", value.name, { value: key }));
			const label = input("Account label", { required: true, maxLength: 60 }),
				handle = input("Username or email (optional)", { maxLength: 100 }),
				url = input("Service website URL", {
					type: "url",
					placeholder: "https://example.com",
				});
			const hint = el(
				"p",
				"This saves a profile, not a password. Complete sign-in in the new service tab.",
			);
			const save = el("button", "Save account", { type: "submit" }),
				error = el("p");
			error.setAttribute("role", "status");
			editor.append(
				el("h2", "Account details"),
				provider,
				label,
				handle,
				url,
				hint,
				save,
				button("Cancel", () => {
					editor.hidden = true;
					editing = null;
				}),
				error,
			);
			provider.onchange = () => {
				url.hidden = provider.value !== "other";
				url.required = provider.value === "other";
			};
			provider.onchange();
			function edit(account) {
				editing = account?.id || null;
				editor.reset();
				provider.value = account?.service || "github";
				label.value = account?.label || "";
				handle.value = account?.handle || "";
				url.value = account?.url || "";
				provider.onchange();
				error.textContent = "";
				editor.hidden = false;
				label.focus();
			}
			editor.onsubmit = (e) => {
				e.preventDefault();
				try {
					const rows = read(),
						old = rows.find((a) => a.id === editing),
						account = normalizeAccount({
							...old,
							id: editing || undefined,
							service: provider.value,
							label: label.value,
							handle: handle.value,
							url: url.value,
						});
					const duplicate = rows.some(
						(a) =>
							a.id !== account.id &&
							a.service === account.service &&
							a.label.toLowerCase() === account.label.toLowerCase(),
					);
					if (duplicate) throw Error("Use a different label for this account.");
					store(
						old
							? rows.map((a) => (a.id === editing ? account : a))
							: [...rows, account],
					);
					editor.hidden = true;
					editing = null;
					status.textContent =
						"Account saved locally. Use Sign in to open the service’s login page.";
					render();
				} catch (err) {
					error.textContent = err.message;
				}
			};
			function launch(account, login) {
				const service = SERVICES[account.service];
				let target = login ? service.login || account.url : account.url;
				// Never collect service passwords or copy tokens into localStorage.
				const link = document.createElement("a");
				link.href = safeAccountURL(target);
				link.target = "_blank";
				link.rel = "noopener noreferrer";
				link.click();
				try {
					store(
						read().map((a) =>
							a.id === account.id ? { ...a, lastOpened: Date.now() } : a,
						),
					);
					status.textContent = `Opened ${service.name}. Finish signing in or choose the account on that website. If no tab opened, allow pop-ups for NebulaHub.`;
					render();
				} catch (err) {
					status.textContent = err.message;
				}
			}
			function render() {
				const all = read(),
					rows = all
						.filter(
							(a) =>
								(filter !== "favorites" || a.favorite) &&
								`${a.label} ${a.handle} ${SERVICES[a.service].name}`
									.toLowerCase()
									.includes(query.toLowerCase()),
						)
						.sort(
							(a, b) =>
								Number(b.favorite) - Number(a.favorite) ||
								b.lastOpened - a.lastOpened ||
								a.label.localeCompare(b.label),
						);
				for (const tab of tabs.children)
					tab.setAttribute(
						"aria-current",
						tab.dataset.filter === filter ? "page" : "false",
					);
				count.textContent = `${rows.length} saved ${rows.length === 1 ? "profile" : "profiles"}`;
				list.replaceChildren();
				if (!rows.length) {
					const empty = el("section", null, { className: "nac-empty" });
					empty.append(
						el("div", "◎"),
						el(
							"h2",
							all.length
								? "No matching accounts"
								: "Bring your accounts into orbit",
						),
						el(
							"p",
							all.length
								? "Try another search or collection."
								: "Add GitHub, Google, social profiles or another service. No passwords are stored here.",
						),
					);
					if (!all.length)
						empty.append(button("Add your first account", () => edit()));
					list.append(empty);
				}
				for (const account of rows) {
					const service = SERVICES[account.service],
						row = el("article", null, { className: "nac-account" });
					row.setAttribute("aria-label", `${service.name}: ${account.label}`);
					const icon = el("div", service.name.slice(0, 2).toUpperCase(), {
						className: "nac-service-icon",
					});
					icon.style.setProperty("--service-color", service.color);
					const identity = el("div", null, { className: "nac-identity" });
					identity.append(
						el("strong", account.label),
						el(
							"span",
							`${service.name}${account.handle ? " · " + account.handle : ""}`,
						),
						el(
							"small",
							account.lastOpened
								? `Last opened ${new Date(account.lastOpened).toLocaleDateString()}`
								: "Saved locally · sign-in status is managed by the service",
						),
					);
					const actions = el("div", null, { className: "nac-account-actions" });
					const favorite = button(account.favorite ? "★" : "☆", () => {
						try {
							store(
								read().map((a) =>
									a.id === account.id ? { ...a, favorite: !a.favorite } : a,
								),
							);
							render();
						} catch (err) {
							status.textContent = err.message;
						}
					});
					favorite.setAttribute(
						"aria-label",
						`${account.favorite ? "Unfavorite" : "Favorite"} ${account.label}`,
					);
					actions.append(
						button("Sign in", () => launch(account, true)),
						button("Open", () => launch(account, false)),
						favorite,
						button("Edit", () => edit(account)),
						button("Remove", () => {
							try {
								store(read().filter((a) => a.id !== account.id));
								undo = account;
								undoButton.hidden = false;
								status.textContent =
									"Saved profile removed. This does not sign out of the service.";
								render();
							} catch (err) {
								status.textContent = err.message;
							}
						}),
					);
					row.append(icon, identity, actions);
					list.append(row);
				}
			}
			content.append(
				header,
				description,
				transfer,
				search,
				count,
				editor,
				list,
				status,
				undoButton,
				el(
					"p",
					"NebulaHub cannot read or verify another website’s login session. Use that website’s account switcher for services with multiple sign-ins. Saved profiles do not isolate website cookies.",
					{ className: "nac-footnote" },
				),
			);
			root.append(sidebar, content);
			render();
			const storage = () => render();
			window.addEventListener("storage", storage);
			win.addEventListener("close", () =>
				window.removeEventListener("storage", storage),
			);
		},
	};
	os.registerApp(app);
	window.addEventListener("nebula:account-center", () => app.open());
}
