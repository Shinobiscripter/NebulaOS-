import { getStore } from "@netlify/blobs";
import { createAccessGate } from "../lib/access-gate.mjs";

export default async (request, context) =>
	createAccessGate(
		getStore({ name: "nebula-community-v1", consistency: "strong" }),
	)(request, () => context.next());

export const config = {
	path: "/*",
	excludedPath: [
		"/api/community",
		"/privacy",
		"/privacy/*",
		"/nebula/LICENSE.txt",
		"/nebula/CREDITS.txt",
		"/robots.txt",
	],
};
