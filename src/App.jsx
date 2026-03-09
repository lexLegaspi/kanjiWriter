import { useState, useRef, useEffect, useCallback } from "react";

// ── Kanji data (stroke counts: KANJIDIC2 © EDRDG) ────────────────────────────
const N5_KANJI = [
  {
    kanji: "日",
    meaning: "Sun / Day",
    kunyomi: "ひ、か",
    onyomi: "ニチ、ジツ",
    strokes: 4,
  },
  {
    kanji: "月",
    meaning: "Moon / Month",
    kunyomi: "つき",
    onyomi: "ゲツ、ガツ",
    strokes: 4,
  },
  { kanji: "火", meaning: "Fire", kunyomi: "ひ", onyomi: "カ", strokes: 4 },
  {
    kanji: "水",
    meaning: "Water",
    kunyomi: "みず",
    onyomi: "スイ",
    strokes: 4,
  },
  {
    kanji: "木",
    meaning: "Tree / Wood",
    kunyomi: "き、こ",
    onyomi: "モク、ボク",
    strokes: 4,
  },
  {
    kanji: "山",
    meaning: "Mountain",
    kunyomi: "やま",
    onyomi: "サン",
    strokes: 3,
  },
  {
    kanji: "川",
    meaning: "River",
    kunyomi: "かわ",
    onyomi: "セン",
    strokes: 3,
  },
  {
    kanji: "人",
    meaning: "Person",
    kunyomi: "ひと",
    onyomi: "ジン、ニン",
    strokes: 2,
  },
  {
    kanji: "大",
    meaning: "Big / Large",
    kunyomi: "おお",
    onyomi: "ダイ、タイ",
    strokes: 3,
  },
  {
    kanji: "小",
    meaning: "Small",
    kunyomi: "ちい、こ",
    onyomi: "ショウ",
    strokes: 3,
  },
  {
    kanji: "中",
    meaning: "Middle / Inside",
    kunyomi: "なか",
    onyomi: "チュウ",
    strokes: 4,
  },
  {
    kanji: "上",
    meaning: "Up / Above",
    kunyomi: "うえ、あ",
    onyomi: "ジョウ",
    strokes: 3,
  },
  {
    kanji: "下",
    meaning: "Down / Below",
    kunyomi: "した、さ",
    onyomi: "カ、ゲ",
    strokes: 3,
  },
  {
    kanji: "一",
    meaning: "One",
    kunyomi: "ひと",
    onyomi: "イチ、イツ",
    strokes: 1,
  },
  { kanji: "二", meaning: "Two", kunyomi: "ふた", onyomi: "ニ", strokes: 2 },
  {
    kanji: "三",
    meaning: "Three",
    kunyomi: "み、みっ",
    onyomi: "サン",
    strokes: 3,
  },
  {
    kanji: "口",
    meaning: "Mouth",
    kunyomi: "くち",
    onyomi: "コウ、ク",
    strokes: 3,
  },
  { kanji: "手", meaning: "Hand", kunyomi: "て", onyomi: "シュ", strokes: 4 },
  {
    kanji: "目",
    meaning: "Eye",
    kunyomi: "め",
    onyomi: "モク、ボク",
    strokes: 5,
  },
  { kanji: "耳", meaning: "Ear", kunyomi: "みみ", onyomi: "ジ", strokes: 6 },
];

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}
const QUIZ_KANJI = shuffle(N5_KANJI).slice(0, 20);
const SZ = 320;

// ── Font preload ──────────────────────────────────────────────────────────────
let fontReady = false;
document.fonts.load("700 120px 'Yuji Syuku'").then(() => {
  fontReady = true;
});

function drawKanjiLayer(ctx, kanji, size, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `700 ${Math.round(size * 0.84)}px 'Yuji Syuku', 'Noto Serif JP', serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#1a3acc";
  ctx.fillText(kanji, size / 2, size / 2 + size * 0.03);
  ctx.restore();
}

// ── KanjiVG fetch & parse ─────────────────────────────────────────────────────
// Uses npm package on jsdelivr (allowed by CSP): cdn.jsdelivr.net/npm/kanjivg/
const kvgCache = {};

async function fetchKanjiVG(kanji) {
  if (kvgCache[kanji] !== undefined) return kvgCache[kanji];
  const hex = kanji.codePointAt(0).toString(16).padStart(5, "0");
  const url = `https://cdn.jsdelivr.net/npm/kanjivg@20160426/kanji/${hex}.svg`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("not found");
    const text = await res.text();
    const strokes = parseKVGStrokes(text);
    kvgCache[kanji] = strokes;
    return strokes;
  } catch {
    kvgCache[kanji] = null;
    return null;
  }
}

function parseKVGStrokes(svgText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const paths = Array.from(doc.querySelectorAll("path[d]"));
  return paths.map((p) => p.getAttribute("d")).filter(Boolean);
}

// Get a point at fraction t along an SVG path using a temporary SVG element
function getPathPoint(dStr, t) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.style.cssText = "position:absolute;visibility:hidden;width:0;height:0";
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", dStr);
  svg.appendChild(path);
  document.body.appendChild(svg);
  try {
    const len = path.getTotalLength();
    const pt = path.getPointAtLength(t * len);
    const ptEnd = path.getPointAtLength(Math.min((t + 0.05) * len, len));
    return {
      x: pt.x,
      y: pt.y,
      angle: Math.atan2(ptEnd.y - pt.y, ptEnd.x - pt.x),
      len,
    };
  } finally {
    document.body.removeChild(svg);
  }
}

// ── Stroke Order Panel ────────────────────────────────────────────────────────
const PANEL_SZ = 140; // size of the mini SVG panel
const KVG_VIEWBOX = 109;
const SCALE = PANEL_SZ / KVG_VIEWBOX;
const COLORS = [
  "#e05010",
  "#1060d0",
  "#208030",
  "#9010a0",
  "#c08010",
  "#106080",
];

function StrokeOrderPanel({ kanji }) {
  const [strokes, setStrokes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(-1); // -1 = show all
  const [animating, setAnimating] = useState(false);
  const animRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    setStrokes(null);
    setActiveIdx(-1);
    fetchKanjiVG(kanji).then((s) => {
      setStrokes(s);
      setLoading(false);
    });
    return () => clearTimeout(animRef.current);
  }, [kanji]);

  const playAnimation = useCallback(() => {
    if (!strokes) return;
    setAnimating(true);
    setActiveIdx(0);
    let i = 0;
    const step = () => {
      i++;
      if (i < strokes.length) {
        setActiveIdx(i);
        animRef.current = setTimeout(step, 800);
      } else {
        animRef.current = setTimeout(() => {
          setActiveIdx(-1);
          setAnimating(false);
        }, 800);
      }
    };
    animRef.current = setTimeout(step, 800);
  }, [strokes]);

  if (loading)
    return (
      <div
        style={{
          textAlign: "center",
          padding: "10px 0",
          color: "#9a8050",
          fontSize: 11,
        }}
      >
        Loading stroke order…
      </div>
    );
  if (!strokes || !strokes.length)
    return (
      <div
        style={{
          textAlign: "center",
          padding: "10px 0",
          color: "#9a8050",
          fontSize: 11,
        }}
      >
        Stroke order unavailable
      </div>
    );

  // Build arrow head at ~85% along each stroke
  function arrowForStroke(d, color) {
    try {
      const pt = getPathPoint(d, 0.82);
      const ax = pt.x * SCALE,
        ay = pt.y * SCALE;
      const ang = pt.angle;
      const size = 5;
      const cos = Math.cos(ang),
        sin = Math.sin(ang);
      // Arrow tip at ax,ay pointing in direction ang
      const tip = `${ax},${ay}`;
      const left = `${ax - size * cos + size * 0.5 * sin},${ay - size * sin - size * 0.5 * cos}`;
      const right = `${ax - size * cos - size * 0.5 * sin},${ay - size * sin + size * 0.5 * cos}`;
      return (
        <polygon
          key="arr"
          points={`${tip} ${left} ${right}`}
          fill={color}
          opacity={0.9}
        />
      );
    } catch {
      return null;
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      {/* Grid of individual stroke steps */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          justifyContent: "center",
        }}
      >
        {strokes.map((d, i) => {
          const color = COLORS[i % COLORS.length];
          const isActive = activeIdx === i;
          return (
            <div
              key={i}
              onClick={() => setActiveIdx(activeIdx === i ? -1 : i)}
              style={{
                cursor: "pointer",
                border: `2px solid ${isActive ? color : "#d4c89a"}`,
                borderRadius: 4,
                background: isActive ? `${color}12` : "#fff8ee",
                padding: 2,
                transition: "all 0.2s",
              }}
            >
              <svg
                width={PANEL_SZ}
                height={PANEL_SZ}
                viewBox={`0 0 ${KVG_VIEWBOX} ${KVG_VIEWBOX}`}
                style={{ display: "block" }}
              >
                {/* Previous strokes faint */}
                {strokes.slice(0, i).map((prev, j) => (
                  <path
                    key={j}
                    d={prev}
                    stroke="#c8c0a8"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    opacity={0.4}
                  />
                ))}
                {/* Current stroke highlighted */}
                <path
                  d={d}
                  stroke={color}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                {/* Direction arrow */}
                {arrowForStroke(d, color)}
                {/* Start dot */}
                {(() => {
                  try {
                    const pt = getPathPoint(d, 0);
                    return (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="3.5"
                        fill={color}
                        opacity={0.85}
                      />
                    );
                  } catch {
                    return null;
                  }
                })()}
                {/* Stroke number */}
                <text
                  x="4"
                  y="13"
                  fontSize="11"
                  fontWeight="700"
                  fill={color}
                  opacity={0.9}
                >
                  {i + 1}
                </text>
              </svg>
            </div>
          );
        })}
      </div>

      {/* Full composite view */}
      <div
        style={{
          border: "2px solid #d4c89a",
          borderRadius: 4,
          background: "#fff8ee",
          padding: 4,
        }}
      >
        <svg
          width={PANEL_SZ}
          height={PANEL_SZ}
          viewBox={`0 0 ${KVG_VIEWBOX} ${KVG_VIEWBOX}`}
          style={{ display: "block" }}
        >
          {strokes.map((d, i) => {
            const color = COLORS[i % COLORS.length];
            const show = activeIdx === -1 || i <= activeIdx;
            const isActive = activeIdx === i;
            return show ? (
              <g key={i}>
                <path
                  d={d}
                  stroke={isActive ? color : "#3a2a10"}
                  strokeWidth={isActive ? 4.5 : 3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  opacity={isActive ? 1 : 0.55}
                />
                {(activeIdx === -1 || isActive) && arrowForStroke(d, color)}
                {(activeIdx === -1 || isActive) &&
                  (() => {
                    try {
                      const pt = getPathPoint(d, 0);
                      return (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="3"
                          fill={color}
                          opacity={0.8}
                        />
                      );
                    } catch {
                      return null;
                    }
                  })()}
                {activeIdx === -1 &&
                  (() => {
                    try {
                      const pt = getPathPoint(d, 0);
                      return (
                        <text
                          x={pt.x + 3}
                          y={pt.y - 3}
                          fontSize="8"
                          fontWeight="700"
                          fill={color}
                          opacity={0.85}
                        >
                          {i + 1}
                        </text>
                      );
                    } catch {
                      return null;
                    }
                  })()}
              </g>
            ) : null;
          })}
        </svg>
      </div>

      {/* Play animation button */}
      <button
        onClick={playAnimation}
        disabled={animating}
        style={{
          background: animating
            ? "#c8b882"
            : "linear-gradient(135deg,#4060a0,#6080cc)",
          border: "none",
          borderRadius: 3,
          color: "#fff",
          fontSize: 11,
          padding: "6px 16px",
          cursor: animating ? "default" : "pointer",
          fontFamily: "'Noto Serif JP', serif",
          letterSpacing: 1,
        }}
      >
        {animating ? "▶ Playing…" : "▶ Animate stroke order"}
      </button>

      <p style={{ fontSize: 9, color: "#b0a070" }}>
        KanjiVG © Ulrich Apel · CC BY-SA 3.0 · kanjivg.tagaini.net
      </p>
    </div>
  );
}

// ── Stroke math ───────────────────────────────────────────────────────────────
function downsample(pts, d = 5) {
  if (pts.length < 2) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const l = out[out.length - 1],
      dx = pts[i].x - l.x,
      dy = pts[i].y - l.y;
    if (Math.sqrt(dx * dx + dy * dy) >= d) out.push(pts[i]);
  }
  if (out[out.length - 1] !== pts[pts.length - 1])
    out.push(pts[pts.length - 1]);
  return out;
}

// ── Drawing Canvas ────────────────────────────────────────────────────────────
function DrawingCanvas({
  canvasRef,
  onStrokesUpdate,
  disabled,
  kanji,
  showGuide,
  showOverlay,
}) {
  const drawing = useRef(false);
  const currentPoints = useRef([]);
  const allStrokes = useRef([]);

  const getPos = (e) => {
    const c = canvasRef.current,
      rect = c.getBoundingClientRect();
    const sx = c.width / rect.width,
      sy = c.height / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * sx,
      y: (src.clientY - rect.top) * sy,
    };
  };

  const repaint = useCallback(
    (strokes, opts = {}) => {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      const { guide = false, overlay = false } = opts;
      ctx.fillStyle = "#fdf6e3";
      ctx.fillRect(0, 0, SZ, SZ);
      if (guide) drawKanjiLayer(ctx, kanji, SZ, 0.09);
      ctx.save();
      ctx.strokeStyle = "rgba(150,130,90,0.18)";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(SZ / 2, 10);
      ctx.lineTo(SZ / 2, SZ - 10);
      ctx.moveTo(10, SZ / 2);
      ctx.lineTo(SZ - 10, SZ / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      ctx.strokeStyle = "#1a0f05";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      strokes.forEach((pts) => {
        if (pts.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      });
      if (overlay) drawKanjiLayer(ctx, kanji, SZ, 0.3);
    },
    [canvasRef, kanji],
  );

  // Mount only — reset strokes
  useEffect(() => {
    allStrokes.current = [];
    repaint([], { guide: showGuide, overlay: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guide / overlay toggle — repaint without resetting strokes
  useEffect(() => {
    repaint(allStrokes.current, { guide: showGuide, overlay: showOverlay });
  }, [showGuide, showOverlay, repaint]);

  const start = (e) => {
    if (disabled) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d"),
      p = getPos(e);
    drawing.current = true;
    currentPoints.current = [p];
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.strokeStyle = "#1a0f05";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };
  const move = (e) => {
    if (!drawing.current || disabled) return;
    e.preventDefault();
    const p = getPos(e);
    currentPoints.current.push(p);
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const end = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    drawing.current = false;
    const pts = downsample(currentPoints.current, 4);
    if (pts.length >= 2) {
      allStrokes.current.push(pts);
      onStrokesUpdate([...allStrokes.current]);
    }
    currentPoints.current = [];
  };
  const clear = () => {
    allStrokes.current = [];
    onStrokesUpdate([]);
    repaint([], { guide: showGuide, overlay: false });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          borderRadius: 4,
          overflow: "hidden",
          border: "2px solid #b8a882",
          boxShadow:
            "inset 0 2px 10px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.2)",
          touchAction: "none",
          cursor: disabled ? "default" : "crosshair",
        }}
      >
        <canvas
          ref={canvasRef}
          width={SZ}
          height={SZ}
          style={{
            display: "block",
            width: "100%",
            maxWidth: SZ,
            touchAction: "none",
          }}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>
      {!disabled && (
        <button
          onClick={clear}
          style={{
            background: "transparent",
            border: "1.5px solid #b8a882",
            color: "#7a6a4a",
            padding: "5px 18px",
            borderRadius: 3,
            fontFamily: "'Noto Serif JP', serif",
            fontSize: 12,
            cursor: "pointer",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "#b8a882";
            e.currentTarget.style.color = "#fff";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#7a6a4a";
          }}
        >
          ✕ Clear
        </button>
      )}
    </div>
  );
}

// ── Stroke badge ──────────────────────────────────────────────────────────────
function StrokeBadge({ current, expected }) {
  const diff = current - expected;
  const color =
    current === 0
      ? "#9a8050"
      : diff === 0
        ? "#2d6a2d"
        : diff > 0
          ? "#9a2020"
          : "#c97020";
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 14px",
        borderRadius: 20,
        background: "rgba(0,0,0,0.06)",
        border: `1px solid ${color}40`,
      }}
    >
      <span style={{ fontSize: 11, color: "#7a6040", letterSpacing: 1 }}>
        STROKES
      </span>
      <span
        style={{
          fontFamily: "'Yuji Syuku', serif",
          fontSize: 20,
          color,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {current}
      </span>
      <span style={{ fontSize: 11, color: "#b0a070" }}>/ {expected}</span>
    </div>
  );
}

// ── Main app ──────────────────────────────────────────────────────────────────
export default function KanjiQuiz() {
  const [idx, setIdx] = useState(0);
  const [userStrokes, setUserStrokes] = useState([]);
  const [result, setResult] = useState(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showStrokeOrder, setShowStrokeOrder] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const canvasRef = useRef(null);
  const current = QUIZ_KANJI[idx];
  const gold = "#c9973a",
    darkGold = "#8b6914";

  const check = () => {
    if (!userStrokes.length || result) return;
    const correct = userStrokes.length === current.strokes;
    setResult({
      isCorrect: correct,
      strokeCountCorrect: correct,
      strokesUsed: userStrokes.length,
      strokesExpected: current.strokes,
    });
    if (correct) setScore((s) => s + 1);
  };

  const next = () => {
    if (idx + 1 >= QUIZ_KANJI.length) {
      setFinished(true);
      return;
    }
    setIdx((i) => i + 1);
    setUserStrokes([]);
    setResult(null);
    setShowHint(false);
    setShowGuide(false);
    setShowStrokeOrder(false);
    setCanvasKey((k) => k + 1);
  };

  const restart = () => {
    setIdx(0);
    setUserStrokes([]);
    setResult(null);
    setScore(0);
    setFinished(false);
    setShowHint(false);
    setShowGuide(false);
    setShowStrokeOrder(false);
    setCanvasKey((k) => k + 1);
  };

  const strokeDiff = userStrokes.length - current.strokes;
  const btnBase = {
    border: "none",
    borderRadius: 3,
    color: "#fff",
    fontSize: 14,
    fontFamily: "'Noto Serif JP', serif",
    letterSpacing: 2,
    cursor: "pointer",
    padding: "13px",
    width: "100%",
    transition: "opacity 0.2s",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Yuji+Syuku&family=Noto+Serif+JP:wght@400;700&family=Shippori+Mincho:wght@400;700&display=swap');
        @keyframes fadeIn  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing:border-box; margin:0; padding:0; }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(160deg,#1a1410,#231c14 60%,#1c1408)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px 16px",
          fontFamily: "'Noto Serif JP', serif",
        }}
      >
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: `linear-gradient(90deg,${darkGold},${gold},${darkGold})`,
          }}
        />

        {!finished ? (
          <div
            style={{
              width: "100%",
              maxWidth: 420,
              animation: "slideUp 0.5s ease",
            }}
          >
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <p
                style={{
                  color: "#8b7040",
                  fontSize: 11,
                  letterSpacing: 4,
                  textTransform: "uppercase",
                  marginBottom: 3,
                }}
              >
                JLPT N5 · Kanji Writing
              </p>
              <h1
                style={{
                  fontFamily: "'Yuji Syuku', serif",
                  color: "#e8d5a0",
                  fontSize: 24,
                  fontWeight: 400,
                  letterSpacing: 3,
                }}
              >
                漢字練習
              </h1>
            </div>

            {/* Progress */}
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <span
                  style={{ color: "#7a6a3a", fontSize: 11, letterSpacing: 1 }}
                >
                  {idx + 1} / {QUIZ_KANJI.length}
                </span>
                <span style={{ color: gold, fontSize: 11, letterSpacing: 1 }}>
                  ✓ {score} correct
                </span>
              </div>
              <div
                style={{ height: 3, background: "#2a2010", borderRadius: 2 }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${(idx / QUIZ_KANJI.length) * 100}%`,
                    background: `linear-gradient(90deg,${darkGold},${gold})`,
                    borderRadius: 2,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>

            {/* Card */}
            <div
              style={{
                background: "linear-gradient(145deg,#f9f3e3,#f0e8cc)",
                borderRadius: 6,
                padding: "20px 18px",
                boxShadow:
                  "0 20px 60px rgba(0,0,0,0.5),0 4px 16px rgba(0,0,0,0.3)",
                border: "1px solid #c8b882",
              }}
            >
              {/* Prompt */}
              <div style={{ textAlign: "center", marginBottom: 12 }}>
                <p
                  style={{
                    fontSize: 12,
                    color: "#5a4a28",
                    letterSpacing: 1,
                    marginBottom: 2,
                  }}
                >
                  Write the kanji for:
                </p>
                <p
                  style={{
                    fontFamily: "'Yuji Syuku', serif",
                    fontSize: 30,
                    color: "#2a1a08",
                    letterSpacing: 2,
                  }}
                >
                  {current.meaning}
                </p>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 10,
                    marginTop: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    onClick={() => setShowHint((h) => !h)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#9a7a30",
                      fontSize: 11,
                      cursor: "pointer",
                      textDecoration: "underline",
                      fontFamily: "'Noto Serif JP', serif",
                    }}
                  >
                    {showHint ? "▲ reading" : "▼ reading"}
                  </button>
                  {!result && (
                    <button
                      onClick={() => setShowGuide((g) => !g)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#4060a0",
                        fontSize: 11,
                        cursor: "pointer",
                        textDecoration: "underline",
                        fontFamily: "'Noto Serif JP', serif",
                      }}
                    >
                      {showGuide ? "▲ hide guide" : "▼ faint guide"}
                    </button>
                  )}
                </div>
                {showHint && (
                  <div
                    style={{
                      marginTop: 6,
                      padding: "5px 12px",
                      background: "rgba(180,150,80,0.1)",
                      borderRadius: 3,
                      border: "1px solid rgba(180,150,80,0.3)",
                      animation: "fadeIn 0.2s ease",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 12,
                        color: "#7a6030",
                        lineHeight: 1.8,
                      }}
                    >
                      訓: {current.kunyomi}
                      <br />
                      音: {current.onyomi}
                    </p>
                  </div>
                )}
              </div>

              {/* Stroke counter */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <StrokeBadge
                  current={userStrokes.length}
                  expected={current.strokes}
                />
                {userStrokes.length > 0 && !result && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color:
                        strokeDiff === 0
                          ? "#2d6a2d"
                          : strokeDiff > 0
                            ? "#9a2020"
                            : "#c97020",
                    }}
                  >
                    {strokeDiff === 0
                      ? "✓"
                      : strokeDiff > 0
                        ? `+${strokeDiff} too many`
                        : `${strokeDiff} too few`}
                  </span>
                )}
              </div>

              <DrawingCanvas
                key={canvasKey}
                canvasRef={canvasRef}
                onStrokesUpdate={setUserStrokes}
                disabled={!!result}
                kanji={current.kanji}
                showGuide={showGuide}
                showOverlay={!!result}
              />

              {/* Legend after check */}
              {result && (
                <div
                  style={{
                    marginTop: 6,
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 4,
                        background: "#1a0f05",
                        borderRadius: 2,
                      }}
                    />
                    <span style={{ fontSize: 10, color: "#5a4a28" }}>
                      your writing
                    </span>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 4,
                        background: "rgba(26,58,204,0.45)",
                        borderRadius: 2,
                      }}
                    />
                    <span style={{ fontSize: 10, color: "#5a4a28" }}>
                      correct form
                    </span>
                  </div>
                </div>
              )}

              {/* Result panel */}
              {result && (
                <div style={{ marginTop: 10, animation: "fadeIn 0.3s ease" }}>
                  <div
                    style={{
                      padding: "14px",
                      background: result.isCorrect
                        ? "rgba(50,120,50,0.12)"
                        : "rgba(160,50,50,0.1)",
                      border: `1.5px solid ${result.isCorrect ? "#4a9a4a" : "#b04040"}`,
                      borderRadius: 4,
                      textAlign: "center",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: result.isCorrect ? "#2d6a2d" : "#9a2020",
                        letterSpacing: 1,
                        fontFamily: "'Yuji Syuku', serif",
                      }}
                    >
                      {result.isCorrect
                        ? "✓ 正解！Correct!"
                        : "✗ 不正解 Incorrect"}
                    </p>

                    <div
                      style={{
                        marginTop: 10,
                        padding: "10px",
                        background: result.strokeCountCorrect
                          ? "rgba(50,120,50,0.08)"
                          : "rgba(180,60,60,0.08)",
                        borderRadius: 3,
                        border: `1px solid ${result.strokeCountCorrect ? "#4a9a4a40" : "#b0404040"}`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          gap: 14,
                        }}
                      >
                        <div style={{ textAlign: "center" }}>
                          <p
                            style={{
                              fontSize: 9,
                              color: "#9a8050",
                              letterSpacing: 1,
                            }}
                          >
                            YOUR STROKES
                          </p>
                          <p
                            style={{
                              fontFamily: "'Yuji Syuku', serif",
                              fontSize: 28,
                              fontWeight: 700,
                              color: result.strokeCountCorrect
                                ? "#2d6a2d"
                                : "#9a2020",
                            }}
                          >
                            {result.strokesUsed}
                          </p>
                        </div>
                        <div
                          style={{
                            color: "#c8b882",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          vs
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <p
                            style={{
                              fontSize: 9,
                              color: "#9a8050",
                              letterSpacing: 1,
                            }}
                          >
                            REQUIRED
                          </p>
                          <p
                            style={{
                              fontFamily: "'Yuji Syuku', serif",
                              fontSize: 28,
                              color: "#2d6a2d",
                              fontWeight: 700,
                            }}
                          >
                            {result.strokesExpected}
                          </p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <span
                            style={{
                              fontSize: 20,
                              color: result.strokeCountCorrect
                                ? "#2d6a2d"
                                : "#9a2020",
                            }}
                          >
                            {result.strokeCountCorrect ? "✓" : "✗"}
                          </span>
                        </div>
                      </div>
                      {result.strokeCountCorrect ? (
                        <p
                          style={{
                            fontSize: 11,
                            color: "#2a5a2a",
                            marginTop: 6,
                            lineHeight: 1.5,
                          }}
                        >
                          Correct! Compare your writing with the blue overlay
                          above.
                        </p>
                      ) : (
                        <p
                          style={{
                            fontSize: 11,
                            color: "#7a3020",
                            marginTop: 6,
                            lineHeight: 1.5,
                          }}
                        >
                          {current.kanji} requires exactly{" "}
                          {result.strokesExpected} stroke
                          {result.strokesExpected > 1 ? "s" : ""}.
                          {result.strokesUsed > result.strokesExpected
                            ? " Try drawing some strokes as one continuous motion."
                            : " You may have lifted the pen too early — try connecting that stroke."}
                        </p>
                      )}
                    </div>

                    {/* ── Stroke order toggle button ── */}
                    <button
                      onClick={() => setShowStrokeOrder((s) => !s)}
                      style={{
                        marginTop: 10,
                        background: showStrokeOrder
                          ? `linear-gradient(135deg,#4060a0,#6080cc)`
                          : "transparent",
                        border: `1.5px solid #4060a0`,
                        borderRadius: 3,
                        color: showStrokeOrder ? "#fff" : "#4060a0",
                        fontSize: 12,
                        padding: "7px 18px",
                        cursor: "pointer",
                        fontFamily: "'Noto Serif JP', serif",
                        letterSpacing: 1,
                        transition: "all 0.2s",
                      }}
                    >
                      {showStrokeOrder
                        ? "▲ Hide stroke order"
                        : "▼ Show stroke order 筆順"}
                    </button>

                    <p style={{ fontSize: 9, color: "#b0a070", marginTop: 8 }}>
                      KANJIDIC2 © EDRDG · Font: Yuji Syuku · KanjiVG © Ulrich
                      Apel CC BY-SA 3.0
                    </p>
                  </div>

                  {/* ── Stroke Order Panel ── */}
                  {showStrokeOrder && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "14px",
                        background: "#fdf6e3",
                        border: "1.5px solid #c8b882",
                        borderRadius: 4,
                        animation: "fadeIn 0.25s ease",
                      }}
                    >
                      <p
                        style={{
                          textAlign: "center",
                          fontSize: 11,
                          color: "#7a6040",
                          letterSpacing: 2,
                          marginBottom: 10,
                          fontFamily: "'Yuji Syuku', serif",
                        }}
                      >
                        筆順 · Stroke Order · {current.kanji}
                      </p>
                      <StrokeOrderPanel kanji={current.kanji} />
                    </div>
                  )}
                </div>
              )}

              {/* Action button */}
              <div style={{ marginTop: 12 }}>
                {!result ? (
                  <button
                    onClick={check}
                    disabled={!userStrokes.length}
                    style={{
                      ...btnBase,
                      background: !userStrokes.length
                        ? "#c8b882"
                        : `linear-gradient(135deg,${darkGold},${gold})`,
                      cursor: !userStrokes.length ? "not-allowed" : "pointer",
                      boxShadow: userStrokes.length
                        ? `0 4px 14px rgba(139,105,20,0.4)`
                        : "none",
                    }}
                  >
                    Check 判定
                  </button>
                ) : (
                  <button
                    onClick={next}
                    style={{
                      ...btnBase,
                      background: "linear-gradient(135deg,#2a5a8a,#3a7ac0)",
                      boxShadow: "0 4px 14px rgba(42,90,138,0.4)",
                    }}
                  >
                    {idx + 1 >= QUIZ_KANJI.length
                      ? "See Results  結果"
                      : "Next  次へ →"}
                  </button>
                )}
              </div>
            </div>

            {/* Progress dots */}
            <div
              style={{
                marginTop: 10,
                display: "flex",
                justifyContent: "center",
                gap: 5,
                flexWrap: "wrap",
              }}
            >
              {QUIZ_KANJI.map((k, i) => (
                <div
                  key={i}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "'Yuji Syuku', serif",
                    fontSize: 13,
                    background:
                      i < idx
                        ? "rgba(180,150,60,0.3)"
                        : i === idx
                          ? "rgba(200,170,80,0.5)"
                          : "rgba(255,255,255,0.05)",
                    border:
                      i === idx
                        ? `1px solid ${gold}`
                        : "1px solid rgba(255,255,255,0.07)",
                    color: i <= idx ? "#e8d5a0" : "#4a3a20",
                    transition: "all 0.3s",
                  }}
                >
                  {i < idx ? k.kanji : "·"}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div
            style={{
              width: "100%",
              maxWidth: 380,
              textAlign: "center",
              animation: "slideUp 0.5s ease",
            }}
          >
            <div
              style={{
                background: "linear-gradient(145deg,#f9f3e3,#f0e8cc)",
                borderRadius: 6,
                padding: "36px 26px",
                boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
                border: "1px solid #c8b882",
              }}
            >
              <p
                style={{
                  color: "#8b7040",
                  fontSize: 11,
                  letterSpacing: 4,
                  marginBottom: 8,
                }}
              >
                RESULTS · 結果
              </p>
              <div
                style={{
                  fontFamily: "'Yuji Syuku', serif",
                  fontSize: 68,
                  color: "#2a1a08",
                  lineHeight: 1,
                  marginBottom: 6,
                }}
              >
                {score}
                <span style={{ fontSize: 28, color: "#9a8050" }}>
                  /{QUIZ_KANJI.length}
                </span>
              </div>
              <p
                style={{
                  color:
                    score >= 16
                      ? "#2d6a2d"
                      : score >= 10
                        ? darkGold
                        : "#9a2020",
                  fontSize: 15,
                  marginBottom: 5,
                  fontWeight: 700,
                  letterSpacing: 1,
                  fontFamily: "'Yuji Syuku', serif",
                }}
              >
                {score >= 16
                  ? "優秀 Excellent!"
                  : score >= 10
                    ? "良い Good!"
                    : "もっと練習 Keep practicing!"}
              </p>
              <p style={{ color: "#7a6040", fontSize: 13, marginBottom: 22 }}>
                {Math.round((score / QUIZ_KANJI.length) * 100)}% accuracy
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5,1fr)",
                  gap: 7,
                  marginBottom: 16,
                }}
              >
                {QUIZ_KANJI.map((k, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "7px 3px",
                      background: "rgba(0,0,0,0.04)",
                      borderRadius: 3,
                      border: "1px solid rgba(0,0,0,0.07)",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "'Yuji Syuku', serif",
                        fontSize: 24,
                        color: "#2a1a08",
                      }}
                    >
                      {k.kanji}
                    </div>
                    <div
                      style={{ fontSize: 9, color: "#9a8050", marginTop: 1 }}
                    >
                      {k.strokes}画
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 9, color: "#b0a070", marginBottom: 18 }}>
                KANJIDIC2 © EDRDG · KanjiVG © Ulrich Apel CC BY-SA 3.0
              </p>
              <button
                onClick={restart}
                style={{
                  ...btnBase,
                  background: `linear-gradient(135deg,${darkGold},${gold})`,
                  boxShadow: `0 4px 14px rgba(139,105,20,0.4)`,
                }}
              >
                Try Again 再挑戦
              </button>
            </div>
          </div>
        )}

        <p
          style={{
            marginTop: 14,
            color: "#3a2a10",
            fontSize: 10,
            letterSpacing: 2,
          }}
        >
          KANJIDIC2 © EDRDG · KanjiVG © Ulrich Apel CC BY-SA 3.0
        </p>
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            background: `linear-gradient(90deg,${darkGold},${gold},${darkGold})`,
          }}
        />
      </div>
    </>
  );
}
