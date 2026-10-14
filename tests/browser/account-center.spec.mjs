import { test, expect } from "@playwright/test";
test("Account Center persists profiles, launches official sign-in and supports edit, favorite and undo", async ({
	page,
	context,
}) => {
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.initComplete);
	await page.evaluate(() => anura.apps["nebula.accounts"].open());
	const app = page.locator(".nebula-account-center");
	await app.getByRole("button", { name: "Add your first account" }).click();
	await app.getByRole("combobox", { name: "Service" }).selectOption("github");
	await app
		.getByRole("textbox", { name: "Account label" })
		.fill("Personal development");
	await app
		.getByRole("textbox", { name: "Username or email (optional)" })
		.fill("test-pilot");
	await app.getByRole("button", { name: "Save account", exact: true }).click();
	const account = app.getByRole("article", {
		name: "GitHub: Personal development",
	});
	await expect(account).toBeVisible();
	await account
		.getByRole("button", { name: "Favorite Personal development" })
		.click();
	await app.getByRole("button", { name: "Favorites", exact: true }).click();
	await expect(account).toBeVisible();
	// Intercept only the external destination: verifies the actual new-tab route without signing into a real account.
	await context.route("https://github.com/login", (route) =>
		route.fulfill({
			body: "<title>GitHub sign-in destination</title>",
			contentType: "text/html",
		}),
	);
	const popupPromise = page.waitForEvent("popup");
	await account.getByRole("button", { name: "Sign in", exact: true }).click();
	const popup = await popupPromise;
	await expect(popup).toHaveURL("https://github.com/login");
	await popup.close();
	const stored = await page.evaluate(() =>
		JSON.parse(localStorage.getItem("nebula.account-center.v1.default")),
	);
	expect(stored[0].handle).toBe("test-pilot");
	expect(stored[0]).not.toHaveProperty("password");
	expect(stored[0]).not.toHaveProperty("token");
	await page.reload();
	await page.waitForFunction(() => window.anura?.initComplete);
	await page.evaluate(() => anura.apps["nebula.accounts"].open());
	await expect(account).toBeVisible();
	await account.getByRole("button", { name: "Edit", exact: true }).click();
	await app.getByRole("textbox", { name: "Account label" }).fill("Main GitHub");
	await app.getByRole("button", { name: "Save account", exact: true }).click();
	const renamed = app.getByRole("article", { name: "GitHub: Main GitHub" });
	await expect(renamed).toBeVisible();
	await renamed.getByRole("button", { name: "Remove", exact: true }).click();
	await expect(renamed).toHaveCount(0);
	await app.getByRole("button", { name: "Undo removal" }).click();
	await expect(renamed).toBeVisible();
	await app
		.getByRole("searchbox", { name: "Search saved accounts" })
		.fill("no-match");
	await expect(renamed).toHaveCount(0);
	await app.getByRole("searchbox", { name: "Search saved accounts" }).fill("");
	await expect(renamed).toBeVisible();
});
test("motion respects system preference and native Reduce motion setting", async ({
	page,
}) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.initComplete);
	await expect(page.locator("body")).toHaveClass(/nebula-motion-reduced/);
	await page.evaluate(() => anura.apps["nebula.accounts"].open());
	expect(
		await page
			.locator(".aliceWMwin")
			.last()
			.evaluate((el) => getComputedStyle(el).transitionDuration),
	).toBe("0s");
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await expect(page.locator("body")).toHaveClass(/nebula-motion(\s|$)/);
	await page.evaluate(async () => {
		await anura.settings.set("disable-animation", true);
		window.dispatchEvent(new Event("nebula:motion"));
	});
	await expect(page.locator("body")).toHaveClass(/nebula-motion-reduced/);
});
