import { test, expect } from "@playwright/test";
test("music app and widget share persistent playlists and reject invalid links", async ({
	page,
}) => {
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.initComplete);
	const card = page.getByRole("region", { name: "Music widget", exact: true });
	await expect(
		page.getByRole("region", { name: "Spotify widget", exact: true }),
	).toHaveCount(0);
	await expect(card.locator("iframe")).toHaveCount(0);
	await card
		.getByRole("textbox", { name: "YouTube song link" })
		.fill("https://example.com/");
	await card.getByRole("button", { name: "Add song" }).click();
	await expect(card.getByRole("status")).toContainText("Use a YouTube");
	await card.getByRole("button", { name: "Open Music app" }).click();
	const app = page.locator(".nm-full");
	await expect(app).toBeVisible();
	await app
		.getByRole("textbox", { name: "New playlist name" })
		.fill("Starlight");
	await app.getByRole("button", { name: "Create playlist" }).click();
	await expect(
		card.getByRole("combobox", { name: "Music playlist" }),
	).toContainText("Starlight");
	const selected = await card.getByRole("combobox").inputValue();
	await expect
		.poll(() =>
			page.evaluate(() => anura.settings.get("nebula.music.library")?.selected),
		)
		.toBe(selected);
	await page.reload();
	await page.waitForFunction(() => window.anura?.initComplete);
	await expect(card.getByRole("combobox")).toHaveValue(selected);
	await page.evaluate(() => anura.apps["nebula.music"].open());
	await expect(app.getByRole("combobox")).toHaveValue(selected);
	await expect(page.locator(".nm-full")).toHaveCount(1);
	await page.evaluate(() => anura.apps["nebula.music"].open());
	await expect(page.locator(".nm-full")).toHaveCount(1);
});
test("live discovery adds actual YouTube metadata to both views", async ({
	page,
}) => {
	test.skip(!process.env.NEBULA_ONLINE_TESTS, "Explicit online provider check");
	test.setTimeout(120000);
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.initComplete);
	await page.evaluate(() => anura.apps["nebula.music"].open());
	const app = page.locator(".nm-full"),
		card = page.getByRole("region", { name: "Music widget", exact: true });
	await expect(app.locator(".nm-result").first()).toBeVisible({
		timeout: 85000,
	});
	const title = await app.locator(".nm-result h3").first().innerText();
	await app
		.locator(".nm-result")
		.first()
		.getByRole("button", { name: "Add to playlist" })
		.click();
	await expect(card.locator(".nm-library")).toContainText(title);
	await expect(app.locator(".nm-library")).toContainText(title);
	await app
		.locator(".nm-result")
		.first()
		.getByRole("button", { name: "Play", exact: true })
		.click();
	await expect(
		app.locator('iframe[title="YouTube music player"]'),
	).toBeVisible();
	await expect
		.poll(
			() => page.frames().some((f) => f.url().includes("youtube.com/embed/")),
			{ timeout: 45000 },
		)
		.toBe(true);
	await page.screenshot({ path: "test-results/NebulaHub-music.png" });
});
