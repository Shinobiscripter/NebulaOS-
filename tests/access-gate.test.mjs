import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createAccessGate } from "../netlify/lib/access-gate.mjs";
test("edge gate blocks anonymous, expired and banned access to documents and raw assets", async () => {
	const hash = (text) => createHash("sha256").update(text).digest("hex");
	const token = "2026-10-21." + "a".repeat(64),
		now = Date.now();
	const records = new Map();
	const gate = createAccessGate(
		{ get: async (key) => records.get(key) },
		() => now,
	);
	let passes = 0;
	const next = async () => {
		passes++;
		return new Response("private asset");
	};
	const req = (path) =>
		new Request("https://nebula.test" + path, {
			headers: { cookie: "__Host-nebula-session=" + token },
		});
	assert.equal(
		(await gate(new Request("https://nebula.test/"), next)).status,
		401,
	);
	assert.equal((await gate(req("/Games/example.html"), next)).status, 401);
	const session = {
		expires: now + 1000,
		user: { sub: "visitor", email: "visitor@example.com", verified: true },
	};
	records.set("sessions/2026-10-21/" + hash(token), session);
	const success = await gate(req("/index.html"), next);
	assert.equal(success.status, 200);
	assert.equal(success.headers.get("Cache-Control"), "private, no-store");
	records.set("restrictions/" + hash("visitor"), {
		kind: "banned",
		reason: "<script>unsafe</script>",
	});
	const denied = await gate(req("/anura.js"), next);
	assert.equal(denied.status, 403);
	assert.ok(!(await denied.text()).includes("<script>unsafe"));
	assert.equal(passes, 1);
	records.set("restrictions/" + hash("visitor"), {
		kind: "suspended",
		until: now - 1,
	});
	assert.equal((await gate(req("/"), next)).status, 200);
	session.expires = now - 1;
	assert.equal((await gate(req("/"), next)).status, 401);
});
test("edge gate fails closed on storage failure", async () => {
	const gate = createAccessGate({
		get: async () => {
			throw Error("offline");
		},
	});
	const req = new Request("https://nebula.test/", {
		headers: { cookie: "__Host-nebula-session=2026-10-21." + "a".repeat(64) },
	});
	assert.equal((await gate(req, () => new Response("bad"))).status, 503);
});
