import { test, expect } from "@playwright/test";
async function boot(page) {
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.initComplete);
	await page.getByRole("button", { name: "Got it", exact: true }).click();
}
test("Horizon Start drags apps to desktop, moves shortcuts, persists and opens native apps", async ({
	page,
}) => {
	await boot(page);
	await page.evaluate(async () => {
		await anura.settings.set("nebula.desktop.environment", "horizon");
		window.dispatchEvent(new Event("nebula:environment"));
	});
	await expect(page.locator("body")).toHaveClass(/nebula-env-horizon/);
	await page.getByRole("button", { name: "✦ Start", exact: true }).click();
	await page
		.getByRole("searchbox", { name: "Horizon app search" })
		.fill("Settings");
	const app = page
		.locator(".nh-app")
		.getByRole("button", { name: "Settings", exact: true });
	await app.dragTo(page.locator(".nebula-horizon-desktop"), {
		targetPosition: { x: 700, y: 250 },
	});
	const shortcut = page.getByRole("button", {
		name: "Settings desktop shortcut",
		exact: true,
	});
	await expect(shortcut).toBeVisible();
	const before = await shortcut.boundingBox();
	await page.mouse.move(before.x + 30, before.y + 30);
	await page.mouse.down();
	await page.mouse.move(before.x + 130, before.y + 90, { steps: 10 });
	await page.mouse.up();
	await expect
		.poll(() => shortcut.evaluate((e) => parseInt(e.style.left)))
		.toBe(Math.round(before.x + 100));
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					anura.settings
						.get("nebula.horizon.shortcuts")
						?.find((s) => s.id === "anura.settings")?.x,
			),
		)
		.toBe(Math.round(before.x + 100));
	await page.reload();
	await page.waitForFunction(() => window.anura?.initComplete);
	await page.getByRole("button", { name: "Got it", exact: true }).click();
	await expect(shortcut).toBeVisible();
	await shortcut.dblclick();
	await expect(
		page.getByRole("combobox", { name: "Desktop environment" }),
	).toHaveValue("horizon");
	await page.evaluate(() =>
		anura.apps["anura.settings"].windows.forEach((w) => w.close()),
	);
	await shortcut.focus();
	await page.keyboard.press("Delete");
	await expect(shortcut).toHaveCount(0);
	await page.evaluate(() => anura.apps["anura.wallpaper"].open());
	await expect(
		page.getByRole("dialog", { name: "Wallpaper switcher", exact: true }),
	).toBeVisible();
	await page.screenshot({ path: "../NebulaHub-horizon-wallpapers.png" });
});
test("Music discovery shelves use returned YouTube metadata and add to the shared playlist", async ({
	page,
}) => {
	await boot(page);
	await page.evaluate(() => {
		const html =
			"var ytInitialData = " +
			JSON.stringify({
				contents: [
					{
						videoRenderer: {
							videoId: "dQw4w9WgXcQ",
							title: { runs: [{ text: "Discovery test song" }] },
							ownerText: { runs: [{ text: "Test artist" }] },
							lengthText: { simpleText: "3:33" },
						},
					},
				],
			}) +
			";";
		anura.net.fetch = async () => new Response(html, { status: 200 });
		anura.net.libcurl = anura.net.libcurl || { fetch() {} };
		anura.apps["nebula.music"].open();
	});
	const app = page.locator(".nm-app");
	for (const name of ["Popular picks", "Fresh signals", "Deep space"]) {
		const shelf = app.getByRole("region", { name, exact: true });
		await expect(shelf).toContainText("Discovery test song");
	}
	const shelf = app.getByRole("region", { name: "Popular picks", exact: true });
	await shelf
		.getByRole("button", { name: "Add to playlist", exact: true })
		.click();
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					anura.settings.get("nebula.music.library")?.playlists[0].tracks[0]
						?.title,
			),
		)
		.toBe("Discovery test song");
	await expect(
		app.getByRole("region", { name: "Recently played", exact: true }),
	).toContainText("Songs you play will appear here.");
});
test("Lock screen shows connection and offers password visibility without bypassing lock", async ({
	page,
}) => {
	await boot(page);
	await page.evaluate(() =>
		window.dispatchEvent(new Event("nebula:lock-request")),
	);
	const lock = page.getByRole("dialog", { name: "Lock screen", exact: true });
	await expect(lock).toContainText("No password set");
	await expect(lock).toContainText("Online");
	await page
		.getByRole("button", { name: "Return to desktop", exact: true })
		.click();
	await expect(lock).toHaveCount(0);
});
