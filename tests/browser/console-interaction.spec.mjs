import { test, expect } from "@playwright/test";
test("console focus, media, slide-out menus, quick settings and handheld layout", async ({
	page,
}) => {
	await page.goto("/");
	await page.waitForFunction(
		() => window.anura?.initComplete && anura.apps["nebula.gamemode"],
	);
	await page.getByRole("button", { name: "Got it", exact: true }).click();
	await page.evaluate(() => anura.apps["nebula.gamemode"].open());
	const root = page.locator(".ng-mode");
	const hex = root.getByRole("button", { name: "Hextris", exact: true });
	await hex.focus();
	await expect(root.locator(".ng-console-preview h1")).toHaveText("Hextris");
	await expect(root.locator(".ng-scene")).toHaveAttribute(
		"data-game",
		"hextris",
	);
	await expect(hex).toHaveClass(/ng-selected/);
	await root
		.getByRole("button", { name: "✦ Control Center", exact: true })
		.click();
	await expect(
		root.getByRole("complementary", { name: "Console menu" }),
	).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(root.locator(".ng-drawer")).toBeHidden();
	await expect(root).toBeVisible();
	await root
		.getByRole("button", { name: "••• Quick settings", exact: true })
		.click();
	await root
		.locator(".ng-drawer")
		.getByRole("button", { name: "Performance overlay", exact: true })
		.click();
	await expect(root.locator(".ng-hud")).toContainText("FPS");
	await page.keyboard.press("Escape");
	await root.getByRole("button", { name: "Media", exact: true }).click();
	await expect(
		root.getByRole("button", { name: "Nebula Music", exact: true }),
	).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(root.locator(".ng-console-rail")).toBeVisible();
	await root.getByRole("button", { name: "Settings", exact: true }).click();
	await root
		.getByRole("button", { name: "Deck · handheld library", exact: true })
		.click();
	await root.getByRole("button", { name: "Home", exact: true }).click();
	await page.setViewportSize({ width: 800, height: 600 });
	await root.getByRole("button", { name: "Hextris", exact: true }).focus();
	await expect(root.locator(".ng-console-preview strong")).toHaveText(
		"Hextris",
	);
	await root.getByRole("button", { name: "NEBULA Menu", exact: true }).click();
	await expect(root.locator(".ng-drawer")).toBeVisible();
	await page.keyboard.press("Tab");
	expect(
		await root
			.locator(".ng-drawer")
			.evaluate((e) => e.contains(document.activeElement)),
	).toBe(true);
	await page.keyboard.press("Escape");
	await page.screenshot({
		path: "../Game-Mode-Handheld.png",
		animations: "disabled",
	});
	await page.emulateMedia({ reducedMotion: "reduce" });
	const duration = await root
		.locator(".ng-console-tile")
		.first()
		.evaluate((e) => getComputedStyle(e).transitionDuration);
	expect(duration).toBe("0s");
});
