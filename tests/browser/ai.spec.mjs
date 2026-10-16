import { test, expect } from "@playwright/test";
test("Nebula AI streams, saves history and offers four free roles", async ({
	page,
}) => {
	await page.context().route("**/api/nebula-ai", async (route) => {
		if (route.request().method() === "GET")
			return route.fulfill({
				json: {
					models: [
						{
							id: "test:free",
							name: "Nebula",
							use: "General",
							model: "Test fixture",
						},
					],
				},
			});
		return route.fulfill({
			contentType: "text/event-stream",
			body: 'data: {"choices":[{"delta":{"content":"Hello from a test fixture. <script>unsafe</script>"}}]}\n\ndata: [DONE]\n\n',
		});
	});
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.initComplete);
	await page.getByRole("button", { name: "Got it", exact: true }).click();
	await page.evaluate(() => anura.apps["nebula.ai"].open());
	await expect(page.locator(".nebula-ai select")).toContainText(
		"Nebula (General",
	);
	await page
		.getByRole("textbox", { name: "Message", exact: true })
		.fill("Hello");
	await page.getByRole("button", { name: "Send ↑", exact: true }).click();
	await expect(page.locator(".nebula-ai article.assistant")).toContainText(
		"Hello from a test fixture.",
	);
	await expect(page.locator(".nebula-ai article script")).toHaveCount(0);
	await page.getByRole("button", { name: "＋ New chat", exact: true }).click();
	await page.locator(".nebula-ai .history button").click();
	await expect(page.locator(".nebula-ai article")).toHaveCount(2);
	await page.screenshot({ path: "../../outputs/Nebula-AI.png" });
});
