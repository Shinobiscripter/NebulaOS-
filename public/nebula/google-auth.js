export const COMMUNITY_API = "/api/community";
export async function communityRequest(action, data) {
	const response = await fetch(
		COMMUNITY_API + "?action=" + encodeURIComponent(action),
		{
			method: data === undefined ? "GET" : "POST",
			credentials: "same-origin",
			cache: "no-store",
			headers: data === undefined ? {} : { "Content-Type": "application/json" },
			...(data === undefined ? {} : { body: JSON.stringify(data) }),
			signal: AbortSignal.timeout(12000),
		},
	);
	let result;
	try {
		result = await response.json();
	} catch {
		throw Error("Community services are unavailable on this host.");
	}
	if (!response.ok) throw Error(result.error || "Community request failed.");
	return result;
}
export async function getGoogleSession() {
	try {
		return await communityRequest("session");
	} catch {
		return { configured: false, user: null, owner: false };
	}
}
export function beginGoogleSignIn(linkProfile) {
	if (linkProfile) sessionStorage.setItem("nebula.google.link", linkProfile);
	else sessionStorage.removeItem("nebula.google.link");
	location.assign(COMMUNITY_API + "?action=login");
}
export function googleProfileHint(value) {
	if (!value) return null;
	if (
		typeof value.sub !== "string" ||
		!/^[a-zA-Z0-9_-]{1,255}$/.test(value.sub) ||
		typeof value.email !== "string" ||
		value.email.length > 254 ||
		!value.email.includes("@")
	)
		throw Error("Invalid Google profile reference.");
	return {
		sub: value.sub,
		email: value.email,
		name: String(value.name || value.email).slice(0, 100),
	};
}
