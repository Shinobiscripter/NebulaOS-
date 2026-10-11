import http from "node:http";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createRequire } from "node:module";
const require = createRequire(
	new URL("../server/package.json", import.meta.url),
);
const { server: wisp } = require("@mercuryworkshop/wisp-js/server");
const root = resolve(process.argv[2] || "static");
const port = Number(process.env.PORT || 8000);
const rules = [];
for (const line of (await readFile(`${root}/_headers`, "utf8")).split("\n")) {
	if (line.startsWith("/"))
		rules.push({
			pattern: new RegExp(
				`^${line
					.trim()
					.split("*")
					.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
					.join(".*")}$`,
			),
			headers: {},
		});
	else if (line.trim() && rules.length) {
		const i = line.indexOf(":");
		rules.at(-1).headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
	}
}
const types = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".wasm": "application/wasm",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".txt": "text/plain; charset=utf-8",
};
const server = http.createServer(async (req, res) => {
	try {
		const pathname = decodeURIComponent(
			new URL(req.url, "http://localhost").pathname,
		);
		for (const rule of rules)
			if (rule.pattern.test(pathname))
				for (const [key, value] of Object.entries(rule.headers))
					res.setHeader(key, value);
		if (/^\/x86images\/alpine-(boot|rootfs)\//.test(pathname)) {
			const remote = await fetch(`https://anura.pro${pathname}`, {
				method: req.method === "HEAD" ? "HEAD" : "GET",
			});
			res.statusCode = remote.status;
			res.setHeader("Content-Type", "application/octet-stream");
			if (remote.headers.get("content-length"))
				res.setHeader("Content-Length", remote.headers.get("content-length"));
			if (req.method === "HEAD" || !remote.body) res.end();
			else await pipeline(Readable.fromWeb(remote.body), res);
			return;
		}
		let path = resolve(root, `.${pathname}`);
		if (path !== root && !path.startsWith(root + sep)) {
			res.writeHead(403).end();
			return;
		}
		let info = await stat(path);
		if (info.isDirectory()) {
			path = resolve(path, "index.html");
			info = await stat(path);
		}
		res.setHeader(
			"Content-Type",
			types[extname(path)] || "application/octet-stream",
		);
		res.setHeader("Content-Length", info.size);
		if (req.method === "HEAD") res.end();
		else await pipeline(createReadStream(path), res);
	} catch (error) {
		if (!res.headersSent)
			res.writeHead(error.code === "ENOENT" ? 404 : 500, {
				"Content-Type": "text/plain",
			});
		res.end(error.code === "ENOENT" ? "Not found" : "Request failed");
	}
});
server.on("upgrade", (request, socket, head) =>
	wisp.routeRequest(request, socket, head),
);
server.listen(port, "127.0.0.1", () =>
	console.log(
		`NebulaHub production preview: http://localhost:${port} (${root})`,
	),
);
