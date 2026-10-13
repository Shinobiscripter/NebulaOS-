// A narrow, checked build-time adapter keeps the browser submodule revision intact.
// Reapply after submodule update; fail explicitly when upstream changes these anchors.
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const path = "external/anura-browserjs/packages/chrome/src/index.ts";
const current = (await readFile(path, "utf8")).replaceAll("\r\n", "\n");
let source = execFileSync(
	"git",
	[
		"-C",
		"external/anura-browserjs",
		"show",
		"HEAD:packages/chrome/src/index.ts",
	],
	{ encoding: "utf8" },
).replaceAll("\r\n", "\n");
if (current !== source && !current.includes("// Nebula Spotify widget adapter"))
	throw new Error(
		"Unrecognized local browser modifications; preserve/review them before applying the widget adapter.",
	);
{
	const replace = (before, after) => {
		if (!source.includes(before))
			throw new Error(
				`Browser widget adapter needs upstream review: ${before}`,
			);
		source = source.replace(before, after);
	};
	replace(
		"await loadServices();",
		`// Nebula Spotify widget adapter
const widgetURL = loc.searchParams.get("nebulaSpotify");
const nebulaWidget = !!widgetURL && /^https:\\/\\/open\\.spotify\\.com\\/embed\\/(track|album|playlist|artist|show|episode)\\/[a-zA-Z0-9]{22}$/.test(widgetURL);
await loadServices();`,
	);
	replace(
		"let saving = false;",
		"if (nebulaWidget) return;\n\tlet saving = false;",
	);
	replace(
		"let version;",
		'if (nebulaWidget) kv.prefix = "nebula-spotify-widget-";\n\t\tlet version;',
	);
	replace(
		"mount();",
		`const mounted = await mount();
if (nebulaWidget) {
 mounted.classList.add("nebula-spotify-browser");
 const style = document.createElement("style");
 style.textContent = ".nebula-spotify-browser > :not(#main), .nebula-spotify-browser #main > :not(:last-child) {display:none!important} .nebula-spotify-browser, .nebula-spotify-browser #main {width:100%!important;height:100%!important;padding:0!important;margin:0!important}";
 document.head.append(style);
 tabsService.newTab(new URL(widgetURL!));
}`,
	);
	if (current !== source) await writeFile(path, source);
}
