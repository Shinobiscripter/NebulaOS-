// Local account gate. Passwords are salted verifiers; filesystem contents are not encrypted.
import { getGoogleSession, beginGoogleSignIn } from "./google-auth.js";
const KEY = "nebula.accounts.v1";
export const profileId = () => window.nebulaProfileId || "default";
const read = () => JSON.parse(localStorage.getItem(KEY) || "[]");
const write = (accounts) => localStorage.setItem(KEY, JSON.stringify(accounts));
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
const field = (label, type = "text") => {
	const input = el("input", null, { type, required: true });
	input.setAttribute("aria-label", label);
	input.placeholder = label;
	if (type === "password") input.autocomplete = "current-password";
	return input;
};
const hex = (bytes) =>
	[...new Uint8Array(bytes)]
		.map((n) => n.toString(16).padStart(2, "0"))
		.join("");
async function verifier(password, salt) {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	return hex(
		await crypto.subtle.deriveBits(
			{
				name: "PBKDF2",
				hash: "SHA-256",
				salt: new TextEncoder().encode(salt),
				iterations: 600000,
			},
			key,
			256,
		),
	);
}
async function credential(password) {
	const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
	return { salt, hash: await verifier(password, salt) };
}
let locking = false;
export function currentLocalAccount() {
	return read().find((account) => account.id === profileId());
}
export async function createLocalAccount(name, password, confirm, wallpaper) {
	const accounts = read(),
		clean = name.trim();
	if (!clean || clean.length > 40)
		throw Error("Enter a name of 1–40 characters.");
	if (accounts.some((a) => a.name.toLowerCase() === clean.toLowerCase()))
		throw Error("That account name already exists.");
	if (password.length < 8) throw Error("Use at least eight characters.");
	if (password !== confirm) throw Error("Passwords do not match.");
	const id = accounts.length ? crypto.randomUUID() : "default";
	const account = {
		id,
		name: clean,
		...(await credential(password)),
		wallpaper,
	};
	// Re-read after hashing so simultaneous creation cannot overwrite another account.
	const latest = read();
	if (JSON.stringify(latest) !== JSON.stringify(accounts))
		throw Error("Accounts changed in another window. Please try again.");
	write([...accounts, account]);
	return account;
}
export async function prepareSession() {
	const accounts = read();
	const callback = new URL(location.href).searchParams.get("google");
	if (callback || accounts.some((a) => a.google)) {
		const session = await getGoogleSession();
		if (
			session.user &&
			(callback === "connected" ||
				!sessionStorage.getItem("nebula.google.locked"))
		) {
			let account = accounts.find((a) => a.google?.sub === session.user.sub);
			const linkId = sessionStorage.getItem("nebula.google.link");
			if (callback === "connected" && linkId) {
				const target = accounts.find((a) => a.id === linkId);
				if (
					target &&
					(!target.google || target.google.sub === session.user.sub) &&
					(!account || account.id === target.id)
				) {
					target.google = session.user;
					account = target;
				}
			}
			if (!account && callback === "connected") {
				account = {
					id: accounts.length ? crypto.randomUUID() : "default",
					name: session.user.name,
					google: session.user,
				};
				accounts.push(account);
			}
			if (account) {
				write(accounts);
				window.nebulaProfileId = account.id;
				localStorage.setItem("nebula.account.selected", account.id);
				sessionStorage.removeItem("nebula.google.link");
				sessionStorage.removeItem("nebula.google.locked");
				if (callback) {
					const url = new URL(location.href);
					url.searchParams.delete("google");
					history.replaceState(null, "", url);
				}
				return;
			}
		}
		if (callback) {
			sessionStorage.removeItem("nebula.google.link");
			const url = new URL(location.href);
			url.searchParams.delete("google");
			history.replaceState(null, "", url);
		}
	}
	if (!accounts.length) {
		window.nebulaProfileId = "default";
		return;
	}
	await lockScreen(null, true);
}
export async function lockScreen(os, boot = false) {
	if (locking) return;
	locking = true;
	sessionStorage.setItem("nebula.google.locked", "1");
	if (document.fullscreenElement)
		await document.exitFullscreen().catch(() => {});
	document.body.classList.add("nebula-locked");
	window.dispatchEvent(new Event("nebula:lock"));
	const accounts = read();
	const dialog = el("dialog", null, { className: "nebula-lock" });
	dialog.setAttribute("aria-label", "Lock screen");
	const time = el("div", null, { className: "nebula-lock-time" }),
		date = el("p", null, { className: "nebula-lock-date" });
	const tick = () => {
		time.textContent = new Date().toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		});
		date.textContent = new Date().toLocaleDateString([], {
			weekday: "long",
			month: "long",
			day: "numeric",
		});
	};
	tick();
	const timer = setInterval(tick, 30000);
	const form = el("form", null, { className: "nebula-unlock-form" });
	const animate = (target, frames, duration = 320) => {
		if (
			matchMedia("(prefers-reduced-motion: reduce)").matches ||
			document.body.classList.contains("nebula-motion-reduced") ||
			os?.settings.get("disable-animation")
		)
			return Promise.resolve();
		return target
			.animate(frames, { duration, easing: "cubic-bezier(.2,.8,.2,1)" })
			.finished.catch(() => {});
	};
	const select = el("select");
	select.setAttribute("aria-label", "Local account");
	for (const a of accounts)
		select.append(el("option", a.name, { value: a.id }));
	select.value = accounts.some((a) => a.id === profileId())
		? profileId()
		: accounts[0]?.id || "";
	if (boot)
		select.value =
			localStorage.getItem("nebula.account.selected") || select.value;
	if (!select.value && accounts.length) select.value = accounts[0].id;
	const password = field("Password", "password"),
		status = el("p", null, { className: "nebula-form-status" });
	status.setAttribute("role", "status");
	const caps = el("small", "Caps Lock is on", { hidden: true });
	password.addEventListener("keyup", (event) => {
		caps.hidden = !event.getModifierState("CapsLock");
	});
	const reveal = button("Show password", () => {
		password.type = password.type === "password" ? "text" : "password";
		reveal.textContent =
			password.type === "password" ? "Show password" : "Hide password";
		reveal.setAttribute("aria-pressed", String(password.type === "text"));
	});
	reveal.setAttribute("aria-pressed", "false");
	const submit = el(
		"button",
		accounts.length ? "Unlock" : "Return to desktop",
		{ type: "submit" },
	);
	const update = () => {
		const a = accounts.find((a) => a.id === select.value);
		const wallpaper = a?.wallpaper || "/nebula/flow-wallpaper.svg";
		dialog.style.setProperty(
			"--lock-wallpaper",
			`url(${JSON.stringify(wallpaper)})`,
		);
		password.value = "";
		password.type = "password";
		reveal.textContent = "Show password";
		reveal.setAttribute("aria-pressed", "false");
		caps.hidden = true;
		status.textContent = "";
		if (!boot && a && a.id !== profileId()) {
			submit.textContent = "Switch account";
			password.hidden = true;
			password.required = false;
		} else {
			submit.textContent = accounts.length ? "Unlock" : "Return to desktop";
			password.hidden = !accounts.length || !a?.hash;
			password.required = !!a?.hash;
			if (a && !a.hash) submit.textContent = "Sign in with Google to unlock";
		}
		reveal.hidden = password.hidden;
	};
	select.onchange = () => {
		update();
		animate(form, [
			{ opacity: 0.4, transform: "translateY(8px)" },
			{ opacity: 1, transform: "none" },
		]);
	};
	update();
	if (accounts.length) form.append(select, password, reveal, caps);
	form.append(submit, status);
	if (accounts.some((a) => a.google))
		form.append(button("Continue with Google", () => beginGoogleSignIn()));
	const connection = el("span", null, { className: "nebula-lock-connection" });
	const network = () => {
		connection.textContent = navigator.onLine
			? "Online · Local session"
			: "Offline · Local unlock available";
	};
	network();
	window.addEventListener("online", network);
	window.addEventListener("offline", network);
	dialog.append(
		el("span", "NEBULAHUB / LOCAL SESSION", { className: "nebula-lock-brand" }),
		time,
		date,
		form,
		connection,
		el(
			"p",
			accounts.length
				? "Your space, waiting for you."
				: "No password set. Add a local account in Settings to protect this screen.",
			{ className: "nebula-lock-foot" },
		),
	);
	dialog.addEventListener("cancel", (e) => e.preventDefault());
	document.body.append(dialog);
	dialog.showModal();
	animate(dialog, [{ opacity: 0 }, { opacity: 1 }], 400);
	animate(
		form,
		[
			{ opacity: 0, transform: "translateY(20px)" },
			{ opacity: 1, transform: "none" },
		],
		450,
	);
	if (!password.hidden) password.focus();
	const swallow = (e) => {
		if (!dialog.contains(e.target)) {
			e.preventDefault();
		}
		e.stopImmediatePropagation();
	};
	window.addEventListener("keydown", swallow, true);
	let failures = 0;
	return new Promise((resolve) => {
		form.onsubmit = async (e) => {
			e.preventDefault();
			if (submit.disabled) return;
			const account = accounts.find((a) => a.id === select.value);
			if (account && !account.hash) {
				beginGoogleSignIn();
				return;
			}
			if (!boot && account && account.id !== profileId()) {
				localStorage.setItem("nebula.account.selected", account.id);
				location.reload();
				return;
			}
			submit.disabled = true;
			select.disabled = true;
			status.textContent = "Unlocking your space…";
			try {
				if (
					account &&
					(await verifier(password.value, account.salt)) !== account.hash
				) {
					failures++;
					password.value = "";
					status.textContent = "Incorrect password. Try again.";
					animate(form, [
						{ transform: "translateX(0)" },
						{ transform: "translateX(-9px)" },
						{ transform: "translateX(9px)" },
						{ transform: "translateX(0)" },
					]);
					await new Promise((r) =>
						setTimeout(r, Math.min(5000, failures * 700)),
					);
					password.focus();
					return;
				}
				if (account) {
					window.nebulaProfileId = account.id;
					localStorage.setItem("nebula.account.selected", account.id);
				}
				clearInterval(timer);
				await animate(
					dialog,
					[
						{ opacity: 1, transform: "scale(1)" },
						{ opacity: 0, transform: "scale(1.025)" },
					],
					260,
				);
				window.removeEventListener("online", network);
				window.removeEventListener("offline", network);
				dialog.close();
				dialog.remove();
				document.body.classList.remove("nebula-locked");
				window.removeEventListener("keydown", swallow, true);
				locking = false;
				sessionStorage.removeItem("nebula.google.locked");
				resolve();
			} catch (error) {
				status.textContent = `Could not unlock: ${error.message}`;
			} finally {
				submit.disabled = false;
				select.disabled = false;
			}
		};
	});
}
export function rememberLockWallpaper(url) {
	const accounts = read(),
		account = accounts.find((a) => a.id === profileId());
	if (account) {
		account.wallpaper = url;
		try {
			write(accounts);
		} catch {
			/* Wallpaper preview is optional if storage is full. */
		}
	}
}
export function installAccounts(os) {
	window.addEventListener("nebula:lock-request", () => lockScreen(os));
	window.addEventListener("nebula:accounts", () => openAccounts(os));
	window.addEventListener("nebula:lock", () => {
		for (const app of Object.values(os.apps))
			for (const win of app.windows || [])
				win.element?.dispatchEvent(
					new CustomEvent("nebula:visibility", { detail: false }),
				);
	});
}
function openAccounts(os) {
	const dialog = el("dialog", null, { className: "nebula-preferences" });
	dialog.setAttribute("aria-label", "Local accounts");
	const close = button("Close accounts", () => {
		dialog.close();
		dialog.remove();
	});
	const current = read().find((a) => a.id === profileId());
	dialog.append(
		close,
		el("h2", "Local accounts"),
		el(
			"p",
			current
				? `Signed in as ${current.name}`
				: "Set up your current desktop account",
		),
		el(
			"p",
			"Each account has its own files, settings and Linux disk on this browser. Passwords lock the interface; browser storage is not encrypted. Keep device access trusted.",
		),
	);
	const list = el("div");
	for (const a of read())
		list.append(
			el("p", `${a.name}${a.id === profileId() ? " · current account" : ""}`),
		);
	dialog.append(list);
	const form = el("form"),
		name = field("Account name"),
		password = field("New password", "password"),
		confirm = field("Confirm password", "password");
	password.minLength = 8;
	password.autocomplete = confirm.autocomplete = "new-password";
	name.maxLength = 40;
	const status = el("p");
	status.setAttribute("role", "status");
	const submit = el(
		"button",
		current ? "Create separate account" : "Create account for this desktop",
		{ type: "submit" },
	);
	form.append(name, password, confirm, submit, status);
	form.onsubmit = async (e) => {
		e.preventDefault();
		submit.disabled = true;
		try {
			const { id, name: clean } = await createLocalAccount(
				name.value,
				password.value,
				confirm.value,
				os.settings.get("nebula.wallpaper.lockPreview"),
			);
			status.textContent =
				id === profileId()
					? "Account created. Your existing files and settings are preserved."
					: "Account created. Lock the desktop to switch accounts.";
			form.reset();
			submit.textContent = "Create separate account";
			list.append(el("p", clean));
		} catch (error) {
			status.textContent = error.message;
		} finally {
			submit.disabled = false;
		}
	};
	dialog.append(
		form,
		button("Lock / switch account", () => {
			dialog.close();
			dialog.remove();
			lockScreen(os);
		}),
	);
	if (current?.hash) {
		const change = el("form"),
			old = field("Current password", "password"),
			next = field("Replacement password", "password"),
			repeat = field("Confirm replacement password", "password");
		next.minLength = 8;
		next.autocomplete = repeat.autocomplete = "new-password";
		const result = el("p");
		result.setAttribute("role", "status");
		const apply = el("button", "Change password", { type: "submit" });
		change.append(
			el("h3", "Change password"),
			old,
			next,
			repeat,
			apply,
			result,
		);
		change.onsubmit = async (e) => {
			e.preventDefault();
			apply.disabled = true;
			try {
				const all = read(),
					a = all.find((a) => a.id === profileId());
				if ((await verifier(old.value, a.salt)) !== a.hash)
					throw Error("Current password is incorrect.");
				if (next.value.length < 8 || next.value !== repeat.value)
					throw Error("Use matching passwords of at least eight characters.");
				Object.assign(a, await credential(next.value));
				write(all);
				change.reset();
				result.textContent = "Password changed.";
			} catch (error) {
				result.textContent = error.message;
			} finally {
				apply.disabled = false;
			}
		};
		dialog.append(change);
	}
	document.body.append(dialog);
	dialog.addEventListener("close", () => dialog.remove(), { once: true });
	dialog.showModal();
}
