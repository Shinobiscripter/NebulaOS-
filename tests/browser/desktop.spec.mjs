import { test, expect } from "@playwright/test";

async function boot(page) {
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.initComplete === true);
	await expect(page.locator(".bootsplash")).toHaveCount(0);
}
test("fresh boot, real desktop applications, persistence and PWA", async ({
	page,
}) => {
	const errors = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await boot(page);
	await expect(page).toHaveTitle("NebulaHub");
	expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
	expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(
		true,
	);
	expect(await page.evaluate(() => window.anura.x86 == null)).toBe(true);
	await page.getByRole("button", { name: "Open launcher" }).click();
	await expect(page.locator(".appsView")).toBeVisible();
	// Anura closes menus through its click-off layer above the taskbar.
	await page.mouse.click(1100, 200);
	for (const id of [
		"anura.settings",
		"anura.fsapp",
		"anura.ashell",
		"nebula.games",
	]) {
		await page.evaluate((id) => window.anura.apps[id].open(), id);
	}
	const games = page.frameLocator('iframe[src*="nebula-games.app/index.html"]');
	await expect(games.locator(".game")).toHaveCount(46);
	await games.getByRole("searchbox").fill("basket random");
	await expect(games.locator(".game")).toHaveCount(1);
	await games.getByRole("button", { name: "Favorite Basket Random" }).click();
	await expect(
		games.getByRole("button", { name: "Favorite Basket Random" }),
	).toHaveAttribute("aria-pressed", "true");
	await page.evaluate(async () => {
		await window.anura.settings.set("nebula.test", "persistent");
		await window.anura.fs.promises.writeFile(
			"/nebula-test.txt",
			"persistent file",
		);
	});
	await page.screenshot({ path: "test-results/desktop.png" });
	await page.reload();
	await page.waitForFunction(() => window.anura?.initComplete);
	expect(
		await page.evaluate(() => window.anura.settings.get("nebula.test")),
	).toBe("persistent");
	expect(
		await page.evaluate(async () =>
			new TextDecoder().decode(
				await window.anura.fs.promises.readFile("/nebula-test.txt"),
			),
		),
	).toBe("persistent file");
	await page.evaluate(() => window.anura.apps["nebula.games"].open());
	await games.getByRole("button", { name: "Favorites", exact: true }).click();
	await expect(games.locator(".game")).toHaveCount(1);
	await page.evaluate(() =>
		window.anura.apps["nebula.games"].windows.forEach((win) => win.close()),
	);
	await expect(
		page.locator('iframe[src*="nebula-games.app/index.html"]'),
	).toHaveCount(0);
	expect(errors).toEqual([]);
});
test("production responses, isolation boundary and WASM", async ({
	request,
}) => {
	const root = await request.get("/");
	expect(root.status()).toBe(200);
	expect(root.headers()["cross-origin-embedder-policy"]).toBe("require-corp");
	const player = await request.get("/play/index.html");
	expect(player.status()).toBe(200);
	expect(player.headers()["cross-origin-embedder-policy"]).toBeUndefined();
	const missing = await request.get("/does-not-exist.wasm");
	expect(missing.status()).toBe(404);
	const manifest = await (await request.get("/manifest.json")).json();
	expect(manifest.name).toBe("NebulaHub");
	for (const icon of manifest.icons)
		expect((await request.get(icon.src)).status()).toBe(200);
	for (const path of ["/lib/v86.wasm", "/libs/libcurl/libcurl.wasm"]) {
		const response = await request.get(path);
		expect(response.status()).toBe(200);
		expect(response.headers()["content-type"]).toBe("application/wasm");
		expect(WebAssembly.validate(await response.body())).toBe(true);
	}
});
test("terminal executes commands and browser UI loads", async ({ page }) => {
	await boot(page);
	await page.evaluate(() => window.anura.apps["anura.ashell"].open());
	const terminal = page
		.frameLocator('iframe[src*="ashell.app/term.html"]')
		.frameLocator("#terminal iframe");
	await expect(terminal.locator("x-screen")).toBeVisible();
	await terminal.locator("x-screen").click();
	await page.keyboard.type("echo NEBULA_TERMINAL_OK");
	await page.keyboard.press("Enter");
	await expect(
		terminal.locator("x-row").filter({ hasText: /^NEBULA_TERMINAL_OK$/ }),
	).toHaveCount(1);
	await page.screenshot({ path: "test-results/terminal.png" });
	await page.evaluate(() => window.anura.apps["anura.browser"].open());
	const browser = page.frameLocator('iframe[src="/browser/index.html"]');
	await expect(browser.locator("body")).not.toBeEmpty();
	await page.screenshot({ path: "test-results/browser.png" });
});
test("offline cache can reboot the desktop and open Games", async ({
	page,
	context,
}) => {
	test.setTimeout(120000);
	await boot(page);
	await page.evaluate(async () => {
		await window.anura.settings.set("use-sw-cache", true);
		await window.anura.settings.set("milestone", "__INVALID");
	});
	// Exercise the same reboot/update path used by Settings' offline switch.
	await page.reload();
	await page.waitForFunction(() => window.anura?.initComplete);
	// Wait for asynchronous filesystem-backed cache writes to finish before disconnecting.
	await page.waitForFunction(async () => {
		try {
			await window.anura.fs.promises.stat("/anura_files/index.html");
			await window.anura.fs.promises.stat(
				"/anura_files/apps/nebula-games.app/games.js",
			);
			return true;
		} catch {
			return false;
		}
	});
	await context.setOffline(true);
	const offlineResponse = await page.reload();
	expect(offlineResponse.status(), await offlineResponse.text()).toBe(200);
	await page.waitForFunction(() => window.anura?.initComplete);
	await page.evaluate(() => window.anura.apps["nebula.games"].open());
	await expect(
		page
			.frameLocator('iframe[src*="nebula-games.app/index.html"]')
			.locator(".game"),
	).toHaveCount(46);
	await context.setOffline(false);
});
