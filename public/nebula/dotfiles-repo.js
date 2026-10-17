// Read-only GitHub import. Remote paths and scripts are data, never executable.
export function repositoryName(value) {
	const name = value
		.trim()
		.replace(/^https:\/\/github\.com\//, "")
		.replace(/\/$/, "")
		.replace(/\.git$/, "");
	if (
		!/^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(name) ||
		name.split("/").some((p) => p === "." || p === "..")
	)
		throw Error(
			"Use a public GitHub URL or owner/repository. Put a branch or tag in the separate field.",
		);
	return name;
}
export async function limitedFetch(url, limit, signal, fetcher = fetch) {
	const response = await fetcher(url, {
		credentials: "omit",
		signal: signal
			? AbortSignal.any([signal, AbortSignal.timeout(20000)])
			: AbortSignal.timeout(20000),
		redirect: "error",
	});
	if (!response.ok)
		throw Error(
			`GitHub returned ${response.status}. Check the repository/ref, or try later if rate limited. Private repos are not supported.`,
		);
	const reader = response.body.getReader(),
		chunks = [];
	let size = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.length;
			if (size > limit)
				throw Error("Repository file exceeds the download limit.");
			chunks.push(value);
		}
	} finally {
		await reader.cancel();
	}
	return new Blob(chunks);
}
export async function scanRepository(
	value,
	ref,
	progress = () => {},
	signal,
	fetcher = fetch,
) {
	const repo = repositoryName(value),
		api = `https://api.github.com/repos/${repo}`;
	const json = async (url) =>
		JSON.parse(
			await (await limitedFetch(url, 8 * 1024 * 1024, signal, fetcher)).text(),
		);
	progress("Resolving repository revision…");
	const metadata = await json(api);
	const commit = await json(
		`${api}/commits/${encodeURIComponent(ref.trim() || metadata.default_branch)}`,
	);
	if (!/^[a-f0-9]{40}$/i.test(commit.sha))
		throw Error("GitHub returned an invalid revision.");
	const tree = await json(`${api}/git/trees/${commit.sha}?recursive=1`);
	if (tree.truncated)
		throw Error(
			"This repository is too large for a complete scan. Upload an extracted theme folder instead.",
		);
	const all = tree.tree.filter(
		(f) => f.type === "blob" && ["100644", "100755"].includes(f.mode),
	);
	const candidates = all.filter(
		(f) =>
			/(?:\.(conf|lua|css|rasi|toml|ini|json|jsonc|sh|bash|zsh|md|txt|yaml|yml)|\/(?:config|install|setup))$/i.test(
				f.path,
			) && !/(^|\/)(node_modules|vendor|\.git)\//.test(f.path),
	);
	candidates.sort(
		(a, b) =>
			Number(!/hyprland\.conf$/.test(a.path)) -
				Number(!/hyprland\.conf$/.test(b.path)) || a.path.localeCompare(b.path),
	);
	const texts = {},
		notes = [],
		images = {};
	let total = 0,
		count = 0;
	for (const f of candidates) {
		if (
			count >= 120 ||
			f.size > 256 * 1024 ||
			total + f.size > 2 * 1024 * 1024
		) {
			notes.push(`Not scanned (size/file limit): ${f.path}`);
			continue;
		}
		progress(`Scanning ${++count}: ${f.path}`);
		const url = `https://raw.githubusercontent.com/${repo}/${commit.sha}/${f.path.split("/").map(encodeURIComponent).join("/")}`;
		const blob = await limitedFetch(url, 256 * 1024, signal, fetcher);
		total += blob.size;
		if (total > 2 * 1024 * 1024)
			throw Error("Repository text exceeds 2 MiB. Use a smaller theme folder.");
		texts[f.path] = await blob.text();
	}
	for (const f of all.filter(
		(f) => /\.(png|jpe?g|webp)$/i.test(f.path) && f.size <= 12 * 1024 * 1024,
	))
		images[f.path] = {
			url: `https://raw.githubusercontent.com/${repo}/${commit.sha}/${f.path.split("/").map(encodeURIComponent).join("/")}`,
		};
	notes.unshift(
		`${repo} @ ${commit.sha.slice(0, 12)}: scanned ${count} text files; ${Object.keys(images).length} eligible images (downloaded only when chosen).`,
	);
	return { texts, images, notes, revision: commit.sha };
}

// Recognize only literal cosmetic declarations. Report shell semantics instead of
// attempting to infer the output of arbitrary programs, substitutions or branches.
export function analyzeDotfiles(texts) {
	const palettes = [],
		commands = [],
		inferred = [],
		warnings = [];
	const color = (s) => (/^#[a-f0-9]{6}$/i.test(s) ? s.toLowerCase() : null);
	for (const [path, text] of Object.entries(texts)) {
		if (
			/\.(css|rasi|conf|lua|toml|ini|jsonc?|ya?ml)$|(?:^|\/)config$/i.test(path)
		) {
			const values = {},
				evidence = [];
			for (const [index, line] of text.split(/\r?\n/).entries()) {
				// Kitty, terminal INI/TOML, rofi and Waybar named color declarations.
				const normalizedLine = line
					.replace(/^\s*[A-Za-z_]\w*\./, "")
					.replace(/rgba?\(([a-f0-9]{6})(?:[a-f0-9]{2})?\)/gi, "#$1");
				const match = normalizedLine.match(
					/^\s*(?:@define-color\s+|\$|--)?["']?([\w-]+)["']?\s*(?:[:=]\s*|\s+)["']?(#[a-f0-9]{6})\b/i,
				);
				if (!match || !color(match[2])) continue;
				const id = {
					background: "background",
					bg: "background",
					base: "background",
					foreground: "foreground",
					fg: "foreground",
					text: "foreground",
					surface: "surface",
					surface0: "surface",
					accent: "accent",
					primary: "accent",
					color4: "accent",
					blue: "accent",
					muted: "muted",
					comment: "muted",
				}[match[1].toLowerCase()];
				if (typeof id === "string") {
					values[id] = color(match[2]);
					evidence.push(`${path}:${index + 1} ${match[1]} = ${values[id]}`);
				}
			}
			if (Object.keys(values).length >= 2)
				palettes.push({ path, values, evidence });
		}
		if (!/\.(sh|bash|zsh|md)$|(?:^|\/)(install|setup)$/i.test(path)) continue;
		let fenced = !/\.md$/i.test(path);
		for (const [index, raw] of text.split(/\r?\n/).entries()) {
			if (/^```/.test(raw)) {
				fenced = !fenced;
				continue;
			}
			const line = raw.trim();
			if (!fenced || !line || line.startsWith("#")) continue;
			const at = `${path}:${index + 1}`;
			if (/[;|`]|\$\(/.test(line))
				commands.push(
					`${at} - Dynamic or chained shell command; its complete result cannot be determined statically. Not executed.\n  ${line}`,
				);
			else if (/^(?:sudo\s+)?(?:cp|ln|install|stow)\s/.test(line))
				commands.push(
					`${at} — Copies/links config files into a Linux installation. Inspect the matching repository files; no filesystem command will run.\n  ${line}`,
				);
			else if (
				/^(?:sudo\s+)?(?:pacman|paru|yay|apt|dnf|nix|flatpak|pip|npm)\s/.test(
					line,
				)
			)
				commands.push(
					`${at} — Installs native packages; unavailable in the web desktop.\n  ${line}`,
				);
			else if (/\b(curl|wget|eval|bash|source|sh)\b|[;|`]|\$\(/.test(line))
				commands.push(
					`${at} — Dynamic command or downloaded code; cannot determine its cosmetic result statically. Not executed or fetched.\n  ${line}`,
				);
			else {
				const keyword = line.match(
					/^hyprctl\s+keyword\s+((?:general|decoration|animations):[\w.]+)\s+(.+)$/,
				);
				const wallpaper = line.match(
					/^(?:swww\s+img|swaybg\s+-i)\s+["']?([^"'\s$]+)["']?$/,
				);
				if (keyword && !/[$`;&|]/.test(keyword[2])) {
					inferred.push(`${keyword[1]} = ${keyword[2]}`);
					commands.push(
						`${at} — Candidate Hyprland cosmetic setting (may be conditional): ${keyword[1]} = ${keyword[2]}`,
					);
				} else if (wallpaper) {
					inferred.push(`wallpaper = ,${wallpaper[1]}`);
					commands.push(
						`${at} — Candidate wallpaper (may be conditional): ${wallpaper[1]}`,
					);
				} else if (/^(?:gsettings|dconf)\s/.test(line))
					commands.push(
						`${at} — Changes a native GTK/desktop preference; inspect included palette files for a web equivalent.\n  ${line}`,
					);
				else if (!/^(```|fi\b|then\b|else\b|done\b|\}|\w+=)/.test(line))
					warnings.push(
						`${at}: Unresolved installer logic: ${line.slice(0, 180)}`,
					);
			}
		}
	}
	return { palettes, commands, inferred, warnings };
}
