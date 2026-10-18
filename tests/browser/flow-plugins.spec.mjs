import { test, expect } from "@playwright/test";
test("Workspace overview moves real windows, focuses them and can be disabled", async ({
	page,
}) => {
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.initComplete);
	await page.getByRole("button", { name: "Got it", exact: true }).click();
	await page.evaluate(async () => {
		await anura.settings.set("nebula.desktop.environment", "flow");
		window.dispatchEvent(new Event("nebula:environment"));
		anura.wm.createGeneric({
			title: "Plugin test window",
			width: "400px",
			height: "300px",
		});
	});
	await page.keyboard.press("Control+Alt+o");
	const overview = page.getByRole("dialog", {
		name: "Workspace overview",
		exact: true,
	});
	await expect(overview).toBeVisible();
	await overview
		.locator(".nebula-expo-window")
		.dragTo(overview.locator('[data-workspace="3"]'));
	await expect(overview.locator('[data-workspace="3"]')).toContainText(
		"Plugin test window",
	);
	await overview
		.getByLabel("Move Plugin test window to workspace")
		.selectOption("2");
	await page.screenshot({ path: "../../outputs/Flow-extensions.png" });
	await expect(overview.locator('[data-workspace="2"]')).toContainText(
		"Plugin test window",
	);
	await overview
		.getByRole("button", { name: "Plugin test window", exact: true })
		.click();
	await expect(overview).toHaveCount(0);
	await expect(
		page.locator('.nebula-workspaces [aria-current="page"]'),
	).toHaveText("2");
	await expect(
		page.locator(".aliceWMwin").filter({ hasText: "Plugin test window" }),
	).toBeVisible();
	await page.evaluate(() =>
		window.dispatchEvent(new Event("nebula:flow-extensions")),
	);
	await page.getByLabel("Workspace overview", { exact: true }).uncheck();
	await page
		.getByRole("button", { name: "Save extensions", exact: true })
		.click();
	await page.keyboard.press("Control+Alt+o");
	await expect(overview).toHaveCount(0);
	expect(
		await page.evaluate(
			() => anura.settings.get("nebula.flow.plugins").overview,
		),
	).toBe(false);
});
test("Idle lock respects activity and the enabled setting", async ({
	page,
}) => {
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.initComplete);
	await page.getByRole("button", { name: "Got it", exact: true }).click();
	await page.clock.install();
	await page.evaluate(() =>
		window.dispatchEvent(new Event("nebula:flow-extensions")),
	);
	await page.getByLabel("Automatically lock when idle").check();
	await page.getByLabel("Idle timeout (minutes)").fill("1");
	await page
		.getByRole("button", { name: "Save extensions", exact: true })
		.click();
	await page.clock.runFor(40000);
	await page.mouse.move(200, 200);
	await page.clock.runFor(40000);
	await expect(
		page.getByRole("dialog", { name: "Lock screen", exact: true }),
	).toHaveCount(0);
	await page.clock.runFor(21000);
	await expect(
		page.getByRole("dialog", { name: "Lock screen", exact: true }),
	).toBeVisible();
});
