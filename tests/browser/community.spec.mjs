import { test, expect } from "@playwright/test";
const owner = {
	sub: "123456",
	email: "gamergeek1107@gmail.com",
	name: "Developer",
};
test("developer reviews and applies an account suspension", async ({ page }) => {
	const calls = await mockAPI(page, owner, true);
	await page.route("**/api/community?action=members", route => route.fulfill({ json: { members: [{ id: "a".repeat(64), name: "Test Pilot", email: "pilot@example.com", lastSignIn: Date.now(), restriction: null, protected: false }], cursor: null } }));
	await page.route("**/api/community?action=moderate", route => {
		const body = route.request().postDataJSON(); calls.push({ action: "moderate", body });
		return route.fulfill({ json: { restriction: { kind: body.kind, reason: body.reason, until: Date.now() + 86400000 } } });
	});
	await page.addInitScript(() => localStorage.setItem("nebula.welcome.v1.default", "complete"));
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.apps["nebula.developer"]);
	await page.evaluate(() => anura.apps["nebula.developer"].open());
	await page.getByLabel("Moderation reason for pilot@example.com").fill("Test community rule");
	page.once("dialog", dialog => dialog.accept());
	await page.getByRole("button", { name: "Review action", exact: true }).click();
	await expect(page.locator(".nc-member")).toContainText("suspended until");
	expect(calls.find(c => c.action === "moderate").body.kind).toBe("suspended");
});
async function mockAPI(page, user = null, isOwner = false) {
	const calls = [];
	let announcement = null;
	await page.route("**/api/community?**", async (route) => {
		const request = route.request(),
			action = new URL(request.url()).searchParams.get("action");
		calls.push({ action, body: request.postDataJSON() });
		let data = { ok: true };
		if (action === "session") data = { configured: true, user, owner: isOwner };
		if (action === "announcements") data = { announcement };
		if (action === "announcement") {
			announcement = {
				...request.postDataJSON(),
				id: "announcement-one",
				expires: Date.now() + 3600000,
			};
			data = { announcement };
		}
		if (action === "dashboard")
			data = {
				announcement,
				sessions: 2,
				counts: { "app.open:nebula.games": 3 },
				recent: [],
				truncated: false,
			};
		if (action === "consent")
			data = { enabled: request.postDataJSON().enabled };
		if (action === "members") data = { members: [], cursor: null };
		await route.fulfill({ json: data });
	});
	return calls;
}
test("owner sees developer panel, previews plain text and publishes through the API", async ({
	page,
}) => {
	const calls = await mockAPI(page, owner, true);
	await page.addInitScript(() =>
		localStorage.setItem("nebula.welcome.v1.default", "complete"),
	);
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.apps["nebula.developer"]);
	await page.evaluate(() => anura.apps["nebula.developer"].open());
	const root = page.locator(".nebula-community");
	await expect(root.getByText("Usage · last 24 hours")).toBeVisible();
	await root
		.getByLabel("Announcement", { exact: true })
		.fill("Welcome, pilots! <b>Plain text only</b>");
	await expect(root.locator(".nc-preview")).toHaveText(
		"Welcome, pilots! <b>Plain text only</b>",
	);
	await root
		.getByRole("button", { name: "Publish announcement", exact: true })
		.click();
	await expect(root.getByRole("status").filter({ hasText: "Published to NebulaHub." })).toHaveText("Published to NebulaHub.");
	expect(calls.find((c) => c.action === "announcement").body.text).toContain(
		"<b>",
	);
	await page.screenshot({ path: "../../outputs/Nebula-Developer-Panel.png" });
});
test("existing opt-outs remain off and visitors do not see developer controls", async ({
	page,
}) => {
	const calls = await mockAPI(page);
	await page.addInitScript(() => {
		localStorage.setItem("nebula.welcome.v1.default", "complete");
		localStorage.setItem("nebula.activity.optin.default", "false");
	});
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.apps["nebula.community"]);
	await page.evaluate(() => anura.apps["nebula.community"].open());
	const root = page.locator(".nebula-community");
	await expect(
		root.getByRole("checkbox", { name: "Share basic usage activity" }),
	).not.toBeChecked();
	expect(await page.evaluate(() => !!anura.apps["nebula.developer"])).toBe(
		false,
	);
	expect(
		calls.some((c) => c.action === "events" || c.action === "consent"),
	).toBe(false);
	await root
		.getByRole("checkbox", { name: "Share basic usage activity" })
		.check();
	await expect(root.getByRole("status")).toHaveText(
		"Activity sharing enabled.",
	);
	await page.evaluate(() => {
		anura.apps["nebula.games"].open();
		Object.defineProperty(document, "hidden", {
			configurable: true,
			value: true,
		});
		document.dispatchEvent(new Event("visibilitychange"));
	});
	await expect
		.poll(() => calls.filter((c) => c.action === "events").length)
		.toBe(1);
	expect(calls.find((c) => c.action === "events").body.events).toEqual(
		expect.arrayContaining([
			{ type: "visit", target: "desktop" },
			{ type: "app.open", target: "nebula.games" },
		]),
	);
	await page.evaluate(() => {
		Object.defineProperty(document, "hidden", {
			configurable: true,
			value: false,
		});
		anura.apps["nebula.community"].open();
	});
	await root
		.getByRole("checkbox", { name: "Share basic usage activity" })
		.uncheck();
	await expect(root.getByRole("status")).toContainText("stopped");
});
test("new profiles report basic usage by default with visible privacy controls", async ({
	page,
}) => {
	const calls = await mockAPI(page);
	await page.addInitScript(() =>
		localStorage.setItem("nebula.welcome.v1.default", "complete"),
	);
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.apps["nebula.community"]);
	await expect
		.poll(() => calls.some((c) => c.action === "consent" && c.body.enabled))
		.toBe(true);
	await page.evaluate(() => anura.apps["nebula.community"].open());
	await expect(
		page.getByRole("checkbox", { name: "Share basic usage activity" }),
	).toBeChecked();
});
test("browser privacy signal disables default reporting", async ({ page }) => {
	const calls = await mockAPI(page);
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "globalPrivacyControl", { value: true });
		localStorage.setItem("nebula.welcome.v1.default", "complete");
	});
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.apps["nebula.community"]);
	await page.evaluate(() => anura.apps["nebula.community"].open());
	await expect(
		page.getByRole("checkbox", { name: "Share basic usage activity" }),
	).toBeDisabled();
	expect(
		calls.some((c) => c.action === "consent" || c.action === "events"),
	).toBe(false);
});
test("required sign-in stops boot for guests", async ({ page }) => {
	await page.route("**/api/community?**", (route) =>
		route.fulfill({
			json: { requireSignIn: true, configured: true, user: null },
		}),
	);
	await page.goto("/");
	await expect(page.locator("#nebula-signin-required")).toBeVisible();
	expect(await page.evaluate(() => !!window.anura?.initComplete)).toBe(false);
});
test("suspended accounts see reason and expiry before desktop initialization", async ({
	page,
}) => {
	await page.route("**/api/community?**", (route) =>
		route.fulfill({
			json: {
				requireSignIn: true,
				user: owner,
				restriction: {
					kind: "suspended",
					reason: "Test restriction",
					until: Date.now() + 3600000,
				},
			},
		}),
	);
	await page.goto("/");
	await expect(page.locator("#nebula-access-restriction")).toContainText(
		"Test restriction",
	);
	expect(await page.evaluate(() => !!window.anura?.initComplete)).toBe(false);
});
test("Google callback creates a linked local profile without a password or exported session", async ({
	page,
}) => {
	await mockAPI(page, owner, true);
	await page.goto("/?google=connected");
	await page.waitForFunction(() => window.anura?.initComplete);
	const accounts = await page.evaluate(() =>
		JSON.parse(localStorage.getItem("nebula.accounts.v1")),
	);
	expect(accounts).toHaveLength(1);
	expect(accounts[0].google.sub).toBe(owner.sub);
	expect(accounts[0].hash).toBeUndefined();
	await page
		.getByRole("dialog", { name: "Welcome to NebulaHub" })
		.getByRole("button", { name: "Continue later" })
		.click();
	await page.evaluate(() => anura.apps["nebula.accounts"].open());
	const dl = page.waitForEvent("download");
	await page.getByRole("button", { name: "Export .hub", exact: true }).click();
	const download = await dl;
	const fs = await import("node:fs/promises");
	const text = await fs.readFile(await download.path(), "utf8");
	const data = JSON.parse(text);
	expect(data.version).toBe(2);
	expect(data.googleProfile.sub).toBe(owner.sub);
	expect(data.googleProfile).not.toHaveProperty("owner");
	expect(text).not.toContain("token");
	await page.reload();
	await page.waitForFunction(() => window.anura?.initComplete);
	expect(
		await page.evaluate(
			() => JSON.parse(localStorage.getItem("nebula.accounts.v1")).length,
		),
	).toBe(1);
});
