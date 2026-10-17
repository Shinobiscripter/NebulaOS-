import {
	scanRepository,
	analyzeDotfiles,
	limitedFetch,
} from "./dotfiles-repo.js";
import { installImportTheme, THEME_KEY, THEME_ON } from "./import-theme.js";
import { parseHyprland, resolveUpload, LIMITS } from "./hyprland-parser.js";
const STYLE = "nebula.flow.importStyle",
	BACKUP = "nebula.flow.importBackup";
const keys = [
	THEME_KEY,
	THEME_ON,
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
	installImportTheme(os);
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
		const repo = el("input");
		repo.placeholder = "https://github.com/owner/dotfiles";
		repo.setAttribute("aria-label", "GitHub repository");
		const ref = el("input");
		ref.placeholder = "Default branch (optional branch/tag)";
		ref.setAttribute("aria-label", "Repository revision");
		const scan = el("button", "Scan GitHub repository");
		const cancel = el("button", "Cancel scan");
		cancel.hidden = true;
		let controller = null;
		const palette = el("select");
		palette.setAttribute("aria-label", "Repository palette");
		palette.hidden = true;
		const infer = el("input");
		infer.type = "checkbox";
		infer.id = "hypr-script-inferences";
		const inferLabel = el(
			"label",
			"Include candidate cosmetic commands from installers (review below)",
		);
		inferLabel.htmlFor = infer.id;
		const scriptReport = el("pre");
		const wallpaperSelect = el("select");
		wallpaperSelect.setAttribute("aria-label", "Repository wallpaper");
		wallpaperSelect.hidden = true;
		const themeSwitch = el(
			"button",
			"Theme the entire desktop and Nebula apps",
		);
		themeSwitch.className = "nebula-theme-switch";
		themeSwitch.setAttribute("role", "switch");
		const syncSwitch = () =>
			themeSwitch.setAttribute(
				"aria-checked",
				String(os.settings.get(THEME_ON) === true),
			);
		syncSwitch();
		themeSwitch.onclick = async () => {
			themeSwitch.disabled = true;
			try {
				await os.settings.set(THEME_ON, os.settings.get(THEME_ON) !== true);
				window.dispatchEvent(new Event("nebula:environment"));
				syncSwitch();
			} catch (error) {
				status.textContent = error.message;
			} finally {
				themeSwitch.disabled = false;
			}
		};
		const input = el("input");
		input.type = "file";
		input.multiple = true;
		input.accept =
			".conf,.lua,.css,.rasi,.toml,.ini,.json,.jsonc,.sh,.md,.png,.jpg,.jpeg,.webp";
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
		let analysis = { palettes: [], commands: [], inferred: [], warnings: [] },
			scanNotes = [],
			allTexts = {};
		let configs = {},
			images = {},
			plan = null,
			wallpaper = null,
			busy = false,
			revision = 0;
		const disable = (value) => {
			busy = value;
			wallpaperSelect.disabled =
				scan.disabled =
				repo.disabled =
				ref.disabled =
				palette.disabled =
				infer.disabled =
				themeSwitch.disabled =
					value;
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
			if (infer.checked && analysis.inferred.length) {
				const translated = parseHyprland(
					{ "installer.conf": analysis.inferred.join("\n") },
					"installer.conf",
					os.settings.get("nebula.flow.keybinds"),
				);
				Object.assign(plan.style, translated.style);
				plan.wallpaper = translated.wallpaper || plan.wallpaper;
				plan.applied.push(
					...translated.applied.map((x) => "Installer candidate: " + x),
				);
				plan.warnings.push(...translated.warnings);
			}
			const selectedPalette = analysis.palettes.find(
				(p) => p.path === palette.value,
			);
			plan.theme = {
				...(selectedPalette?.values || {}),
				accent: plan.style.accent || selectedPalette?.values.accent,
				rounding: plan.style.rounding,
			};
			if (selectedPalette) plan.applied.push(...selectedPalette.evidence);
			plan.warnings.push(...scanNotes, ...analysis.warnings);
			scriptReport.textContent =
				analysis.commands.join("\n\n") ||
				"No recognized install commands found. Unresolved script lines appear below.";
			wallpaper =
				plan.wallpaper && resolveUpload(images, plan.wallpaper, select.value);
			if (wallpaperSelect.value) wallpaper = wallpaperSelect.value;
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
				card.style.background =
					plan.theme.surface || plan.theme.background || "#1a2030";
				card.style.color = plan.theme.foreground || "#f3f5fa";
				sample.append(card);
			}
			status.textContent = `${plan.applied.length} translated settings · ${plan.warnings.length} compatibility notes. Applying switches to Flow. Meta/Super shortcuts may be intercepted by your device.`;
			disable(false);
		}
		function prepare() {
			if (
				Object.values(allTexts).reduce((n, text) => n + text.length, 0) >
				2 * 1024 * 1024
			)
				throw Error(
					"Selected text exceeds 2 MiB. Choose a smaller theme folder.",
				);
			analysis = analyzeDotfiles(allTexts);
			configs = Object.fromEntries(
				Object.entries(allTexts).filter(([name]) => /\.conf$/i.test(name)),
			);
			if (!Object.keys(configs).length)
				configs["Palette only.conf"] = "# Palette-only import";
			const names = Object.keys(configs);
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
			palette.replaceChildren(
				el("option", "Window colors only"),
				...analysis.palettes.map((p) => {
					const option = el("option", p.path);
					option.value = p.path;
					return option;
				}),
			);
			palette.firstChild.value = "";
			palette.value = analysis.palettes[0]?.path || "";
			palette.hidden = !analysis.palettes.length;
			wallpaperSelect.replaceChildren(
				el("option", "Use config wallpaper (or keep current)"),
				...Object.keys(images).map((path) => {
					const opt = el("option", path);
					opt.value = path;
					return opt;
				}),
			);
			wallpaperSelect.firstChild.value = "";
			wallpaperSelect.hidden = !Object.keys(images).length;
			infer.checked = false;
			preview();
		}
		wallpaperSelect.onchange = () => preview();
		palette.onchange = () => preview();
		infer.onchange = () => preview();
		scan.onclick = async () => {
			plan = null;
			disable(true);
			controller = new AbortController();
			cancel.hidden = false;
			status.textContent = "Scanning repository�";
			try {
				const result = await scanRepository(
					repo.value,
					ref.value,
					(message) => (status.textContent = message),
					controller.signal,
				);
				allTexts = result.texts;
				images = result.images;
				scanNotes = result.notes;
				prepare();
			} catch (error) {
				plan = null;
				status.textContent =
					error.name === "AbortError" ? "Scan cancelled." : error.message;
			} finally {
				controller = null;
				cancel.hidden = true;
				disable(false);
			}
		};
		cancel.onclick = () => controller?.abort();
		async function load(fileList) {
			const token = ++revision;
			plan = null;
			wallpaper = null;
			disable(true);
			configs = {};
			allTexts = {};
			scanNotes = [];
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
					if (
						/\.(conf|lua|css|rasi|toml|ini|jsonc?|sh|bash|zsh|md|ya?ml)$|(?:^|\/)(config|install|setup)$/i.test(
							name,
						)
					) {
						if (file.size > LIMITS.text)
							throw Error("A config is larger than 2 MiB.");
						allTexts[name] = await file.text();
					} else if (
						/\.(png|jpe?g|webp)$/i.test(name) &&
						file.size <= 12 * 1024 * 1024
					)
						images[name] = file;
				}
				if (token !== revision) return;
				prepare();
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
			syncSwitch();
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
					const source = images[wallpaper];
					const image = source.url
						? await limitedFetch(
								source.url,
								12 * 1024 * 1024,
								AbortSignal.timeout(20000),
							)
						: source;
					const bitmap = await createImageBitmap(image);
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
				await os.settings.set(THEME_KEY, plan.theme);
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
			el("label", "Public GitHub repository"),
			repo,
			ref,
			scan,
			cancel,
			el("label", "Choose files"),
			input,
			el("label", "Or choose a folder"),
			folder,
			select,
			palette,
			wallpaperSelect,
			infer,
			inferLabel,
			themeSwitch,
			el(
				"p",
				"The full theme switch uses your last applied import. Apply this preview to update its palette. Embedded websites and games keep their own UI.",
			),
			el("h3", "Installer analysis (never executed)"),
			scriptReport,
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
