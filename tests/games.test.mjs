import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { selectGames } from "../apps/nebula-games.app/library.js";
const { games } = JSON.parse(await readFile(new URL("../public/nebula/games.json",import.meta.url)));
test("all migrated launchers are present, unique, unchanged and URL-encoded", async () => {
  assert.equal(games.length,46);assert.equal(new Set(games.map(game => game.id)).size,46);
  for (const game of games) {
    assert.equal(decodeURIComponent(game.path),`/Games/${game.file}`);
    const bytes = await readFile(new URL(`../public/Games/${encodeURIComponent(game.file)}`,import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"),game.sha256);
    assert.ok(new URL(game.originalUrl).pathname.endsWith(encodeURIComponent(game.file)));
  }
});
test("search composes with favorites and sorting", () => {
  const favorites=games.filter(game=>game.title.includes("Freddy")).map(game=>game.id);
  const selected=selectGames(games,{query:"  FREDDY  ",view:"favorites",favorites,sort:"za"});
  assert.ok(selected.length>1);assert.deepEqual(selected, [...selected].sort((a,b)=>b.title.localeCompare(a.title)));
  assert.equal(selectGames(games,{query:"no-such-title"}).length,0);
});
test("recent view excludes unplayed titles and orders newest first", () => {
  const recent={[games[0].id]:10,[games[1].id]:20};
  assert.deepEqual(selectGames(games,{view:"recent",recent}).map(game=>game.id),[games[1].id,games[0].id]);
  assert.equal(selectGames(games,{view:"favorites"}).length,0);
});
