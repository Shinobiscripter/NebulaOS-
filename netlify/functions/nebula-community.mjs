import { getStore } from "@netlify/blobs";
import { createCommunityHandler } from "../lib/community.mjs";
export const config = {
	path: "/api/community",
	rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
export default async function handler(request) {
	const store = getStore({
		name: "nebula-community-v1",
		consistency: "strong",
	});
	return createCommunityHandler({ store })(request);
}
