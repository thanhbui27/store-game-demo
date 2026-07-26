"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

type Mode = "ready" | "playing" | "over";

type Anchor = {
  id: number;
  x: number;
  y: number;
  size: number;
  phase: number;
};

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
};

type Player = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
};

type Engine = {
  mode: Mode;
  player: Player;
  anchors: Anchor[];
  attachedId: number | null;
  ropeLength: number;
  holding: boolean;
  cameraX: number;
  startX: number;
  nextAnchorX: number;
  nextId: number;
  distance: number;
  maxSpeed: number;
  sparks: Spark[];
  lastFrame: number;
  lastHudAt: number;
  flashText: string;
  flashLife: number;
};

type ViewSize = {
  width: number;
  height: number;
  dpr: number;
};

const emptyEngine = (): Engine => ({
  mode: "ready",
  player: {
    x: 120,
    y: 300,
    vx: 0,
    vy: 0,
    rotation: 0,
  },
  anchors: [],
  attachedId: null,
  ropeLength: 0,
  holding: false,
  cameraX: 0,
  startX: 120,
  nextAnchorX: 320,
  nextId: 1,
  distance: 0,
  maxSpeed: 0,
  sparks: [],
  lastFrame: 0,
  lastHudAt: 0,
  flashText: "",
  flashLife: 0,
});

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function seedAnchors(engine: Engine, size: ViewSize) {
  const ceiling = Math.max(82, size.height * 0.12);
  const lower = Math.max(ceiling + 90, size.height - 190);

  while (engine.nextAnchorX < engine.cameraX + size.width * 2.4) {
    const progress = Math.max(0, (engine.nextAnchorX - engine.startX) / 6000);
    const spacing = randomBetween(205, 295 + Math.min(90, progress * 35));
    engine.nextAnchorX += spacing;
    engine.anchors.push({
      id: engine.nextId++,
      x: engine.nextAnchorX,
      y: randomBetween(ceiling, lower),
      size: randomBetween(15, 21),
      phase: Math.random() * Math.PI * 2,
    });
  }
}

function drawRoundedPolygon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  sides: number,
  rotation: number,
) {
  ctx.beginPath();
  for (let index = 0; index < sides; index += 1) {
    const angle = rotation + (index * Math.PI * 2) / sides;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine>(emptyEngine());
  const sizeRef = useRef<ViewSize>({ width: 960, height: 620, dpr: 1 });
  const audioRef = useRef<AudioContext | null>(null);
  const [mode, setMode] = useState<Mode>("ready");
  const [distance, setDistance] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [best, setBest] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem("hook-hop-best") || 0);
    setBest(Number.isFinite(stored) ? stored : 0);
  }, []);

  const playTone = useCallback((frequency: number, duration = 0.07) => {
    try {
      audioRef.current ??= new AudioContext();
      const audio = audioRef.current;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(80, frequency * 0.72),
        audio.currentTime + duration,
      );
      gain.gain.setValueAtTime(0.055, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audio.currentTime + duration,
      );
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + duration);
    } catch {
      // Sound is an enhancement; gameplay remains available without it.
    }
  }, []);

  const makeBurst = useCallback(
    (x: number, y: number, color: string, count = 9) => {
      const engine = engineRef.current;
      for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * Math.PI * 2 + Math.random() * 0.4;
        const force = randomBetween(50, 135);
        engine.sparks.push({
          x,
          y,
          vx: Math.cos(angle) * force,
          vy: Math.sin(angle) * force,
          life: randomBetween(0.35, 0.68),
          color,
        });
      }
    },
    [],
  );

  const attachNearest = useCallback(() => {
    const engine = engineRef.current;
    if (engine.mode !== "playing" || engine.attachedId !== null) return;
    const { player } = engine;
    const maxReach = Math.min(430, Math.max(300, sizeRef.current.width * 0.7));
    let nearest: Anchor | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const anchor of engine.anchors) {
      const dx = anchor.x - player.x;
      const dy = anchor.y - player.y;
      const directDistance = Math.hypot(dx, dy);
      if (
        directDistance <= maxReach &&
        dx > -85 &&
        anchor.y < player.y + 80
      ) {
        const score = directDistance + Math.max(0, -dx) * 1.8;
        if (score < bestScore) {
          bestScore = score;
          nearest = anchor;
        }
      }
    }

    if (!nearest) return;
    engine.attachedId = nearest.id;
    engine.ropeLength = Math.max(
      82,
      Math.hypot(nearest.x - player.x, nearest.y - player.y),
    );
    makeBurst(nearest.x, nearest.y, "#9ff8ff", 7);
    playTone(520, 0.08);
  }, [makeBurst, playTone]);

  const releaseHook = useCallback(() => {
    const engine = engineRef.current;
    engine.holding = false;
    if (engine.mode !== "playing" || engine.attachedId === null) return;
    engine.attachedId = null;
    if (engine.player.vx > 470) {
      engine.player.vx += 34;
      engine.flashText = "PHÓNG!";
      engine.flashLife = 0.65;
      makeBurst(engine.player.x, engine.player.y, "#ffef8b", 12);
      playTone(760, 0.09);
    } else {
      playTone(350, 0.05);
    }
  }, [makeBurst, playTone]);

  const startGame = useCallback(() => {
    const size = sizeRef.current;
    const engine = emptyEngine();
    engine.mode = "playing";
    engine.player = {
      x: 120,
      y: Math.min(size.height * 0.48, size.height - 190),
      vx: 315,
      vy: -75,
      rotation: 0,
    };
    engine.lastFrame = performance.now();
    engine.nextAnchorX = 175;
    seedAnchors(engine, size);
    engineRef.current = engine;
    setMode("playing");
    setDistance(0);
    setSpeed(32);
    setMaxSpeed(32);
    playTone(620, 0.13);
  }, [playTone]);

  const beginHold = useCallback(() => {
    const engine = engineRef.current;
    if (engine.mode !== "playing") return;
    engine.holding = true;
    attachNearest();
  }, [attachNearest]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    beginHold();
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    releaseHook();
  };

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        if (!event.repeat) beginHold();
      }
      if (event.key === "Enter" && engineRef.current.mode !== "playing") {
        startGame();
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        releaseHook();
      }
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, [beginHold, releaseHook, startGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      sizeRef.current = {
        width: Math.max(320, rect.width),
        height: Math.max(420, rect.height),
        dpr,
      };
      canvas.width = Math.round(sizeRef.current.width * dpr);
      canvas.height = Math.round(sizeRef.current.height * dpr);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    let animationFrame = 0;

    const endGame = () => {
      const engine = engineRef.current;
      if (engine.mode !== "playing") return;
      engine.mode = "over";
      engine.holding = false;
      engine.attachedId = null;
      setMode("over");
      setDistance(Math.floor(engine.distance));
      setMaxSpeed(Math.round(engine.maxSpeed / 10));
      setBest((current) => {
        const next = Math.max(current, Math.floor(engine.distance));
        window.localStorage.setItem("hook-hop-best", String(next));
        return next;
      });
      playTone(130, 0.3);
    };

    const update = (dt: number, now: number) => {
      const engine = engineRef.current;
      const size = sizeRef.current;

      for (const spark of engine.sparks) {
        spark.x += spark.vx * dt;
        spark.y += spark.vy * dt;
        spark.vy += 180 * dt;
        spark.life -= dt;
      }
      engine.sparks = engine.sparks.filter((spark) => spark.life > 0);
      engine.flashLife = Math.max(0, engine.flashLife - dt);

      if (engine.mode !== "playing") return;
      const player = engine.player;
      const gravity = 830;
      player.vy += gravity * dt;
      player.x += player.vx * dt;
      player.y += player.vy * dt;

      const attached = engine.anchors.find(
        (anchor) => anchor.id === engine.attachedId,
      );
      if (attached) {
        const dx = player.x - attached.x;
        const dy = player.y - attached.y;
        const length = Math.max(1, Math.hypot(dx, dy));
        const nx = dx / length;
        const ny = dy / length;
        player.x = attached.x + nx * engine.ropeLength;
        player.y = attached.y + ny * engine.ropeLength;
        const radialVelocity = player.vx * nx + player.vy * ny;
        player.vx -= radialVelocity * nx;
        player.vy -= radialVelocity * ny;
        player.vx += 17 * dt;
      } else {
        player.vx *= Math.pow(0.997, dt * 60);
        if (player.vx < 155) player.vx += 20 * dt;
      }

      const velocity = Math.hypot(player.vx, player.vy);
      if (velocity > 880) {
        player.vx = (player.vx / velocity) * 880;
        player.vy = (player.vy / velocity) * 880;
      }
      player.rotation +=
        (Math.atan2(player.vy, player.vx) - player.rotation) *
        Math.min(1, dt * 8);

      if (engine.holding && engine.attachedId === null) attachNearest();

      engine.cameraX = Math.max(0, player.x - size.width * 0.27);
      engine.distance = Math.max(0, (player.x - engine.startX) / 11);
      engine.maxSpeed = Math.max(engine.maxSpeed, velocity);
      seedAnchors(engine, size);
      engine.anchors = engine.anchors.filter(
        (anchor) => anchor.x > engine.cameraX - 420,
      );

      if (now - engine.lastHudAt > 90) {
        engine.lastHudAt = now;
        setDistance(Math.floor(engine.distance));
        setSpeed(Math.round(velocity / 10));
        setMaxSpeed(Math.round(engine.maxSpeed / 10));
      }

      if (
        player.y > size.height + 90 ||
        player.x < engine.cameraX - 95 ||
        player.y < -240
      ) {
        endGame();
      }
    };

    const drawBackground = (
      now: number,
      size: ViewSize,
      cameraX: number,
    ) => {
      const { width, height } = size;
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, "#111a3c");
      sky.addColorStop(0.48, "#3d3170");
      sky.addColorStop(0.74, "#e56f72");
      sky.addColorStop(1, "#f8bb74");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      const sunX = width * 0.78 - cameraX * 0.025;
      const sunY = height * 0.26;
      const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 115);
      glow.addColorStop(0, "rgba(255,239,178,.95)");
      glow.addColorStop(0.35, "rgba(255,187,122,.38)");
      glow.addColorStop(1, "rgba(255,170,120,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 115, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffe9ae";
      ctx.beginPath();
      ctx.arc(sunX, sunY, 42, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(19,28,70,.28)";
      for (let layer = 0; layer < 3; layer += 1) {
        const parallax = cameraX * (0.06 + layer * 0.04);
        const baseY = height * (0.64 + layer * 0.08);
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = -160; x < width + 180; x += 110) {
          const world = x + parallax;
          const peak =
            baseY -
            55 -
            Math.sin(world * 0.006 + layer * 2) * (30 + layer * 9);
          ctx.lineTo(x + 55, peak);
          ctx.lineTo(x + 110, baseY + 26);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.globalAlpha = 0.3 + layer * 0.16;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.fillStyle = "rgba(10,17,46,.72)";
      const cityOffset = -((cameraX * 0.19) % 170);
      for (let x = cityOffset - 170; x < width + 170; x += 170) {
        const buildingHeight = 60 + ((Math.abs(Math.floor((x + cameraX) / 170)) * 37) % 110);
        ctx.fillRect(x, height - buildingHeight, 105, buildingHeight);
        ctx.fillRect(x + 112, height - buildingHeight * 0.7, 42, buildingHeight * 0.7);
        ctx.fillStyle = "rgba(255,226,132,.34)";
        for (let row = 0; row < 3; row += 1) {
          for (let col = 0; col < 3; col += 1) {
            ctx.fillRect(
              x + 16 + col * 25,
              height - buildingHeight + 18 + row * 23,
              7,
              8,
            );
          }
        }
        ctx.fillStyle = "rgba(10,17,46,.72)";
      }

      ctx.fillStyle = "rgba(10,18,47,.93)";
      ctx.fillRect(0, height - 22, width, 22);
      ctx.fillStyle = "rgba(125,237,255,.12)";
      ctx.fillRect(0, height - 22, width, 2);

      for (let index = 0; index < 16; index += 1) {
        const x = ((index * 167 - cameraX * 0.12) % (width + 100)) - 50;
        const y =
          60 +
          ((index * 83) % Math.max(100, height - 170)) +
          Math.sin(now * 0.001 + index) * 7;
        ctx.fillStyle = `rgba(180,238,255,${0.13 + (index % 3) * 0.05})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.5 + (index % 2), 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const draw = (now: number) => {
      const engine = engineRef.current;
      const size = sizeRef.current;
      const { width, height, dpr } = size;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      drawBackground(now, size, engine.cameraX);

      if (engine.mode === "ready") {
        engine.player.x = 125;
        engine.player.y = height * 0.51 + Math.sin(now * 0.002) * 8;
        engine.player.rotation = -0.12;
        if (engine.anchors.length === 0) {
          engine.anchors = [
            { id: 1, x: width * 0.58, y: height * 0.25, size: 19, phase: 0 },
            { id: 2, x: width * 0.86, y: height * 0.42, size: 17, phase: 2 },
          ];
        }
      }

      const attached = engine.anchors.find(
        (anchor) => anchor.id === engine.attachedId,
      );
      if (attached) {
        const screenAnchorX = attached.x - engine.cameraX;
        const screenPlayerX = engine.player.x - engine.cameraX;
        const rope = ctx.createLinearGradient(
          screenAnchorX,
          attached.y,
          screenPlayerX,
          engine.player.y,
        );
        rope.addColorStop(0, "#c6fbff");
        rope.addColorStop(0.5, "#69d9ef");
        rope.addColorStop(1, "#3977d1");
        ctx.strokeStyle = "rgba(107,222,244,.18)";
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(screenAnchorX, attached.y);
        ctx.lineTo(screenPlayerX, engine.player.y);
        ctx.stroke();
        ctx.strokeStyle = rope;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(screenAnchorX, attached.y);
        ctx.lineTo(screenPlayerX, engine.player.y);
        ctx.stroke();
      }

      for (const anchor of engine.anchors) {
        const x = anchor.x - engine.cameraX;
        if (x < -80 || x > width + 80) continue;
        const pulse = 1 + Math.sin(now * 0.004 + anchor.phase) * 0.09;
        const radius = anchor.size * pulse;
        const halo = ctx.createRadialGradient(x, anchor.y, 1, x, anchor.y, 44);
        halo.addColorStop(0, "rgba(151,247,255,.62)");
        halo.addColorStop(1, "rgba(99,217,243,0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(x, anchor.y, 44, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle =
          anchor.id === engine.attachedId ? "#fff1a8" : "#a7f6ff";
        ctx.lineWidth = anchor.id === engine.attachedId ? 5 : 3;
        ctx.beginPath();
        ctx.arc(x, anchor.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(15,31,73,.76)";
        ctx.beginPath();
        ctx.arc(x, anchor.y, Math.max(6, radius - 8), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#d8fbff";
        ctx.beginPath();
        ctx.arc(x - 4, anchor.y - 5, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const spark of engine.sparks) {
        const x = spark.x - engine.cameraX;
        ctx.globalAlpha = Math.min(1, spark.life * 2.5);
        ctx.fillStyle = spark.color;
        ctx.beginPath();
        ctx.arc(x, spark.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const playerX = engine.player.x - engine.cameraX;
      const playerY = engine.player.y;
      ctx.save();
      ctx.translate(playerX, playerY);
      ctx.rotate(engine.player.rotation);

      ctx.strokeStyle = "rgba(255,131,125,.42)";
      ctx.lineWidth = 15;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-25, 5);
      ctx.bezierCurveTo(-52, -2, -68, 18, -96, 3);
      ctx.stroke();
      ctx.strokeStyle = "#ff827d";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(-21, 3);
      ctx.bezierCurveTo(-52, -4, -68, 16, -98, 0);
      ctx.stroke();

      ctx.fillStyle = "rgba(92,97,226,.24)";
      ctx.beginPath();
      ctx.ellipse(-5, 8, 34, 30, 0, 0, Math.PI * 2);
      ctx.fill();

      const bodyGradient = ctx.createLinearGradient(-20, -22, 22, 25);
      bodyGradient.addColorStop(0, "#fff4c8");
      bodyGradient.addColorStop(1, "#e8b7a7");
      ctx.fillStyle = bodyGradient;
      drawRoundedPolygon(ctx, 0, 0, 26, 8, Math.PI / 8);
      ctx.fill();
      ctx.strokeStyle = "#2c2859";
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = "#313064";
      ctx.beginPath();
      ctx.arc(-8, -4, 3.5, 0, Math.PI * 2);
      ctx.arc(8, -4, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#d16872";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 3, 8, 0.25, Math.PI - 0.25);
      ctx.stroke();

      ctx.strokeStyle = "#2c2859";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-18, 15);
      ctx.lineTo(-29, 25);
      ctx.moveTo(18, 15);
      ctx.lineTo(29, 25);
      ctx.stroke();

      ctx.fillStyle = "#71e6f1";
      ctx.beginPath();
      ctx.arc(0, 22, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (engine.mode === "playing" && engine.holding && !attached) {
        ctx.setLineDash([6, 9]);
        ctx.strokeStyle = "rgba(191,248,255,.36)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(playerX, playerY, Math.min(300, width * 0.7), Math.PI, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (engine.flashLife > 0) {
        ctx.globalAlpha = Math.min(1, engine.flashLife * 3);
        ctx.fillStyle = "#fff6aa";
        ctx.font = '900 22px "Arial Rounded MT Bold", Arial';
        ctx.textAlign = "center";
        ctx.fillText(engine.flashText, playerX, playerY - 52);
        ctx.globalAlpha = 1;
      }
    };

    const loop = (now: number) => {
      const engine = engineRef.current;
      const dt = engine.lastFrame
        ? Math.min(0.033, (now - engine.lastFrame) / 1000)
        : 0;
      engine.lastFrame = now;
      update(dt, now);
      draw(now);
      animationFrame = window.requestAnimationFrame(loop);
    };
    animationFrame = window.requestAnimationFrame(loop);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationFrame);
    };
  }, [attachNearest, playTone]);

  return (
    <main className="page-shell">
      <header className="topbar">
        <div className="brand">
          <span className="logo-mark" aria-hidden="true">
            ∞
          </span>
          <div>
            <span className="kicker">ONE-BUTTON SWING</span>
            <h1>HOOK HOP</h1>
          </div>
        </div>
        <div className="top-record">
          <span>KỶ LỤC</span>
          <strong>{best}m</strong>
        </div>
      </header>

      <section className="game-stage" aria-label="Game Hook Hop">
        <canvas
          ref={canvasRef}
          className="game-canvas"
          aria-label="Giữ chuột, chạm màn hình hoặc giữ phím Space để móc dây. Thả để bay."
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={(event) => {
            if (event.buttons === 0) releaseHook();
          }}
        />

        <div className="hud" aria-live="polite">
          <div className="hud-stat align-left">
            <span>TỐC ĐỘ</span>
            <strong>{speed}</strong>
            <small>km/h</small>
          </div>
          <div className="distance">
            <strong>{distance}</strong>
            <span>MÉT</span>
          </div>
          <div className="hud-stat align-right">
            <span>NHANH NHẤT</span>
            <strong>{maxSpeed}</strong>
            <small>km/h</small>
          </div>
        </div>

        {mode === "playing" && distance < 18 && (
          <div className="hold-hint">
            <span className="hold-icon">●</span>
            <div>
              <strong>GIỮ để móc</strong>
              <span>THẢ để bay</span>
            </div>
          </div>
        )}

        {mode !== "playing" && (
          <div className="game-overlay">
            <div className="overlay-card">
              <span className="overlay-kicker">
                {mode === "over" ? "CHUYẾN BAY KẾT THÚC" : "NHỊP MÓC. NHỊP THẢ."}
              </span>
              <h2>
                {mode === "over" ? (
                  <>
                    {distance}
                    <small>m</small>
                  </>
                ) : (
                  <>
                    Móc lấy đà.
                    <br />
                    Bay thật xa.
                  </>
                )}
              </h2>
              <p>
                {mode === "over"
                  ? `Tốc độ cao nhất ${maxSpeed} km/h. Canh nhả dây ở đáy vòng cung để được tăng tốc.`
                  : "Chỉ cần một nút: giữ để bám vào móc gần nhất, thả đúng lúc để lao về phía trước."}
              </p>
              <button
                type="button"
                className="play-button"
                data-testid="start-game"
                onClick={startGame}
              >
                {mode === "over" ? "BAY LẠI" : "CẤT CÁNH"}
                <span aria-hidden="true">↗</span>
              </button>
              <div className="control-note">
                <span>CHẠM &amp; GIỮ</span>
                <i />
                <span>HOẶC SPACE</span>
              </div>
            </div>
          </div>
        )}

        <div className="edge-label left">LOW GRAVITY DISTRICT</div>
        <div className="edge-label right">KEEP MOMENTUM</div>
      </section>

      <footer className="footer-note">
        <span>Giữ để móc · Thả để bay</span>
        <span className="status"><i /> LOCAL PLAYTEST</span>
      </footer>
    </main>
  );
}
