const status = document.getElementById("status");
try {
  const response = await fetch("/nebula/games.json");
  if (!response.ok) throw new Error(`Library returned HTTP ${response.status}`);
  const { games } = await response.json();
  const game = games.find(game => game.id === new URL(location.href).searchParams.get("id"));
  if (!game) throw new Error("This game is not in the library. Open Nebula Games and choose a title.");
  document.title = `${game.title} · NebulaHub`;
  document.getElementById("name").textContent = game.title;
  document.getElementById("direct").href = game.path;
  const frame = document.createElement("iframe");
  frame.title = game.title;frame.allow = "autoplay; fullscreen; gamepad";frame.allowFullscreen = true;
  frame.src = game.path;
  frame.addEventListener("load", () => { status.textContent = "Launcher loaded. Game assets download from the original providers. If loading stalls, try Open directly."; });
  frame.addEventListener("error", () => { status.textContent = "The launcher could not load. Check your connection or try Open directly."; });
  document.body.append(frame);
  document.getElementById("reload").onclick = () => { status.textContent = "Reloading…";frame.src = game.path; };
  document.getElementById("fullscreen").onclick = () => frame.requestFullscreen().catch(error => { status.textContent = error.message; });
} catch (error) { status.textContent = error.message;document.getElementById("direct").hidden = true;document.getElementById("reload").disabled = true;document.getElementById("fullscreen").disabled = true; }
