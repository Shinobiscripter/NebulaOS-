import { test, expect } from "@playwright/test";
test("Installer adapters, interactive preview and actual automatic master tiling", async ({
	page,
}) => {
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.initComplete);
	await page.getByRole("button", { name: "Got it", exact: true }).click();
	await page.evaluate(() => window.dispatchEvent(new Event("nebula:hyprland")));
	await page.getByLabel("Upload dotfiles", { exact: true }).setInputFiles([
		{
			name: "hyprland.conf",
			mimeType: "text/plain",
			buffer: Buffer.from(
				"source = installed.conf\ngeneral:layout = master\nmaster:mfact = 0.65\nbezier = soft,0.2,0.8,0.3,1\nanimation = windowsIn,1,4,soft,slide",
			),
		},
		{
			name: "theme.conf",
			mimeType: "text/plain",
			buffer: Buffer.from("general:border_size = 3\ndecoration:rounding = 14"),
		},
		{
			name: "install.sh",
			mimeType: "text/plain",
			buffer: Buffer.from(
				"pacman -S kitty rofi\ncp theme.conf ~/.config/hypr/installed.conf",
			),
		},
	]);
	await page
		.getByLabel("Include candidate cosmetic commands", { exact: false })
		.check();
	await expect(page.locator(".flow-preview-window")).toHaveCount(3);
	await page
		.getByRole("button", { name: "Add preview window", exact: true })
		.click();
	await expect(page.locator(".flow-preview-window")).toHaveCount(4);
	await page
		.getByRole("button", { name: "Close preview window" })
		.last()
		.click();
	await expect(page.locator(".flow-preview-window")).toHaveCount(3);
	expect(
		await page.evaluate(
			() => anura.settings.get("nebula.flow.importStyle")?.layout,
		),
	).toBeUndefined();
	await page.getByRole("button", { name: "Replay animation" }).click();
	await page.waitForTimeout(450);
	await page.screenshot({ path: "../../outputs/Flow-live-preview.png" });
	await page
		.getByRole("button", { name: "Apply to Flow", exact: true })
		.click();
	await expect(page.locator(".nebula-hypr-import [role=status]")).toContainText(
		"Imported into Flow",
	);
	expect(
		await page.evaluate(async () =>
			new TextDecoder().decode(
				await anura.fs.promises.readFile(
					anura.settings.get("nebula.compat.installation") + "/installed.conf",
				),
			),
		),
	).toContain("border_size = 3");
	await page.getByRole("button", { name: "Open kitty adapter" }).click();
	await expect(page.locator('iframe[src*="ashell.app"]')).toBeVisible();
	await page.evaluate(() => anura.apps["anura.settings"].open());
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					[...document.querySelectorAll(".aliceWMwin[data-nebula-tiled]")]
						.length,
			),
		)
		.toBe(2);
	await expect
		.poll(async () => {
			const widths = await page
				.locator(".aliceWMwin")
				.evaluateAll((nodes) =>
					nodes.map((n) => n.getBoundingClientRect().width),
				);
			return Math.max(...widths) / Math.min(...widths);
		})
		.toBeGreaterThan(1.5);
	await page.evaluate(() => window.dispatchEvent(new Event("nebula:hyprland")));
	await page.getByRole("button", { name: "Undo last import" }).click();
	await expect(page.locator(".nebula-hypr-import [role=status]")).toContainText(
		"Previous setup restored",
	);
	expect(await page.evaluate(() => window.nebulaCompat.list())).toEqual([]);
});
