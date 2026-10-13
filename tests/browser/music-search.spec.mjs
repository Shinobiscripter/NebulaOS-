import { test, expect } from "@playwright/test";
test("widget and app submit live searches and share results and saved songs", async ({
	page,
}) => {
	test.skip(!process.env.NEBULA_ONLINE_TESTS, "Live YouTube search");
	test.setTimeout(180000);
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.initComplete);
	const widget = page.getByRole("region", {
		name: "Music widget",
		exact: true,
	});
	await widget
		.getByRole("searchbox", { name: "Search music" })
		.fill("Daft Punk Voyager");
	await widget.getByRole("searchbox").press("Enter");
	await expect(widget.locator(".nm-result").first()).toBeVisible({
		timeout: 85000,
	});
	await expect(widget.locator(".nm-search-status")).toContainText(
		"Daft Punk Voyager",
	);
	const title = await widget.locator(".nm-result h3").first().innerText();
	await widget
		.locator(".nm-result")
		.first()
		.getByRole("button", { name: "Add to playlist" })
		.click();
	await widget.getByRole("button", { name: "Open Music app" }).click();
	const app = page.locator(".nm-full");
	await expect(app.getByRole("searchbox")).toHaveValue("Daft Punk Voyager");
	await expect(app.locator(".nm-result h3").first()).toHaveText(title);
	await expect(app.locator(".nm-library")).toContainText(title);
	await app.getByRole("searchbox").fill("Tycho Awake");
	await app.getByRole("button", { name: "Search", exact: true }).click();
	await expect(app.locator(".nm-search-status")).toContainText(
		"results for Tycho Awake",
		{ timeout: 85000 },
	);
	await expect(widget.getByRole("searchbox")).toHaveValue("Tycho Awake");
	await expect(widget.locator(".nm-result h3").first()).toHaveText(
		await app.locator(".nm-result h3").first().innerText(),
	);
});
