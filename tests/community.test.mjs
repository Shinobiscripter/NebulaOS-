import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
	createCommunityHandler,
	sanitizeEvents,
	OWNER,
	cleanupCommunity,
	verifyGoogleToken,
} from "../netlify/lib/community.mjs";
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from "jose";
import { exportHub, importHub } from "../public/nebula/account-center.js";
const origin = "https://nebula.test";
const now = Date.UTC(2026, 9, 20, 12);
test("Google signatures, issuer, audience, expiry, nonce and verified email are enforced", async () => {
	const { publicKey, privateKey } = await generateKeyPair("RS256");
	const keys = createLocalJWKSet({
		keys: [{ ...(await exportJWK(publicKey)), kid: "test", alg: "RS256" }],
	});
	async function token(overrides = {}) {
		return new SignJWT({
			sub: "user",
			email: OWNER,
			email_verified: true,
			nonce: "nonce",
			iss: "https://accounts.google.com",
			aud: "client",
			exp: Math.floor(Date.now() / 1000) + 60,
			...overrides,
		})
			.setProtectedHeader({ alg: "RS256", kid: "test" })
			.sign(privateKey);
	}
	assert.equal(
		(await verifyGoogleToken(await token(), "client", "nonce", keys)).email,
		OWNER,
	);
	for (const claims of [
		{ iss: "https://evil.test" },
		{ aud: "another-client" },
		{ exp: 1 },
		{ nonce: "wrong" },
		{ email_verified: false },
	]) {
		await assert.rejects(
			verifyGoogleToken(await token(claims), "client", "nonce", keys),
		);
	}
	const other = await generateKeyPair("RS256");
	const forged = await new SignJWT({ sub: "user" })
		.setProtectedHeader({ alg: "RS256", kid: "test" })
		.sign(other.privateKey);
	await assert.rejects(verifyGoogleToken(forged, "client", "nonce", keys));
});
function setup() {
	const data = new Map();
	const store = {
		get: async (k) => data.get(k) || null,
		setJSON: async (k, v) => data.set(k, structuredClone(v)),
		delete: async (k) => data.delete(k),
		list({ prefix = "", paginate = false, directories = false } = {}) {
			const keys = [...data.keys()].filter((k) => k.startsWith(prefix));
			if (directories)
				return Promise.resolve({
					directories: [
						...new Set(
							keys.map(
								(k) => prefix + k.slice(prefix.length).split("/")[0] + "/",
							),
						),
					],
					blobs: [],
				});
			const result = { blobs: keys.map((key) => ({ key })) };
			return paginate
				? (async function* () {
						yield result;
					})()
				: Promise.resolve(result);
		},
	};
	const handler = createCommunityHandler({
		store,
		env: {
			NEBULA_SITE_ORIGIN: origin,
			GOOGLE_CLIENT_ID: "test-client",
			GOOGLE_CLIENT_SECRET: "test-secret",
		},
		now: () => now,
		exchange: async () => Response.json({ id_token: "test-token" }),
		verify: async () => ({
			sub: "google-owner",
			email: OWNER,
			name: "Owner",
			verified: true,
		}),
	});
	function request(
		action,
		{ method = "GET", body, cookie = "", requestOrigin = origin } = {},
	) {
		return handler(
			new Request(origin + "/api/community?action=" + action, {
				method,
				headers: {
					Origin: requestOrigin,
					Cookie: cookie,
					...(body ? { "Content-Type": "application/json" } : {}),
				},
				...(body ? { body: JSON.stringify(body) } : {}),
			}),
		);
	}
	function session(email = OWNER, verified = true) {
		const token = "2026-10-20." + "a".repeat(64);
		data.set(
			"sessions/2026-10-20/" + createHash("sha256").update(token).digest("hex"),
			{
				user: { email, verified, sub: "test-sub", name: "Test" },
				expires: now + 10000,
			},
		);
		return "__Host-nebula-session=" + token;
	}
	return { request, session, data, store };
}
test("developer routes reject anonymous, forged, wrong-account and unverified sessions", async () => {
	const s = setup();
	for (const makeCookie of [
		() => "",
		() => "__Host-nebula-session=forged",
		() => s.session("someone@gmail.com"),
		() => s.session(OWNER, false),
	]) {
		const cookie = makeCookie();
		assert.equal((await s.request("dashboard", { cookie })).status, 403);
	}
	assert.equal(
		(
			await s.request("announcement", {
				method: "POST",
				body: { email: OWNER, text: "fake", active: true, hours: 1 },
			})
		).status,
		403,
	);
});
test("owner announcements are shared, plain text and withdrawable; cross-origin writes fail", async () => {
	const s = setup(),
		cookie = s.session();
	const body = {
		text: "<script>not executable</script>",
		active: true,
		hours: 2,
	};
	assert.equal(
		(
			await s.request("announcement", {
				method: "POST",
				cookie,
				body,
				requestOrigin: "https://evil.test",
			})
		).status,
		403,
	);
	assert.equal(
		(await s.request("announcement", { method: "POST", cookie, body })).status,
		200,
	);
	assert.equal(
		(await (await s.request("announcements")).json()).announcement.text,
		body.text,
	);
	await s.request("announcement", {
		method: "POST",
		cookie,
		body: { ...body, active: false },
	});
	assert.equal(
		(await (await s.request("announcements")).json()).announcement,
		null,
	);
});
test("OAuth requires matching one-use state and returns an HttpOnly session, never tokens in a URL", async () => {
	const s = setup();
	const login = await s.request("login"),
		url = new URL(login.headers.get("location"));
	assert.equal(url.origin, "https://accounts.google.com");
	assert.equal(url.searchParams.get("scope"), "openid email profile");
	assert.equal(url.searchParams.get("code_challenge_method"), "S256");
	const state = url.searchParams.get("state"),
		cookie = login.headers.get("set-cookie").split(";")[0];
	assert.equal(
		(await s.request("callback&state=" + state + "&code=test")).status,
		401,
	);
	const result = await s.request("callback&state=" + state + "&code=test", {
		cookie,
	});
	assert.equal(result.status, 302);
	assert.equal(result.headers.get("location"), origin + "/?google=connected");
	assert.match(
		result.headers.get("set-cookie"),
		/HttpOnly; Secure; SameSite=Lax/,
	);
	assert.equal(
		(await s.request("callback&state=" + state + "&code=test", { cookie }))
			.status,
		401,
	);
});
test("logout revokes the server session", async () => {
	const s = setup(),
		cookie = s.session();
	assert.equal(
		(await (await s.request("session", { cookie })).json()).owner,
		true,
	);
	await s.request("logout", { method: "POST", cookie, body: {} });
	assert.equal(
		(await (await s.request("session", { cookie })).json()).owner,
		false,
	);
});
test("activity requires opt-in and accepts only whitelisted metadata", async () => {
	const s = setup(),
		events = [
			{
				type: "app.open",
				target: "nebula.games",
				email: "private",
				password: "secret",
			},
		];
	assert.equal(
		(await s.request("events", { method: "POST", body: { events } })).status,
		403,
	);
	const res = await s.request("consent", {
			method: "POST",
			body: { enabled: true },
		}),
		cookie = res.headers.get("set-cookie").split(";")[0];
	assert.equal(
		(await s.request("events", { method: "POST", cookie, body: { events } }))
			.status,
		200,
	);
	const rows = [...s.data.entries()].filter(([k]) => k.startsWith("activity/"));
	assert.equal(rows.length, 1);
	assert.ok(!JSON.stringify(rows).includes("private"));
	assert.ok(!JSON.stringify(rows).includes("secret"));
	assert.throws(() =>
		sanitizeEvents([{ type: "app.open", target: "https://private.example" }]),
	);
	assert.throws(() => sanitizeEvents([{ type: "keystroke", target: "a" }]));
	await s.request("consent", {
		method: "POST",
		cookie,
		body: { enabled: false },
	});
	assert.equal(
		(await s.request("events", { method: "POST", cookie, body: { events } }))
			.status,
		403,
	);
});
test("Google .hub export carries an identity reference but discards sessions, privileges and tokens", () => {
	const text = exportHub([], {
		sub: "12345",
		email: OWNER,
		name: "Owner",
		token: "secret",
		owner: true,
		cookie: "secret",
	});
	const result = importHub(text, []);
	assert.equal(result.googleProfile.sub, "12345");
	assert.equal(result.googleProfile.email, OWNER);
	assert.ok(!text.includes("secret"));
	assert.ok(!text.includes("owner"));
	assert.equal(result.googleProfile.owner, undefined);
	assert.throws(() =>
		importHub(
			JSON.stringify({
				format: "nebulahub-account-center",
				version: 2,
				accounts: [],
				googleProfile: { sub: "../../admin", email: OWNER },
			}),
			[],
		),
	);
});
test("retention cleanup removes old batches and expired-date sessions only", async () => {
	const s = setup();
	s.data.set("activity/2026-10-01/old", {});
	s.data.set("activity/2026-10-20/current", {});
	s.data.set("sessions/2026-10-01/old", {});
	s.data.set("announcement", { text: "keep" });
	await cleanupCommunity(s.store, now);
	assert.equal(s.data.has("activity/2026-10-01/old"), false);
	assert.equal(s.data.has("sessions/2026-10-01/old"), false);
	assert.equal(s.data.has("activity/2026-10-20/current"), true);
	assert.equal(s.data.has("announcement"), true);
});
