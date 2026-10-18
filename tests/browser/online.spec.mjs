import { test, expect } from "@playwright/test";
test.skip(
	!process.env.NEBULA_ONLINE_TESTS,
	"External providers are checked explicitly, not in offline CI.",
);
test("representative game launches in tab and managed window", async ({
	page,
	context,
}) => {
	test.setTimeout(150000);
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.initComplete);
	await page.evaluate(() => window.anura.apps["nebula.games"].open());
	const library = page.frameLocator(
		'iframe[src*="nebula-games.app/index.html"]',
	);
	await library.getByRole("searchbox").fill("Awesome Tanks");
	const popupPromise = context.waitForEvent("page");
	await library
		.getByRole("button", { name: "Play Awesome Tanks", exact: true })
		.click();
	const popup = await popupPromise;
	await popup.waitForLoadState();
	expect(await popup.evaluate(() => crossOriginIsolated)).toBe(false);
	await expect(
		popup.frameLocator("iframe").locator("ruffle-player"),
	).toBeVisible({ timeout: 60000 });
	await popup.waitForFunction(
		() => {
			const player = document
				.querySelector("iframe")
				?.contentDocument?.querySelector("ruffle-player");
			return player?.readyState === 2;
		},
		null,
		{ timeout: 60000 },
	);
	await popup.screenshot({ path: "test-results/awesome-tanks.png" });
	await popup.close();
	await library.getByRole("searchbox").fill("n-gon");
	await library.getByRole("button", { name: "Open in window" }).click();
	const game = page
		.frameLocator('iframe[src*="/play/index.html"]')
		.frameLocator("iframe");
	await expect(game.locator("canvas")).toBeVisible({ timeout: 60000 });
	await page.screenshot({ path: "test-results/n-gon.png" });
});
