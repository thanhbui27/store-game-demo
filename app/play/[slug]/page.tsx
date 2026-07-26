import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { games } from "@/generated/games";

type PlayPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return games.map((game) => ({ slug: game.slug }));
}

export async function generateMetadata({
  params,
}: PlayPageProps): Promise<Metadata> {
  const { slug } = await params;
  const game = games.find((item) => item.slug === slug);
  return game
    ? { title: game.name, description: game.description }
    : { title: "Không tìm thấy game" };
}

export default async function PlayPage({ params }: PlayPageProps) {
  const { slug } = await params;
  const game = games.find((item) => item.slug === slug);
  if (!game) notFound();

  return (
    <main className="player-shell">
      <header className="player-bar">
        <a href="/" className="player-back">
          <span aria-hidden="true">←</span>
          <span>Thư viện</span>
        </a>

        <div className="player-title">
          <span style={{ background: game.accent }} aria-hidden="true" />
          <div>
            <small>ĐANG CHƠI</small>
            <strong>{game.name}</strong>
          </div>
        </div>

        <a
          href={game.embedUrl}
          className="player-open"
          target="_blank"
          rel="noreferrer"
        >
          Mở riêng <span aria-hidden="true">↗</span>
        </a>
      </header>

      <div className="player-stage">
        <iframe
          src={game.embedUrl}
          title={`Chơi ${game.name}`}
          allow="autoplay; fullscreen; gamepad"
          allowFullScreen
        />
      </div>
    </main>
  );
}
