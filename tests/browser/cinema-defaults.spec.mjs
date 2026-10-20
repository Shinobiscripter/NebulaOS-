import { test, expect } from "@playwright/test";
test("Default catalog title resolves Torrentio sources and explains companion requirement", async ({
	page,
}) => {
	await page.route("https://torrentio.strem.fun/**", (route) =>
		route.fulfill({
			json: route.request().url().endsWith("manifest.json")
				? {
						id: "com.stremio.torrentio.addon",
						name: "Torrentio",
						resources: [
							{ name: "stream", types: ["movie"], idPrefixes: ["tt"] },
						],
						types: ["movie"],
						catalogs: [],
					}
				: {
						streams: [
							{
								name: "Torrentio test source",
								infoHash: "a".repeat(40),
								fileIdx: 0,
							},
						],
					},
			headers: { "Access-Control-Allow-Origin": "*" },
		}),
	);
	await page.route("https://v3-cinemeta.strem.io/**", (route) =>
		route.fulfill({
			json: route.request().url().endsWith("manifest.json")
				? {
						id: "com.linvo.cinemeta",
						name: "Cinemeta",
						resources: ["catalog", "meta"],
						types: ["movie"],
						catalogs: [{ id: "top", type: "movie", name: "Popular" }],
					}
				: route.request().url().includes("/meta/")
					? { meta: { id: "tt123", type: "movie", name: "Catalog title" } }
					: { metas: [{ id: "tt123", type: "movie", name: "Catalog title" }] },
			headers: { "Access-Control-Allow-Origin": "*" },
		}),
	);
	await page.goto(process.env.NEBULA_CINEMA_PATH || "/cinema/");
	await page.getByRole("button", { name: "Catalog title movie" }).click();
	await page.getByRole("button", { name: "Torrentio test source" }).click();
	await expect(
		page.getByText("Connect your torrent companion in Add-ons & server first."),
	).toBeVisible();
	await page.locator("#details .close").click();
	await page.getByRole("button", { name: "Add-ons & server" }).click();
	await expect(page.locator("#addons")).toContainText(
		"Torrentio · Stream provider",
	);
	await page
		.locator("#addons .row")
		.filter({ hasText: "Torrentio" })
		.getByRole("button", { name: "Remove" })
		.click();
	await page.reload();
	await page.getByRole("button", { name: "Add-ons & server" }).click();
	await expect(page.locator("#addons")).not.toContainText("Torrentio");
});
