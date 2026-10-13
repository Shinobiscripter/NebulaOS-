import http from "node:http";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";

const origins = new Set(
	(
		process.env.ALLOWED_ORIGINS ||
		"https://nebulahub-shinobiscripter.netlify.app"
	)
		.split(",")
		.map((x) => x.trim()),
);
// Keep the relay limited to web traffic and exclude private/loopback destinations.
Object.assign(wisp.options, {
	allow_private_ips: false,
	allow_loopback_ips: false,
	allow_direct_ip: false,
	allow_udp_streams: false,
	port_whitelist: [80, 443],
	stream_limit_total: 96,
	stream_limit_per_host: 24,
});
logging.set_level(logging.ERROR);
const server = http.createServer((req, res) => {
	res.writeHead(req.url === "/health" || req.url === "/" ? 200 : 404, {
		"Content-Type": "text/plain",
		"Cache-Control": "no-store",
	});
	res.end(
		req.url === "/health" || req.url === "/"
			? "NebulaHub Wisp relay ready\n"
			: "Not found\n",
	);
});
let active = 0;
server.on("upgrade", (req, socket, head) => {
	if (req.url !== "/wisp/" || !origins.has(req.headers.origin)) {
		socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
		return;
	}
	if (active >= 100) {
		socket.end("HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n");
		return;
	}
	active++;
	socket.once("close", () => active--);
	wisp.routeRequest(req, socket, head);
});
server.listen(Number(process.env.PORT || 10000), "0.0.0.0", () =>
	console.log("NebulaHub relay listening"),
);
