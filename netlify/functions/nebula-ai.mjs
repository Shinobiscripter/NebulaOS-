export const config = {
	path: "/api/nebula-ai",
	rateLimit: { windowLimit: 12, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
export const personas = [
	{
		id: "google/gemma-4-26b-a4b-it:free",
		name: "Nebula",
		use: "General",
		model: "Google Gemma 4",
	},
	{
		id: "nvidia/nemotron-3.5-super-vl:free",
		name: "Pulsar",
		use: "Thinking",
		model: "NVIDIA Nemotron 3.5 Super VL",
	},
	{
		id: "cohere/north-mini-code:free",
		name: "Forge",
		use: "Coding",
		model: "Cohere North Mini Code",
	},
	{
		id: "liquid/lfm-2.5-2.6b:free",
		name: "Comet",
		use: "Fast",
		model: "Liquid LFM 2.5",
	},
];
export function isFree(model) {
	return (
		!!model?.id?.endsWith(":free") &&
		["prompt", "completion"].every(
			(k) => model.pricing?.[k] !== undefined && Number(model.pricing[k]) === 0,
		) &&
		Object.values(model.pricing || {}).every((v) => Number(v) === 0)
	);
}
let cached,
	expires = 0;
async function catalog() {
	if (cached && Date.now() < expires) return cached;
	const r = await fetch("https://openrouter.ai/api/v1/models", {
		signal: AbortSignal.timeout(15000),
	});
	if (!r.ok) throw Error("Model catalog unavailable");
	const data = await r.json();
	cached = personas.filter((p) =>
		data.data.some((m) => m.id === p.id && isFree(m)),
	);
	expires = Date.now() + 60000;
	return cached;
}
const json = (data, status = 200) =>
	Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export default async function handler(request) {
	try {
		const models = await catalog();
		if (request.method === "GET") return json({ models });
		if (request.method !== "POST")
			return json({ error: "Method not allowed" }, 405);
		const origin = request.headers.get("origin");
		if (origin && origin !== new URL(request.url).origin)
			return json({ error: "Origin not allowed" }, 403);
		if (!request.headers.get("content-type")?.includes("application/json"))
			return json({ error: "JSON required" }, 415);
		const reader = request.body?.getReader();
		let bytes = 0,
			parts = [];
		if (!reader) return json({ error: "Message required" }, 400);
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			bytes += value.length;
			if (bytes > 40000) {
				await reader.cancel();
				return json({ error: "Conversation too long. Start a new chat." }, 413);
			}
			parts.push(value);
		}
		const body = JSON.parse(await new Blob(parts).text());
		if (!models.some((m) => m.id === body.model))
			return json(
				{
					error:
						"This model is not currently verified free. Choose another model.",
				},
				400,
			);
		if (
			!Array.isArray(body.messages) ||
			!body.messages.length ||
			body.messages.length > 40 ||
			body.messages.some(
				(m) =>
					!["user", "assistant"].includes(m.role) ||
					typeof m.content !== "string" ||
					m.content.length > 12000,
			)
		)
			return json({ error: "Invalid conversation" }, 400);
		if (!process.env.OPENROUTER_API_KEY)
			return json({ error: "Chat service is not configured" }, 503);
		const upstream = await fetch(
			"https://openrouter.ai/api/v1/chat/completions",
			{
				method: "POST",
				signal: AbortSignal.timeout(90000),
				headers: {
					Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
					"Content-Type": "application/json",
					"HTTP-Referer": "https://nebulahub-shinobiscripter.netlify.app",
					"X-Title": "Nebula AI",
				},
				body: JSON.stringify({
					model: body.model,
					messages: body.messages.map(({ role, content }) => ({
						role,
						content,
					})),
					max_tokens: 4096,
					stream: true,
					provider: { max_price: { prompt: 0, completion: 0 } },
					reasoning: { exclude: true },
				}),
			},
		);
		if (!upstream.ok)
			return json(
				{
					error:
						upstream.status === 429
							? "The shared free allowance is busy or exhausted. Try again later."
							: "The free provider is unavailable. Try another model.",
				},
				upstream.status === 429 ? 429 : 502,
			);
		return new Response(upstream.body, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-store",
				"X-Content-Type-Options": "nosniff",
			},
		});
	} catch {
		return json(
			{
				error:
					"The service could not complete this request. Try again shortly.",
			},
			503,
		);
	}
}
