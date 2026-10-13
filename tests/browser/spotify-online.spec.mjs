import { test, expect } from "@playwright/test";
test("Spotify renders and plays a preview through the real proxy", async ({
	page,
}) => {
	test.skip(
		!process.env.NEBULA_ONLINE_TESTS,
		"Uses Spotify and a live Wisp relay",
	);
	test.setTimeout(120000);
	const errors = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.initComplete);
	const card = page.getByRole("region", {
		name: "Spotify widget",
		exact: true,
	});
	await card
		.getByRole("textbox", { name: "Spotify link" })
		.fill("https://open.spotify.com/track/0Lr4kGOYn9l83EjuK6cZFQ");
	await card.getByRole("button", { name: "Load through proxy" }).click();
	await expect(card.locator("iframe")).toHaveAttribute(
		"src",
		/nebulaSpotify=/,
		{ timeout: 80000 },
	);
	await expect
		.poll(
			() =>
				page
					.frames()
					.some(
						(f) => f.url().includes("/~/sj/") && f.url().includes("spotify"),
					),
			{ timeout: 30000 },
		)
		.toBe(true);
	const spotify = page
		.frames()
		.find((f) => f.url().includes("/~/sj/") && f.url().includes("spotify"));
	await expect(
		spotify.getByRole("button", { name: "Play", exact: true }),
	).toBeVisible({ timeout: 30000 });
	// Spotify renders a server-side Play button before its player is hydrated.
	await spotify.waitForLoadState("networkidle", { timeout: 30000 });
	await spotify.getByRole("button", { name: "Play", exact: true }).click();
	await expect
		.poll(
			() =>
				spotify
					.locator("video,audio")
					.evaluateAll((media) =>
						media.some((m) => m.currentTime > 0 && !m.paused),
					),
			{ timeout: 30000 },
		)
		.toBe(true);
	await card.getByRole("button", { name: "Stop", exact: true }).click();
	await expect(card.locator("iframe")).toHaveCount(0);
	expect(errors).toEqual([]);
});
