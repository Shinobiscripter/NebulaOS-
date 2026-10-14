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
		"NebulaHub does not access your service accounts or store their login credentials. Saved profile names and links stay in this browser.";
	const dismiss = document.createElement("button");
	dismiss.type = "button";
	dismiss.textContent = "Got it";
	dismiss.addEventListener("click", () => notice.remove());
	notice.append(message, dismiss);
	document.body.append(notice);
}
