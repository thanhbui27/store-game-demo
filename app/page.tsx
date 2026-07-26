import { GameLibrary } from "./game-library";
import { games } from "@/generated/games";

export default function HomePage() {
  return (
    <main className="arcade-home">
      <div className="arcade-glow arcade-glow-one" aria-hidden="true" />
      <div className="arcade-glow arcade-glow-two" aria-hidden="true" />

      <header className="arcade-nav">
        <a className="arcade-brand" href="/" aria-label="R Arcade - Trang chủ">
          <span className="arcade-brand-mark" aria-hidden="true">
            R
          </span>
          <span>
            <strong>ARCADE</strong>
            <small>PLAYGROUND / 01</small>
          </span>
        </a>

        <div className="arcade-status">
          <i aria-hidden="true" />
          <span>{games.length} game sẵn sàng</span>
        </div>
      </header>

      <section className="arcade-hero" aria-labelledby="arcade-title">
        <div className="arcade-hero-copy">
          <p className="arcade-eyebrow">
            <span>NEW SEASON</span>
            Chơi nhanh. Vui lâu.
          </p>
          <h1 id="arcade-title">
            Chọn game.
            <br />
            <em>Bật mood.</em> Chơi thôi.
          </h1>
          <p className="arcade-intro">
            Không tài khoản, không chờ đợi. Chọn một tựa game bên dưới và vào
            trận ngay trên trình duyệt.
          </p>
        </div>

        <div className="arcade-hero-stamp" aria-hidden="true">
          <span>R/</span>
          <small>LOCAL<br />ARCADE</small>
        </div>
      </section>

      <GameLibrary games={games} />

      <footer className="arcade-footer">
        <span>R/ARCADE © 2026</span>
        <span className="arcade-footer-rule" aria-hidden="true" />
        <span>BUILT FOR PLAY</span>
      </footer>
    </main>
  );
}
