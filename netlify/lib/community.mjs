import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { memberKey, restriction, rememberMember } from "./moderation.mjs";
import gameCatalog from "../../public/nebula/games.json" with { type: "json" };
import storeCatalog from "../../public/game-library/catalog.json" with { type: "json" };

export const OWNER = "gamergeek1107@gmail.com";
export const APP_IDS = new Set([
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
const GAME_IDS = new Set(
	[...gameCatalog.games, ...storeCatalog.games].map((g) => g.id),
);
const jwks = createRemoteJWKSet(
	new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
const random = () => randomBytes(32).toString("hex");
const hash = (text) => createHash("sha256").update(text).digest("hex");
const day = (time) => new Date(time).toISOString().slice(0, 10);
const json = (data, status = 200, extra = {}) =>
	Response.json(data, {
		status,
		headers: { "Cache-Control": "no-store", ...extra },
	});
const cookie = (name, value, age) =>
	`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const cookies = (req) =>
	Object.fromEntries(
		(req.headers.get("cookie") || "")
			.split(";")
			.map((s) => s.trim().split("=")),
	);
const equal = (a, b) =>
	typeof a === "string" &&
	typeof b === "string" &&
	a.length === b.length &&
	timingSafeEqual(Buffer.from(a), Buffer.from(b));
const validToken = (t) => /^\d{4}-\d{2}-\d{2}\.[a-f0-9]{64}$/.test(t || "");
const fail = (message, status = 400) =>
	Object.assign(new Error(message), { status });
async function body(req) {
	if (!req.headers.get("content-type")?.startsWith("application/json"))
		throw fail("JSON required.", 415);
	const reader = req.body?.getReader();
	if (!reader) throw fail("Body required.");
	let text = "",
		bytes = 0;
	const decoder = new TextDecoder();
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		bytes += value.byteLength;
		if (bytes > 8192) {
			await reader.cancel();
			throw fail("Request too large.", 413);
		}
		text += decoder.decode(value, { stream: true });
	}
	try {
		return JSON.parse(text + decoder.decode());
	} catch {
		throw fail("Invalid JSON.");
	}
}
export function sanitizeEvents(events) {
	if (!Array.isArray(events) || events.length > 20)
		throw fail("Send at most 20 events.");
	return events.map((e) => {
		if (e?.type === "visit") return { type: "visit", target: "desktop" };
		if (e?.type === "app.open" && APP_IDS.has(e.target))
			return { type: e.type, target: e.target };
		if (e?.type === "game.open" && GAME_IDS.has(e.target))
			return { type: e.type, target: e.target };
		throw fail("Unsupported activity event.");
	});
}
export async function verifyGoogleToken(token, clientId, nonce, keys = jwks) {
	const { payload } = await jwtVerify(token, keys, {
		issuer: ["https://accounts.google.com", "accounts.google.com"],
		audience: clientId,
		algorithms: ["RS256"],
	});
	if (
		payload.nonce !== nonce ||
		payload.email_verified !== true ||
		typeof payload.sub !== "string" ||
		typeof payload.email !== "string"
	)
		throw fail("Google identity could not be verified.", 401);
	return {
		sub: payload.sub,
		email: payload.email.toLowerCase(),
		name: String(payload.name || payload.email).slice(0, 100),
		verified: true,
	};
}
export function createCommunityHandler({
	store,
	env = process.env,
	now = Date.now,
	verify = verifyGoogleToken,
	exchange = fetch,
}) {
	const origin =
		env.NEBULA_SITE_ORIGIN || "https://nebulahub-shinobiscripter.netlify.app";
	const callback = origin + "/api/community?action=callback";
	const configured = () => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
	const tokenKey = (prefix, t) => `${prefix}/${t.slice(0, 10)}/${hash(t)}`;
	async function session(req) {
		const token = cookies(req)["__Host-nebula-session"];
		if (!validToken(token)) return null;
		const s = await store.get(tokenKey("sessions", token), { type: "json" });
		return s?.expires > now() ? s : null;
	}
	async function owner(req) {
		const s = await session(req);
		if (!s || s.user.verified !== true || s.user.email !== OWNER)
			throw fail(
				"Developer access requires the authorized Google account.",
				403,
			);
		return s;
	}
	async function access(s) {
		if (!s || s.user.email === OWNER) return null;
		return restriction(
			{
				restriction: await store.get(
					"restrictions/" + memberKey(s.user.sub).slice(8),
					{ type: "json" },
				),
			},
			now(),
		);
	}
	return async function handler(req) {
		try {
			const url = new URL(req.url),
				action = url.searchParams.get("action") || "session";
			if (!["GET", "POST"].includes(req.method))
				return json({ error: "Method not allowed." }, 405);
			if (req.method === "POST" && req.headers.get("origin") !== origin)
				throw fail("Origin rejected.", 403);
			if (action === "session" && req.method === "GET") {
				const s = await session(req);
				if (s && !(await store.get(memberKey(s.user.sub), { type: "json" })))
					await rememberMember(store, s.user, now());
				return json({
					requireSignIn: true,
					restriction: await access(s),
					configured: configured(),
					user: s
						? { sub: s.user.sub, email: s.user.email, name: s.user.name }
						: null,
					owner: !!s && s.user.verified === true && s.user.email === OWNER,
				});
			}
			if (action === "login" && req.method === "GET") {
				if (!configured())
					throw fail(
						"Google sign-in is awaiting site-owner configuration.",
						503,
					);
				const state = day(now()) + "." + random(),
					verifier = random(),
					nonce = random();
				await store.setJSON(tokenKey("oauth", state), {
					verifier,
					nonce,
					expires: now() + 600000,
				});
				const dest = new URL("https://accounts.google.com/o/oauth2/v2/auth");
				dest.search = new URLSearchParams({
					client_id: env.GOOGLE_CLIENT_ID,
					redirect_uri: callback,
					response_type: "code",
					scope: "openid email profile",
					state,
					nonce,
					code_challenge: createHash("sha256")
						.update(verifier)
						.digest("base64url"),
					code_challenge_method: "S256",
					prompt: "select_account",
				}).toString();
				return new Response(null, {
					status: 302,
					headers: {
						Location: dest.href,
						"Cache-Control": "no-store",
						"Set-Cookie": cookie("__Host-nebula-oauth", state, 600),
					},
				});
			}
			if (action === "callback" && req.method === "GET") {
				const state = url.searchParams.get("state");
				if (
					!configured() ||
					!validToken(state) ||
					!equal(state, cookies(req)["__Host-nebula-oauth"])
				)
					throw fail(
						"Sign-in expired or state did not match. Start again.",
						401,
					);
				const stateKey = tokenKey("oauth", state),
					pending = await store.get(stateKey, { type: "json" });
				if (!pending || pending.expires <= now())
					throw fail("Sign-in expired. Start again.", 401);
				await store.delete(stateKey);
				if (url.searchParams.has("error"))
					return new Response(null, {
						status: 302,
						headers: {
							Location: origin + "/?google=cancelled",
							"Set-Cookie": cookie("__Host-nebula-oauth", "", 0),
							"Cache-Control": "no-store",
						},
					});
				const code = url.searchParams.get("code");
				if (!code) throw fail("Missing authorization code.");
				const result = await exchange("https://oauth2.googleapis.com/token", {
					method: "POST",
					headers: { "Content-Type": "application/x-www-form-urlencoded" },
					body: new URLSearchParams({
						code,
						client_id: env.GOOGLE_CLIENT_ID,
						client_secret: env.GOOGLE_CLIENT_SECRET,
						redirect_uri: callback,
						grant_type: "authorization_code",
						code_verifier: pending.verifier,
					}),
					signal: AbortSignal.timeout(15000),
				});
				if (!result.ok) throw fail("Google sign-in failed. Start again.", 401);
				const tokens = await result.json(),
					user = await verify(
						tokens.id_token,
						env.GOOGLE_CLIENT_ID,
						pending.nonce,
					);
				const token = day(now()) + "." + random();
				await rememberMember(store, user, now());
				await store.setJSON(tokenKey("sessions", token), {
					user,
					expires: now() + 86400000,
				});
				const headers = new Headers({
					Location: origin + "/?google=connected",
					"Cache-Control": "no-store",
					"Referrer-Policy": "no-referrer",
				});
				headers.append(
					"Set-Cookie",
					cookie("__Host-nebula-session", token, 86400),
				);
				headers.append("Set-Cookie", cookie("__Host-nebula-oauth", "", 0));
				return new Response(null, { status: 302, headers });
			}
			if (action === "logout" && req.method === "POST") {
				const t = cookies(req)["__Host-nebula-session"];
				if (validToken(t)) await store.delete(tokenKey("sessions", t));
				return json({ ok: true }, 200, {
					"Set-Cookie": cookie("__Host-nebula-session", "", 0),
				});
			}
			if (action === "members" && req.method === "GET") {
				await owner(req);
				const cursor = url.searchParams.get("cursor") || "";
				if (cursor && !/^[a-f0-9]{64}$/.test(cursor))
					throw fail("Invalid account cursor.");
				const page = await store.list({ prefix: "members/" });
				const items = page.blobs
					.filter((item) => item.key.slice(8) > cursor)
					.sort((a, b) => a.key.localeCompare(b.key));
				const members = [];
				for (const item of items.slice(0, 100)) {
					const m = await store.get(item.key, { type: "json" });
					if (!m) continue;
					const rule = await store.get("restrictions/" + m.id, {
						type: "json",
					});
					members.push({
						id: m.id,
						name: m.name,
						email: m.email,
						firstSeen: m.firstSeen,
						lastSignIn: m.lastSignIn,
						restriction: restriction({ restriction: rule }, now()),
						protected: m.email === OWNER,
					});
				}
				return json({
					members,
					cursor: items.length > 100 ? items[99].key.slice(8) : null,
				});
			}
			if (action === "moderate" && req.method === "POST") {
				await owner(req);
				const data = await body(req);
				if (
					!/^[a-f0-9]{64}$/.test(data.id || "") ||
					!["active", "suspended", "banned"].includes(data.kind)
				)
					throw fail("Choose a valid account and action.");
				const m = await store.get("members/" + data.id, { type: "json" });
				if (!m) throw fail("Account not found.", 404);
				if (m.email === OWNER)
					throw fail("The developer account cannot be restricted.", 403);
				const reason =
					typeof data.reason === "string" ? data.reason.trim() : "";
				if (!reason || reason.length > 300)
					throw fail("Enter a reason of 1–300 characters.");
				const hours = Number(data.hours);
				if (
					data.kind === "suspended" &&
					(!Number.isInteger(hours) || hours < 1 || hours > 8760)
				)
					throw fail("Choose 1–8,760 hours.");
				const rule = {
					kind: data.kind,
					reason,
					until: data.kind === "suspended" ? now() + hours * 3600000 : null,
					at: now(),
				};
				await store.setJSON("restrictions/" + data.id, rule);
				await store.setJSON(`moderation/${day(now())}/${random()}`, {
					member: data.id,
					...rule,
				});
				return json({ restriction: restriction({ restriction: rule }, now()) });
			}
			const visitor = await session(req);
			if (!visitor) throw fail("Google sign-in is required.", 401);
			const blocked = await access(visitor);
			if (blocked)
				return json(
					{
						error:
							blocked.kind === "banned"
								? "This account is banned."
								: "This account is suspended.",
						restriction: blocked,
					},
					403,
				);
			if (action === "announcements" && req.method === "GET") {
				const a = await store.get("announcement", { type: "json" });
				return json({
					announcement: a?.active && a.expires > now() ? a : null,
				});
			}
			if (action === "announcement" && req.method === "POST") {
				await owner(req);
				const data = await body(req);
				if (
					typeof data.text !== "string" ||
					!data.text.trim() ||
					data.text.length > 1000 ||
					typeof data.active !== "boolean"
				)
					throw fail("Enter an announcement of 1–1,000 characters.");
				const hours = Number(data.hours);
				if (!Number.isInteger(hours) || hours < 1 || hours > 168)
					throw fail("Choose 1–168 hours.");
				const a = {
					id: random(),
					text: data.text.trim(),
					active: data.active,
					published: now(),
					expires: now() + hours * 3600000,
				};
				await store.setJSON("announcement", a);
				return json({ announcement: a });
			}
			if (action === "consent" && req.method === "POST") {
				const data = await body(req);
				if (typeof data.enabled !== "boolean")
					throw fail("Consent choice required.");
				const t = data.enabled ? day(now()) + "." + random() : "";
				if (t)
					await store.setJSON(tokenKey("consent", t), {
						expires: now() + 86400000,
					});
				else {
					const old = cookies(req)["__Host-nebula-activity"];
					if (validToken(old)) await store.delete(tokenKey("consent", old));
				}
				return json({ enabled: data.enabled }, 200, {
					"Set-Cookie": cookie("__Host-nebula-activity", t, t ? 86400 : 0),
				});
			}
			if (action === "events" && req.method === "POST") {
				const t = cookies(req)["__Host-nebula-activity"];
				if (!validToken(t)) throw fail("Activity sharing is off.", 403);
				const consent = await store.get(tokenKey("consent", t), {
					type: "json",
				});
				if (!consent || consent.expires <= now())
					throw fail("Activity consent expired.", 403);
				const events = sanitizeEvents((await body(req)).events);
				if (events.length)
					await store.setJSON(`activity/${day(now())}/${random()}`, {
						at: now(),
						session: hash(day(now()) + t).slice(0, 16),
						events,
					});
				return json({ accepted: events.length });
			}
			if (action === "dashboard" && req.method === "GET") {
				await owner(req);
				const rows = [];
				let reads = 0;
				let truncated = false;
				// Bounded reads: at most 500 batches from the last 24 hours.
				for (const date of [day(now()), day(now() - 86400000)]) {
					for await (const page of store.list({
						prefix: `activity/${date}/`,
						paginate: true,
					})) {
						const items = page.blobs.slice(0, 500 - reads);
						for (let offset = 0; offset < items.length; offset += 10) {
							const batch = await Promise.all(
								items
									.slice(offset, offset + 10)
									.map((item) => store.get(item.key, { type: "json" })),
							);
							rows.push(...batch.filter((row) => row?.at > now() - 86400000));
						}
						reads += items.length;
						truncated = reads >= 500;
						if (truncated) break;
					}
					if (truncated) break;
				}
				const counts = {};
				for (const row of rows)
					for (const e of row.events) {
						const k = e.type + ":" + e.target;
						counts[k] = (counts[k] || 0) + 1;
					}
				return json({
					announcement: await store.get("announcement", { type: "json" }),
					sessions: new Set(rows.map((r) => r.session)).size,
					counts,
					recent: rows
						.sort((a, b) => b.at - a.at)
						.slice(0, 30)
						.map(({ at, events }) => ({ at, events })),
					truncated,
					windowHours: 24,
				});
			}
			return json({ error: "Not found." }, 404);
		} catch (e) {
			return json(
				{ error: e.status ? e.message : "Service temporarily unavailable." },
				e.status || 503,
			);
		}
	};
}

export async function cleanupCommunity(store, now = Date.now()) {
	for (const [prefix, days] of [
		["activity", 7],
		["oauth", 1],
		["sessions", 2],
		["consent", 2],
	]) {
		const { directories } = await store.list({
			prefix: prefix + "/",
			directories: true,
		});
		for (const dir of directories || []) {
			const date = dir.split("/")[1];
			if (
				!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
				date >= day(now - days * 86400000)
			)
				continue;
			for await (const page of store.list({ prefix: dir, paginate: true }))
				for (const item of page.blobs) await store.delete(item.key);
		}
	}
}
