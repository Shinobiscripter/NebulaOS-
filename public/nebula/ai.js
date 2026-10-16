export function installAI(os) {
	let win = null;
	const app = {
		name: "Nebula AI",
		package: "nebula.ai",
		icon: "/nebula/ai.svg",
		hidden: false,
		windows: [],
		open() {
			if (win?.element.isConnected) {
				win.unminimize();
				win.focus();
				return;
			}
			if (!document.querySelector("link[data-nebula-ai]")) {
				const css = document.createElement("link");
				css.rel = "stylesheet";
				css.href = "/nebula/ai.css";
				css.dataset.nebulaAi = "";
				document.head.append(css);
			}
			win = os.wm.create(app, {
				title: "Nebula AI",
				width: "1100px",
				height: "760px",
				resizable: true,
			});
			win.content.style.position = "relative";
			const root = document.createElement("div");
			root.className = "nebula-ai";
			root.innerHTML =
				'<aside><h2>✦ Nebula AI</h2><button class="new">＋ New chat</button><div class="history"></div><button class="delete">Delete chat</button></aside><main><header><select aria-label="Model"><option>Loading free models…</option></select></header><div class="messages" aria-label="Conversation"></div><form><div class="status" role="status"></div><div class="compose"><textarea aria-label="Message" placeholder="Message Nebula AI" maxlength="12000" required></textarea><button class="send" type="submit">Send ↑</button><button class="stop" type="button" disabled>Stop</button></div><p class="notice">Free models · Shared limits apply. Messages are sent to OpenRouter and its model providers. Chat history stays in this browser. AI can make mistakes.</p></form></main>';
			win.content.append(root);
			const $ = (s) => root.querySelector(s),
				key = "nebula-ai-chats:" + String(window.nebulaProfileId || "default");
			let chats = [];
			try {
				const saved = JSON.parse(localStorage.getItem(key) || "[]");
				if (Array.isArray(saved))
					chats = saved.filter(
						(c) => typeof c.title === "string" && Array.isArray(c.messages),
					);
			} catch {}
			let current = chats[0] || null,
				controller = null;
			function save() {
				try {
					localStorage.setItem(key, JSON.stringify(chats.slice(0, 50)));
				} catch {
					$(".status").textContent =
						"Browser storage is full; this chat could not be saved.";
				}
			}
			function history() {
				const host = $(".history");
				host.replaceChildren();
				for (const c of chats) {
					const b = document.createElement("button");
					b.textContent = c.title;
					b.title = c.title;
					b.disabled = !!controller;
					b.onclick = () => {
						current = c;
						render();
					};
					host.append(b);
				}
			}
			function bubble(message) {
				const a = document.createElement("article");
				a.className = message.role;
				const label = document.createElement("strong");
				label.textContent =
					message.role === "user" ? "You" : message.name || "Nebula AI";
				const content = document.createElement("div");
				content.textContent = message.content;
				a.append(label, content);
				$(".messages").append(a);
				return content;
			}
			function render() {
				history();
				$(".messages").replaceChildren();
				if (!current?.messages.length) {
					const e = document.createElement("div");
					e.className = "welcome";
					e.textContent = "✦ What’s on your horizon?";
					$(".messages").append(e);
				} else current.messages.forEach(bubble);
				$(".messages").scrollTop = $(".messages").scrollHeight;
			}
			$(".new").onclick = () => {
				current = null;
				render();
				$(".status").textContent = "";
			};
			$(".delete").onclick = () => {
				if (current && confirm("Delete this chat from this browser?")) {
					chats = chats.filter((c) => c !== current);
					current = null;
					save();
					render();
				}
			};
			$(".stop").onclick = () => controller?.abort();
			function busy(value) {
				for (const s of [".new", ".delete", ".send", "select"])
					$(s).disabled = value;
				$(".stop").disabled = !value;
				history();
			}
			$(".send").disabled = true;
			fetch("/api/nebula-ai", { cache: "no-store" })
				.then(async (r) => {
					if (!r.ok)
						throw Error(
							"Free models are unavailable. Close and reopen the app to retry.",
						);
					return r.json();
				})
				.then(({ models }) => {
					const select = $("select");
					select.replaceChildren();
					for (const m of models) {
						const o = document.createElement("option");
						o.value = m.id;
						o.textContent = `${m.name} (${m.use} · ${m.model})`;
						select.append(o);
					}
					$(".send").disabled = !models.length;
					if (!models.length)
						$(".status").textContent =
							"No verified free models are currently available.";
				})
				.catch((e) => {
					$(".status").textContent = e.message;
				});
			$("textarea").onkeydown = (e) => {
				if (e.key === "Enter" && !e.shiftKey) {
					e.preventDefault();
					if (!controller && !$(".send").disabled) $("form").requestSubmit();
				}
			};
			$("form").onsubmit = async (e) => {
				e.preventDefault();
				const text = $("textarea").value.trim();
				if (!text || controller || !$("select").value) return;
				if (!current) {
					current = {
						id: crypto.randomUUID(),
						title: text.slice(0, 60),
						messages: [],
					};
					chats.unshift(current);
				}
				current.messages.push({ role: "user", content: text });
				$("textarea").value = "";
				render();
				save();
				controller = new AbortController();
				busy(true);
				$(".status").textContent = "Connecting to a free model…";
				const reply = {
					role: "assistant",
					content: "",
					name: $("select").selectedOptions[0].textContent.split(" (")[0],
				};
				const target = bubble(reply);
				try {
					const r = await fetch("/api/nebula-ai", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						signal: controller.signal,
						body: JSON.stringify({
							model: $("select").value,
							messages: current.messages
								.slice(-40)
								.map(({ role, content }) => ({ role, content })),
						}),
					});
					if (!r.ok) {
						const data = await r.json();
						throw Error(data.error || "Request failed");
					}
					const reader = r.body.getReader(),
						decoder = new TextDecoder();
					let buffer = "";
					$(".status").textContent =
						reply.name === "Pulsar" ? "Thinking…" : "Responding…";
					while (true) {
						const { value, done } = await reader.read();
						buffer += decoder.decode(value || new Uint8Array(), {
							stream: !done,
						});
						const lines = buffer.split("\n");
						buffer = lines.pop();
						for (const line of lines) {
							if (!line.startsWith("data:")) continue;
							const raw = line.slice(5).trim();
							if (!raw || raw === "[DONE]") continue;
							const data = JSON.parse(raw);
							if (data.error)
								throw Error(
									data.error.message || "Provider interrupted the response",
								);
							const delta = data.choices?.[0]?.delta?.content;
							if (delta) {
								reply.content += delta;
								target.textContent = reply.content;
								$(".messages").scrollTop = $(".messages").scrollHeight;
							}
						}
						if (done) break;
					}
					if (!reply.content)
						throw Error(
							"The model returned no answer. Try another free model.",
						);
					$(".status").textContent = "";
				} catch (err) {
					$(".status").textContent =
						err.name === "AbortError" ? "Response stopped." : err.message;
				} finally {
					if (reply.content) current.messages.push(reply);
					save();
					controller = null;
					busy(false);
				}
			};
			win.addEventListener("close", () => controller?.abort());
			render();
		},
	};
	os.registerApp(app);
}
