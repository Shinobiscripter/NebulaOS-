import { getStore } from "@netlify/blobs";
import { cleanupCommunity } from "../lib/community.mjs";
export const config = { schedule: "17 4 * * *" };
export default async () => {
	await cleanupCommunity(
		getStore({ name: "nebula-community-v1", consistency: "strong" }),
	);
	return new Response(null, { status: 204 });
};
