import test from "node:test";
import assert from "node:assert/strict";
import {
	safeAccountURL,
	normalizeAccount,
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
