// Dismissal lasts only for this page load, so every startup shows the notice.
let shown = false;
export function showAccountNotice() {
	if (shown) return;
	shown = true;
	const notice = document.createElement("aside");
	notice.className = "nebula-account-notice";
	notice.setAttribute("aria-label", "Account privacy notice");
	const message = document.createElement("p");
	message.textContent =
		"The Community Update: basic visit, app and game counts are enabled by default; previous opt-outs and browser privacy preferences are respected. Manage reporting in Google & Privacy. Google sign-in shares your name, email and account ID; sign-in times are kept for account moderation. Service passwords stay with their providers, and saved service links stay in this browser.";
	const privacy = document.createElement("button");
	privacy.type = "button";
	privacy.textContent = "Privacy settings";
	privacy.onclick = () => window.dispatchEvent(new Event("nebula:community"));
	const dismiss = document.createElement("button");
	dismiss.type = "button";
	dismiss.textContent = "Got it";
	dismiss.addEventListener("click", () => notice.remove());
	notice.append(message, privacy, dismiss);
	document.body.append(notice);
}
