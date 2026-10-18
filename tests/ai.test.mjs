import test from "node:test";
import assert from "node:assert/strict";
import { isFree } from "../netlify/functions/nebula-ai.mjs";
test("free-only gate rejects paid, missing, malformed and renamed pricing", () => {
	assert.equal(
		isFree({ id: "x:free", pricing: { prompt: "0", completion: "0" } }),
		true,
	);
	for (const model of [
		{ id: "x", pricing: { prompt: 0, completion: 0 } },
		{ id: "x:free" },
		{ id: "x:free", pricing: { prompt: 0, completion: 0.1 } },
		{ id: "x:free", pricing: { prompt: 0, completion: 0, request: 1 } },
		{ id: "x:free", pricing: { prompt: "unknown", completion: 0 } },
	])
		assert.equal(isFree(model), false);
});
