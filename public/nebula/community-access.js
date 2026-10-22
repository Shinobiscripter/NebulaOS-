import { communityRequest, beginGoogleSignIn } from "./google-auth.js";

export function showRestriction(rule) {
	if (document.getElementById("nebula-access-restriction")) return;
	const root = document.createElement("dialog");
	root.id = "nebula-access-restriction";
	root.style.cssText =
		"background:#09111f;color:#e6efff;border:1px solid #4c6381;padding:40px;max-width:520px;font:16px/1.6 system-ui";
	root.addEventListener("cancel", (event) => event.preventDefault());
	const heading = document.createElement("h1");
	heading.textContent =
		rule.kind === "banned"
			? "Account access removed"
			: "Account temporarily suspended";
	const detail = document.createElement("p");
	detail.textContent =
		rule.reason +
		(rule.until
			? " Access resumes " + new Date(rule.until).toLocaleString() + "."
			: " This restriction has no automatic expiry.");
	const note = document.createElement("p");
	note.textContent =
		"Your local files have not been deleted. Contact the site owner if you believe this is a mistake.";
	const retry = document.createElement("button");
	retry.textContent = "Check access again";
	retry.onclick = () => location.reload();
	const signout = document.createElement("button");
	signout.textContent = "Sign out";
	signout.onclick = async () => {
		try {
			await communityRequest("logout", {});
			location.reload();
		} catch {
			note.textContent = "Could not sign out. Please try again.";
		}
	};
	root.append(heading, detail, note, retry, signout);
	document.body.append(root);
	root.showModal();
	for (const media of document.querySelectorAll("audio,video")) media.pause();
	window.dispatchEvent(new Event("nebula:access-restricted"));
}

export function showSignIn(unavailable = false) {
	if (document.getElementById("nebula-signin-required")) return;
	const dialog = document.createElement("dialog");
	dialog.id = "nebula-signin-required";
	dialog.style.cssText =
		"background:#09111f;color:#e6efff;border:1px solid #4c6381;padding:40px;max-width:520px;font:16px/1.6 system-ui";
	dialog.addEventListener("cancel", (event) => event.preventDefault());
	const heading = document.createElement("h1");
	heading.textContent = unavailable
		? "Connection unavailable"
		: "Welcome to the community";
	const text = document.createElement("p");
	text.textContent = unavailable
		? "Connect to the internet and retry so NebulaHub can check your account access."
		: "The Community Update requires Google sign-in. Your local files stay in this browser. Your name, email and sign-in times are available to the site owner for moderation.";
	const sign = document.createElement("button");
	sign.textContent = unavailable ? "Retry connection" : "Continue with Google";
	sign.onclick = () => (unavailable ? location.reload() : beginGoogleSignIn());
	dialog.append(heading, text, sign);
	document.body.append(dialog);
	dialog.showModal();
	window.dispatchEvent(new Event("nebula:access-restricted"));
}

export async function checkCommunityAccess() {
	try {
		const session = await communityRequest("session");
		if (session.restriction) {
			showRestriction(session.restriction);
			await new Promise(() => {});
		}
		if (session.requireSignIn && !session.user) {
			showSignIn();
			await new Promise(() => {});
		}
		return session;
	} catch {
		if (!["localhost", "127.0.0.1"].includes(location.hostname)) {
			showSignIn(true);
			await new Promise(() => {});
		}
		return null;
	}
}
