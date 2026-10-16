import { test, expect } from "@playwright/test";
test("fullscreen, visual layouts and Hextris gameplay", async ({ page }) => {
	const errors = [];
	page.on("pageerror", (e) => errors.push(e.message));
	await boot(page);
	const root = page.locator(".ng-mode");
	await root.getByRole("button", { name: "Fullscreen", exact: true }).click();
	await expect
		.poll(() => page.evaluate(() => !!document.fullscreenElement))
		.toBe(true);
	await page.screenshot({
		animations: "disabled",
		path: "../Game-Mode-Nova.png",
	});
	for (const [mode, name] of [
		["Deck", "Deck · handheld library"],
		["Pulse", "Pulse · tile dashboard"],
	]) {
		await root.getByRole("button", { name: "Settings", exact: true }).click();
		await root.getByRole("button", { name, exact: true }).click();
		await root.getByRole("button", { name: "Home", exact: true }).click();
		await page.screenshot({
			animations: "disabled",
			path: "../Game-Mode-" + mode + ".png",
		});
	}
	await root.getByRole("button", { name: "Marketplace", exact: true }).click();
	await root.getByRole("searchbox", { name: "Search games" }).fill("Hextris");
	await root.locator(".ng-card").click();
	await root
		.getByRole("button", { name: "Download — free", exact: true })
		.click();
	await expect(
		root.getByRole("button", { name: "Play", exact: true }),
	).toBeEnabled({ timeout: 60000 });
	await root.getByRole("button", { name: "Play", exact: true }).click();
	const hex = page.frameLocator('iframe[title="Hextris"]');
	await expect(hex.locator("#canvas")).toBeVisible();
	await hex.locator("#canvas").click({ position: { x: 200, y: 200 } });
	await page.keyboard.press("ArrowLeft");
	expect(errors).toEqual([]);
	page.once("dialog", (d) => d.accept());
	await root.getByRole("button", { name: "Close game", exact: true }).click();
	await root.getByRole("button", { name: "Desktop", exact: true }).click();
	await expect
		.poll(() => page.evaluate(() => !!document.fullscreenElement))
		.toBe(false);
});
async function boot(page) {
	await page.goto("/");
	await page.waitForFunction(
		() => window.anura?.initComplete && anura.apps["nebula.gamemode"],
	);
	await page.getByRole("button", { name: "Got it", exact: true }).click();
	await page.evaluate(() => anura.apps["nebula.gamemode"].open());
	await expect(page.locator(".ng-hero")).toBeVisible();
}
test("three modes share a persistent library, settings and real downloaded gameplay", async ({
	page,
	context,
}) => {
	await boot(page);
	const root = page.getByRole("dialog", { name: "NebulaHub Game Mode" });
	await expect(root).toHaveAttribute("data-mode", "nova");
	const started = Date.now();
	await root
		.getByRole("button", { name: "Download — free", exact: true })
		.click();
	await expect(
		root.getByRole("button", { name: "Play", exact: true }),
	).toBeEnabled({ timeout: 60000 });
	expect(Date.now() - started).toBeGreaterThanOrEqual(2000);
	await root.getByRole("button", { name: "Play", exact: true }).click();
	const game = page.frameLocator('iframe[title="2048"]');
	await expect(game.locator(".tile")).toHaveCount(2);
	await game.locator("body").click();
	await page.keyboard.press("ArrowLeft");
	await page.keyboard.press("ArrowDown");
	expect(await game.locator(".tile").count()).toBeGreaterThan(2);
	page.once("dialog", (d) => d.accept());
	await root.getByRole("button", { name: "Close game", exact: true }).click();
	await root.getByRole("button", { name: "Settings", exact: true }).click();
	await root
		.getByRole("checkbox", { name: "Performance overlay", exact: true })
		.check();
	await expect(root.locator(".ng-hud")).toContainText("FPS");
	await root.getByLabel("Overlay position").selectOption("bottom-left");
	await expect(root.locator(".ng-hud")).toHaveAttribute(
		"data-position",
		"bottom-left",
	);
	for (const [id, name] of [
		["deck", "Deck · handheld library"],
		["pulse", "Pulse · tile dashboard"],
	]) {
		await root.getByRole("button", { name, exact: true }).click();
		await expect(root).toHaveAttribute("data-mode", id);
		await expect(
			root.getByRole("checkbox", { name: "Performance overlay", exact: true }),
		).not.toBeChecked();
		await root.getByRole("button", { name: "Library", exact: true }).click();
		await expect(
			root.getByRole("button", { name: "2048", exact: true }),
		).toBeVisible();
		await root.getByRole("button", { name: "Settings", exact: true }).click();
	}
	await root.getByRole("button", { name: "Desktop", exact: true }).click();
	await expect(root).not.toBeVisible();
	await page.reload();
	await page.waitForFunction(
		() => window.anura?.initComplete && anura.apps["nebula.gamemode"],
	);
	await page.evaluate(() => anura.apps["nebula.gamemode"].open());
	await expect(root).toHaveAttribute("data-mode", "pulse");
	await root.getByRole("button", { name: "2048", exact: true }).click();
	await expect(
		root.getByRole("button", { name: "Play", exact: true }),
	).toBeVisible();
	await context.setOffline(true);
	await root.getByRole("button", { name: "Play", exact: true }).click();
	await expect(game.locator(".game-container")).toBeVisible();
	await context.setOffline(false);
});
test("store searches, installs online launchers honestly and rejects failed downloads", async ({
	page,
}) => {
	await boot(page);
	const root = page.locator(".ng-mode");
	await root.getByRole("button", { name: "Discover", exact: true }).click();
	await root.getByRole("searchbox", { name: "Search games" }).fill("bite");
	await expect(root.locator(".ng-card")).toHaveCount(1);
	await root.locator(".ng-card").click();
	await expect(root.locator(".ng-delivery")).toContainText("internet required");
	await root
		.getByRole("button", { name: "Add online game", exact: true })
		.click();
	await expect(
		root.getByRole("button", { name: "Play", exact: true }),
	).toBeEnabled();
	await root.getByRole("searchbox", { name: "Search games" }).fill("Hextris");
	await root.locator(".ng-card").click();
	await page.evaluate(() => {
		const original = window.fetch;
		window.fetch = (url, ...args) =>
			String(url).includes("/game-library/games/hextris/")
				? Promise.resolve(new Response("test failure", { status: 503 }))
				: original(url, ...args);
	});
	await root
		.getByRole("button", { name: "Download — free", exact: true })
		.click();
	await expect(root.locator(".ng-status")).toContainText("Not added");
	expect(
		await page.evaluate(
			() => anura.settings.get("nebula.gaming.library").hextris,
		),
	).toBeUndefined();
});
test("Files and Explore expose Game Mode across desktop environments", async ({
	page,
}) => {
	await boot(page);
	await page
		.locator(".ng-mode")
		.getByRole("button", { name: "Desktop", exact: true })
		.click();
	await page.evaluate(() => anura.apps["anura.fsapp"].open());
	const files = page.frames();
	await expect
		.poll(async () => {
			for (const frame of page.frames())
				if (
					frame !== page.mainFrame() &&
					(await frame.getByRole("button", { name: /Game Mode/ }).count())
				)
					return true;
			return false;
		})
		.toBe(true);
	for (const env of ["orbit", "flow", "horizon"]) {
		await page.evaluate(async (env) => {
			await anura.settings.set("nebula.desktop.environment", env);
			window.dispatchEvent(new Event("nebula:environment"));
		}, env);
		let found = false;
		for (const f of page.frames()) {
			if (f === page.mainFrame()) continue;
			const b = f.getByRole("button", { name: /Game Mode/ });
			if (await b.count()) {
				await b.click();
				found = true;
				break;
			}
		}
		expect(found).toBe(true);
		await expect(page.locator(".ng-mode")).toBeVisible();
		await page
			.locator(".ng-mode")
			.getByRole("button", { name: "Desktop", exact: true })
			.click();
	}
});
