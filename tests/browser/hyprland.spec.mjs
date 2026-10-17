import { test, expect } from "@playwright/test";
test("Dotfiles import previews, applies, persists and undoes real Flow settings", async ({
	page,
}) => {
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.initComplete);
	await page.getByRole("button", { name: "Got it", exact: true }).click();
	const before = await page.evaluate(
		() => anura.settings.get("nebula.desktop.environment") || null,
	);
	await page.evaluate(() => window.dispatchEvent(new Event("nebula:hyprland")));
	await page.getByLabel("Upload dotfiles", { exact: true }).setInputFiles([
		{
			name: "hyprland.conf",
			mimeType: "text/plain",
			buffer: Buffer.from(
				"$mod = CTRL ALT\ngeneral {\ngaps_in = 8\ngaps_out = 22\nborder_size = 3\ncol.active_border = rgb(83caff)\n}\ndecoration {\nrounding = 18\n}\nbind = $mod, 2, workspace, 2\nexec-once = touch /should-not-exist",
			),
		},
	]);
	await expect(page.locator(".nebula-hypr-import")).toContainText(
		"command ignored",
	);
	await page.screenshot({ path: "../../outputs/Hyprland-import.png" });
	await page
		.getByRole("button", { name: "Apply to Flow", exact: true })
		.click();
	await expect(
		page.getByRole("status").filter({ hasText: "Imported into Flow" }),
	).toBeVisible();
	await page.getByRole("button", { name: "Close importer" }).click();
	await page.evaluate(() => anura.apps["anura.settings"].open());
	await expect(page.locator(".aliceWMwin").last()).toHaveCSS(
		"border-radius",
		"18px",
	);
	await expect(page.locator(".aliceWMwin").last()).toHaveCSS(
		"border-top-width",
		"3px",
	);
	await page
		.locator(".nebula-flow-actions")
		.getByRole("button", { name: "Tile", exact: true })
		.click();
	await expect(page.locator(".aliceWMwin").last()).toHaveCSS("left", "22px");
	await page.reload();
	await page.waitForFunction(() => window.anura?.initComplete);
	await page.getByRole("button", { name: "Got it", exact: true }).click();
	await expect(page.locator("body")).toHaveClass(/nebula-env-flow/);
	await page.evaluate(() => anura.apps["anura.settings"].open());
	await expect(page.locator(".aliceWMwin").last()).toHaveCSS(
		"border-radius",
		"18px",
	);
	await page
		.getByRole("button", { name: "Import Hyprland dotfiles", exact: true })
		.click();
	await page.getByRole("button", { name: "Undo last import" }).click();
	await expect(
		page.getByRole("status").filter({ hasText: "Previous setup restored" }),
	).toBeVisible();
	expect(
		await page.evaluate(
			() => anura.settings.get("nebula.desktop.environment") || null,
		),
	).toBe(before);
});

test("Uploaded wallpapers and window action bindings work without executing commands", async ({
	page,
}) => {
	const { readFile } = await import("node:fs/promises");
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.initComplete);
	await page.getByRole("button", { name: "Got it", exact: true }).click();
	const before = await page.evaluate(
		() => anura.settings.get("wallpaper") || null,
	);
	await page.evaluate(() => window.dispatchEvent(new Event("nebula:hyprland")));
	await page.getByLabel("Upload dotfiles", { exact: true }).setInputFiles([
		{
			name: "hyprland.conf",
			mimeType: "text/plain",
			buffer: Buffer.from(
				"bind = CTRL ALT, Y, fullscreen,\nbind = CTRL ALT, Q, killactive,",
			),
		},
		{
			name: "hyprpaper.conf",
			mimeType: "text/plain",
			buffer: Buffer.from("wallpaper = ,star.png"),
		},
		{
			name: "star.png",
			mimeType: "image/png",
			buffer: await readFile("public/nebula/icon-192.png"),
		},
	]);
	await page
		.getByRole("button", { name: "Apply to Flow", exact: true })
		.click();
	await expect(
		page.getByRole("status").filter({ hasText: "Imported into Flow" }),
	).toBeVisible();
	const wallpaper = await page.evaluate(() => anura.settings.get("wallpaper"));
	expect(wallpaper).toMatch(/^\/fs\/\.nebula-wallpapers\/hypr-/);
	expect(
		await page.evaluate(async (url) => (await fetch(url)).ok, wallpaper),
	).toBe(true);
	await page.getByRole("button", { name: "Close importer" }).click();
	await page.evaluate(() => anura.apps["anura.settings"].open());
	await page.keyboard.press("Control+Alt+y");
	await expect(page.locator(".aliceWMwin").last()).toHaveClass(
		/nebula-maximized/,
	);
	await page.keyboard.press("Control+Alt+q");
	await expect(page.locator(".aliceWMwin")).toHaveCount(0);
	await page.evaluate(() => window.dispatchEvent(new Event("nebula:hyprland")));
	await page.getByRole("button", { name: "Undo last import" }).click();
	await expect(
		page.getByRole("status").filter({ hasText: "Previous setup restored" }),
	).toBeVisible();
	expect(
		await page.evaluate(() => anura.settings.get("wallpaper") || null),
	).toBe(before);
});
