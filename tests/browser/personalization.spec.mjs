import { test, expect } from "@playwright/test";
const boot = async (page) => {
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.initComplete);
};
const event = async (page, name) =>
	page.evaluate((name) => window.dispatchEvent(new Event(name)), name);
const unlock = async (page, password) => {
	await page
		.getByRole("textbox", { name: "Password", exact: true })
		.fill(password);
	await page.getByRole("button", { name: "Unlock", exact: true }).click();
	await page.waitForFunction(() => window.anura?.initComplete);
	await expect(
		page.getByRole("dialog", { name: "Lock screen", exact: true }),
	).toHaveCount(0);
};
test("local accounts preserve existing files, lock before boot, and isolate new account data", async ({
	page,
}) => {
	await boot(page);
	await page.evaluate(async () => {
		await anura.fs.promises.writeFile("/account-proof.txt", "Original account");
		await anura.settings.set("nebula.flow.note", "Private first note");
	});
	await event(page, "nebula:accounts");
	const accounts = page.getByRole("dialog", {
		name: "Local accounts",
		exact: true,
	});
	await accounts
		.getByRole("textbox", { name: "Account name", exact: true })
		.fill("Pilot");
	await accounts
		.getByRole("textbox", { name: "New password", exact: true })
		.fill("test-orbit-824!");
	await accounts
		.getByRole("textbox", { name: "Confirm password", exact: true })
		.fill("test-orbit-824!");
	await accounts
		.getByRole("button", {
			name: "Create account for this desktop",
			exact: true,
		})
		.click();
	await expect(accounts).toContainText(
		"Your existing files and settings are preserved.",
	);
	await page.reload();
	await expect(
		page.getByRole("dialog", { name: "Lock screen", exact: true }),
	).toBeVisible();
	expect(await page.evaluate(() => Boolean(window.anura?.initComplete))).toBe(
		false,
	);
	await page
		.getByRole("textbox", { name: "Password", exact: true })
		.fill("wrong-password");
	await page.getByRole("button", { name: "Unlock", exact: true }).click();
	await expect(page.getByRole("status")).toContainText("Incorrect password");
	await expect(
		page.getByRole("button", { name: "Unlock", exact: true }),
	).toBeEnabled();
	await unlock(page, "test-orbit-824!");
	expect(
		await page.evaluate(async () =>
			new TextDecoder().decode(
				await anura.fs.promises.readFile("/account-proof.txt"),
			),
		),
	).toBe("Original account");
	await event(page, "nebula:accounts");
	await accounts
		.getByRole("textbox", { name: "Account name", exact: true })
		.fill("Navigator");
	await accounts
		.getByRole("textbox", { name: "New password", exact: true })
		.fill("test-nova-824!");
	await accounts
		.getByRole("textbox", { name: "Confirm password", exact: true })
		.fill("test-nova-824!");
	await accounts
		.getByRole("button", { name: "Create separate account", exact: true })
		.click();
	await expect(accounts).toContainText(
		"Account created. Lock the desktop to switch accounts.",
	);
	await accounts
		.getByRole("button", { name: "Lock / switch account", exact: true })
		.click();
	await page
		.getByRole("combobox", { name: "Local account", exact: true })
		.selectOption({ label: "Navigator" });
	await page
		.getByRole("button", { name: "Switch account", exact: true })
		.click();
	await expect(
		page.getByRole("button", { name: "Unlock", exact: true }),
	).toBeVisible();
	await unlock(page, "test-nova-824!");
	expect(
		await page.evaluate(async () => {
			try {
				await anura.fs.promises.readFile("/account-proof.txt");
				return true;
			} catch {
				return false;
			}
		}),
	).toBe(false);
	expect(
		await page.evaluate(() => anura.settings.get("nebula.flow.note")),
	).toBeUndefined();
	await page.evaluate(async () => {
		await anura.fs.promises.writeFile("/account-proof.txt", "Second account");
		await anura.settings.set("nebula.flow.note", "Second note");
	});
	await event(page, "nebula:lock-request");
	await page
		.getByRole("combobox", { name: "Local account" })
		.selectOption({ label: "Pilot" });
	await page.getByRole("button", { name: "Switch account" }).click();
	await expect(
		page.getByRole("button", { name: "Unlock", exact: true }),
	).toBeVisible();
	await unlock(page, "test-orbit-824!");
	expect(
		await page.evaluate(async () =>
			new TextDecoder().decode(
				await anura.fs.promises.readFile("/account-proof.txt"),
			),
		),
	).toBe("Original account");
	expect(
		await page.evaluate(() => anura.settings.get("nebula.flow.note")),
	).toBe("Private first note");
	await event(page, "nebula:lock-request");
	await page.keyboard.press("Escape");
	await page.keyboard.press("Control+k");
	await expect(
		page.getByRole("dialog", { name: "Lock screen", exact: true }),
	).toBeVisible();
	await unlock(page, "test-orbit-824!");
});
test("custom Flow shortcuts persist, reject conflicts and trigger actions", async ({
	page,
}) => {
	await boot(page);
	await page.evaluate(async () => {
		await anura.settings.set("nebula.desktop.environment", "flow");
		window.dispatchEvent(new Event("nebula:environment"));
	});
	await event(page, "nebula:keybinds");
	const prefs = page.getByRole("dialog", { name: "Flow keyboard shortcuts" });
	await prefs
		.getByRole("button", { name: "Change Scratchpad", exact: true })
		.click();
	await page.keyboard.press("Control+Alt+KeyT");
	await expect(prefs).toContainText("already assigned");
	await page.keyboard.press("Control+Alt+KeyY");
	await expect(prefs).toContainText("Shortcut saved.");
	await prefs.getByRole("button", { name: "Close shortcuts" }).click();
	await page.keyboard.press("Control+Alt+KeyY");
	await expect(
		page.getByRole("textbox", { name: "Scratchpad text" }),
	).toBeVisible();
	await page.reload();
	await page.waitForFunction(() => window.anura?.initComplete);
	await page.keyboard.press("Control+Alt+KeyY");
	await expect(
		page.getByRole("textbox", { name: "Scratchpad text" }),
	).toBeVisible();
	await page.getByRole("button", { name: "Close scratchpad" }).click();
	await page.keyboard.press("Control+Alt+KeyL");
	await expect(
		page.getByRole("dialog", { name: "Lock screen", exact: true }),
	).toBeVisible();
	await page.getByRole("button", { name: "Return to desktop" }).click();
});
test("wallpaper picker saves images and automatically pairs accents", async ({
	page,
}) => {
	await boot(page);
	await event(page, "nebula:wallpapers");
	const picker = page.getByRole("dialog", {
		name: "Wallpaper switcher",
		exact: true,
	});
	await picker
		.getByRole("button", { name: "Apply Flow — Ringed horizon", exact: true })
		.click();
	await expect(picker.getByRole("status")).toContainText(
		"Saved for offline use.",
	);
	const first = await page.evaluate(() => anura.ui.theme.accent);
	expect(first).toMatch(/^#[0-9a-f]{6}$/);
	await picker
		.getByRole("button", { name: "Apply Nebula — Quiet orbit", exact: true })
		.click();
	await expect(picker.getByRole("status")).toContainText("Applied Nebula");
	const second = await page.evaluate(() => anura.ui.theme.accent);
	expect(second).not.toBe(first);
	const path = await page.evaluate(() => anura.settings.get("wallpaper"));
	expect(path).toContain("/fs/.nebula-wallpapers/");
	await picker
		.getByRole("button", { name: "Close wallpaper switcher" })
		.click();
	await page.reload();
	await page.waitForFunction(() => window.anura?.initComplete);
	expect(await page.evaluate(() => anura.settings.get("wallpaper"))).toBe(path);
	expect(await page.evaluate(() => anura.ui.theme.accent)).toBe(second);
});
test("public repository wallpaper catalog loads", async ({ page }) => {
	test.skip(
		!process.env.NEBULA_ONLINE_TESTS,
		"Opt-in public GitHub integration",
	);
	await boot(page);
	await event(page, "nebula:wallpapers");
	const picker = page.getByRole("dialog", {
		name: "Wallpaper switcher",
		exact: true,
	});
	await picker
		.getByRole("combobox", { name: "Wallpaper source" })
		.selectOption("D3Ext/aesthetic-wallpapers");
	await expect(picker.getByRole("status")).toContainText("wallpapers. Select", {
		timeout: 30000,
	});
	const first = picker.locator(".nebula-wallpaper-card").first();
	await expect(first).toBeVisible();
	await first.click();
	await expect(picker.getByRole("status")).toContainText(
		"Saved for offline use.",
		{ timeout: 30000 },
	);
});
