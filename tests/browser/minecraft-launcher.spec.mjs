import { test, expect } from "@playwright/test";
test("NebulaCraft native launcher exposes eleven editions and starts the separately hosted game", async ({
	page,
}) => {
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.initComplete);
	await page.getByRole("button", { name: "Got it", exact: true }).click();
	await page.evaluate(() => anura.apps["nebula.minecraft"].open());
	const launcher = page.frameLocator('iframe[title="NebulaCraft Launcher"]');
	await expect(
		launcher.getByRole("button", { name: "PLAY", exact: true }),
	).toBeVisible({ timeout: 30000 });
	await expect(launcher.locator("#version-picker option")).toHaveCount(11);
	await expect(launcher.locator(".edition")).toContainText("1.20.4");
	await launcher
		.getByRole("button", { name: "Installation details", exact: true })
		.click();
	await expect(launcher.locator("#details-panel")).toBeVisible();
	await launcher
		.getByRole("button", { name: "Play", exact: true })
		.first()
		.click();
	await launcher.locator("#play").click();
	await expect(
		launcher.locator('iframe[title="Eaglercraft 1.20.4"]'),
	).toHaveAttribute("src", "/game/");
	await launcher
		.getByRole("button", { name: "Return to launcher", exact: true })
		.click();
	await launcher
		.getByRole("button", { name: "Keep playing", exact: true })
		.click();
	await expect(launcher.locator("#session")).toBeVisible();
	await launcher
		.getByRole("button", { name: "Return to launcher", exact: true })
		.click();
	await launcher
		.getByRole("button", { name: "Close game", exact: true })
		.click();
	await expect(
		launcher.locator('iframe[title="Eaglercraft 1.20.4"]'),
	).toHaveCount(0);
	await page.evaluate(() => anura.apps["nebula.minecraft"].open());
	await expect(
		page.locator('iframe[title="NebulaCraft Launcher"]'),
	).toHaveCount(1);
});
