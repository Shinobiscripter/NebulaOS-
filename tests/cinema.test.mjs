import { test } from "node:test";
import assert from "node:assert/strict";
import {
	manifestURL,
	resourceURL,
	supports,
	safeURL,
} from "../public/cinema/protocol.js";
test("Cinema validates URLs and preserves configured addon paths", () => {
	assert.equal(
		manifestURL("stremio://example.org/config/manifest.json"),
		"https://example.org/config/manifest.json",
	);
	assert.throws(() => safeURL("javascript:alert(1)"));
	assert.throws(() => manifestURL("https://example.org/configure"));
	assert.equal(
		resourceURL(
			{ url: "https://example.org/config/manifest.json" },
			"catalog",
			"movie",
			"top",
			{ search: "a/b & c" },
		),
		"https://example.org/config/catalog/movie/top/search=a%2Fb%20%26%20c.json",
	);
});
test("Cinema respects resource-specific types and ID prefixes", () => {
	const m = {
		types: ["movie"],
		idPrefixes: ["tt"],
		resources: [
			"meta",
			{ name: "stream", types: ["series"], idPrefixes: ["show:"] },
		],
	};
	assert.equal(supports(m, "meta", "movie", "tt123"), true);
	assert.equal(supports(m, "meta", "movie", "other"), false);
	assert.equal(supports(m, "stream", "series", "show:1:2"), true);
	assert.equal(supports(m, "stream", "movie", "tt123"), false);
});
