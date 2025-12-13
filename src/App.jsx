// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Plus, Trash2, Share2 } from "lucide-react";
import cards from "./cards.json";

/* ---------- utils ---------- */
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

function avgElixir(deck) {
  if (!deck.length) return 0;
  return deck.reduce((s, c) => s + (c.elixir || 0), 0) / deck.length;
}
function sigmaElixir(deck, avg) {
  if (!deck.length) return 0;
  return Math.sqrt(deck.reduce((s, c) => s + Math.pow((c.elixir || 0) - avg, 2), 0) / deck.length);
}

/* ---------- scoring ---------- */
function computeSynergy(deck) {
  if (!deck.length) return 0;
  let synergy = 0, pairs = 0;
  for (let i = 0; i < deck.length; i++) {
    for (let j = i + 1; j < deck.length; j++) {
      const a = deck[i], b = deck[j];
      if (!a || !b) continue;
      const shared = (a.tags || []).filter(t => (b.tags || []).includes(t));
      synergy += Math.min(0.35, shared.length * 0.12);
      pairs++;
    }
  }
  return Math.round(clamp(pairs ? synergy / pairs : 0, 0, 1) * 100);
}

function computeOffenseDefense(deck) {
  let off = 0, def = 0;
  for (const c of deck) {
    if (!c) continue;
    const e = c.elixir || 0;
    off += clamp(e / 6, 0, 1);
    def += clamp((4 - Math.abs(e - 3.5)) / 4, 0, 1);
    if (c.type === "spell") off += 0.5;
    if (c.type === "building") def += 0.9;
  }
  return {
    offense: Math.round(clamp(off / (deck.length * 1.2), 0, 1) * 100),
    defense: Math.round(clamp(def / (deck.length * 1.2), 0, 1) * 100)
  };
}

function computeCycle(avg, sigma) {
  if (!avg) return 0;
  return Math.round(clamp((4.5 - avg) / 2, 0, 1) * clamp(1 - sigma / 2.5, 0, 1) * 100);
}

/* ---------- UI ---------- */
function ElixirDrop({ value }) {
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold text-white"
      style={{ background: "linear-gradient(180deg,#ff4fd8,#c026d3)" }}
    >
      {value}
    </div>
  );
}

function RadarChart({ values }) {
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  const labels = ["Offense", "Defense", "Synergy", "Cycle"];
  const vals = [values.offense, values.defense, values.synergy, values.cycle];
  const angle = i => Math.PI / 2 - i * (Math.PI / 2);

  const points = vals.map((v, i) => {
    const rad = (v / 100) * r;
    return `${cx + Math.cos(angle(i)) * rad},${cy - Math.sin(angle(i)) * rad}`;
  }).join(" ");

  return (
    <div className="relative w-[220px] h-[240px] mx-auto">
      {/* labels */}
      <div className="absolute left-1/2 -translate-x-1/2 top-0 text-xs text-slate-300">Offense</div>
      <div className="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-slate-300">Defense</div>
      <div className="absolute left-1/2 -translate-x-1/2 bottom-0 text-xs text-slate-300">Synergy</div>
      <div className="absolute left-0 top-1/2 -translate-y-1/2 text-xs text-slate-300">Cycle</div>

      <svg width={size} height={size} className="absolute left-1/2 -translate-x-1/2 top-6">
        {[0.25,0.5,0.75,1].map((f,i)=>(
          <circle key={i} cx={cx} cy={cy} r={r*f} fill="none" stroke="#263241" />
        ))}
        {labels.map((_,i)=>(
          <line key={i}
            x1={cx} y1={cy}
            x2={cx + Math.cos(angle(i))*r}
            y2={cy - Math.sin(angle(i))*r}
            stroke="#263241"
          />
        ))}
        <polygon points={points} fill="#f59e0b" fillOpacity="0.85" stroke="#fbbf24" />
      </svg>
    </div>
  );
}

/* ---------- APP ---------- */
export default function App() {
  const [deck, setDeck] = useState(Array(8).fill(null));
  const filled = deck.filter(Boolean);

  const avg = useMemo(()=>avgElixir(filled),[filled]);
  const sigma = useMemo(()=>sigmaElixir(filled,avg),[filled,avg]);
  const synergy = useMemo(()=>computeSynergy(filled),[filled]);
  const { offense, defense } = useMemo(()=>computeOffenseDefense(filled),[filled]);
  const cycle = useMemo(()=>computeCycle(avg,sigma),[avg,sigma]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white p-4">
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-bold mb-3">DeckScore</h1>

        {/* deck */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {deck.map((c,i)=>(
            <div key={i} className="h-28 rounded-lg border border-amber-400 bg-slate-800/50 p-2 flex flex-col justify-between">
              {c ? (
                <>
                  <div className="font-semibold text-sm truncate">{c.name}</div>
                  <div className="mt-2 flex justify-center">
                    <ElixirDrop value={c.elixir} />
                  </div>
                  <button
                    onClick={()=>{ const d=[...deck]; d[i]=null; setDeck(d); }}
                    className="text-xs text-red-400 mt-2"
                  >
                    Remove
                  </button>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  Empty
                </div>
              )}
            </div>
          ))}
        </div>

        {/* radar */}
        <RadarChart values={{ offense, defense, synergy, cycle }} />

        <div className="mt-6 text-center">
          <div className="text-4xl font-bold text-amber-300">
            {filled.length === 8
              ? Math.round((offense+defense+synergy+cycle)/4)
              : "--"}
          </div>
          <div className="text-xs text-slate-400 mt-1">DeckScore</div>
          <div className="text-xs text-slate-400 mt-1">
            Avg Elixir: <span className="text-amber-300 font-semibold">
              {filled.length ? avg.toFixed(2) : "--"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
