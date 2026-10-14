import { test, expect } from "@playwright/test";
test("maximized app fills viewport and dock retracts, reveals, and restores", async ({
	page,
}) => {
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.initComplete);
	await page.evaluate(() => anura.apps["nebula.music"].open());
	const win = page.locator(".aliceWMwin.nebula-maximized");
	await expect(win).toHaveCount(1);
	await expect
		.poll(() =>
			win.evaluate((el) => Math.round(el.getBoundingClientRect().height)),
		)
		.toBe(900);
	await expect
		.poll(() =>
			win.evaluate((el) => Math.round(el.getBoundingClientRect().width)),
		)
		.toBe(1366);
	await expect
		.poll(() =>
			win.evaluate((el) => Math.round(el.getBoundingClientRect().top)),
		)
		.toBe(0);
	const dock = page.locator("body > footer");
	await expect
		.poll(() => dock.evaluate((el) => el.getBoundingClientRect().top))
		.toBeGreaterThanOrEqual(900);
	await page.getByRole("button", { name: "Reveal dock", exact: true }).hover();
	await expect
		.poll(() => dock.evaluate((el) => el.getBoundingClientRect().bottom))
		.toBeLessThanOrEqual(900);
	await page.mouse.move(100, 400);
	await expect
		.poll(() => dock.evaluate((el) => el.getBoundingClientRect().top))
		.toBeGreaterThanOrEqual(900);
	await page.setViewportSize({ width: 1100, height: 720 });
	await expect
		.poll(() =>
			win.evaluate((el) => Math.round(el.getBoundingClientRect().height)),
		)
		.toBe(720);
	await page.evaluate(() => anura.apps["nebula.music"].windows[0].minimize());
	await expect(page.locator("body")).not.toHaveClass(/nebula-fullscreen/);
	await page.evaluate(() => anura.apps["nebula.music"].windows[0].unminimize());
	await expect(page.locator("body")).toHaveClass(/nebula-fullscreen/);
	await page.evaluate(() => anura.apps["nebula.music"].windows[0].close());
	await expect(page.locator("body")).not.toHaveClass(/nebula-fullscreen/);
});
test("Settings switches environments; workspaces, scratchpad, dashboard and tiling function", async ({
	page,
}) => {
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.initComplete);
	await page.evaluate(() => anura.apps["anura.settings"].open());
	await page
		.getByRole("combobox", { name: "Desktop environment" })
		.selectOption("flow");
	await expect(page.locator("body")).toHaveClass(/nebula-env-flow/);
	await expect(
		page.getByRole("navigation", { name: "Workspaces" }).getByRole("button"),
	).toHaveCount(4);
	await page
		.getByRole("button", { name: "Workspace 2, 0 windows", exact: true })
		.click();
	await expect(
		page.getByRole("combobox", { name: "Desktop environment" }),
	).toBeHidden();
	await page.evaluate(() => anura.apps["nebula.games"].open());
	await expect(page.locator('iframe[src*="nebula-games.app"]')).toBeVisible();
	await page.getByRole("button", { name: /Workspace 1,/ }).click();
	await expect(page.locator('iframe[src*="nebula-games.app"]')).toBeHidden();
	await expect(
		page.getByRole("combobox", { name: "Desktop environment" }),
	).toBeVisible();
	await page.getByRole("button", { name: "Notes", exact: true }).click();
	await page
		.getByRole("textbox", { name: "Scratchpad text" })
		.fill("A thought from orbit");
	await expect
		.poll(() => page.evaluate(() => anura.settings.get("nebula.flow.note")))
		.toBe("A thought from orbit");
	await page.getByRole("button", { name: "Close scratchpad" }).click();
	await page.getByRole("button", { name: "Dashboard", exact: true }).click();
	await expect(
		page.getByRole("dialog", { name: "Desktop dashboard" }),
	).toContainText("2 open windows");
	await page.getByRole("button", { name: "Close dashboard" }).click();
	await page.evaluate(() => anura.apps["anura.fsapp"].open());
	await page.getByRole("button", { name: "Tile", exact: true }).click();
	await expect(page.locator("[data-nebula-tiled=true]")).toHaveCount(2);
	await page.getByRole("button", { name: "Float", exact: true }).click();
	await expect(page.locator("[data-nebula-tiled=true]")).toHaveCount(0);
	await page.reload();
	await page.waitForFunction(() => window.anura?.initComplete);
	await expect(page.locator("body")).toHaveClass(/nebula-env-flow/);
	await page.evaluate(() => anura.apps["anura.settings"].open());
	await page
		.getByRole("combobox", { name: "Desktop environment" })
		.selectOption("orbit");
	await expect(page.locator("body")).not.toHaveClass(/nebula-env-flow/);
});
