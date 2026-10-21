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
		"Service passwords stay with their providers. Optional Google sign-in shares your name, email and account ID with NebulaHub. Basic usage sharing is off by default; manage it in Google & Privacy. Saved service links stay in this browser.";
	const dismiss = document.createElement("button");
	dismiss.type = "button";
	dismiss.textContent = "Got it";
	dismiss.addEventListener("click", () => notice.remove());
	notice.append(message, dismiss);
	document.body.append(notice);
}
