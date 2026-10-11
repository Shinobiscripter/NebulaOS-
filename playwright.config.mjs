import { defineConfig } from "@playwright/test";
export default defineConfig({
	testDir: "./tests/browser",
	timeout: 90000,
	workers: 1,
	use: {
		baseURL: "http://localhost:8000",
		viewport: { width: 1366, height: 900 },
		screenshot: "only-on-failure",
		trace: "retain-on-failure",
	},
	webServer: {
		command: "node scripts/serve.mjs",
		url: "http://localhost:8000",
		reuseExistingServer: !process.env.CI,
		timeout: 30000,
	},
	reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],
});
