import React, { useMemo, useState } from "react";
import cards from "./cards.json";

/* ---------- helpers ---------- */
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

/* ---------- elixir bubble ---------- */
function ElixirBubble({ value }) {
  return (
    <div className="mt-3 flex justify-center">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
        style={{
          background: "linear-gradient(180deg,#ff4fd8,#c026d3)",
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.25)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

/* ---------- radar chart ---------- */
function RadarChart({ values }) {
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;

  const labels = [
    { text: "Offense", x: "50%", y: "0%" },
    { text: "Defense", x: "100%", y: "50%" },
    { text: "Synergy", x: "50%", y: "100%" },
    { text: "Cycle", x: "0%", y: "50%" },
  ];

  const vals = [
    values.offense,
    values.defense,
    values.synergy,
    values.cycle,
  ];

  const angle = i => Math.PI / 2 - i * (Math.PI / 2);

  const points = vals
    .map((v, i) => {
      const rad = (v / 100) * r;
      const x = cx + Math.cos(angle(i)) * rad;
      const y = cy - Math.sin(angle(i)) * rad;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="relative w-[220px] h-[220px] mx-auto">
      {labels.map((l, i) => (
        <div
          key={i}
          className="absolute text-xs text-slate-300"
          style={{
            left: l.x,
            top: l.y,
            transform: "translate(-50%,-50%)",
          }}
        >
          {l.text}
        </div>
      ))}

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
      >
        {[0.25, 0.5, 0.75, 1].map((f, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r * f}
            fill="none"
            stroke="#263241"
            strokeWidth="1"
          />
        ))}

        {[0, 1, 2, 3].map(i => {
          const x = cx + Math.cos(angle(i)) * r;
          const y = cy - Math.sin(angle(i)) * r;
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="#263241"
              strokeWidth="1"
            />
          );
        })}

        <polygon
          points={points}
          fill="rgba(255,165,0,0.85)"
          stroke="#ff9a55"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

/* ---------- main ---------- */
export default function App() {
  const [deck, setDeck] = useState([]);

  const addCard = c => {
    if (deck.length === 8) return;
    if (deck.find(x => x.id === c.id)) return;
    setDeck([...deck, c]);
  };

  const removeCard = id => {
    setDeck(deck.filter(c => c.id !== id));
  };

  const stats = useMemo(() => {
    if (deck.length !== 8)
      return { offense: 0, defense: 0, synergy: 0, cycle: 0 };

    const avgElixir =
      deck.reduce((s, c) => s + c.elixir, 0) / deck.length;

    return {
      offense: clamp(60 + Math.random() * 20, 0, 100),
      defense: clamp(55 + Math.random() * 25, 0, 100),
      synergy: clamp(40 + Math.random() * 40, 0, 100),
      cycle: clamp(100 - avgElixir * 15, 0, 100),
    };
  }, [deck]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b1220] to-[#0f172a] text-white p-4">
      <h1 className="text-2xl font-extrabold mb-2">DeckScore</h1>

      {/* deck */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {deck.map(c => (
          <div
            key={c.id}
            className="relative border border-amber-400 rounded-xl p-2 bg-[#0f172a]"
          >
            <div className="font-semibold truncate">{c.name}</div>

            <ElixirBubble value={c.elixir} />

            <button
              onClick={() => removeCard(c.id)}
              className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-red-400"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* card search (simple list) */}
      {deck.length < 8 && (
        <div className="space-y-2 mb-6">
          {cards.map(c => (
            <button
              key={c.id}
              onClick={() => addCard(c)}
              className="w-full text-left px-3 py-2 rounded bg-slate-800 hover:bg-slate-700"
            >
              {c.name} ({c.elixir})
            </button>
          ))}
        </div>
      )}

      {/* radar */}
      {deck.length === 8 && (
        <>
          <RadarChart values={stats} />

          <div className="text-center mt-4">
            <div className="text-4xl font-extrabold text-amber-400">
              {Math.round(
                (stats.offense +
                  stats.defense +
                  stats.synergy +
                  stats.cycle) /
                  4
              )}
            </div>
            <div className="text-sm text-slate-400">DeckScore</div>
          </div>
        </>
      )}
    </div>
  );
}
