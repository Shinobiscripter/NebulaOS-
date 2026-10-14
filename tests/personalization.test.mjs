import test from "node:test";
import assert from "node:assert/strict";
import {
	paletteFromPixels,
	parseRepository,
} from "../public/nebula/wallpapers.js";
import {
	bindingError,
	DEFAULT_BINDINGS,
	chord,
} from "../public/nebula/keybinds.js";
test("repository input accepts only public owner/repo coordinates", () => {
	assert.equal(
		parseRepository("https://github.com/dharmx/walls/"),
		"dharmx/walls",
	);
	for (const bad of [
		"https://evil.test/user/repo",
		"owner/repo/../../secret",
		"javascript:alert(1)",
	])
		assert.throws(() => parseRepository(bad));
});
test("wallpaper palette handles dark/transparent images and follows dominant color", () => {
	assert.match(
		paletteFromPixels(new Uint8ClampedArray([0, 0, 0, 0]))[0],
		/^#[0-9a-f]{6}$/,
	);
	const color = paletteFromPixels(
		new Uint8ClampedArray([180, 20, 20, 255, 185, 20, 20, 255, 0, 0, 0, 255]),
	)[0];
	assert.ok(parseInt(color.slice(1, 3), 16) > parseInt(color.slice(3, 5), 16));
});
test("shortcut validation rejects conflicts and reserved combinations", () => {
	assert.match(
		bindingError("Ctrl+Alt+KeyT", DEFAULT_BINDINGS, "notes"),
		/already/,
	);
	assert.match(
		bindingError("Ctrl+KeyW", DEFAULT_BINDINGS, "notes"),
		/reserved/,
	);
	assert.equal(bindingError("Ctrl+Alt+KeyY", DEFAULT_BINDINGS, "notes"), "");
	assert.equal(
		chord({
			key: "!",
			code: "Digit1",
			ctrlKey: true,
			altKey: true,
			shiftKey: true,
		}),
		"Ctrl+Alt+Shift+Digit1",
	);
});
