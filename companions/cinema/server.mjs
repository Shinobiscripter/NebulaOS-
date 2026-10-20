import http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import WebTorrent from "webtorrent";

export function byteRange(header, length) {
	if (!header) return { start: 0, end: length - 1, status: 200 };
	const m = /^bytes=(\d*)-(\d*)$/.exec(header);
	if (!m || (!m[1] && !m[2])) return null;
	const start = m[1] ? Number(m[1]) : Math.max(0, length - Number(m[2]));
	const end = m[1]
		? m[2]
			? Math.min(Number(m[2]), length - 1)
			: length - 1
		: length - 1;
	return Number.isSafeInteger(start) &&
		Number.isSafeInteger(end) &&
		start >= 0 &&
		end >= start &&
		start < length
		? { start, end, status: 206 }
		: null;
}
export async function createCompanion({
	token,
	origins = [],
	client = new WebTorrent({ maxConns: 30, natUpnp: false, natPmp: false }),
	maxBytes = 2 * 1024 ** 3,
} = {}) {
	if (!token || token.length < 24)
		throw new Error("CINEMA_TOKEN must be at least 24 characters.");
	const directory = await mkdtemp(join(tmpdir(), "nebula-cinema-"));
	let current = null,
		busy = false,
		lastUsed = Date.now();
	const streams = new Set();
	const authorized = (req) => {
		const actual = Buffer.from(req.headers.authorization || "");
		const expected = Buffer.from("Bearer " + token);
		return (
			actual.length === expected.length && timingSafeEqual(actual, expected)
		);
	};
	async function clear() {
		for (const s of streams) s.destroy();
		streams.clear();
		if (current) {
			const torrent = current.torrent;
			current = null;
			await new Promise((resolve) =>
				torrent.destroy({ destroyStore: true }, resolve),
			);
		}
	}
	const timer = setInterval(() => {
		if (!busy && !streams.size && Date.now() - lastUsed > 15 * 60000)
			clear().catch(() => {});
	}, 60000);
	timer.unref();
	const server = http.createServer(async (req, res) => {
		res.setHeader("Cache-Control", "no-store");
		res.setHeader("Referrer-Policy", "no-referrer");
		res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
		const origin = req.headers.origin;
		if (origin && !origins.includes(origin)) {
			res.writeHead(403).end();
			return;
		}
		if (origin) {
			res.setHeader("Access-Control-Allow-Origin", origin);
			res.setHeader("Vary", "Origin");
			res.setHeader(
				"Access-Control-Allow-Headers",
				"Authorization, Content-Type, Range",
			);
			res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
			res.setHeader("Access-Control-Allow-Private-Network", "true");
		}
		if (req.method === "OPTIONS") {
			res.writeHead(204).end();
			return;
		}
		const reply = (status, data) => {
			if (!res.headersSent) {
				res.writeHead(status, { "Content-Type": "application/json" });
				res.end(JSON.stringify(data));
			}
		};
		try {
			const url = new URL(req.url, "http://localhost");
			if (url.pathname === "/health") {
				if (!authorized(req))
					return reply(401, { error: "Access token required." });
				return reply(200, { ok: true, name: "Nebula Cinema companion" });
			}
			if (url.pathname === "/sessions" && req.method === "POST") {
				if (!authorized(req))
					return reply(401, { error: "Access token required." });
				if (busy)
					return reply(409, { error: "Another torrent is being prepared." });
				let body = "";
				for await (const chunk of req) {
					body += chunk;
					if (body.length > 4096)
						return reply(413, { error: "Request too large." });
				}
				let data;
				try {
					data = JSON.parse(body);
				} catch {
					return reply(400, { error: "Invalid JSON." });
				}
				if (
					!/^[a-f0-9]{40}$/i.test(data.infoHash) ||
					!(
						data.fileIdx === undefined ||
						(Number.isSafeInteger(data.fileIdx) && data.fileIdx >= 0)
					)
				)
					return reply(400, {
						error: "Expected a v1 infoHash and optional nonnegative fileIdx.",
					});
				busy = true;
				try {
					await clear();
					const torrent = client.add(data.infoHash, { path: directory });
					current = {
						torrent,
						id: randomBytes(24).toString("hex"),
						file: null,
					};
					// Install before metadata: an emitted torrent error must never crash the process.
					torrent.on("error", () => {});
					await new Promise((resolve, reject) => {
						const timeout = setTimeout(
							() =>
								finish(
									new Error(
										"Torrent metadata timed out. Check peers and network connectivity.",
									),
								),
							60000,
						);
						const finish = (error) => {
							clearTimeout(timeout);
							torrent.off("ready", ready);
							torrent.off("error", finish);
							error ? reject(error) : resolve();
						};
						const ready = () => finish();
						torrent.once("ready", ready);
						torrent.once("error", finish);
						if (torrent.ready) finish();
					});
					for (const file of torrent.files) file.deselect();
					if (torrent.length > maxBytes)
						throw new Error("Torrent exceeds the configured size limit.");
					const file =
						data.fileIdx === undefined
							? [...torrent.files]
									.filter((f) => /\.(mp4|webm|m4v|ogg)$/i.test(f.name))
									.sort((a, b) => b.length - a.length)[0]
							: torrent.files[data.fileIdx];
					if (!file) throw new Error("No playable file found at this index.");
					if (!/\.(mp4|webm|m4v|ogg)$/i.test(file.name))
						throw new Error(
							"This companion supports MP4, WebM and Ogg without transcoding. Choose another source.",
						);
					current.file = file;
					lastUsed = Date.now();
					reply(200, {
						path: "/media/" + current.id,
						name: file.name,
						size: file.length,
					});
				} catch (error) {
					await clear();
					reply(422, { error: error.message });
				} finally {
					busy = false;
				}
				return;
			}
			if (
				current?.file &&
				url.pathname === "/media/" + current.id &&
				["GET", "HEAD"].includes(req.method)
			) {
				lastUsed = Date.now();
				const file = current.file;
				const range = byteRange(req.headers.range, file.length);
				if (!range) {
					res
						.writeHead(416, { "Content-Range": `bytes */${file.length}` })
						.end();
					return;
				}
				const headers = {
					"Content-Type": /\.webm$/i.test(file.name)
						? "video/webm"
						: /\.ogg$/i.test(file.name)
							? "video/ogg"
							: "video/mp4",
					"Accept-Ranges": "bytes",
					"Content-Length": range.end - range.start + 1,
				};
				if (range.status === 206)
					headers["Content-Range"] =
						`bytes ${range.start}-${range.end}/${file.length}`;
				res.writeHead(range.status, headers);
				if (req.method === "HEAD") {
					res.end();
					return;
				}
				const stream = file.createReadStream({
					start: range.start,
					end: range.end,
				});
				streams.add(stream);
				const timeout = setTimeout(
					() => stream.destroy(new Error("Stream stalled.")),
					120000,
				);
				stream.on("data", () => {
					lastUsed = Date.now();
					timeout.refresh();
				});
				stream.on("error", () => res.destroy());
				stream.on("close", () => {
					clearTimeout(timeout);
					streams.delete(stream);
				});
				res.on("close", () => stream.destroy());
				stream.pipe(res);
				return;
			}
			reply(404, { error: "Not found." });
		} catch (error) {
			reply(500, { error: "Companion request failed." });
		}
	});
	client.on("error", () => {});
	return {
		server,
		client,
		async close() {
			clearInterval(timer);
			await clear();
			await new Promise((resolve) => server.close(resolve));
			await new Promise((resolve) => client.destroy(resolve));
			await rm(directory, { recursive: true, force: true });
		},
	};
}
if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	const token = process.env.CINEMA_TOKEN || randomBytes(32).toString("hex");
	const origins = (
		process.env.CINEMA_ORIGINS ||
		"https://nebulahub-shinobiscripter.netlify.app,https://nebula-cinema-shinobiscripter.netlify.app,http://localhost:8000"
	)
		.split(",")
		.map((s) => s.trim());
	const app = await createCompanion({ token, origins });
	const port = Number(process.env.PORT || 8787);
	const host = process.env.HOST || "127.0.0.1";
	app.server.listen(port, host, () => {
		console.log(`Nebula Cinema companion: http://${host}:${port}`);
		if (!process.env.CINEMA_TOKEN)
			console.log(`Paste this temporary access token into Cinema: ${token}`);
	});
	for (const signal of ["SIGINT", "SIGTERM"])
		process.on(signal, () => app.close().then(() => process.exit()));
}
