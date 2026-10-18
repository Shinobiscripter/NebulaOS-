import { layoutRects, animateFlow } from "./flow-layout.js";
import { themeTokens } from "./import-theme.js";
export function renderFlowPreview(host, plan) {
	host.replaceChildren();
	host.style.display = "block";
	host.style.padding = "12px";
	const theme = themeTokens(plan.theme),
		controls = document.createElement("div"),
		frame = document.createElement("div"),
		scene = document.createElement("div");
	controls.style.cssText =
		"display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px";
	frame.style.cssText =
		"position:relative;aspect-ratio:16/9;overflow:hidden;background:#080d18;border:1px solid #ffffff30";
	scene.style.cssText = `position:absolute;width:960px;height:540px;transform-origin:top left;background:${theme.background};color:${theme.foreground}`;
	const bar = document.createElement("div");
	bar.textContent = "FLOW PREVIEW  ·  1  2  3  4  ·  Apps  ·  Clock";
	bar.style.cssText = `padding:12px;background:${theme.surface};font:16px system-ui`;
	scene.append(bar);
	const cards = [];
	let floating = false;
	const reduced = () =>
		matchMedia("(prefers-reduced-motion: reduce)").matches ||
		document.body.classList.contains("nebula-motion-reduced");
	function arrange() {
		const rects = layoutRects(cards.length, 960, 540, plan.style);
		cards.forEach((card, i) => {
			const r = floating
				? { x: 50 + i * 85, y: 85 + i * 55, width: 420, height: 240 }
				: rects[i];
			Object.assign(card.style, {
				left: r.x + "px",
				top: r.y + "px",
				width: r.width + "px",
				height: r.height + "px",
			});
		});
	}
	function add() {
		if (cards.length === 6) return;
		const card = document.createElement("div");
		card.className = "flow-preview-window";
		card.tabIndex = 0;
		card.style.cssText = `position:absolute;box-sizing:border-box;overflow:hidden;border:${plan.style.border ?? 1}px solid ${plan.style.accent || theme.accent};border-radius:${plan.style.rounding ?? 9}px;background:${theme.surface};color:${theme.foreground};box-shadow:0 10px 30px #0004;font:18px system-ui`;
		const title = document.createElement("div");
		title.textContent = [
			"Nebula Games",
			"Files",
			"Terminal",
			"Music",
			"Settings",
			"Notes",
		][cards.length];
		title.style.cssText =
			"padding:12px;border-bottom:1px solid #ffffff25;cursor:grab;touch-action:none";
		const close = document.createElement("button");
		close.textContent = "×";
		close.setAttribute("aria-label", "Close preview window");
		close.style.float = "right";
		close.onclick = () => {
			cards.splice(cards.indexOf(card), 1);
			card.remove();
			arrange();
		};
		title.append(close);
		const text = document.createElement("p");
		text.textContent = "Preview window • Drag its title to float it.";
		text.style.cssText = "padding:14px;font:16px system-ui";
		card.append(title, text);
		scene.append(card);
		cards.push(card);
		arrange();
		animateFlow(card, plan.style, "windowsIn", reduced());
		title.onpointerdown = (e) => {
			if (e.target === close) return;
			floating = true;
			title.setPointerCapture(e.pointerId);
			const x = e.clientX,
				y = e.clientY,
				left = parseFloat(card.style.left),
				top = parseFloat(card.style.top),
				scale = frame.clientWidth / 960;
			title.onpointermove = (ev) => {
				card.style.left =
					Math.max(
						0,
						Math.min(960 - card.offsetWidth, left + (ev.clientX - x) / scale),
					) + "px";
				card.style.top =
					Math.max(44, Math.min(510, top + (ev.clientY - y) / scale)) + "px";
			};
			title.onpointerup = () => {
				title.onpointermove = null;
			};
			title.onlostpointercapture = () => {
				title.onpointermove = null;
			};
		};
	}
	for (const [name, action] of [
		["Add preview window", add],
		[
			"Tile preview",
			() => {
				floating = false;
				arrange();
			},
		],
		[
			"Float preview",
			() => {
				floating = true;
				arrange();
			},
		],
		[
			"Replay animation",
			() =>
				cards.forEach((c) =>
					animateFlow(c, plan.style, "windowsIn", reduced()),
				),
		],
	]) {
		const button = document.createElement("button");
		button.textContent = name;
		button.type = "button";
		button.onclick = action;
		controls.append(button);
	}
	frame.append(scene);
	host.append(controls, frame);
	add();
	add();
	add();
	const observer = new ResizeObserver(
		() => (scene.style.transform = `scale(${frame.clientWidth / 960})`),
	);
	observer.observe(frame);
	return {
		destroy() {
			observer.disconnect();
			for (const card of cards) card.getAnimations().forEach((a) => a.cancel());
		},
		setWallpaper(url) {
			scene.style.backgroundImage = url ? `url("${url}")` : "";
			scene.style.backgroundSize = "cover";
		},
	};
}
