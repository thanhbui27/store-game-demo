"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

const WORLD_W = 720;
const WORLD_H = 980;
const ROUND_SECONDS = 60;

type InsectKind = "normal" | "gold" | "hazard";
type GameMode = "ready" | "playing" | "over";

type Insect = {
  id: number;
  kind: InsectKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  phase: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
};

type Tongue = {
  x: number;
  y: number;
  elapsed: number;
  caught: boolean;
};

type Engine = {
  playing: boolean;
  score: number;
  combo: number;
  bestCombo: number;
  timeLeft: number;
  spawnClock: number;
  nextId: number;
  lastCatchAt: number;
  insects: Insect[];
  particles: Particle[];
  tongue: Tongue | null;
  aimX: number;
  aimY: number;
  lastFrame: number;
  lastShownSecond: number;
};

const initialEngine = (): Engine => ({
  playing: false,
  score: 0,
  combo: 0,
  bestCombo: 0,
  timeLeft: ROUND_SECONDS,
  spawnClock: 0.4,
  nextId: 1,
  lastCatchAt: 0,
  insects: [],
  particles: [],
  tongue: null,
  aimX: WORLD_W / 2,
  aimY: WORLD_H * 0.38,
  lastFrame: 0,
  lastShownSecond: ROUND_SECONDS,
});

function makeInsect(engine: Engine): Insect {
  const roll = Math.random();
  const kind: InsectKind =
    roll > 0.9 ? "hazard" : roll > 0.76 ? "gold" : "normal";
  const speed = 48 + Math.random() * 65;
  const fromLeft = Math.random() > 0.5;

  return {
    id: engine.nextId++,
    kind,
    x: fromLeft ? 34 : WORLD_W - 34,
    y: 150 + Math.random() * 510,
    vx: (fromLeft ? 1 : -1) * speed,
    vy: -22 + Math.random() * 44,
    radius: kind === "hazard" ? 23 : kind === "gold" ? 20 : 18,
    phase: Math.random() * Math.PI * 2,
  };
}

function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  const x = ax + t * dx;
  const y = ay + t * dy;
  return Math.hypot(px - x, py - y);
}

function drawLeaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  rotation: number,
  color: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(42, -58, 104, -42, 132, 0);
  ctx.bezierCurveTo(88, 34, 36, 34, 0, 0);
  ctx.fill();
  ctx.strokeStyle = "rgba(224,255,181,.28)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(116, 0);
  ctx.stroke();
  ctx.restore();
}

function drawInsect(
  ctx: CanvasRenderingContext2D,
  insect: Insect,
  now: number,
) {
  const bob = Math.sin(now * 0.006 + insect.phase) * 5;
  const wing = Math.sin(now * 0.035 + insect.phase) * 0.45;

  ctx.save();
  ctx.translate(insect.x, insect.y + bob);
  ctx.rotate(Math.atan2(insect.vy, insect.vx) * 0.12);

  if (insect.kind === "gold") {
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 48);
    glow.addColorStop(0, "rgba(255,236,120,.72)");
    glow.addColorStop(1, "rgba(255,204,74,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle =
    insect.kind === "hazard"
      ? "rgba(255,116,105,.28)"
      : "rgba(223,246,255,.45)";
  ctx.save();
  ctx.rotate(-0.55 - wing);
  ctx.beginPath();
  ctx.ellipse(-7, -16, 10, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.rotate(0.55 + wing);
  ctx.beginPath();
  ctx.ellipse(7, -16, 10, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle =
    insect.kind === "hazard"
      ? "#ef5b4c"
      : insect.kind === "gold"
        ? "#ffd95b"
        : "#263a43";
  ctx.beginPath();
  ctx.ellipse(0, 3, 8, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -14, 7, 0, Math.PI * 2);
  ctx.fill();

  if (insect.kind === "hazard") {
    ctx.strokeStyle = "#3d1d26";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-7, -6);
    ctx.lineTo(7, 1);
    ctx.moveTo(-7, 5);
    ctx.lineTo(7, 12);
    ctx.stroke();
  }

  ctx.strokeStyle =
    insect.kind === "gold" ? "#ffec93" : "rgba(25,34,39,.72)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-2, -19);
  ctx.quadraticCurveTo(-15, -30, -22, -25);
  ctx.moveTo(2, -19);
  ctx.quadraticCurveTo(15, -30, 22, -25);
  ctx.stroke();
  ctx.restore();
}

function drawLizard(
  ctx: CanvasRenderingContext2D,
  aimX: number,
  aimY: number,
  tongue: Tongue | null,
) {
  const baseX = WORLD_W / 2;
  const baseY = WORLD_H - 118;
  const angle = Math.atan2(aimY - baseY, aimX - baseX);
  const eyeX = Math.cos(angle) * 4;
  const eyeY = Math.sin(angle) * 4;

  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = "#448c54";
  ctx.lineWidth = 44;
  ctx.beginPath();
  ctx.moveTo(baseX - 60, baseY + 70);
  ctx.bezierCurveTo(baseX - 175, baseY + 96, baseX - 204, baseY + 17, baseX - 250, baseY + 56);
  ctx.stroke();

  ctx.fillStyle = "#6fc86f";
  ctx.beginPath();
  ctx.ellipse(baseX, baseY + 48, 108, 74, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#8add7d";
  ctx.beginPath();
  ctx.ellipse(baseX, baseY, 88, 72, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(219,255,173,.6)";
  ctx.beginPath();
  ctx.ellipse(baseX - 30, baseY + 17, 18, 13, -0.3, 0, Math.PI * 2);
  ctx.ellipse(baseX + 40, baseY + 29, 15, 10, 0.4, 0, Math.PI * 2);
  ctx.fill();

  for (const side of [-1, 1]) {
    const ex = baseX + side * 42;
    ctx.fillStyle = "#f3f6bb";
    ctx.beginPath();
    ctx.arc(ex, baseY - 38, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#19282e";
    ctx.beginPath();
    ctx.arc(ex + eyeX, baseY - 38 + eyeY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(ex + eyeX - 3, baseY - 42 + eyeY, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "#346d44";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(baseX, baseY + 9, 31, 0.18, Math.PI - 0.18);
  ctx.stroke();

  if (tongue) {
    const duration = 0.34;
    const progress = Math.sin(Math.min(1, tongue.elapsed / duration) * Math.PI);
    const dx = tongue.x - baseX;
    const dy = tongue.y - (baseY + 22);
    const length = Math.hypot(dx, dy);
    const maxLength = Math.min(length, 560);
    const endX = baseX + (dx / Math.max(1, length)) * maxLength * progress;
    const endY = baseY + 22 + (dy / Math.max(1, length)) * maxLength * progress;
    ctx.strokeStyle = "#76304c";
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY + 22);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.strokeStyle = "#ff7699";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY + 22);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.fillStyle = "#ff98b1";
    ctx.beginPath();
    ctx.arc(endX, endY, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine>(initialEngine());
  const audioRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef(true);
  const [mode, setMode] = useState<GameMode>("ready");
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [highScore, setHighScore] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem("muoi-hunter-high-score") || 0);
    setHighScore(Number.isFinite(stored) ? stored : 0);
  }, []);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const playTone = useCallback((frequency: number, duration = 0.08) => {
    if (!soundEnabledRef.current) return;
    try {
      audioRef.current ??= new AudioContext();
      const audio = audioRef.current;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(90, frequency * 0.7),
        audio.currentTime + duration,
      );
      gain.gain.setValueAtTime(0.075, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audio.currentTime + duration,
      );
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + duration);
    } catch {
      // Audio is optional; gameplay should never depend on it.
    }
  }, []);

  const startGame = useCallback(() => {
    const fresh = initialEngine();
    fresh.playing = true;
    fresh.insects = [makeInsect(fresh), makeInsect(fresh), makeInsect(fresh)];
    fresh.lastFrame = performance.now();
    engineRef.current = fresh;
    setScore(0);
    setCombo(0);
    setTimeLeft(ROUND_SECONDS);
    setMode("playing");
    playTone(540, 0.12);
  }, [playTone]);

  const shootAt = useCallback(
    (x: number, y: number) => {
      const engine = engineRef.current;
      if (!engine.playing || engine.tongue) return;
      engine.aimX = Math.max(20, Math.min(WORLD_W - 20, x));
      engine.aimY = Math.max(70, Math.min(WORLD_H - 170, y));
      engine.tongue = {
        x: engine.aimX,
        y: engine.aimY,
        elapsed: 0,
        caught: false,
      };
      playTone(310, 0.06);
    },
    [playTone],
  );

  const pointerPosition = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * WORLD_W,
      y: ((event.clientY - rect.top) / rect.height) * WORLD_H,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = pointerPosition(event);
    engineRef.current.aimX = point.x;
    engineRef.current.aimY = point.y;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerPosition(event);
    shootAt(point.x, point.y);
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const engine = engineRef.current;
      const step = event.shiftKey ? 34 : 18;
      if (event.key === "ArrowLeft") engine.aimX -= step;
      if (event.key === "ArrowRight") engine.aimX += step;
      if (event.key === "ArrowUp") engine.aimY -= step;
      if (event.key === "ArrowDown") engine.aimY += step;
      engine.aimX = Math.max(20, Math.min(WORLD_W - 20, engine.aimX));
      engine.aimY = Math.max(70, Math.min(WORLD_H - 170, engine.aimY));
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
      }
      if (event.code === "Space") {
        event.preventDefault();
        shootAt(engine.aimX, engine.aimY);
      }
      if (event.key === "Enter" && !engine.playing) startGame();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [shootAt, startGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = WORLD_W * dpr;
    canvas.height = WORLD_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let frame = 0;

    const finishRound = () => {
      const engine = engineRef.current;
      if (!engine.playing) return;
      engine.playing = false;
      engine.tongue = null;
      setMode("over");
      setCombo(engine.bestCombo);
      setHighScore((current) => {
        const next = Math.max(current, engine.score);
        window.localStorage.setItem("muoi-hunter-high-score", String(next));
        return next;
      });
      playTone(180, 0.3);
    };

    const burst = (x: number, y: number, color: string) => {
      const engine = engineRef.current;
      for (let i = 0; i < 10; i += 1) {
        const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.3;
        const speed = 55 + Math.random() * 85;
        engine.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.5 + Math.random() * 0.25,
          color,
        });
      }
    };

    const update = (dt: number, now: number) => {
      const engine = engineRef.current;

      for (const particle of engine.particles) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vy += 95 * dt;
        particle.life -= dt;
      }
      engine.particles = engine.particles.filter((particle) => particle.life > 0);

      if (!engine.playing) return;
      engine.timeLeft = Math.max(0, engine.timeLeft - dt);
      const shownSecond = Math.ceil(engine.timeLeft);
      if (shownSecond !== engine.lastShownSecond) {
        engine.lastShownSecond = shownSecond;
        setTimeLeft(shownSecond);
      }
      if (engine.timeLeft <= 0) {
        finishRound();
        return;
      }

      engine.spawnClock -= dt;
      if (engine.spawnClock <= 0 && engine.insects.length < 11) {
        engine.insects.push(makeInsect(engine));
        const elapsed = ROUND_SECONDS - engine.timeLeft;
        engine.spawnClock = Math.max(0.34, 0.88 - elapsed * 0.007) + Math.random() * 0.28;
      }

      for (const insect of engine.insects) {
        insect.x += insect.vx * dt;
        insect.y += insect.vy * dt;
        insect.vy += Math.sin(now * 0.002 + insect.phase) * 7 * dt;
        if (insect.x < 28 || insect.x > WORLD_W - 28) insect.vx *= -1;
        if (insect.y < 108 || insect.y > WORLD_H - 250) insect.vy *= -1;
      }

      if (engine.tongue) {
        const tongue = engine.tongue;
        tongue.elapsed += dt;
        const duration = 0.34;
        const progress = Math.sin(Math.min(1, tongue.elapsed / duration) * Math.PI);
        const baseX = WORLD_W / 2;
        const baseY = WORLD_H - 96;
        const dx = tongue.x - baseX;
        const dy = tongue.y - baseY;
        const fullLength = Math.hypot(dx, dy);
        const reach = Math.min(fullLength, 560) * progress;
        const endX = baseX + (dx / Math.max(1, fullLength)) * reach;
        const endY = baseY + (dy / Math.max(1, fullLength)) * reach;

        if (!tongue.caught && tongue.elapsed < duration * 0.62) {
          let hitIndex = -1;
          let hitDistance = Number.POSITIVE_INFINITY;
          engine.insects.forEach((insect, index) => {
            const distance = distanceToSegment(
              insect.x,
              insect.y,
              baseX,
              baseY,
              endX,
              endY,
            );
            const fromMouth = Math.hypot(insect.x - baseX, insect.y - baseY);
            if (distance < insect.radius + 10 && fromMouth < hitDistance) {
              hitDistance = fromMouth;
              hitIndex = index;
            }
          });

          if (hitIndex >= 0) {
            const hit = engine.insects.splice(hitIndex, 1)[0];
            tongue.caught = true;
            if (hit.kind === "hazard") {
              engine.score = Math.max(0, engine.score - 20);
              engine.combo = 0;
              engine.timeLeft = Math.max(0, engine.timeLeft - 2);
              setScore(engine.score);
              setCombo(0);
              burst(hit.x, hit.y, "#ff7167");
              playTone(120, 0.16);
            } else {
              engine.combo =
                now - engine.lastCatchAt < 2300 ? engine.combo + 1 : 1;
              engine.lastCatchAt = now;
              engine.bestCombo = Math.max(engine.bestCombo, engine.combo);
              const multiplier = Math.min(5, 1 + Math.floor(engine.combo / 3));
              const points = (hit.kind === "gold" ? 30 : 10) * multiplier;
              engine.score += points;
              setScore(engine.score);
              setCombo(engine.combo);
              burst(
                hit.x,
                hit.y,
                hit.kind === "gold" ? "#ffe66a" : "#b8f271",
              );
              playTone(hit.kind === "gold" ? 880 : 650, 0.1);
            }
          }
        }

        if (tongue.elapsed >= duration) {
          if (!tongue.caught && engine.combo > 0) {
            engine.combo = 0;
            setCombo(0);
          }
          engine.tongue = null;
        }
      }
    };

    const draw = (now: number) => {
      const engine = engineRef.current;
      ctx.clearRect(0, 0, WORLD_W, WORLD_H);

      const sky = ctx.createLinearGradient(0, 0, 0, WORLD_H);
      sky.addColorStop(0, "#172b4c");
      sky.addColorStop(0.52, "#315d63");
      sky.addColorStop(1, "#163d37");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);

      const moonGlow = ctx.createRadialGradient(566, 146, 8, 566, 146, 142);
      moonGlow.addColorStop(0, "rgba(255,244,186,.5)");
      moonGlow.addColorStop(1, "rgba(255,244,186,0)");
      ctx.fillStyle = moonGlow;
      ctx.beginPath();
      ctx.arc(566, 146, 142, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff1b9";
      ctx.beginPath();
      ctx.arc(566, 146, 48, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1e3a55";
      ctx.beginPath();
      ctx.arc(587, 128, 48, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(7,28,34,.3)";
      for (let i = 0; i < 7; i += 1) {
        ctx.beginPath();
        ctx.ellipse(
          60 + i * 118,
          722 + Math.sin(i * 2.4) * 26,
          118,
          238,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }

      for (let i = 0; i < 15; i += 1) {
        const x = 32 + ((i * 139) % 655);
        const y = 92 + ((i * 83) % 610);
        const pulse = 0.45 + Math.sin(now * 0.003 + i) * 0.3;
        ctx.fillStyle = `rgba(225,255,123,${pulse})`;
        ctx.beginPath();
        ctx.arc(x, y, 2.5 + pulse * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      drawLeaf(ctx, -25, 770, 1.25, -0.2, "#245c45");
      drawLeaf(ctx, 560, 760, 1.15, Math.PI + 0.28, "#2a6c4d");
      drawLeaf(ctx, 26, 186, 0.75, 0.5, "#306b4e");
      drawLeaf(ctx, 650, 294, 0.8, 2.7, "#245942");

      for (const insect of engine.insects) drawInsect(ctx, insect, now);
      for (const particle of engine.particles) {
        ctx.globalAlpha = Math.min(1, particle.life * 2);
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      drawLizard(ctx, engine.aimX, engine.aimY, engine.tongue);

      if (engine.playing && !engine.tongue) {
        ctx.strokeStyle = "rgba(239,255,179,.8)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(engine.aimX, engine.aimY, 18, 0, Math.PI * 2);
        ctx.moveTo(engine.aimX - 27, engine.aimY);
        ctx.lineTo(engine.aimX - 10, engine.aimY);
        ctx.moveTo(engine.aimX + 10, engine.aimY);
        ctx.lineTo(engine.aimX + 27, engine.aimY);
        ctx.moveTo(engine.aimX, engine.aimY - 27);
        ctx.lineTo(engine.aimX, engine.aimY - 10);
        ctx.moveTo(engine.aimX, engine.aimY + 10);
        ctx.lineTo(engine.aimX, engine.aimY + 27);
        ctx.stroke();
      }
    };

    const loop = (now: number) => {
      const engine = engineRef.current;
      const dt = engine.lastFrame
        ? Math.min(0.034, (now - engine.lastFrame) / 1000)
        : 0;
      engine.lastFrame = now;
      update(dt, now);
      draw(now);
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [playTone]);

  const multiplier = Math.min(5, 1 + Math.floor(combo / 3));

  return (
    <main className="page-shell">
      <section className="game-column" aria-labelledby="game-title">
        <header className="topbar">
          <div className="brand">
            <span className="brand-kicker">VƯỜN ĐÊM</span>
            <h1 id="game-title">Thằn Lằn Săn Muỗi</h1>
          </div>
          <button
            className="sound-button"
            type="button"
            aria-label={soundEnabled ? "Tắt âm thanh" : "Bật âm thanh"}
            aria-pressed={soundEnabled}
            onClick={() => setSoundEnabled((value) => !value)}
          >
            {soundEnabled ? "ÂM: BẬT" : "ÂM: TẮT"}
          </button>
        </header>

        <div className="game-frame">
          <div className="hud" aria-live="polite">
            <div className="hud-block">
              <span>ĐIỂM</span>
              <strong>{score.toString().padStart(3, "0")}</strong>
            </div>
            <div className={`combo-pill ${combo >= 3 ? "is-hot" : ""}`}>
              <span>COMBO</span>
              <strong>
                {combo} <small>×{multiplier}</small>
              </strong>
            </div>
            <div className={`hud-block align-right ${timeLeft <= 10 ? "danger" : ""}`}>
              <span>THỜI GIAN</span>
              <strong>{timeLeft}s</strong>
            </div>
          </div>

          <canvas
            ref={canvasRef}
            className="game-canvas"
            aria-label="Sân chơi săn muỗi. Di chuyển chuột để ngắm và bấm để phóng lưỡi."
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerDown}
          />

          {mode !== "playing" && (
            <div className="game-overlay">
              <div className="overlay-card">
                <span className="eyebrow">
                  {mode === "over" ? "HẾT GIỜ!" : "SẴN SÀNG SĂN ĐÊM?"}
                </span>
                <h2>
                  {mode === "over"
                    ? `${score} điểm`
                    : "Ngắm chuẩn. Táp nhanh."}
                </h2>
                {mode === "over" ? (
                  <div className="result-grid">
                    <div>
                      <span>Kỷ lục</span>
                      <strong>{Math.max(highScore, score)}</strong>
                    </div>
                    <div>
                      <span>Combo tốt</span>
                      <strong>×{combo}</strong>
                    </div>
                  </div>
                ) : (
                  <p>
                    Chạm vào muỗi để phóng lưỡi. Bắt liên tiếp để tăng hệ số,
                    săn muỗi vàng và tránh bọ xít đỏ.
                  </p>
                )}
                <button
                  className="play-button"
                  type="button"
                  data-testid="start-game"
                  onClick={startGame}
                >
                  {mode === "over" ? "SĂN LẠI" : "BẮT ĐẦU"}
                  <span aria-hidden="true">→</span>
                </button>
                <small>Chuột / chạm màn hình · Phím mũi tên + Space</small>
              </div>
            </div>
          )}
        </div>

        <footer className="legend">
          <span><i className="dot normal" /> Muỗi thường +10</span>
          <span><i className="dot gold" /> Muỗi vàng +30</span>
          <span><i className="dot hazard" /> Bọ xít −20 &amp; −2s</span>
          <span className="record">Kỷ lục: <strong>{highScore}</strong></span>
        </footer>
      </section>
    </main>
  );
}
