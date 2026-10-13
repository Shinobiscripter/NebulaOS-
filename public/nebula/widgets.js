// Desktop layout stays separate from Anura's window manager and app storage.
export function createWidgets(
	os,
	{ make, button, save, dialog, heading, search, results },
) {
	const layer = make("aside", "nebula-widgets");
	layer.setAttribute("aria-label", "Desktop widgets");
	layer.hidden = os.settings.get("nebula.desktop.widgets") === false;
	document.body.append(layer);
	let layout = os.settings.get("nebula.desktop.widgetLayout") || {};
	const cards = new Map();
	let front = 1;
	const persist = () =>
		save("nebula.desktop.widgetLayout", structuredClone(layout));
	function place(card, point) {
		const x = Math.max(
			0,
			Math.min(Number(point.x) || 0, layer.clientWidth - card.offsetWidth),
		);
		const y = Math.max(
			0,
			Math.min(
				Number(point.y) || 0,
				layer.clientHeight - Math.min(card.offsetHeight, layer.clientHeight),
			),
		);
		card.style.left = `${x}px`;
		card.style.top = `${y}px`;
		return { x, y };
	}
	function arrange() {
		if (layer.hidden) return;
		let x = 16,
			y = 16,
			columnWidth = 274;
		for (const [id, card] of cards) {
			if (card.hidden) continue;
			if (layout[id]?.position) {
				place(card, layout[id].position);
				continue;
			}
			if (y > 16 && y + card.offsetHeight > layer.clientHeight - 8) {
				x += columnWidth + 14;
				y = 16;
				columnWidth = 274;
			}
			place(card, { x, y });
			y += card.offsetHeight + 14;
			columnWidth = Math.max(columnWidth, card.offsetWidth);
		}
	}
	function visibility(id, visible) {
		layout[id] = { ...layout[id], visible };
		const card = cards.get(id);
		card.hidden = !visible;
		card.dispatchEvent(new Event(visible ? "widgetshow" : "widgethide"));
		persist();
		arrange();
	}
	function menu() {
		heading.textContent = "Desktop widgets";
		search.hidden = true;
		results.replaceChildren();
		for (const [id, card] of cards) {
			const label = make("label", "nebula-widget-option");
			const check = make("input");
			check.type = "checkbox";
			check.checked = !card.hidden;
			check.onchange = () => {
				layer.hidden = false;
				save("nebula.desktop.widgets", true);
				visibility(id, check.checked);
			};
			label.append(check, document.createTextNode(card.dataset.title));
			results.append(label);
		}
		results.append(
			button(layer.hidden ? "Show all widgets" : "Hide all widgets", () => {
				layer.hidden = !layer.hidden;
				save("nebula.desktop.widgets", !layer.hidden);
				for (const card of cards.values())
					card.dispatchEvent(
						new Event(layer.hidden ? "widgethide" : "widgetshow"),
					);
				arrange();
				menu();
			}),
			button("Reset positions", () => {
				for (const entry of Object.values(layout)) delete entry.position;
				persist();
				arrange();
			}),
		);
		if (!dialog.open) dialog.showModal();
	}
	const observer = new ResizeObserver(arrange);
	observer.observe(layer);
	function widget(title, className = "") {
		const id = title.toLowerCase().replaceAll(" ", "-");
		const card = make("section", `nebula-widget ${className}`);
		const raise = () => {
			card.style.zIndex = String(++front);
		};
		card.addEventListener("pointerdown", raise, { capture: true });
		card.addEventListener("focusin", raise);
		card.dataset.widget = id;
		card.dataset.title = title;
		card.setAttribute("aria-label", `${title} widget`);
		card.hidden = layout[id]?.visible === false;
		const header = make("div", "nebula-widget-header");
		const handle = button(title, () => {}, "nebula-widget-handle");
		handle.setAttribute("aria-label", `Move ${title} widget`);
		handle.title =
			"Drag to move. Arrow keys move 10 pixels; Shift moves 1 pixel.";
		const hide = button("×", () => visibility(id, false));
		hide.setAttribute("aria-label", `Hide ${title} widget`);
		header.append(handle, hide);
		card.append(header);
		layer.append(card);
		cards.set(id, card);
		let drag;
		const finish = (event) => {
			if (!drag || event.pointerId !== drag.id) return;
			layout[id] = {
				...layout[id],
				position: { x: card.offsetLeft, y: card.offsetTop },
			};
			drag = null;
			card.classList.remove("dragging");
			persist();
		};
		handle.onpointerdown = (event) => {
			if (event.button !== 0) return;
			event.preventDefault();
			handle.focus();
			handle.setPointerCapture(event.pointerId);
			drag = {
				id: event.pointerId,
				x: event.clientX,
				y: event.clientY,
				left: card.offsetLeft,
				top: card.offsetTop,
			};
			card.classList.add("dragging");
		};
		handle.onpointermove = (event) => {
			if (drag?.id !== event.pointerId) return;
			place(card, {
				x: drag.left + event.clientX - drag.x,
				y: drag.top + event.clientY - drag.y,
			});
		};
		handle.onpointerup = finish;
		handle.onpointercancel = finish;
		handle.onlostpointercapture = finish;
		handle.onkeydown = (event) => {
			const delta = {
				ArrowLeft: [-1, 0],
				ArrowRight: [1, 0],
				ArrowUp: [0, -1],
				ArrowDown: [0, 1],
			}[event.key];
			if (!delta) return;
			event.preventDefault();
			const step = event.shiftKey ? 1 : 10;
			const position = place(card, {
				x: card.offsetLeft + delta[0] * step,
				y: card.offsetTop + delta[1] * step,
			});
			layout[id] = { ...layout[id], position };
			persist();
		};
		observer.observe(card);
		return card;
	}
	return { layer, widget, menu };
}
