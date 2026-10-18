import { resolveUpload } from "./hyprland-parser.js";
export const BRIDGES = Object.freeze({
	hyprland: "Flow window manager",
	waybar: "Flow panel",
	rofi: "Application search",
	wofi: "Application search",
	kitty: "Anura terminal",
	alacritty: "Anura terminal",
	foot: "Anura terminal",
	hyprpaper: "Nebula wallpaper manager",
	swww: "Nebula wallpaper manager",
	swaybg: "Nebula wallpaper manager",
	hyprlock: "Nebula lock screen",
});
// Compile a restricted command vocabulary to data. Never pass input to a shell.
export function compileInstaller(texts) {
	const aliases = {},
		bridges = new Set(),
		report = [],
		rejected = [];
	const clean = (p) =>
		p
			.replace(/^['"]|['"]$/g, "")
			.replace(/^(?:~|\$HOME)\/\.config\/hypr(?:\/|$)/, "")
			.replace(/^\.\//, "");
	let operations = 0;
	for (const [file, text] of Object.entries(texts)) {
		if (!/\.(sh|bash|zsh)$|(?:^|\/)(install|setup)$/.test(file)) continue;
		// Branches, functions and loops cannot be faithfully evaluated statically.
		if (
			/(^|\n)\s*(if\b|for\b|while\b|case\b|function\b|\w+\s*\(\))/m.test(text)
		) {
			rejected.push(
				`${file}: control flow requires manual review; no copy/package operations compiled.`,
			);
			continue;
		}
		for (const [index, line] of text.split(/\r?\n/).entries()) {
			const at = `${file}:${index + 1}`,
				raw = line.trim();
			if (!raw || raw.startsWith("#")) continue;
			if (++operations > 2000) throw Error("Installer exceeds 2,000 commands.");
			if (/[;&|`<>]|\$\(|\\$/.test(raw)) {
				rejected.push(`${at}: shell expressions/pipelines are unsupported.`);
				continue;
			}
			const tokens = raw.match(/"[^"\n]*"|'[^'\n]*'|[^\s]+/g) || [];
			if (tokens[0] === "sudo") tokens.shift();
			const command = tokens.shift();
			if (
				["pacman", "paru", "yay", "apt", "apt-get", "dnf"].includes(command)
			) {
				const mode = tokens.shift();
				if (!["-S", "-Sy", "-Syu", "install"].includes(mode)) {
					rejected.push(`${at}: unsupported package-manager operation.`);
					continue;
				}
				for (const name of tokens.filter((t) => !t.startsWith("-"))) {
					if (Object.hasOwn(BRIDGES, name)) {
						bridges.add(name);
						report.push(
							`${at}: ${name} → enable ${BRIDGES[name]} adapter (not the Linux binary).`,
						);
					} else rejected.push(`${at}: package ${name} has no Nebula adapter.`);
				}
			} else if (["cp", "ln"].includes(command)) {
				if (tokens.some((t) => t.startsWith("-") && !/^-[rsfRT]+$/.test(t))) {
					rejected.push(`${at}: unsupported copy/link flags.`);
					continue;
				}
				const args = tokens.filter((t) => !t.startsWith("-"));
				if (args.length !== 2) {
					rejected.push(`${at}: requires one literal source and destination.`);
					continue;
				}
				const [src, dst] = args.map(clean);
				if (
					/[$*?]/.test(src) ||
					/[$*?]|(^|\/)\.\.(\/|$)/.test(dst) ||
					/^(\/|~)/.test(dst)
				) {
					rejected.push(`${at}: unresolved or out-of-scope path.`);
					continue;
				}
				const found = resolveUpload(texts, src, file);
				const matches = found
					? [found]
					: Object.keys(texts).filter((p) =>
							p.startsWith(src.replace(/\/$/, "") + "/"),
						);
				if (!matches.length) {
					rejected.push(
						`${at}: source ${src} is not in the uploaded repository.`,
					);
					continue;
				}
				for (const path of matches) {
					if (!path.endsWith(".conf")) continue;
					const target = found
						? !dst || dst.endsWith("/")
							? dst + path.split("/").pop()
							: dst
						: [
								dst.replace(/\/$/, ""),
								path.slice(src.replace(/\/$/, "").length + 1),
							]
								.filter(Boolean)
								.join("/");
					if (!target.endsWith(".conf")) {
						rejected.push(
							`${at}: ambiguous destination ${dst}; use an explicit file or trailing slash.`,
						);
						continue;
					}
					if (Object.hasOwn(texts, target) || Object.hasOwn(aliases, target)) {
						rejected.push(`${at}: ${target} already exists; not overwritten.`);
						continue;
					}
					aliases[target] = texts[path];
					report.push(`${at}: map ${path} → virtual config ${target}`);
				}
			} else if (command === "mkdir")
				report.push(
					`${at}: virtual config directories are provided automatically.`,
				);
			else if (!["hyprctl", "swww", "swaybg"].includes(command))
				rejected.push(`${at}: command ${command} has no executable adapter.`);
		}
	}
	return { aliases, bridges: [...bridges], report, rejected };
}
