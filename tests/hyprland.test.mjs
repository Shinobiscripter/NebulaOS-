import { test } from "node:test";
import assert from "node:assert/strict";
import {
	parseHyprland,
	resolveUpload,
} from "../public/nebula/hyprland-parser.js";
test("Hyprland includes, variables, scoped values and native bindings translate in order", () => {
	const result = parseHyprland(
		{
			"dotfiles/hyprland.conf":
				"$mod = CTRL ALT\nsource = ./colors.conf\ngeneral {\ngaps_in = 8\ngaps_out = 20\ncol.active_border = $color\n}\ndecoration {\nrounding = 16\n}\nbind = $mod, 2, workspace, 2\nbind = $mod, Q, killactive,\nbind = $mod, F, fullscreen,",
			"dotfiles/colors.conf": "$color = rgba(abcdefee)",
		},
		"dotfiles/hyprland.conf",
	);
	assert.deepEqual(result.style, {
		inner: 8,
		outer: 20,
		accent: "#abcdefee",
		rounding: 16,
	});
	assert.equal(result.bindings.workspace2, "Ctrl+Alt+Digit2");
	assert.equal(result.bindings.close, "Ctrl+Alt+KeyQ");
	assert.equal(result.bindings.fullscreen, undefined); // conflicts with Flow's Float
	assert.ok(result.warnings.some((w) => w.includes("already assigned")));
});
test("Commands, CSS payloads, invalid ranges and reserved shortcuts are rejected", () => {
	const result = parseHyprland(
		{
			"hyprland.conf":
				"exec-once = fetch(https://evil)\ngeneral {\nborder_size = 999\ncol.active_border = url(https://evil)\n}\nbind = SUPER, Q, killactive,\nbind = CTRL ALT, E, exec, rm -rf /",
		},
		"hyprland.conf",
	);
	assert.deepEqual(result.style, {});
	assert.deepEqual(result.bindings, {});
	assert.equal(result.warnings.length, 5);
});
test("Include cycles and missing files are visible; no network or arbitrary disk resolution", () => {
	const files = {
		"hyprland.conf":
			"source = a.conf\nsource = https://evil/config\nsource = ../../outside.conf",
		"a.conf": "source = hyprland.conf",
	};
	const result = parseHyprland(files, "hyprland.conf");
	assert.equal(result.warnings.length, 3);
	assert.equal(
		resolveUpload({ "one/a.conf": "", "two/a.conf": "" }, "a.conf"),
		null,
	);
});
test("Limits stop expansion and repeated parsing", () => {
	assert.throws(
		() =>
			parseHyprland({ "x.conf": "x".repeat(2 * 1024 * 1024 + 1) }, "x.conf"),
		/exceeds/,
	);
	assert.throws(
		() =>
			parseHyprland(
				{
					"x.conf": "$v = 12345678\n" + Array(18).fill("$v = $v$v").join("\n"),
				},
				"x.conf",
			),
		/expansion/,
	);
});
test("Hyprpaper reference, animation toggle and unsupported options are reported", () => {
	const result = parseHyprland(
		{
			"hyprland.conf":
				"animations {\nenabled = false\n}\nmonitor = ,preferred,auto,1",
			"hyprpaper.conf": "wallpaper = ,wall.jpg",
		},
		"hyprland.conf",
	);
	assert.equal(result.wallpaper, "wall.jpg");
	assert.equal(result.style.motion, false);
	assert.equal(result.warnings.length, 1);
});
