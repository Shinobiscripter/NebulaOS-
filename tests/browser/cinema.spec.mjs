import { test, expect } from "@playwright/test";
test("Cinema installs, searches and removes a Stremio addon across reloads", async ({
	page,
}) => {
	await page.route("https://cinema-test.example/**", async (route) => {
		const url = route.request().url();
		let data;
		if (url.endsWith("manifest.json"))
			data = {
				id: "test",
				name: "Test Cinema",
				version: "1.0.0",
				types: ["movie"],
				resources: ["catalog", "meta", "stream"],
				catalogs: [{ type: "movie", id: "all", extra: [{ name: "search" }] }],
			};
		else if (url.includes("/catalog/"))
			data = {
				metas: [
					{
						id: "test:film",
						type: "movie",
						name: url.includes("search=") ? "Search result" : "Test film",
					},
				],
			};
		else if (url.includes("/meta/"))
			data = {
				meta: {
					id: "test:film",
					type: "movie",
					name: "Test film",
					description: "Test description",
				},
			};
		else
			data = {
				streams: [
					{ name: "External source", externalUrl: "https://example.org/watch" },
				],
			};
		await route.fulfill({
			json: data,
			headers: { "Access-Control-Allow-Origin": "*" },
		});
	});
	await page.goto("/cinema/");
	await expect(
		page.getByRole("heading", { name: "A universe of stories." }),
	).toBeVisible();
	await page.getByRole("button", { name: "Add-ons & server" }).click();
	await page
		.getByLabel("Add-on manifest URL")
		.fill("https://cinema-test.example/manifest.json");
	await page.getByRole("button", { name: "Install add-on" }).click();
	await expect(
		page.getByText("Add-on installed.", { exact: true }),
	).toBeVisible();
	await page.locator("#preferences .close").click();
	await page.reload();
	await page.getByLabel("Search titles").fill("space");
	await page.getByRole("button", { name: "Search", exact: true }).click();
	await page.getByRole("button", { name: "Search result movie" }).click();
	await expect(page.getByText("Test description")).toBeVisible();
	await page.getByRole("button", { name: "External source" }).click();
	await expect(
		page.getByRole("link", { name: "Open in source website ↗" }),
	).toHaveAttribute("href", "https://example.org/watch");
	await page.locator("#details .close").click();
	await page.getByRole("button", { name: "Add-ons & server" }).click();
	await page.getByRole("button", { name: "Remove", exact: true }).click();
	await expect(page.locator("#addons")).toBeEmpty();
});
test("Cinema opens within a managed Nebula window", async ({ page }) => {
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.initComplete);
	await page.getByRole("button", { name: "Got it", exact: true }).click();
	await page.evaluate(() => anura.apps["nebula.cinema"].open());
	await expect(
		page
			.frameLocator('iframe[title="Nebula Cinema"]')
			.getByRole("heading", { name: "A universe of stories." }),
	).toBeVisible();
});
