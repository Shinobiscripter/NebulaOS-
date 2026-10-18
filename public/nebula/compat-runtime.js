import { BRIDGES } from "./compat-installer.js";
export async function saveCompatInstallation(os, aliases, bridges) {
	if (!Object.keys(aliases).length && !bridges.length) return;
	const root = `/.nebula-compat/${crypto.randomUUID()}`;
	async function mkdir(path) {
		try {
			await os.fs.promises.mkdir(path);
		} catch (error) {
			if (error.code !== "EEXIST") throw error;
		}
	}
	await mkdir("/.nebula-compat");
	await mkdir(root);
	for (const [path, text] of Object.entries(aliases)) {
		if (
			path.startsWith("/") ||
			path.split("/").some((p) => !p || p === "." || p === "..") ||
			!path.endsWith(".conf")
		)
			throw Error("Invalid translated config path.");
		const parts = path.split("/");
		parts.pop();
		let directory = root;
		for (const part of parts) {
			directory += "/" + part;
			await mkdir(directory);
		}
		await os.fs.promises.writeFile(`${root}/${path}`, text);
	}
	await os.fs.promises.writeFile(
		`${root}/manifest.json`,
		JSON.stringify(
			{
				version: 1,
				bridges,
				files: Object.keys(aliases),
				kind: "Nebula compatibility adapters",
			},
			null,
			2,
		),
	);
	await os.settings.set("nebula.compat.installation", root);
}
export function installCompatRuntime(os) {
	const run = (name) => {
		if (
			!Object.hasOwn(BRIDGES, name) ||
			!(os.settings.get("nebula.compat.bridges") || []).includes(name)
		)
			throw Error("This compatibility adapter is not enabled.");
		if (["kitty", "alacritty", "foot"].includes(name))
			return os.apps["anura.ashell"].open();
		if (["rofi", "wofi"].includes(name))
			return window.dispatchEvent(new Event("nebula:compat-launcher"));
		if (["hyprpaper", "swww", "swaybg"].includes(name))
			return window.dispatchEvent(new Event("nebula:wallpapers"));
		if (name === "hyprexpo")
			return window.dispatchEvent(new Event("nebula:flow-overview"));
		if (name === "hypridle")
			return window.dispatchEvent(new Event("nebula:flow-extensions"));
		if (name === "hyprlock")
			return window.dispatchEvent(new Event("nebula:lock-request"));
		if (name === "waybar")
			return window.dispatchEvent(new Event("nebula:compat-dashboard"));
		return os.apps["anura.settings"].open();
	};
	// Public adapter API accepts names, not shell text, flags or code.
	window.nebulaCompat = Object.freeze({
		run,
		list: () => [...(os.settings.get("nebula.compat.bridges") || [])],
	});
}
