import React, { useMemo, useState } from "react";
import cards from "./cards.json";

/* ---------------- helpers ---------------- */
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

/* ---------------- Elixir Bubble ---------------- */
function ElixirBubble({ value }) {
  return (
    <div className="mt-2 flex justify-center">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
        style={{
          background: "linear-gradient(180deg,#ff4fd8,#c026d3)",
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.35)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

/* ---------------- Radar Chart ---------------- */
function RadarChart({ values }) {
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;

  const stats = [
    values.offense,
    values.defense,
    values.synergy,
    values.cycle,
  ];

  const angle = i => Math.PI / 2 - i * (Math.PI / 2);

  const points = stats
    .map((v, i) => {
      const rad = (v / 100) * r;
      const x = cx + Math.cos(angle(i)) * rad;
      const y = cy - Math.sin(angle(i)) * rad;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="relative w-[220px] h-[220px] mx-auto mt-8">
      {/* Labels */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 text-sm text-slate-300">
        Offense
      </div>
      <div className="absolute right-0 top-1/2 -translate-y-1/2 text-sm text-slate-300">
        Defense
      </div>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-sm text-slate-300">
        Synergy
      </div>
      <div className="absolute left-0 top-1/2 -translate-y-1/2 text-sm text-slate-300">
        Cycle
      </div>

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

/* ---------------- Main App ---------------- */
export default function App() {
  const [deck, setDeck] = useState([]);

  const addCard = c => {
    if (deck.length >= 8) return;
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
      offense: clamp(55 + Math.random() * 30, 0, 100),
      defense: clamp(55 + Math.random() * 30, 0, 100),
      synergy: clamp(40 + Math.random() * 40, 0, 100),
      cycle: clamp(100 - avgElixir * 15, 0, 100),
    };
  }, [deck]);

  const deckScore =
    deck.length === 8
      ? Math.round(
          (stats.offense +
            stats.defense +
            stats.synergy +
            stats.cycle) /
            4
        )
      : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b1220] to-[#0f172a] text-white p-4">
      <h1 className="text-2xl font-extrabold mb-4">DeckScore</h1>

      {/* Deck Grid */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {deck.map(card => (
          <div
            key={card.id}
            className="border border-amber-400 rounded-xl p-2 bg-[#0f172a] relative"
          >
            <div className="font-semibold truncate text-sm">
              {card.name}
            </div>

            <ElixirBubble value={card.elixir} />

            <button
              onClick={() => removeCard(card.id)}
              className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-red-400"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* Card Picker */}
      {deck.length < 8 && (
        <div className="space-y-2 mb-8">
          {cards.map(c => (
            <button
              key={c.id}
              onClick={() => addCard(c)}
              className="w-full text-left px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700"
            >
              {c.name} ({c.elixir})
            </button>
          ))}
        </div>
      )}

      {/* Radar + Score */}
      {deck.length === 8 && (
        <>
          <RadarChart values={stats} />

          <div className="text-center mt-6">
            <div className="text-5xl font-extrabold text-amber-400">
              {deckScore}
            </div>
            <div className="text-slate-400 mt-1">DeckScore</div>
          </div>
        </>
      )}
    </div>
  );
}
