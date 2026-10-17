import { parseHyprland, resolveUpload, LIMITS } from "./hyprland-parser.js";
const STYLE = "nebula.flow.importStyle",
	BACKUP = "nebula.flow.importBackup";
const keys = [
	STYLE,
	"nebula.flow.keybinds",
	"nebula.desktop.environment",
	"wallpaper",
	"wallpaper-name",
	"nebula.desktop.environmentWallpaper",
];
const el = (tag, text) => {
	const node = document.createElement(tag);
	if (text != null) node.textContent = text;
	return node;
};
export function installHyprland(os) {
	const style = el("style");
	style.textContent = `body.nebula-desktop.nebula-env-flow .aliceWMwin:not(.nebula-maximized) { border-width:var(--hypr-border,1px); border-color:var(--hypr-accent,#90b6a570); border-radius:var(--hypr-rounding,9px);  }
  body.nebula-desktop.nebula-env-flow .aliceWMwin[data-nebula-focused="false"]:not(.nebula-maximized) { border-color:var(--hypr-inactive,var(--hypr-accent,#90b6a570)); }
  body.nebula-desktop.nebula-env-flow .aliceWMwin[data-nebula-focused="true"] { opacity:var(--hypr-opacity,1); }
  body.nebula-desktop.nebula-env-flow { --flow-accent:var(--hypr-accent,var(--theme-accent,#a7d4c4)); }
  body.nebula-desktop.nebula-env-flow.nebula-hypr-still .aliceWMwin { animation:none!important; transition:none!important; }
  .nebula-hypr-import { width:min(700px,90vw); max-height:82vh; overflow:auto; }
  .nebula-hypr-import select,.nebula-hypr-import input { display:block; max-width:100%; margin:12px 0; }
  .nebula-hypr-import pre { white-space:pre-wrap; overflow-wrap:anywhere; font:12px/1.6 monospace; max-height:240px; overflow:auto; background:#080d18; padding:12px; }
  .nebula-hypr-sample { padding:20px; background:#080d18; margin:16px 0; display:flex; gap:12px; }
  .nebula-hypr-sample div { flex:1; padding:18px; background:#1a2030; min-width:0; }`;
	document.head.append(style);
	const refresh = () => {
		const config = os.settings.get(STYLE) || {};
		for (const key of ["border", "rounding", "accent", "inactive", "opacity"]) {
			const value = config[key];
			if (value != null)
				document.body.style.setProperty(
					`--hypr-${key}`,
					String(value) + (["border", "rounding"].includes(key) ? "px" : ""),
				);
			else document.body.style.removeProperty(`--hypr-${key}`);
		}
		document.body.classList.toggle(
			"nebula-hypr-still",
			config.motion === false,
		);
	};
	refresh();
	window.addEventListener("nebula:environment", refresh);
	window.addEventListener("nebula:hyprland", () => {
		if (document.querySelector(".nebula-hypr-import")) return;
		const dialog = el("dialog");
		dialog.className = "nebula-preferences nebula-hypr-import";
		dialog.setAttribute("aria-label", "Import Hyprland dotfiles");
		dialog.append(
			el("h2", "Bring your Hyprland setup to Flow"),
			el(
				"p",
				"Upload .conf files or an extracted dotfiles folder. Preview the supported appearance and shortcuts, then apply. Shell commands, plugins and Linux programs never run. ZIP archives must be extracted first.",
			),
		);
		const input = el("input");
		input.type = "file";
		input.multiple = true;
		input.accept = ".conf,.png,.jpg,.jpeg,.webp";
		input.setAttribute("aria-label", "Upload dotfiles");
		const folder = el("input");
		folder.type = "file";
		folder.multiple = true;
		folder.setAttribute("webkitdirectory", "");
		folder.setAttribute("aria-label", "Upload dotfiles folder");
		const select = el("select");
		select.setAttribute("aria-label", "Entry config");
		select.hidden = true;
		const sample = el("div");
		sample.className = "nebula-hypr-sample";
		sample.hidden = true;
		const report = el("pre"),
			warnings = el("pre"),
			status = el("p");
		status.setAttribute("role", "status");
		const apply = el("button", "Apply to Flow"),
			undo = el("button", "Undo last import"),
			close = el("button", "Close importer");
		apply.disabled = true;
		undo.disabled = !os.settings.get(BACKUP);
		let configs = {},
			images = {},
			plan = null,
			wallpaper = null,
			busy = false,
			revision = 0;
		const disable = (value) => {
			busy = value;
			input.disabled =
				folder.disabled =
				select.disabled =
				close.disabled =
					value;
			apply.disabled = value || !plan || (!plan.applied.length && !wallpaper);
			undo.disabled = value || !os.settings.get(BACKUP);
		};
		function preview() {
			plan = parseHyprland(
				configs,
				select.value,
				os.settings.get("nebula.flow.keybinds"),
			);
			wallpaper =
				plan.wallpaper && resolveUpload(images, plan.wallpaper, select.value);
			if (plan.wallpaper && !wallpaper)
				plan.warnings.push(
					"Wallpaper image is missing or ambiguous. Upload it with the configs; existing wallpaper will be retained.",
				);
			report.textContent =
				plan.applied.join("\n") || "No compatible settings found.";
			warnings.textContent =
				plan.warnings.join("\n") || "No unsupported options found.";
			sample.replaceChildren();
			sample.hidden = false;
			sample.style.gap = `${plan.style.inner ?? 12}px`;
			for (const title of ["Nebula Games", "Files"]) {
				const card = el("div", title);
				card.style.border = `${plan.style.border ?? 1}px solid ${plan.style.accent || "#a7d4c4"}`;
				card.style.borderRadius = `${plan.style.rounding ?? 9}px`;
				card.style.opacity = plan.style.opacity ?? 1;
				sample.append(card);
			}
			status.textContent = `${plan.applied.length} translated settings · ${plan.warnings.length} compatibility notes. Applying switches to Flow. Meta/Super shortcuts may be intercepted by your device.`;
			disable(false);
		}
		async function load(fileList) {
			const token = ++revision;
			plan = null;
			wallpaper = null;
			disable(true);
			configs = {};
			images = {};
			report.textContent = warnings.textContent = "";
			sample.hidden = true;
			select.hidden = true;
			try {
				const files = [...fileList];
				if (
					files.length > LIMITS.files ||
					files.reduce((n, f) => n + f.size, 0) > 32 * 1024 * 1024
				)
					throw Error("Select at most 256 files, totaling 32 MiB.");
				for (const file of files) {
					const name = file.webkitRelativePath || file.name;
					if (/\.conf$/i.test(name)) {
						if (file.size > LIMITS.text)
							throw Error("A config is larger than 2 MiB.");
						configs[name] = await file.text();
					} else if (
						/\.(png|jpe?g|webp)$/i.test(name) &&
						file.size <= 12 * 1024 * 1024
					)
						images[name] = file;
				}
				if (token !== revision) return;
				const names = Object.keys(configs);
				if (!names.length)
					throw Error(
						"No .conf files found. Extract archives before uploading.",
					);
				select.replaceChildren(
					...names.map((name) => {
						const option = el("option", name);
						option.value = name;
						return option;
					}),
				);
				select.value =
					names.find((name) => /(^|\/)hyprland\.conf$/.test(name)) || names[0];
				select.hidden = false;
				preview();
			} catch (error) {
				status.textContent = error.message;
				plan = null;
			} finally {
				disable(false);
			}
		}
		input.onchange = () => load(input.files);
		folder.onchange = () => load(folder.files);
		select.onchange = () => {
			try {
				preview();
			} catch (error) {
				plan = null;
				status.textContent = error.message;
				disable(false);
			}
		};
		async function restore(snapshot) {
			for (const key of keys) await os.settings.set(key, snapshot[key] ?? null);
			os.apps["anura.wallpaper"]?.setWallpaper(
				snapshot.wallpaper || "/nebula/wallpaper.svg",
			);
			window.dispatchEvent(new Event("nebula:environment"));
			window.dispatchEvent(new Event("nebula:wallpaper-changed"));
		}
		apply.onclick = async () => {
			if (busy || !plan) return;
			disable(true);
			const snapshot = Object.fromEntries(
				keys.map((key) => [key, structuredClone(os.settings.get(key) ?? null)]),
			);
			try {
				// Persist the rollback before any mutation, including wallpaper installation.
				await os.settings.set(BACKUP, snapshot);
				if (wallpaper) {
					const bitmap = await createImageBitmap(images[wallpaper]);
					if (bitmap.width * bitmap.height > 32000000) {
						bitmap.close();
						throw Error("Wallpaper exceeds 32 megapixels.");
					}
					const canvas = el("canvas"),
						scale = Math.min(1, 2560 / bitmap.width, 1440 / bitmap.height);
					canvas.width = Math.round(bitmap.width * scale);
					canvas.height = Math.round(bitmap.height * scale);
					canvas
						.getContext("2d")
						.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
					bitmap.close();
					const blob = await new Promise((resolve) =>
						canvas.toBlob(resolve, "image/jpeg", 0.9),
					);
					if (!blob) throw Error("Wallpaper could not be decoded.");
					const path = `/.nebula-wallpapers/hypr-${crypto.randomUUID()}.jpg`;
					try {
						await os.fs.promises.mkdir("/.nebula-wallpapers");
					} catch (e) {
						if (e.code !== "EEXIST") throw e;
					}
					await os.fs.promises.writeFile(
						path,
						new Uint8Array(await blob.arrayBuffer()),
					);
					await os.settings.set("wallpaper", `/fs${path}`);
					await os.settings.set("wallpaper-name", wallpaper);
					await os.settings.set("nebula.desktop.environmentWallpaper", false);
					os.apps["anura.wallpaper"].setWallpaper(`/fs${path}`);
				}
				await os.settings.set(STYLE, {
					...(os.settings.get(STYLE) || {}),
					...plan.style,
				});
				await os.settings.set("nebula.flow.keybinds", {
					...(os.settings.get("nebula.flow.keybinds") || {}),
					...plan.bindings,
				});
				await os.settings.set("nebula.desktop.environment", "flow");
				window.dispatchEvent(new Event("nebula:environment"));
				window.dispatchEvent(new Event("nebula:wallpaper-changed"));
				status.textContent =
					"Imported into Flow. Use Tile to arrange open windows with your gaps. Saved on this browser; Undo restores the previous setup.";
			} catch (error) {
				try {
					await restore(snapshot);
					status.textContent = `Import failed; previous setup restored: ${error.message}`;
				} catch {
					status.textContent =
						"Could not save or restore settings. Free browser storage and use Undo last import.";
				}
			} finally {
				disable(false);
			}
		};
		undo.onclick = async () => {
			if (busy) return;
			const snapshot = os.settings.get(BACKUP);
			if (!snapshot) return;
			disable(true);
			try {
				await restore(snapshot);
				await os.settings.set(BACKUP, null);
				status.textContent = "Previous setup restored.";
			} catch (error) {
				status.textContent = `Restore failed: ${error.message}`;
			} finally {
				disable(false);
			}
		};
		close.onclick = () => dialog.close();
		dialog.addEventListener("cancel", (event) => {
			if (busy) event.preventDefault();
		});
		dialog.addEventListener("close", () => dialog.remove(), { once: true });
		dialog.append(
			el("label", "Choose files"),
			input,
			el("label", "Or choose a folder"),
			folder,
			select,
			sample,
			el("h3", "Compatibility preview"),
			report,
			el("h3", "Skipped or adapted"),
			warnings,
			status,
			apply,
			undo,
			close,
		);
		document.body.append(dialog);
		dialog.showModal();
	});
}
