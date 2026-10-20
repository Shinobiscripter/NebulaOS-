import { selectGames } from "./library.js";
const $ = selector => document.querySelector(selector);
const os = window.anura || window.parent.anura;
const app = window.instance || os?.apps["nebula.games"];
const state = { games: [], query: "", view: "all", sort: "az", favorites: [], recent: {} };
let saveQueue = Promise.resolve();
function tell(text) { $("#message").textContent = text; }
function save() {
  const snapshot = { favorites: [...state.favorites], recent: { ...state.recent } };
  saveQueue = saveQueue.then(() => os.settings.set("nebula.games.library", snapshot)).catch(error => tell(`Could not save your library: ${error.message}`));
}
function played(game) { state.recent[game.id] = Date.now(); save(); }
function launch(game, inWindow = false) {
  if (game.launch === "external") {
    window.parent.open(game.path, "_blank", "noopener,noreferrer");
    tell(game.title + " requested on its external host. " + (game.description || ""));
    played(game); return;
  }
  if (inWindow) {
    if (!("credentialless" in HTMLIFrameElement.prototype)) {
      tell("This browser cannot embed compatibility games. Use Play to open a browser tab.");
      return;
    }
    const win = os.wm.create(app, { title: game.title, width: "960px", height: "680px", resizable: true });
    const frame = document.createElement("iframe");
    frame.credentialless = true;
    frame.title = game.title;
    frame.allow = "autoplay; fullscreen; gamepad";
    frame.allowFullscreen = true;
    frame.style.cssText = "width:100%;height:100%;border:0;background:#090d16";
    // Same-origin compatibility host is excluded from the OS service-worker routes.
    frame.src = `/play/index.html?id=${encodeURIComponent(game.id)}`;
    win.content.append(frame);
    win.addEventListener("close", () => { frame.src = "about:blank"; frame.remove(); });
    tell(`${game.title} opened in a desktop window. If the game needs persistent storage or fails to load, use Play in a browser tab.`);
  } else {
    // Keep this synchronous with the click so popup blockers can recognize it.
    window.parent.open(`/play/index.html?id=${encodeURIComponent(game.id)}`, "_blank", "noopener,noreferrer");
    tell(`${game.title} requested in a browser tab. Allow popups if it did not open.`);
  }
  played(game);
}
function render() {
  const games = selectGames(state.games, state);
  $("#count").textContent = `${games.length} / ${state.games.length} games`;
  const fragment = document.createDocumentFragment();
  for (const game of games) {
    const card = document.createElement("article");card.className = "game";
    const art = document.createElement("div");art.className = "art";art.setAttribute("aria-hidden", "true");
    // Source has no cover art. Initials are deliberate fallbacks, not invented covers.
    art.textContent = game.title.split(/\s+/).map(word => word[0]).join("").slice(0, 3);
    const details = document.createElement("div");details.className = "details";
    const title = document.createElement("h2");title.textContent = game.title;
    const actions = document.createElement("div");actions.className = "actions";
    const play = document.createElement("button");play.className = "play";play.textContent = "Play ↗";play.setAttribute("aria-label", `Play ${game.title}`);play.onclick = () => launch(game);
    const favorite = document.createElement("button");favorite.className = "favorite";favorite.textContent = state.favorites.includes(game.id) ? "★" : "☆";favorite.setAttribute("aria-pressed", String(state.favorites.includes(game.id)));favorite.setAttribute("aria-label", `Favorite ${game.title}`);
    favorite.onclick = () => {
      state.favorites = state.favorites.includes(game.id) ? state.favorites.filter(id => id !== game.id) : [...state.favorites, game.id];
      save();
      if (state.view === "favorites") render();
      else { favorite.textContent = state.favorites.includes(game.id) ? "★" : "☆"; favorite.setAttribute("aria-pressed", String(state.favorites.includes(game.id))); }
    };
    const secondary = document.createElement("div");secondary.className = "secondary";
    const native = document.createElement("button");native.className = "window-launch";native.textContent = "Open in window";native.onclick = () => launch(game, true);
    const original = document.createElement("a");original.textContent = "Original URL";original.href = game.originalUrl;original.target = "_blank";original.rel = "noopener noreferrer";
    if (game.launch === "external") { native.hidden = true; original.textContent = "GitHub project"; original.href = game.source; }
    actions.append(play, favorite);secondary.append(native, original);details.append(title);
    if (game.description) { const description = document.createElement("p"); description.textContent = game.description; details.append(description); }
    details.append(actions, secondary);card.append(art, details);fragment.append(card);
  }
  if (!games.length) { const empty = document.createElement("p");empty.className = "empty";empty.textContent = state.view === "favorites" ? "No favorites yet. Star a game in All games." : state.view === "recent" ? "Games you launch will appear here." : "No games match your search.";fragment.append(empty); }
  $("#games").replaceChildren(fragment);
}
$("#search").addEventListener("input", event => { state.query = event.target.value;render(); });
$("#sort").addEventListener("change", event => { state.sort = event.target.value;render(); });
document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => { state.view = button.dataset.view;document.querySelectorAll("[data-view]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));render(); }));
document.addEventListener("keydown", event => {
  if (event.key === "/" && !["INPUT", "SELECT"].includes(document.activeElement.tagName)) { event.preventDefault();$("#search").focus(); }
});
try {
  if (!os || !app) throw new Error("Open Nebula Games from the NebulaHub launcher.");
  const saved = os.settings.get("nebula.games.library") || {};
  state.favorites = Array.isArray(saved.favorites) ? saved.favorites : [];
  state.recent = saved.recent && typeof saved.recent === "object" ? saved.recent : {};
  const response = await fetch("/nebula/games.json");if (!response.ok) throw new Error(`Library returned HTTP ${response.status}`);
  state.games = (await response.json()).games;
  render();tell("Play opens a browser tab for compatibility. Desktop windows are available in Chromium; their game storage is temporary.");
} catch (error) { $("#count").textContent = "Library unavailable";tell(error.message); }
