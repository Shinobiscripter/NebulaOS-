import { test, expect } from "@playwright/test";
test("Netlify upgrades its old relay default and preserves custom relay settings", async ({
	page,
}) => {
	test.skip(
		!process.env.NEBULA_BASE_URL?.includes(".netlify.app"),
		"Production migration",
	);
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.initComplete);
	const expected = await page.evaluate(() => anura.settings.get("wisp-url"));
	expect(expected).toBe("wss://nebulahub-browser.onrender.com/wisp/");
	await page.evaluate(() =>
		anura.settings.set("wisp-url", `wss://${location.host}/`),
	);
	await page.reload();
	await page.waitForFunction(() => window.anura?.initComplete);
	expect(await page.evaluate(() => anura.settings.get("wisp-url"))).toBe(
		expected,
	);
	const custom = expected.replace(".com/", ".com:443/");
	await page.evaluate((url) => anura.settings.set("wisp-url", url), custom);
	await page.reload();
	await page.waitForFunction(() => window.anura?.initComplete);
	expect(await page.evaluate(() => anura.settings.get("wisp-url"))).toBe(
		custom,
	);
});
test("individual widget visibility, pointer and keyboard placement persist", async ({
	page,
}) => {
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.initComplete);
	await expect(page.locator(".bootsplash")).toHaveCount(0);
	const note = page.getByRole("region", {
		name: "Quick note widget",
		exact: true,
	});
	const handle = note.getByRole("button", { name: "Move Quick note widget" });
	const old = await note.boundingBox();
	const grip = await handle.boundingBox();
	await page.mouse.move(grip.x + 30, grip.y + 12);
	await page.mouse.down();
	await page.mouse.move(grip.x + 390, grip.y + 62, { steps: 10 });
	await page.mouse.up();
	const moved = await note.boundingBox();
	expect(moved.x - old.x).toBeCloseTo(360, 0);
	await handle.focus();
	await page.keyboard.press("ArrowRight");
	const final = await note.boundingBox();
	expect(final.x - moved.x).toBe(10);
	await note.getByRole("button", { name: "Hide Quick note widget" }).click();
	await expect(note).toBeHidden();
	await page.getByRole("button", { name: "Widgets", exact: true }).click();
	const dialog = page.getByRole("dialog");
	await expect(
		dialog.getByRole("checkbox", { name: "Quick note", exact: true }),
	).not.toBeChecked();
	await dialog.getByRole("button", { name: "Close", exact: true }).click();
	await page.waitForFunction(
		() =>
			anura.settings.get("nebula.desktop.widgetLayout")?.["quick-note"]
				?.visible === false,
	);
	await page.reload();
	await page.waitForFunction(() => window.anura?.initComplete);
	await expect(note).toBeHidden();
	await page.getByRole("button", { name: "Widgets", exact: true }).click();
	await dialog
		.getByRole("checkbox", { name: "Quick note", exact: true })
		.check();
	await dialog.getByRole("button", { name: "Close", exact: true }).click();
	await expect(note).toBeVisible();
	expect((await note.boundingBox()).x).toBeCloseTo(final.x, 0);
	await page.setViewportSize({ width: 800, height: 600 });
	const bounds = await note.boundingBox();
	expect(bounds.x + bounds.width).toBeLessThanOrEqual(800);
});
test("Spotify validates links and does not load until requested", async ({
	page,
}) => {
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.initComplete);
	const card = page.getByRole("region", {
		name: "Spotify widget",
		exact: true,
	});
	await expect(card.locator("iframe")).toHaveCount(0);
	await card
		.getByRole("textbox", { name: "Spotify link" })
		.fill("https://example.com/");
	await card.getByRole("button", { name: "Load through proxy" }).click();
	await expect(card.getByRole("status")).toContainText(
		"Paste an open.spotify.com",
	);
	await expect(card.locator("iframe")).toHaveCount(0);
	await card
		.getByRole("textbox", { name: "Spotify link" })
		.fill("https://open.spotify.com/track/0Lr4kGOYn9l83EjuK6cZFQ");
	if (new URL(page.url()).hostname.endsWith(".netlify.app")) {
		await page.evaluate(() =>
			anura.settings.set("wisp-url", `wss://${location.host}/`),
		);
		await card.getByRole("button", { name: "Load through proxy" }).click();
		await expect(card.getByRole("status")).toContainText("No proxy relay");
	}
	await card.getByRole("button", { name: "Use direct player" }).click();
	await expect(card.locator("iframe")).toHaveAttribute(
		"src",
		"https://open.spotify.com/embed/track/0Lr4kGOYn9l83EjuK6cZFQ",
	);
	await card.getByRole("button", { name: "Hide Spotify widget" }).click();
	await expect(card.locator("iframe")).toHaveCount(0);
});
