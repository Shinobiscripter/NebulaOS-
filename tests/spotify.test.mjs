import { test } from "node:test";
import assert from "node:assert/strict";
import { spotifyURL } from "../public/nebula/spotify.js";
test("Spotify accepts only supported HTTPS Spotify content and strips tracking", () => {
	assert.equal(
		spotifyURL("https://open.spotify.com/track/0Lr4kGOYn9l83EjuK6cZFQ?si=abc"),
		"https://open.spotify.com/embed/track/0Lr4kGOYn9l83EjuK6cZFQ",
	);
	for (const url of [
		"javascript:alert(1)",
		"https://open.spotify.com.evil.test/track/0Lr4kGOYn9l83EjuK6cZFQ",
		"https://user:pass@open.spotify.com/track/0Lr4kGOYn9l83EjuK6cZFQ",
		"http://open.spotify.com/track/0Lr4kGOYn9l83EjuK6cZFQ",
	])
		assert.throws(() => spotifyURL(url));
});
