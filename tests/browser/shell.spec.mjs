import { test, expect } from "@playwright/test";
test("desktop menus, widgets, app search and real window overview", async ({
	page,
}) => {
	const errors = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.initComplete);
	const menu = page.getByRole("navigation", { name: "Desktop menu" });
	await expect(menu).toBeVisible();
	const widgets = page.getByRole("complementary", { name: "Desktop widgets" });
	await expect(widgets).toBeVisible();
	await widgets.getByRole("button", { name: "Open calendar" }).click();
	await expect(page.locator("#calendar")).toHaveCSS("opacity", "1");
	await page.locator("#date-container").click();
	await page.locator("#taskinfo-container").click();
	await expect(page.locator("#quickSettings")).toHaveCSS("opacity", "1");
	await page.locator("#taskinfo-container").click();
	await widgets
		.getByRole("textbox", { name: "Quick note", exact: true })
		.fill("Plan tomorrow’s orbit");
	await widgets
		.getByRole("textbox", { name: "New reminder" })
		.fill("Test the desktop");
	await widgets.getByRole("button", { name: "Add reminder" }).click();
	await widgets.getByRole("checkbox", { name: "Test the desktop" }).check();
	await widgets.getByRole("button", { name: "Start 25 minutes" }).click();
	await expect(
		widgets.getByRole("button", { name: "Pause", exact: true }),
	).toBeVisible();
	await widgets.getByRole("button", { name: "Pause", exact: true }).click();
	await widgets.getByRole("button", { name: "Reset", exact: true }).click();
	await page.waitForFunction(
		() => anura.settings.get("nebula.desktop.note") === "Plan tomorrow’s orbit",
	);
	await page.reload();
	await page.waitForFunction(() => window.anura?.initComplete);
	await expect(
		widgets.getByRole("textbox", { name: "Quick note", exact: true }),
	).toHaveValue("Plan tomorrow’s orbit");
	await expect(
		widgets.getByRole("checkbox", { name: "Test the desktop" }),
	).toBeChecked();
	await menu.getByRole("button", { name: "Search", exact: true }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByRole("searchbox").fill("Nebula Games");
	await dialog
		.getByRole("button", { name: "Nebula Games", exact: true })
		.click();
	await expect(
		page
			.frameLocator('iframe[src*="nebula-games.app/index.html"]')
			.locator(".game"),
	).toHaveCount(46);
	await menu.getByRole("button", { name: "Windows", exact: true }).click();
	await dialog.getByRole("button", { name: "Tile right" }).click();
	const gameWindow = page.locator(".aliceWMwin").filter({
		has: page.locator('iframe[src*="nebula-games.app/index.html"]'),
	});
	const bounds = await gameWindow.boundingBox();
	expect(bounds.x).toBeGreaterThan(600);
	expect(bounds.y).toBeGreaterThanOrEqual(34);
	await menu.getByRole("button", { name: "Show Desktop", exact: true }).click();
	await expect(gameWindow).toBeHidden();
	await menu
		.getByRole("button", { name: "Restore Windows", exact: true })
		.click();
	await expect(gameWindow).toBeVisible();
	await menu.getByRole("button", { name: "Widgets", exact: true }).click();
	await dialog
		.getByRole("button", { name: "Hide all widgets", exact: true })
		.click();
	await expect(widgets).toBeHidden();
	await dialog
		.getByRole("button", { name: "Show all widgets", exact: true })
		.click();
	await dialog.getByRole("button", { name: "Close", exact: true }).click();
	await expect(widgets).toBeVisible();
	await gameWindow
		.getByRole("button", { name: "Close Nebula Games", exact: true })
		.click();
	await expect(gameWindow).toHaveCount(0);
	await page.screenshot({ path: "test-results/macos-desktop.png" });
	expect(errors).toEqual([]);
});
