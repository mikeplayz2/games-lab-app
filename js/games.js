import { games } from "./games-data.js";

const grid = document.getElementById("games-grid");
const search = document.getElementById("game-search");
const categorySelect = document.getElementById("game-category");
const resultCount = document.getElementById("game-count");

function createGameCard(game) {
  const card = document.createElement("article");
  card.className = "game-card glass";

  const art = document.createElement("div");
  art.className = "game-art";
  art.style.setProperty("--game-accent", /^#[0-9a-f]{6}$/i.test(game.accent || "") ? game.accent : "#3b82f6");
  art.setAttribute("aria-hidden", "true");
  if (game.icon) {
    const icon = document.createElement("img");
    icon.className = "game-icon";
    icon.src = game.icon;
    icon.alt = "";
    icon.loading = "lazy";
    icon.addEventListener("error", () => {
      icon.remove();
      const fallback = document.createElement("span");
      fallback.className = "game-emoji";
      fallback.textContent = game.emoji || "🎮";
      art.append(fallback);
    }, { once: true });
    art.append(icon);
  } else {
    const emoji = document.createElement("span");
    emoji.className = "game-emoji";
    emoji.textContent = game.emoji || "🎮";
    art.append(emoji);
  }

  const body = document.createElement("div");
  body.className = "game-body";
  const meta = document.createElement("div");
  meta.className = "game-meta";
  const category = document.createElement("span");
  category.className = "game-category";
  category.textContent = game.category || "Other";
  const status = document.createElement("span");
  status.className = "game-status";
  status.textContent = game.status || "Coming soon";
  meta.append(category, status);

  const title = document.createElement("h3");
  title.textContent = game.title || "Untitled game";
  const description = document.createElement("p");
  description.textContent = game.description || "More details coming soon.";
  body.append(meta, title, description);

  if (game.folder) {
    const link = document.createElement("a");
    link.className = "game-link";
    link.textContent = "Play now ↗";
    link.href = `${game.folder.replace(/\/+$/, "")}/index.html`;
    body.append(link);
  } else {
    const unavailable = document.createElement("span");
    unavailable.className = "game-link unavailable";
    unavailable.textContent = "Coming soon";
    body.append(unavailable);
  }
  card.append(art, body);
  return card;
}

function renderGames() {
  const query = search.value.trim().toLowerCase();
  const selectedCategory = categorySelect.value;
  const visibleGames = games.filter((game) => {
    const matchesCategory = selectedCategory === "all" || game.category === selectedCategory;
    const searchable = `${game.title} ${game.category} ${game.description} ${game.status}`.toLowerCase();
    return matchesCategory && searchable.includes(query);
  });

  grid.replaceChildren(...visibleGames.map(createGameCard));
  resultCount.textContent = `${visibleGames.length} ${visibleGames.length === 1 ? "game" : "games"}`;
  document.getElementById("empty-state").hidden = visibleGames.length > 0;
}

const categories = [...new Set(games.map((game) => game.category).filter(Boolean))].sort();
for (const category of categories) {
  const option = document.createElement("option");
  option.value = category;
  option.textContent = category;
  categorySelect.append(option);
}
search.addEventListener("input", renderGames);
categorySelect.addEventListener("change", renderGames);
document.getElementById("clear-filters").addEventListener("click", () => {
  search.value = "";
  categorySelect.value = "all";
  renderGames();
});
renderGames();
