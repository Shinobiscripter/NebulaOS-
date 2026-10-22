// Pure catalog operations shared by the UI and regression tests.
export function selectGames(games, { query = "", view = "all", sort = "az", favorites = [], recent = {} } = {}) {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return games.filter(game => {
    const searchable = [game.title, ...(game.tags || []), ...(game.categories || [])].join(" ").toLocaleLowerCase();
    return words.every(word => searchable.includes(word)) &&
      (view !== "favorites" || favorites.includes(game.id)) &&
      (view !== "recent" || recent[game.id]);
  }).sort((a, b) => {
    if (sort === "recent" || view === "recent") return (recent[b.id] || 0) - (recent[a.id] || 0) || a.title.localeCompare(b.title);
    return a.title.localeCompare(b.title) * (sort === "za" ? -1 : 1);
  });
}
