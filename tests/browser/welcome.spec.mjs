import { test, expect } from "@playwright/test";

test("setup creates a real local account, applies a desktop, persists completion and replays", async ({
	page,
}) => {
	await page.goto("/");
	const guide = page.getByRole("dialog", { name: "Welcome to NebulaHub" });
	await expect(guide).toBeVisible({ timeout: 60000 });
	await page.screenshot({ path: "../../outputs/Nebula-Welcome.png" });
	await guide.getByRole("button", { name: "Get started", exact: true }).click();
	await guide.getByLabel("Account name", { exact: true }).fill("Test Pilot");
	await guide
		.getByLabel("New password", { exact: true })
		.fill("test-only-password");
	await guide
		.getByLabel("Confirm password", { exact: true })
		.fill("different-password");
	await guide.getByRole("button", { name: "Create local account" }).click();
	await expect(guide.getByRole("status")).toHaveText("Passwords do not match.");
	await guide
		.getByLabel("Confirm password", { exact: true })
		.fill("test-only-password");
	await guide.getByRole("button", { name: "Create local account" }).click();
	await expect(
		guide.getByRole("heading", { name: "Choose your desktop" }),
	).toBeVisible();
	const stored = await page.evaluate(() =>
		JSON.parse(localStorage.getItem("nebula.accounts.v1")),
	);
	expect(stored[0].id).toBe("default");
	expect(stored[0].hash).toHaveLength(64);
	expect(JSON.stringify(stored)).not.toContain("test-only-password");
	await guide.getByRole("button", { name: "Flow", exact: true }).click();
	await expect(
		guide.getByRole("button", { name: "Flow", exact: true }),
	).toHaveAttribute("aria-pressed", "true");
	await expect(page.locator("body")).toHaveClass(/nebula-env-flow/);
	await guide.getByRole("button", { name: "Continue", exact: true }).click();
	for (const group of [
		"Play",
		"Listen & watch",
		"Make it yours",
		"Your space",
		"Create & explore",
	]) {
		await guide.getByRole("button", { name: group, exact: true }).click();
		await expect(guide.locator(".nw-features article").first()).toBeVisible();
	}
	await guide.getByRole("button", { name: "Continue", exact: true }).click();
	await guide.getByRole("button", { name: "Enter NebulaHub" }).click();
	await expect(guide).toHaveCount(0);
	await page.reload();
	const lock = page.getByRole("dialog", { name: "Lock screen" });
	await lock.getByLabel("Password", { exact: true }).fill("test-only-password");
	await lock.getByRole("button", { name: "Unlock", exact: true }).click();
	await page.waitForFunction(() => window.anura?.initComplete);
	await expect(guide).toHaveCount(0);
	await page.evaluate(() => anura.apps["nebula.welcome"].open());
	await expect(guide).toBeVisible();
	await guide.getByRole("button", { name: "Get started", exact: true }).click();
	await expect(guide.getByText(/You're set, Test Pilot/)).toBeVisible();
	expect(
		await page.evaluate(
			() => JSON.parse(localStorage.getItem("nebula.accounts.v1")).length,
		),
	).toBe(1);
});

test("guide fits small screens with reduced motion and can be deferred", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/");
	const guide = page.getByRole("dialog", { name: "Welcome to NebulaHub" });
	await expect(guide).toBeVisible({ timeout: 60000 });
	expect(
		await guide.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
	).toBe(true);
	await guide.getByRole("button", { name: "Continue later" }).click();
	await expect(guide).toHaveCount(0);
	expect(
		await page.evaluate(() =>
			localStorage.getItem("nebula.welcome.v1.default"),
		),
	).toBeNull();
});
