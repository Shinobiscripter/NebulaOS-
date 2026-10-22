import { test } from "node:test";
import assert from "node:assert/strict";
import { youtubeID, searchTracks } from "../public/nebula/music-data.js";
test("YouTube music links accept only supported HTTPS song URLs", () => {
	assert.equal(
		youtubeID("https://music.youtube.com/watch?v=jfKfPfyJRdk&list=abc"),
		"jfKfPfyJRdk",
	);
	assert.equal(youtubeID("https://youtu.be/jfKfPfyJRdk"), "jfKfPfyJRdk");
	for (const url of [
		"https://evil.test/watch?v=jfKfPfyJRdk",
		"http://youtube.com/watch?v=jfKfPfyJRdk",
		"https://youtube.com/watch?v=bad",
		"https://user@youtube.com/watch?v=jfKfPfyJRdk",
	])
		assert.throws(() => youtubeID(url));
});
test("public search parser handles quoted braces, deduplicates and rejects missing data", () => {
	const videoRenderer = {
		videoId: "jfKfPfyJRdk",
		title: { runs: [{ text: 'A "star}" song' }] },
		ownerText: { runs: [{ text: "Artist" }] },
	};
	const html =
		"<script>var ytInitialData = " +
		JSON.stringify({ contents: [{ videoRenderer }, { videoRenderer }] }) +
		";</script>";
	assert.deepEqual(searchTracks(html), [
		{
			id: "jfKfPfyJRdk",
			title: 'A "star}" song',
			artist: "Artist",
			duration: "",
		},
	]);
	assert.throws(() => searchTracks("<html>Consent required</html>"));
});
