import { communityRequest } from "./google-auth.js";

const node = (tag, text) =>
	Object.assign(document.createElement(tag), { textContent: text || "" });
export function mountMembers(root) {
	const section = node("section");
	const title = node("h2", "Signed-in community");
	const description = node(
		"p",
		"Verified Google accounts and their last sign-in. Anonymous traffic cannot be identified. Usage reports are kept separate from account identities.",
	);
	const search = node("input");
	search.type = "search";
	search.placeholder = "Filter loaded accounts by name or email";
	search.setAttribute("aria-label", "Search community accounts");
	const status = node("p");
	status.setAttribute("role", "status");
	const list = node("div");
	const more = node("button", "Load more accounts");
	const refresh = node("button", "Refresh accounts");
	let members = [],
		cursor = null,
		loading = false;
	function render() {
		list.replaceChildren();
		const query = search.value.toLowerCase();
		for (const member of members.filter((m) =>
			`${m.name} ${m.email}`.toLowerCase().includes(query),
		)) {
			const card = node("article");
			card.className = "nc-member";
			card.append(
				node("h3", member.name),
				node("p", member.email),
				node(
					"p",
					`Last sign-in: ${new Date(member.lastSignIn).toLocaleString()}`,
				),
			);
			const rule = member.restriction;
			card.append(
				node(
					"p",
					rule
						? `${rule.kind}${rule.until ? " until " + new Date(rule.until).toLocaleString() : ""}: ${rule.reason}`
						: "Active",
				),
			);
			if (member.protected)
				card.append(node("p", "Protected developer account"));
			else {
				const form = node("form");
				const kind = node("select");
				kind.setAttribute("aria-label", "Account action for " + member.email);
				for (const [value, label] of [
					["suspended", "Suspend temporarily"],
					["banned", "Ban indefinitely"],
					["active", "Restore access"],
				]) {
					const option = node("option", label);
					option.value = value;
					kind.append(option);
				}
				const hours = node("input");
				hours.type = "number";
				hours.min = "1";
				hours.max = "8760";
				hours.value = "24";
				hours.setAttribute(
					"aria-label",
					"Suspension hours for " + member.email,
				);
				kind.onchange = () => {
					hours.hidden = kind.value !== "suspended";
				};
				const reason = node("input");
				reason.required = true;
				reason.maxLength = 300;
				reason.placeholder = "Reason shown to this account";
				reason.setAttribute(
					"aria-label",
					"Moderation reason for " + member.email,
				);
				const submit = node("button", "Review action");
				submit.type = "submit";
				form.append(kind, hours, reason, submit);
				form.onsubmit = async (event) => {
					event.preventDefault();
					const summary = `${kind.options[kind.selectedIndex].text}: ${member.email}${kind.value === "suspended" ? " for " + hours.value + " hours" : ""}.\nReason: ${reason.value}\n\nApply this action?`;
					if (!window.confirm(summary)) return;
					submit.disabled = true;
					try {
						const result = await communityRequest("moderate", {
							id: member.id,
							kind: kind.value,
							hours: Number(hours.value),
							reason: reason.value,
						});
						member.restriction = result.restriction;
						status.textContent = "Account access updated.";
						render();
					} catch (error) {
						status.textContent = error.message;
					} finally {
						submit.disabled = false;
					}
				};
				card.append(form);
			}
			list.append(card);
		}
	}
	async function load(reset = false) {
		if (loading) return;
		loading = true;
		more.disabled = refresh.disabled = true;
		status.textContent = "Loading accounts…";
		try {
			const result = await communityRequest(
				"members",
				undefined,
				reset || !cursor ? {} : { cursor },
			);
			members = reset ? result.members : [...members, ...result.members];
			cursor = result.cursor;
			more.hidden = !cursor;
			status.textContent = `${members.length} accounts loaded.`;
			render();
		} catch (error) {
			status.textContent = error.message;
		} finally {
			loading = false;
			more.disabled = refresh.disabled = false;
		}
	}
	search.oninput = render;
	refresh.onclick = () => load(true);
	more.onclick = () => load();
	section.append(title, description, search, refresh, status, list, more);
	root.append(section);
	load(true);
}
