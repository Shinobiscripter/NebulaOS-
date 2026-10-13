import { test, expect } from "@playwright/test";
for (const reduced of [false, true]) {
	test(`real boot stages and ${reduced ? "reduced-motion" : "animated"} launch`, async ({
		page,
	}) => {
		await page.emulateMedia({
			reducedMotion: reduced ? "reduce" : "no-preference",
		});
		let release;
		const gate = new Promise((resolve) => {
			release = resolve;
		});
		await page.route("**/config.json", async (route) => {
			await gate;
			await route.continue();
		});
		await page.goto("/");
		const splash = page.locator(".nebula-boot");
		await expect(splash).toBeVisible();
		await expect(splash).toHaveAttribute("data-stage", "0");
		await expect(splash.locator("[aria-current=step]")).toHaveText("Storage");
		expect(
			await splash
				.locator(".nebula-boot-monogram")
				.evaluate((node) => node.namespaceURI),
		).toBe("http://www.w3.org/2000/svg");
		await expect(splash.locator(".nebula-boot-monogram")).toHaveCSS(
			"animation-name",
			reduced ? "none" : "nebula-draw",
		);
		if (!reduced)
			await page.screenshot({
				path: "test-results/NebulaHub-boot.png",
				animations: "disabled",
			});
		release();
		await page.waitForFunction(() => window.anura?.initComplete);
		await expect(splash).toHaveCount(0);
		await expect(
			page.getByRole("navigation", { name: "Desktop menu" }),
		).toBeVisible();
	});
}
