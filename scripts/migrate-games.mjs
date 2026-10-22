import { readdir, readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const source = resolve(process.argv[2] || "../NebulaHub-2");
const files = (await readdir(`${source}/Games`)).filter(name => name.endsWith(".html")).sort();
await mkdir("public/Games", { recursive: true });
await mkdir("public/nebula", { recursive: true });
const games = [];
for (const file of files) {
  // Read the Git blob so Windows checkout line-ending conversion cannot alter hashes.
  const content = execFileSync("git", ["-C", source, "show", `HEAD:Games/${file}`]);
  await writeFile(`public/Games/${file}`, content);
  const path = `/Games/${encodeURIComponent(file)}`;
  games.push({ id: createHash("sha256").update(file).digest("hex").slice(0, 12), title: file.slice(0, -5).replace(/_/g, ":"), file, path, originalUrl: `https://nebula-hub-2.vercel.app${path}`, categories: [], tags: [], sha256: createHash("sha256").update(content).digest("hex"), launch: "compatibility" });
}
const catalog = { source: "https://github.com/Shinobiscripter/NebulaHub-2", sourceCommit: execFileSync("git", ["-C", source, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(), note: "Titles come from source filenames. Source provides no covers, categories or tags. Launchers use external assets.", games };
await writeFile("public/nebula/games.json", JSON.stringify(catalog, null, 2) + "\n");
console.log(`Migrated ${games.length} game launchers without changing their bytes.`);
