import { test } from "node:test";
import assert from "node:assert/strict";
import WebTorrent from "webtorrent";
import { createCompanion, byteRange } from "./server.mjs";
test("Byte ranges support seeking and suffixes; reject malformed requests", () => {
	assert.deepEqual(byteRange("bytes=10-19", 100), {
		start: 10,
		end: 19,
		status: 206,
	});
	assert.deepEqual(byteRange("bytes=-10", 100), {
		start: 90,
		end: 99,
		status: 206,
	});
	for (const value of [
		"bytes=100-",
		"bytes=20-10",
		"bytes=0-1,4-6",
		"bytes=-0",
		"bad",
	])
		assert.equal(byteRange(value, 100), null);
});
test(
	"Authenticated companion transfers real torrent bytes and serves seek ranges",
	{ timeout: 30000 },
	async () => {
		const token = "test-token-that-is-at-least-24-characters";
		const seeder = new WebTorrent({
			dht: false,
			tracker: false,
			lsd: false,
			natUpnp: false,
			natPmp: false,
			utp: false,
		});
		const client = new WebTorrent({
			dht: false,
			tracker: false,
			lsd: false,
			natUpnp: false,
			natPmp: false,
			utp: false,
		});
		const app = await createCompanion({
			token,
			origins: ["http://localhost:8000"],
			client,
		});
		await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
		const base = "http://127.0.0.1:" + app.server.address().port;
		try {
			const payload = Buffer.alloc(65536);
			for (let i = 0; i < payload.length; i++) payload[i] = i % 251;
			const seed = await new Promise((resolve) =>
				seeder.seed(payload, { name: "test.mp4", announce: [] }, resolve),
			);
			client.on("torrent", (t) => t.addPeer("127.0.0.1:" + seeder.torrentPort));
			// The info hash has no public tracker: explicitly attach the local seed before metadata.
			const original = client.add.bind(client);
			client.add = (...args) => {
				const t = original(...args);
				t.once("infoHash", () => t.addPeer("127.0.0.1:" + seeder.torrentPort));
				return t;
			};
			assert.equal((await fetch(base + "/health")).status, 401);
			assert.equal(
				(
					await fetch(base + "/health", {
						headers: {
							Origin: "https://untrusted.example",
							Authorization: "Bearer " + token,
						},
					})
				).status,
				403,
			);
			const headers = {
				"Content-Type": "application/json",
				Authorization: "Bearer " + token,
				Origin: "http://localhost:8000",
			};
			assert.equal(
				(
					await fetch(base + "/sessions", {
						method: "POST",
						headers,
						body: '{"infoHash":"invalid"}',
					})
				).status,
				400,
			);
			const session = await fetch(base + "/sessions", {
				method: "POST",
				headers,
				body: JSON.stringify({ infoHash: seed.infoHash }),
			});
			const data = await session.json();
			assert.equal(session.status, 200, JSON.stringify(data));
			const response = await fetch(base + data.path, {
				headers: { Range: "bytes=100-199" },
			});
			assert.equal(response.status, 206);
			assert.equal(
				response.headers.get("content-range"),
				"bytes 100-199/65536",
			);
			assert.deepEqual(
				Buffer.from(await response.arrayBuffer()),
				payload.subarray(100, 200),
			);
			assert.equal(
				(await fetch(base + data.path, { headers: { Range: "bytes=999999-" } }))
					.status,
				416,
			);
		} finally {
			await app.close();
			await new Promise((resolve) => seeder.destroy(resolve));
		}
	},
);
