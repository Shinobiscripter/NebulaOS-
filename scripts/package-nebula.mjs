import {
	readFile,
	writeFile,
	mkdir,
	copyFile,
	readdir,
	stat,
} from "node:fs/promises";
import { execFileSync } from "node:child_process";
const root = "static";
await mkdir(`${root}/nebula`, { recursive: true });
await copyFile("LICENSE", `${root}/nebula/LICENSE.txt`);
await copyFile("CREDITS.md", `${root}/nebula/CREDITS.txt`);
const config = JSON.parse(await readFile("config.default.json", "utf8"));
if (process.env.NEBULA_WISP_URL) {
	const url = new URL(process.env.NEBULA_WISP_URL);
	if (!["ws:", "wss:"].includes(url.protocol))
		throw new Error("NEBULA_WISP_URL must be a WebSocket URL.");
	config.defaultsettings["wisp-url"] = url.href;
}
if (process.env.NEBULA_X86_BASE_URL) {
	const base = new URL(process.env.NEBULA_X86_BASE_URL);
	if (base.protocol !== "https:")
		throw new Error("NEBULA_X86_BASE_URL must use HTTPS and provide CORS.");
	config.x86.alpine.bzimage = new URL("alpine-boot/vmlinuz-virt", base).href;
	config.x86.alpine.initrd = new URL("alpine-boot/initramfs-virt", base).href;
	config.x86.alpine.rootfs = config.x86.alpine.rootfs.map(
		(path) => new URL(path.replace(/^\/?x86images\//, ""), base).href,
	);
}
await writeFile(`${root}/config.json`, JSON.stringify(config, null, 2));
// Explicit document/worker scopes leave /Games and /play non-isolated.
let headers = `/*\n  Cross-Origin-Opener-Policy: same-origin\n  Cross-Origin-Resource-Policy: same-origin\n  X-Content-Type-Options: nosniff\n  Cache-Control: public, max-age=0, must-revalidate\n`;
for (const path of [
	"/",
	"/index.html",
	"/apps/*",
	"/browser/*",
	"/lib/*",
	"/libs/*",
	"/fs/*",
	"/service/*",
	"/anura-sw.js",
	"/sw/*",
])
	headers += `\n${path}\n  Cross-Origin-Embedder-Policy: require-corp\n`;
headers += `\n/*.wasm\n  Content-Type: application/wasm\n\n/anura-sw.js\n  Cache-Control: no-cache\n  Service-Worker-Allowed: /\n\n/config.json\n  Cache-Control: no-cache\n\n/MILESTONE\n  Cache-Control: no-cache\n`;
await writeFile(`${root}/_headers`, headers);
// Anura's 1 GiB optional Linux disk is deliberately not part of each static deploy.
// Same-origin Netlify proxy avoids the upstream image server's absent CORS headers.
await writeFile(
	`${root}/_redirects`,
	"/x86images/alpine-boot/* https://anura.pro/x86images/alpine-boot/:splat 200\n/x86images/alpine-rootfs/* https://anura.pro/x86images/alpine-rootfs/:splat 200\n",
);
const files = [];
async function scan(dir = "") {
	for (const entry of await readdir(`${root}/${dir}`, {
		withFileTypes: true,
	})) {
		const name = dir ? `${dir}/${entry.name}` : entry.name;
		if (entry.isDirectory()) await scan(name);
		else
			files.push({ path: name, bytes: (await stat(`${root}/${name}`)).size });
	}
}
await scan();
// Include the browser bundle and Nebula app, omitted from the upstream cache list.
const precache = files
	.filter(
		(file) =>
			!/^(x86images\/|Games\/|play\/|artifacts\/)/.test(file.path) &&
			!/(\.map|\.d\.ts)$/.test(file.path) &&
			!/^(MILESTONE|COMMIT|config.json|cache-load.json|_headers|_redirects)$/.test(
				file.path,
			),
	)
	.map((file) => file.path);
await writeFile(`${root}/cache-load.json`, JSON.stringify(precache));
const report = {
	commit: execFileSync("git", ["rev-parse", "HEAD"], {
		encoding: "utf8",
	}).trim(),
	totalBytes: files.reduce((n, file) => n + file.bytes, 0),
	files: files.length,
	largest: files.sort((a, b) => b.bytes - a.bytes).slice(0, 30),
	over10MiB: files.filter((file) => file.bytes > 10 * 1024 * 1024),
	over50MiB: files.filter((file) => file.bytes > 50 * 1024 * 1024),
	optionalLinuxDiskBytes: 1073741824,
	linuxImageSource:
		process.env.NEBULA_X86_BASE_URL ||
		"https://anura.pro/x86images/ via same-origin Netlify proxy",
};
await writeFile(
	`${root}/nebula/build-report.json`,
	JSON.stringify(report, null, 2),
);
console.log(
	`Packaged ${files.length} files (${(report.totalBytes / 1024 / 1024).toFixed(1)} MiB). ${report.over50MiB.length} files exceed 50 MiB.`,
);
if (report.over50MiB.length)
	throw new Error(
		"Review oversized assets in static/nebula/build-report.json before deployment.",
	);
