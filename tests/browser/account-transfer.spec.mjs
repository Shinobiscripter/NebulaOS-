import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("exports .hub and imports into a separate browser profile without overwriting existing data", async ({
	page,
	browser,
}) => {
	async function open(p) {
		await p.goto(process.env.NEBULA_BASE_URL || "http://localhost:8000");
		await p.waitForFunction(() => window.anura?.initComplete);
		const notice = p.getByRole("button", { name: "Got it", exact: true });
		if (await notice.count()) await notice.click();
		await p.evaluate(() => anura.apps["nebula.accounts"].open());
		return p.locator(".nebula-account-center");
	}
	const app = await open(page);
	await app.getByRole("button", { name: "Add account", exact: true }).click();
	await app
		.getByRole("textbox", { name: "Account label", exact: true })
		.fill("Travel profile");
	await app
		.getByRole("textbox", { name: "Username or email (optional)", exact: true })
		.fill("pilot");
	await app.getByRole("button", { name: "Save account", exact: true }).click();
	await app
		.getByRole("button", { name: "Favorite Travel profile", exact: true })
		.click();
	const downloading = page.waitForEvent("download");
	await app.getByRole("button", { name: "Export .hub", exact: true }).click();
	const download = await downloading;
	expect(download.suggestedFilename()).toBe("NebulaHub-accounts.hub");
	const buffer = await readFile(await download.path());
	const data = JSON.parse(buffer.toString());
	expect(data.accounts[0].handle).toBe("pilot");
	expect(data.accounts[0].favorite).toBe(true);
	const context = await browser.newContext();
	try {
		const destination = await context.newPage();
		const target = await open(destination);
		const upload = {
			name: "accounts.hub",
			mimeType: "application/json",
			buffer,
		};
		const chooserPromise = destination.waitForEvent("filechooser");
		await target
			.getByRole("button", { name: "Import .hub", exact: true })
			.click();
		await (await chooserPromise).setFiles(upload);
		await expect(
			target.getByRole("article", { name: "GitHub: Travel profile" }),
		).toBeVisible();
		await expect(target.locator(".nac-status")).toContainText(
			"Imported 1 profiles",
		);
		await target
			.getByLabel("Import .hub file", { exact: true })
			.setInputFiles(upload);
		await expect(target.locator(".nac-status")).toContainText(
			"1 duplicate labels skipped",
		);
		await target
			.getByLabel("Import .hub file", { exact: true })
			.setInputFiles({
				name: "bad.hub",
				mimeType: "application/json",
				buffer: Buffer.from("{}"),
			});
		await expect(target.locator(".nac-status")).toContainText("Import failed");
		await destination.reload();
		await destination.waitForFunction(() => window.anura?.initComplete);
		await destination.evaluate(() => anura.apps["nebula.accounts"].open());
		await expect(
			destination.getByRole("article", { name: "GitHub: Travel profile" }),
		).toHaveCount(1);
	} finally {
		await context.close();
	}
});
