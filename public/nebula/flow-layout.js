// Shared by real Flow windows and the isolated importer preview.
export function layoutRects(count, width, height, config = {}, top = 52) {
	if (!count) return [];
	const gap = config.inner ?? 12,
		outer = config.outer ?? 12;
	const area = {
		x: outer,
		y: top + outer,
		width: Math.max(1, width - outer * 2),
		height: Math.max(1, height - top - outer * 2),
	};
	if (config.layout === "master" && count > 1 && count <= 8) {
		const mw = (area.width - gap) * (config.mfact ?? 0.55),
			sh = (area.height - gap * (count - 2)) / (count - 1);
		return [
			{ ...area, width: mw },
			...Array.from({ length: count - 1 }, (_, i) => ({
				x: area.x + mw + gap,
				y: area.y + i * (sh + gap),
				width: area.width - mw - gap,
				height: Math.max(1, sh),
			})),
		];
	}
	if (config.layout === "dwindle" && count <= 8) {
		const rectangles = [];
		let remaining = { ...area };
		for (let i = 0; i < count - 1; i++) {
			const horizontal = remaining.width >= remaining.height;
			const size = (remaining[horizontal ? "width" : "height"] - gap) / 2;
			rectangles.push({
				...remaining,
				[horizontal ? "width" : "height"]: Math.max(1, size),
			});
			remaining = {
				...remaining,
				[horizontal ? "x" : "y"]:
					remaining[horizontal ? "x" : "y"] + size + gap,
				[horizontal ? "width" : "height"]: Math.max(1, size),
			};
		}
		return [...rectangles, remaining];
	}
	const columns = Math.ceil(Math.sqrt(count)),
		rows = Math.ceil(count / columns);
	const w = (area.width - gap * (columns - 1)) / columns,
		h = (area.height - gap * (rows - 1)) / rows;
	return Array.from({ length: count }, (_, i) => ({
		x: area.x + (i % columns) * (w + gap),
		y: area.y + Math.floor(i / columns) * (h + gap),
		width: Math.max(1, w),
		height: Math.max(1, h),
	}));
}
export function animationSpec(config = {}, kind = "windowsIn") {
	const parent = kind.startsWith("windows") ? "windows" : "workspaces";
	const item =
		config.animations?.[kind] ||
		config.animations?.[parent] ||
		config.animations?.global;
	const curve = Object.hasOwn(config.curves || {}, item?.curve)
		? config.curves[item.curve]
		: null;
	return {
		duration:
			config.motion === false || item?.enabled === false
				? 0
				: (item?.duration ?? 220),
		easing: curve
			? `cubic-bezier(${curve.join(",")})`
			: "cubic-bezier(.16,1,.3,1)",
		style: item?.style || (kind === "workspaces" ? "slide" : "popin"),
	};
}
export function animateFlow(
	node,
	config,
	kind = "windowsIn",
	reduced = false,
	direction = 1,
) {
	const spec = animationSpec(config, kind);
	if (reduced || !spec.duration) return null;
	const offset =
		spec.style === "slide"
			? kind === "workspaces"
				? `translateX(${direction * 40}px)`
				: "translateY(28px)"
			: spec.style === "fade"
				? "none"
				: "scale(.9)";
	return node.animate(
		[
			{ opacity: 0, transform: offset },
			{ opacity: 1, transform: "none" },
		],
		{ duration: spec.duration, easing: spec.easing },
	);
}
