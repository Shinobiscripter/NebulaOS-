// A declarative compatibility translator, never a shell/config interpreter.
import { DEFAULT_BINDINGS, bindingError } from "./keybinds.js";
export const LIMITS = { files: 256, text: 2 * 1024 * 1024, lines: 20000 };
const clean = (path) =>
	path
		.replace(/\\/g, "/")
		.replace(/^~\/\.config\/hypr\//, "")
		.replace(/^\.\//, "");
export function resolveUpload(files, request, from = "") {
	const raw = clean(request.replace(/^['"]|['"]$/g, ""));
	const joined = `${from.includes("/") ? from.slice(0, from.lastIndexOf("/") + 1) : ""}${raw}`;
	const normalize = (s) => {
		const parts = [];
		for (const p of s.split("/")) {
			if (p === "..") {
				if (!parts.length) return null;
				parts.pop();
			} else if (p && p !== ".") parts.push(p);
		}
		return parts.join("/");
	};
	const relative = normalize(joined);
	if (relative && Object.hasOwn(files, relative)) return relative;
	if (Object.hasOwn(files, raw)) return raw;
	if (raw.includes("..") || /^(https?:|data:)/i.test(raw)) return null;
	const matches = Object.keys(files).filter(
		(p) =>
			p.endsWith("/" + raw) ||
			(!raw.includes("/") && p.split("/").pop() === raw),
	);
	return matches.length === 1 ? matches[0] : null;
}
export function parseHyprland(files, entry, existing = DEFAULT_BINDINGS) {
	const names = Object.keys(files);
	if (
		names.length > LIMITS.files ||
		names.reduce((n, k) => n + files[k].length, 0) > LIMITS.text
	)
		throw Error("Config upload exceeds 256 files or 2 MiB of text.");
	if (!Object.hasOwn(files, entry))
		throw Error("Choose an uploaded entry config.");
	const result = {
		style: {},
		bindings: {},
		warnings: [],
		applied: [],
		wallpaper: null,
		visited: [],
	};
	const vars = new Map(),
		stack = [],
		effective = { ...DEFAULT_BINDINGS, ...existing };
	let lines = 0;
	const warn = (at, message) => result.warnings.push(`${at}: ${message}`);
	const expand = (value) => {
		for (let n = 0; n < 16 && /\$[\w]+/.test(value); n++) {
			const next = value.replace(
				/\$([\w]+)/g,
				(all, key) => vars.get(key) ?? all,
			);
			if (next === value) break;
			value = next;
			if (value.length > 8192)
				throw Error("Variable expansion exceeds the limit.");
		}
		return value;
	};
	function parse(path, depth = 0) {
		if (depth > 16 || stack.includes(path)) {
			warn(path, "Recursive include skipped.");
			return;
		}
		stack.push(path);
		result.visited.push(path);
		const blocks = [];
		for (const [index, raw] of files[path].split(/\r?\n/).entries()) {
			if (++lines > LIMITS.lines)
				throw Error("Config exceeds the processing limit.");
			const at = `${path}:${index + 1}`,
				line = raw.replace(/#.*$/, "").trim();
			if (!line) continue;
			if (/^[\w.]+\s*\{$/.test(line)) {
				blocks.push(line.slice(0, -1).trim());
				continue;
			}
			if (line === "}") {
				if (!blocks.pop()) warn(at, "Unmatched closing block.");
				continue;
			}
			const match = line.match(/^([\w.$:-]+)\s*=\s*(.*)$/);
			if (!match) {
				warn(at, "Unsupported syntax; use one assignment per line.");
				continue;
			}
			const [, key, original] = match,
				value = expand(original);
			if (key.startsWith("$")) {
				vars.set(key.slice(1), value);
				continue;
			}
			const full = [...blocks, key].join(":");
			if (key === "source") {
				if (value.includes("*")) {
					warn(
						at,
						"Wildcard includes are not imported; select explicit source files.",
					);
					continue;
				}
				const target = resolveUpload(files, value, path);
				if (target) parse(target, depth + 1);
				else warn(at, `Include not found or ambiguous: ${value}`);
				continue;
			}
			if (full === "general:layout") {
				if (["master", "dwindle", "grid"].includes(value)) {
					result.style.layout = value;
					result.applied.push(`Flow layout: ${value}`);
				} else warn(at, "Unsupported layout.");
				continue;
			}
			if (key === "bezier") {
				const [name, ...points] = value.split(",").map((x) => x.trim()),
					nums = points.map(Number);
				if (
					/^[\w-]+$/.test(name) &&
					nums.length === 4 &&
					nums.every(Number.isFinite) &&
					nums[0] >= 0 &&
					nums[0] <= 1 &&
					nums[2] >= 0 &&
					nums[2] <= 1 &&
					Math.abs(nums[1]) <= 4 &&
					Math.abs(nums[3]) <= 4
				) {
					result.style.curves = {
						...(result.style.curves || {}),
						[name]: nums,
					};
					result.applied.push(`Bezier curve: ${name}`);
				} else
					warn(at, "Invalid cubic Bezier (x must be 0�1, y between -4 and 4).");
				continue;
			}
			if (key === "animation") {
				const [leaf, on, speed, curve = "default", style = "popin"] = value
					.split(",")
					.map((x) => x.trim());
				if (
					[
						"global",
						"windows",
						"windowsIn",
						"windowsMove",
						"workspaces",
					].includes(leaf) &&
					["0", "1"].includes(on) &&
					(on === "0" || (Number(speed) > 0 && Number(speed) <= 20)) &&
					["popin", "slide", "fade"].includes(style) &&
					/^[\w-]+$/.test(curve)
				) {
					result.style.animations = {
						...(result.style.animations || {}),
						[leaf]: {
							enabled: on === "1",
							duration: on === "0" ? 0 : Number(speed) * 100,
							curve,
							style,
						},
					};
					result.applied.push(
						`Animation ${leaf}: ${on === "0" ? "off" : Number(speed) * 100 + "ms / " + style}`,
					);
				} else
					warn(
						at,
						"Unsupported animation leaf/style or duration (maximum 2 seconds).",
					);
				continue;
			}
			const numeric = {
				__proto__: null,
				"master:mfact": ["mfact", 0.1, 0.9],
				"general:gaps_in": ["inner", 0, 48],
				"general:gaps_out": ["outer", 0, 64],
				"general:border_size": ["border", 0, 8],
				"decoration:rounding": ["rounding", 0, 40],
				"decoration:active_opacity": ["opacity", 0.4, 1],
			}[full];
			if (numeric) {
				const [id, min, max] = numeric,
					n = Number(value);
				if (!value || !Number.isFinite(n) || n < min || n > max)
					warn(at, `Expected a single number between ${min} and ${max}.`);
				else {
					result.style[id] = n;
					result.applied.push(`${full} → ${n}`);
				}
				continue;
			}
			if (
				["general:col.active_border", "general:col.inactive_border"].includes(
					full,
				)
			) {
				const color = value.match(
					/^rgba?\(([\da-f]{6}(?:[\da-f]{2})?)\)(.*)$/i,
				);
				if (color) {
					result.style[full.includes("inactive") ? "inactive" : "accent"] =
						"#" + color[1];
					result.applied.push(`${full} → #${color[1]}`);
					if (color[2].trim())
						warn(at, "Border gradient simplified to its first color.");
				} else warn(at, "Supported colors are rgb(RRGGBB) and rgba(RRGGBBAA).");
				continue;
			}
			if (full === "animations:enabled") {
				if (/^(true|yes|on|1|false|no|off|0)$/i.test(value)) {
					result.style.motion = /^(true|yes|on|1)$/i.test(value);
					result.applied.push(
						`Flow animations → ${result.style.motion ? "on" : "off"}`,
					);
				} else warn(at, "Invalid animation toggle.");
				continue;
			}
			if (key === "wallpaper" && !blocks.length) {
				result.wallpaper = value.split(",").slice(1).join(",").trim();
				result.applied.push(`Wallpaper reference → ${result.wallpaper}`);
				continue;
			}
			if (key === "bind" && !blocks.length) {
				const [mods, keyName, dispatcher, arg = ""] = value
					.split(",")
					.map((s) => s.trim());
				const action =
					dispatcher === "exec" &&
					Object.hasOwn(
						{
							kitty: 1,
							alacritty: 1,
							foot: 1,
							"rofi -show drun": 1,
							"wofi --show drun": 1,
							thunar: 1,
							dolphin: 1,
							firefox: 1,
							hyprlock: 1,
						},
						arg,
					)
						? {
								kitty: "terminal",
								alacritty: "terminal",
								foot: "terminal",
								"rofi -show drun": "apps",
								"wofi --show drun": "apps",
								thunar: "files",
								dolphin: "files",
								firefox: "browser",
								hyprlock: "lock",
							}[arg]
						: dispatcher === "workspace" && /^[1-4]$/.test(arg)
							? `workspace${arg}`
							: ["movetoworkspace", "movetoworkspacesilent"].includes(
										dispatcher,
								  ) && /^[1-4]$/.test(arg)
								? `move${arg}`
								: {
										__proto__: null,
										killactive: "close",
										fullscreen: "fullscreen",
										togglesplit: "tile",
									}[dispatcher];
				const tokens = (mods || "")
					.toUpperCase()
					.replace(/SUPER/g, "META")
					.replace(/CONTROL/g, "CTRL")
					.split(/[\s+_|]+/)
					.filter(Boolean);
				const code = /^[a-z]$/i.test(keyName || "")
					? `Key${keyName.toUpperCase()}`
					: /^\d$/.test(keyName || "")
						? `Digit${keyName}`
						: {
								__proto__: null,
								space: "Space",
								return: "Enter",
								escape: "Escape",
								tab: "Tab",
								left: "ArrowLeft",
								right: "ArrowRight",
								up: "ArrowUp",
								down: "ArrowDown",
							}[keyName?.toLowerCase()];
				const chord = [
					["CTRL", "Ctrl"],
					["ALT", "Alt"],
					["SHIFT", "Shift"],
					["META", "Meta"],
				]
					.filter(([k]) => tokens.includes(k))
					.map(([, k]) => k)
					.concat(code || "")
					.join("+");
				const error = !action
					? "Dispatcher is not supported (commands are never executed)."
					: !code ||
						  tokens.some((t) => !["CTRL", "ALT", "SHIFT", "META"].includes(t))
						? "Unsupported key or modifier."
						: bindingError(chord, effective, action);
				if (error) warn(at, error);
				else {
					result.bindings[action] = chord;
					effective[action] = chord;
					result.applied.push(`${action} → ${chord}`);
					if (dispatcher === "movetoworkspacesilent")
						warn(at, "Flow also switches to the destination workspace.");
					if (dispatcher === "togglesplit")
						warn(at, "Mapped to Flow grid tiling.");
				}
				continue;
			}
			warn(
				at,
				`${full} is not supported${/exec/.test(key) ? "; command ignored" : ""}.`,
			);
		}
		if (blocks.length) warn(path, "Unclosed config block.");
		stack.pop();
	}
	parse(entry);
	for (const name of names.filter(
		(n) => /(^|\/)hyprpaper\.conf$/.test(n) && !result.visited.includes(n),
	))
		parse(name);
	for (const [leaf, item] of Object.entries(result.style.animations || {}))
		if (
			item.curve !== "default" &&
			!Object.hasOwn(result.style.curves || {}, item.curve)
		)
			warn(
				entry,
				`Animation ${leaf}: missing curve ${item.curve}; using Flow default.`,
			);
	return result;
}
