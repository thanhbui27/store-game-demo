"use client";

import { useMemo, useState } from "react";
import type { GameDefinition } from "@/generated/games";

type GameLibraryProps = {
  games: readonly GameDefinition[];
};

export function GameLibrary({ games }: GameLibraryProps) {
  const [query, setQuery] = useState("");

  const visibleGames = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi");
    if (!normalized) return games;
    return games.filter((game) =>
      [game.name, game.description, game.category]
        .join(" ")
        .toLocaleLowerCase("vi")
        .includes(normalized),
    );
  }, [games, query]);

  return (
    <section className="arcade-library" aria-labelledby="library-title">
      <div className="arcade-library-head">
        <div>
          <p className="arcade-section-index">01 / GAME LIBRARY</p>
          <h2 id="library-title">Chơi gì hôm nay?</h2>
        </div>

        <label className="arcade-search">
          <span className="sr-only">Tìm game</span>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            placeholder="Tìm game..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <kbd>/</kbd>
        </label>
      </div>

      {visibleGames.length > 0 ? (
        <div className="arcade-grid">
          {visibleGames.map((game, index) => (
            <a
              className="arcade-card"
              href={`/play/${game.slug}`}
              key={game.slug}
              style={
                {
                  "--game-accent": game.accent,
                  "--card-delay": `${index * 70}ms`,
                } as React.CSSProperties
              }
              aria-label={`Chơi ${game.name}`}
            >
              <div className="arcade-card-visual">
                {game.iconUrl ? (
                  // Folder-owned images are copied to public/game-icons at build time.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={game.iconUrl} alt="" />
                ) : (
                  <div className="arcade-card-fallback" aria-hidden="true">
                    <span>{game.emoji}</span>
                    <strong>{game.name}</strong>
                  </div>
                )}
                <div className="arcade-card-shade" />
                <span className="arcade-card-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="arcade-play-button" aria-hidden="true">
                  <i />
                </span>
              </div>

              <div className="arcade-card-copy">
                <div>
                  <p>{game.category}</p>
                  <h3>{game.name}</h3>
                </div>
                <span className="arcade-card-arrow" aria-hidden="true">
                  ↗
                </span>
                <p className="arcade-card-description">{game.description}</p>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="arcade-empty">
          <span aria-hidden="true">×</span>
          <h3>Chưa tìm thấy game này</h3>
          <p>Thử một từ khóa khác nha.</p>
        </div>
      )}
    </section>
  );
}
