import { test, expect } from "@playwright/test";
test.skip(
	!process.env.NEBULA_LINUX_TESTS,
	"Opt in: downloads and installs the real 1 GiB Linux disk.",
);
test("optional Linux image installs and boots v86", async ({ page }) => {
	test.setTimeout(900000);
	page.on("console", (msg) => {
		if (msg.text().startsWith("SERIAL0:")) console.log(msg.text());
	});
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.initComplete);
	await page.evaluate(async () => {
		await anura.settings.set("x86-image", "alpine");
		const tracker = document.createElement("p");
		document.body.append(tracker);
		new MutationObserver(() =>
			console.log("SERIAL0: install " + tracker.textContent),
		).observe(tracker, { childList: true });
		await installx86(tracker);
		await anura.settings.set("x86-disabled", false);
	});
	await page.reload();
	await page.waitForFunction(
		() => window.anura?.x86?.ready,
		{},
		{ timeout: 240000 },
	);
	expect(await page.evaluate(() => anura.x86.ready)).toBe(true);
	await page.evaluate(() =>
		anura.apps["anura.ashell"].open(["--cmd", "/usr/bin/x86-run.ajs"]),
	);
	await page.screenshot({ path: "test-results/linux.png" });
});
