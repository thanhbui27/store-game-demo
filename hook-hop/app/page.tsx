"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

type Mode = "ready" | "playing" | "over";
type ObstacleKind = "mine" | "spinner";

type Skin = {
  id: string;
  name: string;
  price: number;
  body: string;
  bodyShade: string;
  outline: string;
  scarf: string;
  accent: string;
};

const SKINS: Skin[] = [
  {
    id: "nova",
    name: "Nova",
    price: 0,
    body: "#fff4c8",
    bodyShade: "#e8b7a7",
    outline: "#2c2859",
    scarf: "#ff827d",
    accent: "#71e6f1",
  },
  {
    id: "mint",
    name: "Mint Dash",
    price: 40,
    body: "#baf8cf",
    bodyShade: "#63d4b2",
    outline: "#174c55",
    scarf: "#fff09b",
    accent: "#e9fff2",
  },
  {
    id: "sunset",
    name: "Sunset Pop",
    price: 90,
    body: "#ffae8f",
    bodyShade: "#e76374",
    outline: "#5b254f",
    scarf: "#8ceef5",
    accent: "#fff0a8",
  },
  {
    id: "midnight",
    name: "Midnight X",
    price: 160,
    body: "#353a82",
    bodyShade: "#1b2056",
    outline: "#9cf0f4",
    scarf: "#d3ff79",
    accent: "#ff9ee1",
  },
];

type Anchor = {
  id: number;
  x: number;
  y: number;
  size: number;
  phase: number;
};

type Obstacle = {
  id: number;
  kind: ObstacleKind;
  x: number;
  y: number;
  radius: number;
  phase: number;
};

type CoinPickup = {
  id: number;
  x: number;
  y: number;
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
  obstacles: Obstacle[];
  pickups: CoinPickup[];
  attachedId: number | null;
  ropeLength: number;
  ropeAdjust: number;
  swingSide: number;
  swingStreak: number;
  lastPumpAt: number;
  holding: boolean;
  cameraX: number;
  startX: number;
  nextAnchorX: number;
  lastAnchorY: number;
  nextId: number;
  distance: number;
  maxSpeed: number;
  runCoins: number;
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

type Hud = {
  distance: number;
  speed: number;
  maxSpeed: number;
  runCoins: number;
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
  obstacles: [],
  pickups: [],
  attachedId: null,
  ropeLength: 0,
  ropeAdjust: 0,
  swingSide: 0,
  swingStreak: 0,
  lastPumpAt: 0,
  holding: false,
  cameraX: 0,
  startX: 120,
  nextAnchorX: 320,
  lastAnchorY: 220,
  nextId: 1,
  distance: 0,
  maxSpeed: 0,
  runCoins: 0,
  sparks: [],
  lastFrame: 0,
  lastHudAt: 0,
  flashText: "",
  flashLife: 0,
});

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function ropeBounds(size: ViewSize) {
  return {
    min: 64,
    max: Math.min(455, Math.max(255, size.width * 0.68)),
  };
}

function seedWorld(engine: Engine, size: ViewSize) {
  const ceiling = Math.max(82, size.height * 0.12);
  const lower = Math.max(ceiling + 90, size.height - 190);

  while (engine.nextAnchorX < engine.cameraX + size.width * 2.35) {
    const previousX = engine.nextAnchorX;
    const previousY = engine.lastAnchorY;
    const progress = Math.max(0, (previousX - engine.startX) / 6000);
    const hookReach = Math.min(430, Math.max(300, size.width * 0.7));
    const maxSpacing = Math.min(
      335 + Math.min(45, progress * 22),
      Math.max(230, size.width * 0.62),
    );
    const minSpacing = Math.min(205, maxSpacing - 20);
    const spacing = randomBetween(minSpacing, maxSpacing);
    const maxVerticalStep =
      Math.sqrt(Math.max(100, hookReach * hookReach - spacing * spacing)) * 0.72;
    const nextX = previousX + spacing;
    const nextY = clamp(
      previousY + randomBetween(-maxVerticalStep, maxVerticalStep),
      ceiling,
      lower,
    );

    engine.nextAnchorX = nextX;
    engine.lastAnchorY = nextY;
    engine.anchors.push({
      id: engine.nextId++,
      x: nextX,
      y: nextY,
      size: randomBetween(15, 21),
      phase: Math.random() * Math.PI * 2,
    });

    const coinCount = 2 + Math.floor(Math.random() * 3);
    for (let index = 1; index <= coinCount; index += 1) {
      const t = index / (coinCount + 1);
      const arcY =
        previousY +
        (nextY - previousY) * t +
        Math.sin(t * Math.PI) * randomBetween(70, 125);
      engine.pickups.push({
        id: engine.nextId++,
        x: previousX + spacing * t,
        y: clamp(arcY, ceiling + 75, size.height - 105),
        phase: Math.random() * Math.PI * 2,
      });
    }

    if (nextX > 850 && Math.random() < 0.46) {
      const kind: ObstacleKind = Math.random() > 0.48 ? "mine" : "spinner";
      engine.obstacles.push({
        id: engine.nextId++,
        kind,
        x: previousX + spacing * randomBetween(0.42, 0.68),
        y: randomBetween(ceiling + 105, Math.min(size.height - 105, lower + 80)),
        radius: kind === "mine" ? 24 : 31,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }
}

function drawPolygon(
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

function obstacleY(obstacle: Obstacle, now: number) {
  return obstacle.y + Math.sin(now * 0.0022 + obstacle.phase) * 18;
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine>(emptyEngine());
  const sizeRef = useRef<ViewSize>({ width: 960, height: 620, dpr: 1 });
  const audioRef = useRef<AudioContext | null>(null);
  const selectedSkinRef = useRef("nova");
  const coinsRef = useRef(0);
  const pointerYRef = useRef<number | null>(null);
  const [mode, setMode] = useState<Mode>("ready");
  const [hud, setHud] = useState<Hud>({
    distance: 0,
    speed: 0,
    maxSpeed: 0,
    runCoins: 0,
  });
  const [best, setBest] = useState(0);
  const [coins, setCoins] = useState(0);
  const [ownedSkins, setOwnedSkins] = useState<string[]>(["nova"]);
  const [selectedSkin, setSelectedSkin] = useState("nova");
  const [shopOpen, setShopOpen] = useState(false);

  useEffect(() => {
    const storedBest = Number(window.localStorage.getItem("hook-hop-best") || 0);
    const storedCoins = Number(window.localStorage.getItem("hook-hop-coins") || 0);
    const storedSkin = window.localStorage.getItem("hook-hop-skin") || "nova";
    let storedOwned = ["nova"];
    try {
      const parsed = JSON.parse(
        window.localStorage.getItem("hook-hop-owned-skins") || '["nova"]',
      );
      if (Array.isArray(parsed)) {
        storedOwned = Array.from(
          new Set(["nova", ...parsed.filter((item) => typeof item === "string")]),
        );
      }
    } catch {
      storedOwned = ["nova"];
    }
    const safeBest = Number.isFinite(storedBest) ? Math.max(0, storedBest) : 0;
    const safeCoins = Number.isFinite(storedCoins) ? Math.max(0, storedCoins) : 0;
    const safeSkin = storedOwned.includes(storedSkin) ? storedSkin : "nova";
    setBest(safeBest);
    setCoins(safeCoins);
    setOwnedSkins(storedOwned);
    setSelectedSkin(safeSkin);
    coinsRef.current = safeCoins;
    selectedSkinRef.current = safeSkin;
  }, []);

  useEffect(() => {
    coinsRef.current = coins;
  }, [coins]);

  useEffect(() => {
    selectedSkinRef.current = selectedSkin;
  }, [selectedSkin]);

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
      gain.gain.setValueAtTime(0.045, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audio.currentTime + duration,
      );
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + duration);
    } catch {
      // Sound is optional and must never block gameplay.
    }
  }, []);

  const makeBurst = useCallback(
    (x: number, y: number, color: string, count = 8) => {
      const engine = engineRef.current;
      const allowed = Math.max(0, Math.min(count, 64 - engine.sparks.length));
      for (let index = 0; index < allowed; index += 1) {
        const angle = (index / Math.max(1, allowed)) * Math.PI * 2 + Math.random() * 0.4;
        const force = randomBetween(48, 125);
        engine.sparks.push({
          x,
          y,
          vx: Math.cos(angle) * force,
          vy: Math.sin(angle) * force,
          life: randomBetween(0.32, 0.62),
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
    const bounds = ropeBounds(sizeRef.current);
    engine.ropeLength = clamp(
      Math.hypot(nearest.x - player.x, nearest.y - player.y),
      bounds.min,
      bounds.max,
    );
    engine.swingSide = player.x >= nearest.x ? 1 : -1;
    engine.swingStreak = 0;
    engine.lastPumpAt = 0;
    makeBurst(nearest.x, nearest.y, "#9ff8ff", 6);
    playTone(520, 0.07);
  }, [makeBurst, playTone]);

  const releaseHook = useCallback(() => {
    const engine = engineRef.current;
    engine.holding = false;
    engine.ropeAdjust = 0;
    pointerYRef.current = null;
    if (engine.mode !== "playing" || engine.attachedId === null) return;
    engine.attachedId = null;
    engine.swingSide = 0;
    engine.swingStreak = 0;
    if (engine.player.vx > 470) {
      engine.player.vx += 34;
      engine.flashText = "PHÓNG!";
      engine.flashLife = 0.65;
      makeBurst(engine.player.x, engine.player.y, "#ffef8b", 10);
      playTone(760, 0.08);
    } else {
      playTone(350, 0.045);
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
    engine.lastAnchorY = clamp(size.height * 0.36, 110, size.height - 210);
    seedWorld(engine, size);
    engineRef.current = engine;
    setMode("playing");
    setShopOpen(false);
    setHud({ distance: 0, speed: 32, maxSpeed: 32, runCoins: 0 });
    playTone(620, 0.12);
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
    pointerYRef.current = event.clientY;
    beginHold();
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const previousY = pointerYRef.current;
    pointerYRef.current = event.clientY;
    const engine = engineRef.current;
    if (
      previousY === null ||
      !engine.holding ||
      engine.attachedId === null
    ) {
      return;
    }
    event.preventDefault();
    const bounds = ropeBounds(sizeRef.current);
    engine.ropeLength = clamp(
      engine.ropeLength + (event.clientY - previousY) * 0.82,
      bounds.min,
      bounds.max,
    );
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    releaseHook();
  };

  const handleWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    if (engine.mode !== "playing" || engine.attachedId === null) return;
    event.preventDefault();
    const bounds = ropeBounds(sizeRef.current);
    engine.ropeLength = clamp(
      engine.ropeLength + event.deltaY * 0.14,
      bounds.min,
      bounds.max,
    );
  };

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        if (!event.repeat) beginHold();
      }
      if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
        event.preventDefault();
        engineRef.current.ropeAdjust = -1;
      }
      if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
        event.preventDefault();
        engineRef.current.ropeAdjust = 1;
      }
      if (
        event.key === "Enter" &&
        engineRef.current.mode !== "playing" &&
        !shopOpen
      ) {
        startGame();
      }
      if (event.key === "Escape" && shopOpen) setShopOpen(false);
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        releaseHook();
      }
      if (
        event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key.toLowerCase() === "w" ||
        event.key.toLowerCase() === "s"
      ) {
        engineRef.current.ropeAdjust = 0;
      }
    };
    window.addEventListener("keydown", keyDown, { passive: false });
    window.addEventListener("keyup", keyUp, { passive: false });
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, [beginHold, releaseHook, shopOpen, startGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    });
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const isMobile = rect.width < 700 || navigator.maxTouchPoints > 0;
      const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.6);
      const nextSize = {
        width: Math.max(320, rect.width),
        height: Math.max(420, rect.height),
        dpr,
      };
      sizeRef.current = nextSize;
      const physicalWidth = Math.round(nextSize.width * dpr);
      const physicalHeight = Math.round(nextSize.height * dpr);
      if (canvas.width !== physicalWidth || canvas.height !== physicalHeight) {
        canvas.width = physicalWidth;
        canvas.height = physicalHeight;
      }
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
      const finalHud = {
        distance: Math.floor(engine.distance),
        speed: Math.round(Math.hypot(engine.player.vx, engine.player.vy) / 10),
        maxSpeed: Math.round(engine.maxSpeed / 10),
        runCoins: engine.runCoins,
      };
      setMode("over");
      setHud(finalHud);
      setBest((current) => {
        const next = Math.max(current, finalHud.distance);
        window.localStorage.setItem("hook-hop-best", String(next));
        return next;
      });
      playTone(130, 0.28);
    };

    const update = (dt: number, now: number) => {
      const engine = engineRef.current;
      const size = sizeRef.current;

      for (let index = engine.sparks.length - 1; index >= 0; index -= 1) {
        const spark = engine.sparks[index];
        spark.x += spark.vx * dt;
        spark.y += spark.vy * dt;
        spark.vy += 180 * dt;
        spark.life -= dt;
        if (spark.life <= 0) engine.sparks.splice(index, 1);
      }
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
        const bounds = ropeBounds(size);
        if (engine.ropeAdjust !== 0) {
          engine.ropeLength = clamp(
            engine.ropeLength + engine.ropeAdjust * 150 * dt,
            bounds.min,
            bounds.max,
          );
        }
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

        const currentSide = dx >= 0 ? 1 : -1;
        const crossedBottom =
          engine.swingSide !== 0 &&
          currentSide !== engine.swingSide &&
          dy > engine.ropeLength * 0.55 &&
          now - engine.lastPumpAt > 220;
        if (crossedBottom) {
          const tangentX = -ny;
          const tangentY = nx;
          const tangentVelocity =
            player.vx * tangentX + player.vy * tangentY;
          if (Math.abs(tangentVelocity) > 60) {
            engine.swingStreak = Math.min(8, engine.swingStreak + 1);
            const gain = 1.045 + engine.swingStreak * 0.006;
            const addedTangent = tangentVelocity * (gain - 1);
            player.vx += tangentX * addedTangent;
            player.vy += tangentY * addedTangent;
            engine.flashText =
              engine.swingStreak >= 3
                ? `ĐÀ ×${engine.swingStreak + 1}`
                : "TÍCH ĐÀ!";
            engine.flashLife = 0.46;
            engine.lastPumpAt = now;
            makeBurst(player.x, player.y, "#d3ff79", 4);
            playTone(555 + engine.swingStreak * 34, 0.045);
          }
        }
        if (currentSide !== engine.swingSide) {
          engine.swingSide = currentSide;
        }
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
      seedWorld(engine, size);

      for (let index = engine.pickups.length - 1; index >= 0; index -= 1) {
        const pickup = engine.pickups[index];
        const pickupY = pickup.y + Math.sin(now * 0.004 + pickup.phase) * 5;
        if (Math.hypot(player.x - pickup.x, player.y - pickupY) < 38) {
          engine.pickups.splice(index, 1);
          engine.runCoins += 1;
          const total = coinsRef.current + 1;
          coinsRef.current = total;
          setCoins(total);
          window.localStorage.setItem("hook-hop-coins", String(total));
          makeBurst(pickup.x, pickupY, "#ffe585", 7);
          playTone(910, 0.055);
        }
      }

      for (const obstacle of engine.obstacles) {
        const currentY = obstacleY(obstacle, now);
        if (
          Math.hypot(player.x - obstacle.x, player.y - currentY) <
          obstacle.radius + 22
        ) {
          makeBurst(player.x, player.y, "#ff6f8f", 14);
          endGame();
          return;
        }
      }

      const pruneX = engine.cameraX - 430;
      engine.anchors = engine.anchors.filter((anchor) => anchor.x > pruneX);
      engine.pickups = engine.pickups.filter((pickup) => pickup.x > pruneX);
      engine.obstacles = engine.obstacles.filter(
        (obstacle) => obstacle.x > pruneX,
      );

      if (now - engine.lastHudAt > 140) {
        engine.lastHudAt = now;
        setHud({
          distance: Math.floor(engine.distance),
          speed: Math.round(velocity / 10),
          maxSpeed: Math.round(engine.maxSpeed / 10),
          runCoins: engine.runCoins,
        });
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
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = "#ffe7a6";
      ctx.beginPath();
      ctx.arc(sunX, sunY, 105, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
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
        const buildingHeight =
          60 + ((Math.abs(Math.floor((x + cameraX) / 170)) * 37) % 110);
        ctx.fillRect(x, height - buildingHeight, 105, buildingHeight);
        ctx.fillRect(
          x + 112,
          height - buildingHeight * 0.7,
          42,
          buildingHeight * 0.7,
        );
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

      for (let index = 0; index < 12; index += 1) {
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

    const drawObstacle = (obstacle: Obstacle, now: number, cameraX: number) => {
      const x = obstacle.x - cameraX;
      const y = obstacleY(obstacle, now);
      if (obstacle.kind === "mine") {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(now * 0.0008 + obstacle.phase);
        ctx.strokeStyle = "rgba(255,88,132,.35)";
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.arc(0, 0, obstacle.radius + 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#3a214e";
        drawPolygon(ctx, 0, 0, obstacle.radius + 8, 10, 0);
        ctx.fill();
        ctx.fillStyle = "#ff6f8f";
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffd0da";
        ctx.beginPath();
        ctx.arc(-3, -3, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(now * 0.003 + obstacle.phase);
        ctx.strokeStyle = "rgba(255,213,108,.3)";
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.arc(0, 0, obstacle.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#ffcf68";
        for (let blade = 0; blade < 4; blade += 1) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(5, -7);
          ctx.lineTo(obstacle.radius + 13, -4);
          ctx.lineTo(obstacle.radius + 2, 8);
          ctx.lineTo(5, 7);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = "#342551";
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#aaf5ff";
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
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
        ctx.strokeStyle = "rgba(107,222,244,.2)";
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(screenAnchorX, attached.y);
        ctx.lineTo(screenPlayerX, engine.player.y);
        ctx.stroke();
        ctx.strokeStyle = "#8ceef5";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(screenAnchorX, attached.y);
        ctx.lineTo(screenPlayerX, engine.player.y);
        ctx.stroke();

        const bounds = ropeBounds(size);
        const ropeRatio =
          (engine.ropeLength - bounds.min) / (bounds.max - bounds.min);
        const meterX = clamp(
          (screenAnchorX + screenPlayerX) / 2 + 14,
          18,
          width - 84,
        );
        const meterY = clamp(
          (attached.y + engine.player.y) / 2 - 19,
          74,
          height - 58,
        );
        const powerRatio = engine.swingStreak / 8;
        ctx.fillStyle = "rgba(13,18,52,.8)";
        ctx.fillRect(meterX, meterY, 66, 34);
        ctx.fillStyle = "rgba(140,238,245,.18)";
        ctx.fillRect(meterX + 6, meterY + 13, 54, 3);
        ctx.fillStyle = "#8ceef5";
        ctx.fillRect(meterX + 6, meterY + 13, 54 * ropeRatio, 3);
        ctx.fillStyle = "rgba(211,255,121,.16)";
        ctx.fillRect(meterX + 6, meterY + 26, 54, 3);
        ctx.fillStyle = "#d3ff79";
        ctx.fillRect(meterX + 6, meterY + 26, 54 * powerRatio, 3);
        ctx.fillStyle = "#d9faff";
        ctx.font = '800 8px Arial';
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText("DÂY  ↑↓", meterX + 7, meterY + 10);
        ctx.fillStyle = "#e6ffad";
        ctx.fillText(
          `ĐÀ  ×${engine.swingStreak + 1}`,
          meterX + 7,
          meterY + 23,
        );
      }

      for (const pickup of engine.pickups) {
        const x = pickup.x - engine.cameraX;
        if (x < -50 || x > width + 50) continue;
        const y = pickup.y + Math.sin(now * 0.004 + pickup.phase) * 5;
        const pulse = 1 + Math.sin(now * 0.006 + pickup.phase) * 0.08;
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = "#ffe27d";
        ctx.beginPath();
        ctx.arc(x, y, 22 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#ffd765";
        ctx.beginPath();
        ctx.arc(x, y, 11 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff0a8";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#9a5a46";
        ctx.font = '900 11px "Arial Rounded MT Bold", Arial';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("H", x, y + 0.5);
      }

      for (const obstacle of engine.obstacles) {
        const x = obstacle.x - engine.cameraX;
        if (x < -80 || x > width + 80) continue;
        drawObstacle(obstacle, now, engine.cameraX);
      }

      for (const anchor of engine.anchors) {
        const x = anchor.x - engine.cameraX;
        if (x < -80 || x > width + 80) continue;
        const pulse = 1 + Math.sin(now * 0.004 + anchor.phase) * 0.09;
        const radius = anchor.size * pulse;
        ctx.globalAlpha = 0.13;
        ctx.fillStyle = "#9bf6ff";
        ctx.beginPath();
        ctx.arc(x, anchor.y, 39, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
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
        ctx.arc(x, spark.y, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const playerX = engine.player.x - engine.cameraX;
      const playerY = engine.player.y;
      const skin =
        SKINS.find((item) => item.id === selectedSkinRef.current) ?? SKINS[0];
      ctx.save();
      ctx.translate(playerX, playerY);
      ctx.rotate(engine.player.rotation);

      ctx.globalAlpha = 0.32;
      ctx.strokeStyle = skin.scarf;
      ctx.lineWidth = 15;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-25, 5);
      ctx.bezierCurveTo(-52, -2, -68, 18, -96, 3);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = skin.scarf;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(-21, 3);
      ctx.bezierCurveTo(-52, -4, -68, 16, -98, 0);
      ctx.stroke();

      ctx.globalAlpha = 0.22;
      ctx.fillStyle = skin.accent;
      ctx.beginPath();
      ctx.ellipse(-5, 8, 34, 30, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = skin.body;
      drawPolygon(ctx, 0, 0, 26, 8, Math.PI / 8);
      ctx.fill();
      ctx.fillStyle = skin.bodyShade;
      ctx.beginPath();
      ctx.ellipse(5, 10, 17, 10, 0.25, 0, Math.PI);
      ctx.fill();
      ctx.strokeStyle = skin.outline;
      ctx.lineWidth = 4;
      drawPolygon(ctx, 0, 0, 26, 8, Math.PI / 8);
      ctx.stroke();

      ctx.fillStyle = skin.outline;
      ctx.beginPath();
      ctx.arc(-8, -4, 3.5, 0, Math.PI * 2);
      ctx.arc(8, -4, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = skin.scarf;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 3, 8, 0.25, Math.PI - 0.25);
      ctx.stroke();

      ctx.strokeStyle = skin.outline;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-18, 15);
      ctx.lineTo(-29, 25);
      ctx.moveTo(18, 15);
      ctx.lineTo(29, 25);
      ctx.stroke();

      ctx.fillStyle = skin.accent;
      ctx.beginPath();
      ctx.arc(0, 22, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (engine.mode === "playing" && engine.holding && !attached) {
        ctx.setLineDash([6, 9]);
        ctx.strokeStyle = "rgba(191,248,255,.36)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
          playerX,
          playerY,
          Math.min(300, width * 0.7),
          Math.PI,
          Math.PI * 2,
        );
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (engine.flashLife > 0) {
        ctx.globalAlpha = Math.min(1, engine.flashLife * 3);
        ctx.fillStyle = "#fff6aa";
        ctx.font = '900 22px "Arial Rounded MT Bold", Arial';
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(engine.flashText, playerX, playerY - 52);
        ctx.globalAlpha = 1;
      }
    };

    const loop = (now: number) => {
      const engine = engineRef.current;
      const elapsed = engine.lastFrame
        ? Math.min(0.05, (now - engine.lastFrame) / 1000)
        : 0;
      engine.lastFrame = now;
      const steps = elapsed > 0.022 ? 2 : 1;
      const step = elapsed / steps;
      for (let index = 0; index < steps; index += 1) update(step, now);
      draw(now);
      animationFrame = window.requestAnimationFrame(loop);
    };
    animationFrame = window.requestAnimationFrame(loop);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationFrame);
    };
  }, [attachNearest, makeBurst, playTone]);

  const buyOrSelect = (skin: Skin) => {
    const isOwned = ownedSkins.includes(skin.id);
    if (!isOwned && coins < skin.price) return;

    if (!isOwned) {
      const nextCoins = coins - skin.price;
      const nextOwned = [...ownedSkins, skin.id];
      setCoins(nextCoins);
      setOwnedSkins(nextOwned);
      coinsRef.current = nextCoins;
      window.localStorage.setItem("hook-hop-coins", String(nextCoins));
      window.localStorage.setItem(
        "hook-hop-owned-skins",
        JSON.stringify(nextOwned),
      );
      playTone(740, 0.12);
    } else {
      playTone(520, 0.06);
    }

    setSelectedSkin(skin.id);
    selectedSkinRef.current = skin.id;
    window.localStorage.setItem("hook-hop-skin", skin.id);
  };

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

        <div className="top-actions">
          <div className="wallet" aria-label={`${coins} xu`}>
            <span aria-hidden="true">◆</span>
            <strong>{coins}</strong>
          </div>
          <button
            type="button"
            className="shop-button"
            disabled={mode === "playing"}
            onClick={() => setShopOpen(true)}
          >
            SHOP
          </button>
          <div className="top-record">
            <span>KỶ LỤC</span>
            <strong>{best}m</strong>
          </div>
        </div>
      </header>

      <section
        className="game-stage"
        aria-label="Game Hook Hop"
        onContextMenu={(event) => event.preventDefault()}
      >
        <canvas
          ref={canvasRef}
          className="game-canvas"
          aria-label="Giữ để móc dây, vuốt lên xuống để chỉnh độ dài dây, thả để bay."
          draggable={false}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          onPointerLeave={(event) => {
            if (event.buttons === 0) releaseHook();
          }}
        />

        <div className="hud" aria-live="polite">
          <div className="hud-stat align-left">
            <span>TỐC ĐỘ</span>
            <strong>{hud.speed}</strong>
            <small>km/h</small>
          </div>
          <div className="distance">
            <strong>{hud.distance}</strong>
            <span>MÉT</span>
          </div>
          <div className="hud-stat align-right coin-stat">
            <span>XU VÒNG NÀY</span>
            <strong>{hud.runCoins}</strong>
            <small>◆</small>
          </div>
        </div>

        {mode === "playing" && hud.distance < 18 && (
          <div className="hold-hint">
            <span className="hold-icon">●</span>
            <div>
              <strong>GIỮ để móc</strong>
              <span>LẮC nhiều nhịp để tích đà · VUỐT ↑↓ chỉnh dây</span>
            </div>
          </div>
        )}

        {mode !== "playing" && (
          <div className="game-overlay">
            <div className="overlay-card">
              <span className="overlay-kicker">
                {mode === "over"
                  ? "CHUYẾN BAY KẾT THÚC"
                  : "NHỊP MÓC. NHỊP THẢ."}
              </span>
              <h2>
                {mode === "over" ? (
                  <>
                    {hud.distance}
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
              {mode === "over" ? (
                <div className="result-grid">
                  <div>
                    <span>Xu nhặt được</span>
                    <strong>+{hud.runCoins} ◆</strong>
                  </div>
                  <div>
                    <span>Nhanh nhất</span>
                    <strong>{hud.maxSpeed}</strong>
                    <small>km/h</small>
                  </div>
                </div>
              ) : (
                <p>
                  Giữ qua nhiều nhịp để tích đà và lắc ngày càng xa. Vuốt lên
                  xuống để chỉnh dây, thu thập xu và né vật cản.
                </p>
              )}
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
                <span>GIỮ + VUỐT ↑↓</span>
                <i />
                <span>SPACE + W/S</span>
              </div>
            </div>
          </div>
        )}

        {shopOpen && (
          <div className="shop-modal" role="dialog" aria-modal="true" aria-labelledby="shop-title">
            <div className="shop-panel">
              <div className="shop-header">
                <div>
                  <span className="overlay-kicker">SKIN COLLECTION</span>
                  <h2 id="shop-title">Đổi diện mạo</h2>
                </div>
                <button
                  type="button"
                  className="close-button"
                  aria-label="Đóng shop"
                  onClick={() => setShopOpen(false)}
                >
                  ×
                </button>
              </div>
              <div className="shop-balance">
                <span>SỐ DƯ</span>
                <strong>◆ {coins}</strong>
              </div>
              <div className="skin-grid">
                {SKINS.map((skin) => {
                  const isOwned = ownedSkins.includes(skin.id);
                  const isSelected = selectedSkin === skin.id;
                  const canBuy = coins >= skin.price;
                  return (
                    <article
                      key={skin.id}
                      className={`skin-card ${isSelected ? "selected" : ""}`}
                    >
                      <div
                        className="skin-preview"
                        style={{
                          background: `linear-gradient(145deg, ${skin.body}, ${skin.bodyShade})`,
                          borderColor: skin.outline,
                        }}
                      >
                        <i style={{ background: skin.scarf }} />
                        <span style={{ background: skin.accent }} />
                      </div>
                      <div className="skin-info">
                        <strong>{skin.name}</strong>
                        <span>{isOwned ? "Đã sở hữu" : `◆ ${skin.price}`}</span>
                      </div>
                      <button
                        type="button"
                        disabled={isSelected || (!isOwned && !canBuy)}
                        onClick={() => buyOrSelect(skin)}
                      >
                        {isSelected
                          ? "ĐANG DÙNG"
                          : isOwned
                            ? "SỬ DỤNG"
                            : canBuy
                              ? "MUA SKIN"
                              : "CHƯA ĐỦ XU"}
                      </button>
                    </article>
                  );
                })}
              </div>
              <p className="shop-note">
                Xu và skin được lưu trên thiết bị này.
              </p>
            </div>
          </div>
        )}

        <div className="edge-label left">LOW GRAVITY DISTRICT</div>
        <div className="edge-label right">KEEP MOMENTUM</div>
      </section>

      <footer className="footer-note">
        <span>Giữ để lắc · Lắc nhiều để tích đà · Thả để bay</span>
        <span className="status">
          <i /> LOCAL PLAYTEST
        </span>
      </footer>
    </main>
  );
}
