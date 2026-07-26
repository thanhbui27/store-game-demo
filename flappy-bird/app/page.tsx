import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flappy Bird — Bay thật xa!",
  description:
    "Game Flappy Bird một chạm, chơi ngay trên máy tính hoặc điện thoại.",
};

export default function Home() {
  return (
    <main className="game-page">
      <iframe
        className="game-frame"
        src="/game.html"
        title="Flappy Bird"
        allow="autoplay"
      />
    </main>
  );
}
