import test from "node:test";
import assert from "node:assert/strict";
import {
	safeAccountURL,
	normalizeAccount,
	exportHub,
	importHub,
} from "../public/nebula/account-center.js";
test("online account profiles never persist supplied credentials and restrict destinations", () => {
	const account = normalizeAccount({
		service: "github",
		label: " Work ",
		handle: "pilot",
		password: "must-not-store",
		token: "must-not-store",
		url: "https://evil.test",
	});
	assert.equal(account.label, "Work");
	assert.equal(account.url, "https://github.com/");
	assert.ok(!("password" in account));
	assert.ok(!("token" in account));
	for (const url of [
		"javascript:alert(1)",
		"http://example.com",
		"https://user:secret@example.com",
	])
		assert.throws(() => safeAccountURL(url));
	assert.equal(safeAccountURL("https://example.com"), "https://example.com/");
});

test(".hub round trip preserves profiles and safely merges repeated imports", () => {
	const profile = normalizeAccount({
		service: "other",
		label: "Community",
		handle: "pilot",
		url: "https://example.com",
		favorite: true,
	});
	const text = exportHub([{ ...profile, password: "secret", token: "secret" }]);
	assert.ok(!text.includes("secret"));
	const imported = importHub(text, []);
	assert.equal(imported.added, 1);
	assert.equal(imported.rows[0].favorite, true);
	assert.equal(imported.rows[0].handle, "pilot");
	assert.notEqual(imported.rows[0].id, profile.id);
	const repeated = importHub(text, imported.rows);
	assert.equal(repeated.added, 0);
	assert.equal(repeated.skipped, 1);
	assert.deepEqual(repeated.rows, imported.rows);
});
test(".hub rejects corrupt, unsupported and unsafe files without changing existing profiles", () => {
	const existing = [normalizeAccount({ service: "github", label: "Work" })];
	const before = JSON.stringify(existing);
	for (const text of [
		"bad",
		"{}",
		JSON.stringify({
			format: "nebulahub-account-center",
			version: 2,
			accounts: [],
		}),
		JSON.stringify({
			format: "nebulahub-account-center",
			version: 1,
			accounts: [
				{ service: "other", label: "Unsafe", url: "javascript:alert(1)" },
			],
		}),
		JSON.stringify({
			format: "nebulahub-account-center",
			version: 1,
			accounts: [{ service: "__proto__", label: "Invalid" }],
		}),
		" ".repeat(1024 * 1024 + 1),
	])
		assert.throws(() => importHub(text, existing));
	assert.equal(JSON.stringify(existing), before);
});
