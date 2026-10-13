// A narrow, checked build-time adapter keeps the browser submodule revision intact.
// Reapply after submodule update; fail explicitly when upstream changes these anchors.
import { readFile, writeFile } from "node:fs/promises";
const path = "external/anura-browserjs/packages/chrome/src/index.ts";
let source = await readFile(path, "utf8");
if (!source.includes("// Nebula Spotify widget adapter")) {
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
 const main = mounted.querySelector<HTMLElement>("#main")!;
 const shell = main.lastElementChild as HTMLElement;
 mounted.replaceChildren(main);
 main.replaceChildren(shell);
 main.style.cssText = "width:100%;height:100%;padding:0;margin:0";
 shell.style.cssText = "width:100%;height:100%;flex:1";
 const tab = tabsService.newTab(new URL(widgetURL!));
 for (const other of [...tabsService.tabs]) if (other !== tab) tabsService.destroyTab(other);
}`,
	);
	await writeFile(path, source);
}
