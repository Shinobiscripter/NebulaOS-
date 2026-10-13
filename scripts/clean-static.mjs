// Remove only this repository's generated output before copying fresh build assets.
import { rm, lstat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (process.cwd() !== root)
	throw new Error("Run the build from the repository root.");
const target = resolve(root, "static");
const info = await lstat(target).catch((e) => {
	if (e.code !== "ENOENT") throw e;
});
if (info?.isSymbolicLink())
	throw new Error("Refusing to clear a linked static directory.");
await rm(target, { recursive: true, force: true });
