import { createHash } from "node:crypto";

export const memberKey = (sub) =>
	"members/" + createHash("sha256").update(sub).digest("hex");

export function restriction(member, now = Date.now()) {
	const rule = member?.restriction;
	if (!rule || rule.kind === "active") return null;
	if (rule.kind === "suspended" && rule.until <= now) return null;
	return { kind: rule.kind, reason: rule.reason, until: rule.until || null };
}

export async function rememberMember(store, user, now) {
	const key = memberKey(user.sub);
	const previous = await store.get(key, { type: "json" });
	const member = {
		...previous,
		id: key.slice(8),
		sub: user.sub,
		email: user.email,
		name: user.name,
		firstSeen: previous?.firstSeen || now,
		lastSignIn: now,
	};
	await store.setJSON(key, member);
	return member;
}
