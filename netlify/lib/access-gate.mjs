const digest = async (text) =>
	Array.from(
		new Uint8Array(
			await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
		),
		(b) => b.toString(16).padStart(2, "0"),
	).join("");
const escape = (text) =>
	String(text).replace(
		/[&<>"']/g,
		(c) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				c
			],
	);
export function accessPage(title, message, status) {
	return new Response(
		`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · NebulaHub</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#060b15;color:#e4edff;font:16px/1.6 system-ui}main{max-width:540px;padding:40px}h1{font-size:40px;line-height:1.1}small{letter-spacing:.2em;color:#9bc8ed}a,button{display:inline-block;background:#203959;color:white;border:1px solid #5a779c;border-radius:6px;padding:12px 20px;text-decoration:none;font:inherit;margin:8px 8px 8px 0}p{color:#bbcbe1}</style><main><small>NEBULAHUB / THE COMMUNITY UPDATE</small><h1>${escape(title)}</h1><p>${escape(message)}</p><a href="/api/community?action=login">Continue with Google</a><a href="/privacy/">Privacy & reporting</a><p>Google provides your name, email and account identifier. We store sign-in times and access restrictions for moderation. Local files remain in your browser.</p></main></html>`,
		{
			status,
			headers: {
				"Content-Type": "text/html; charset=utf-8",
				"Cache-Control": "private, no-store",
				"Netlify-CDN-Cache-Control": "no-store",
				Vary: "Cookie",
				"X-Content-Type-Options": "nosniff",
				"Referrer-Policy": "no-referrer",
			},
		},
	);
}
export function createAccessGate(store, now = Date.now) {
	return async (request, next) => {
		try {
			const token = (request.headers.get("cookie") || "")
				.split(";")
				.map((s) => s.trim())
				.find((s) => s.startsWith("__Host-nebula-session="))
				?.slice(22);
			if (!/^\d{4}-\d{2}-\d{2}\.[a-f0-9]{64}$/.test(token || ""))
				return accessPage(
					"Your community starts here",
					"Sign in with Google to access NebulaHub.",
					401,
				);
			const session = await store.get(
				`sessions/${token.slice(0, 10)}/${await digest(token)}`,
				{ type: "json" },
			);
			if (
				!session ||
				session.expires <= now() ||
				session.user?.verified !== true
			)
				return accessPage(
					"Sign in to continue",
					"Your session has expired. Sign in again to access NebulaHub.",
					401,
				);
			const rule = await store.get(
				"restrictions/" + (await digest(session.user.sub)),
				{ type: "json" },
			);
			if (
				session.user.email !== "gamergeek1107@gmail.com" &&
				(rule?.kind === "banned" ||
					(rule?.kind === "suspended" && rule.until > now()))
			)
				return accessPage(
					rule.kind === "banned"
						? "Account access removed"
						: "Account temporarily suspended",
					`${rule.reason}${rule.until ? " Access resumes " + new Date(rule.until).toISOString() + "." : ""} Contact the site owner if you believe this is a mistake.`,
					403,
				);
			const response = await next();
			// Never cache an authenticated response in a shared CDN or browser HTTP cache.
			const headers = new Headers(response.headers);
			headers.set("Cache-Control", "private, no-store");
			headers.set("Netlify-CDN-Cache-Control", "no-store");
			return new Response(response.body, { status: response.status, headers });
		} catch {
			return accessPage(
				"Connection unavailable",
				"Account access could not be checked. Please try again shortly.",
				503,
			);
		}
	};
}
