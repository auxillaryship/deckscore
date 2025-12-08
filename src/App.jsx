// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Share2, RefreshCcw, Download, Link2 } from "lucide-react";
import cards from "./cards.json";

/* ======================
   Small icon fallback
   (replace with images later)
   ====================== */
const ICONS = {
  knight: "🛡️",
  archers: "🏹",
  hogrider: "🐗",
  rune_giant: "🔮",
  boss_bandit: "🗡️",
  archer_queen: "👑",
  giant: "🪨",
  pekka: "⚔️",
  balloon: "🎈",
  lava_hound: "🐺",
};
const getIcon = (id) => ICONS[id] || "🃏";

/* ======================
   Helpers + Heuristic
   ====================== */
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
function calcElixirAvg(deck) {
  return deck.reduce((s, c) => s + (c.elixir || 0), 0) / deck.length;
}
function calcSigma(deck, avg) {
  return Math.sqrt(deck.reduce((s, c) => s + Math.pow((c.elixir || 0) - avg, 2), 0) / deck.length);
}
function getSynergy(a, b) {
  // quick heuristics: evo & hero get mild synergy
  if (!a || !b) return 0;
  if ((a.tags || []).includes("evolution") || (b.tags || []).includes("evolution")) return 0.18;
  if (a.type === "hero" || b.type === "hero") return 0.22;
  // same tag synergy
  const shared = (a.tags || []).filter((t) => (b.tags || []).includes(t));
  return Math.min(0.35, shared.length * 0.12);
}
function computeHeuristic(deck) {
  if (!deck || deck.length !== 8) return null;
  const avg = calcElixirAvg(deck);
  const sigma = calcSigma(deck, avg);

  // role counts
  const roles = { win: 0, support: 0, spell: 0, building: 0, air: 0, swarm: 0 };
  deck.forEach((c) => (c.tags || []).forEach((t) => {
    if (roles[t] !== undefined) roles[t] += 1;
    if (t === "spell") roles.spell += 1;
  }));

  const win_ok = deck.some((d) => (d.tags || []).includes("win")) ? 1 : 0;
  const spell_ok = Math.min(1, roles.spell / 2);
  const air_ok = Math.min(1, roles.air / 1);
  const swarm_ok = Math.min(1, roles.swarm / 1);
  const elixir_ok = clamp(1 - Math.abs(avg - 3.8) / 3.8, 0, 1);
  const balance_ok = 1 - clamp(sigma / 3, 0, 1);

  // synergy average
  let synergy = 0, pairs = 0;
  for (let i = 0; i < deck.length; i++) {
    for (let j = i + 1; j < deck.length; j++) {
      synergy += getSynergy(deck[i], deck[j]);
      pairs++;
    }
  }
  const synergy_score = pairs ? clamp((synergy / pairs + 1) / 2, 0, 1) : 0.5;

  const score = Math.round(
    30 * win_ok +
    15 * spell_ok +
    10 * air_ok +
    10 * swarm_ok +
    15 * elixir_ok +
    10 * balance_ok +
    10 * synergy_score
  );

  return {
    final: score,
    breakdown: {
      win: Math.round(win_ok * 100),
      spell: Math.round(spell_ok * 100),
      air: Math.round(air_ok * 100),
      elixir: Math.round(elixir_ok * 100),
      synergy: Math.round(synergy_score * 100),
    },
    avgElixir: +avg.toFixed(2),
    sigma: +sigma.toFixed(2),
  };
}

/* ======================
   Component
   ====================== */
export default function App() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]);
  const [result, setResult] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("deck");
    if (code) {
      const ids = code.split(",");
      const deck = ids.map((id) => cards.find((c) => c.id === id)).filter(Boolean);
      if (deck.length === 8) setSelected(deck);
    }
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (selected.length === 8) {
      const r = computeHeuristic(selected);
      setResult(r);
      // simple suggestion logic: placeholder -> recommend any card that is not in deck and increases score slightly
      const base = r ? r.final : 0;
      const suggs = [];
      for (let i = 0; i < selected.length; i++) {
        const from = selected[i];
        for (const candidate of cards) {
          if (selected.find((d) => d.id === candidate.id)) continue;
          const trial = selected.slice();
          trial[i] = candidate;
          const s = computeHeuristic(trial);
          if (s && s.final - base >= 8) {
            suggs.push({ slot: i, from, to: candidate, delta: s.final - base, score: s.final });
          }
        }
      }
      suggs.sort((a, b) => b.delta - a.delta);
      setSuggestions(suggs.slice(0, 3));
    } else {
      setResult(null);
      setSuggestions([]);
    }
  }, [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  }, [query]);

  function toggleCard(card) {
    const idx = selected.findIndex((c) => c.id === card.id);
    if (idx >= 0) {
      setSelected((prev) => prev.filter((_, i) => i !== idx));
      return;
    }
    if (selected.length >= 8) return;
    setSelected((prev) => [...prev, card]);
  }

  function removeSlot(i) {
    setSelected((prev) => prev.filter((_, idx) => idx !== i));
  }

  function applySuggestion(s) {
    setSelected((prev) => prev.map((c, i) => (i === s.slot ? s.to : c)));
  }

  function quickFillRandom() {
    const pick = [...cards].sort(() => Math.random() - 0.5).slice(0, 8);
    setSelected(pick);
  }

  function clearAll() {
    setSelected([]);
    setResult(null);
    setSuggestions([]);
  }

  function copyShare() {
    const code = selected.map((c) => c.id).join(",");
    const u = `${window.location.origin}${window.location.pathname}?deck=${encodeURIComponent(code)}`;
    navigator.clipboard.writeText(u).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadDeck() {
    const data = JSON.stringify(selected.map((c) => c.id), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "deck.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-slate-100 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-extrabold">DeckScore</h1>
            <p className="text-slate-400 text-sm">Instant Clash Royale deck ratings — pick 8 cards to get started.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={quickFillRandom} className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-md text-sm">Random</button>
            <button onClick={clearAll} className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-md text-sm">Clear</button>
            <button onClick={copyShare} className="bg-amber-500 text-slate-900 px-3 py-2 rounded-md flex items-center gap-2 text-sm">
              {copied ? "Link Copied" : <>Share <Share2 size={14} /></>}
            </button>
            <button onClick={downloadDeck} className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-md text-sm flex items-center gap-2">
              <Download size={14} /> Download
            </button>
          </div>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Picker */}
          <section className="md:col-span-7 bg-slate-800/40 rounded-2xl p-4 shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="relative w-full">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search cards or ids..."
                  className="w-full bg-transparent border border-slate-700 rounded-md px-3 py-2 placeholder-slate-400"
                />
                <div className="absolute right-3 top-2.5 text-slate-400"><Search size={16} /></div>
              </div>
            </div>

            <div className="text-sm text-slate-400 mb-2">Tap cards to add to your deck — selected cards show order badges.</div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map((card) => {
                const idx = selected.findIndex((c) => c.id === card.id);
                const selectedClass = idx >= 0 ? "ring-2 ring-amber-400 bg-amber-900/10" : "hover:bg-white/5";
                return (
                  <motion.button
                    layout
                    key={card.id}
                    onClick={() => toggleCard(card)}
                    whileTap={{ scale: 0.97 }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`relative p-3 rounded-xl border border-slate-700 text-left ${selectedClass} transition-colors`}
                    title={`${card.name} — ${card.elixir} elixir`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center text-xl font-bold shadow">{getIcon(card.id)}</div>
                      <div className="flex-1">
                        <div className="font-medium leading-tight">{card.name}</div>
                        <div className="text-xs text-slate-400 mt-1">{card.elixir ?? "—"} • {card.type}</div>
                      </div>
                      <div className="text-xs px-2 py-1 rounded-md bg-slate-700 text-slate-200">{(card.tags || []).slice(0,2).join(',')}</div>
                    </div>

                    <AnimatePresence>
                      {idx >= 0 && (
                        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} className="absolute -top-2 -right-2">
                          <div className="bg-amber-500 text-slate-900 px-2 py-1 rounded-full text-xs font-semibold">#{idx + 1}</div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>

            <div className="mt-4">
              <div className="text-sm text-slate-300">Selected ({selected.length}/8)</div>
              <div className="mt-3 flex gap-2 flex-wrap">
                {selected.map((c, i) => (
                  <motion.div key={c.id} layout initial={{ scale: 0.9, opacity: 0.8 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-2 bg-slate-700 px-3 py-2 rounded-md">
                    <div className="w-8 h-8 rounded bg-slate-600 flex items-center justify-center text-lg">{getIcon(c.id)}</div>
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-xs text-slate-400">#{i + 1}</div>
                    <button onClick={() => removeSlot(i)} className="ml-2 text-xs px-2 py-1 bg-red-700 rounded">Remove</button>
                  </motion.div>
                ))}
                {selected.length < 8 && <div className="text-slate-500 text-sm self-center">Pick {8 - selected.length} more</div>}
              </div>
            </div>
          </section>

          {/* Rating panel (sticky on desktop) */}
          <aside className="md:col-span-5">
            <div className="sticky top-6 bg-gradient-to-b from-slate-800/40 to-slate-700/30 rounded-2xl p-5 shadow-lg">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-slate-400">Deck Rating</div>
                  <div className="flex items-center gap-4 mt-3">
                    <div className="w-36 h-36 bg-gradient-to-br from-amber-500 to-rose-500 rounded-full flex items-center justify-center shadow-2xl">
                      <AnimatePresence>
                        {result ? (
                          <motion.div key={result.final} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-4xl font-extrabold text-slate-900">
                            {result.final}
                          </motion.div>
                        ) : (
                          <motion.div initial={{ scale: 0.95, opacity: 0.6 }} animate={{ opacity: 1 }} className="text-slate-200 text-sm text-center px-2">
                            Select 8 cards to rate
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="flex-1">
                      <div className="text-sm text-slate-300">Quick insights</div>
                      <div className="mt-2">
                        <div className="text-xs text-slate-400">Elixir: <span className="text-slate-200 ml-2">{result ? result.avgElixir : "--"}</span></div>
                        <div className="text-xs text-slate-400">Variance: <span className="text-slate-200 ml-2">{result ? result.sigma : "--"}</span></div>
                        <div className="mt-3">
                          <div className="text-xs text-slate-400 mb-1">Breakdown</div>
                          <div className="space-y-2">
                            {result ? Object.entries(result.breakdown).map(([k, v]) => (
                              <div key={k} className="bg-slate-800/50 p-2 rounded-md">
                                <div className="flex items-center justify-between text-xs text-slate-300 font-medium">{k.toUpperCase()} <span>{v}%</span></div>
                                <div className="w-full bg-slate-900 h-2 rounded mt-2 overflow-hidden"><div style={{ width: `${v}%` }} className="h-2 bg-amber-400"></div></div>
                              </div>
                            )) : (
                              <div className="text-slate-500 text-sm">No rating yet — pick 8 cards</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Share</div>
                  <div className="mt-2 flex flex-col gap-2">
                    <button onClick={copyShare} className="px-3 py-2 bg-amber-500 text-slate-900 rounded-md flex items-center gap-2 text-sm"><Link2 size={14}/>Copy Link</button>
                    <button onClick={downloadDeck} className="px-3 py-2 bg-slate-700 rounded-md flex items-center gap-2 text-sm"><Download size={14}/>Download JSON</button>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                {result && suggestions.length ? (
                  <>
                    <div className="text-sm text-slate-300 mb-2">Top suggestions</div>
                    <div className="flex flex-col gap-2">
                      {suggestions.map((s, idx) => (
                        <motion.div key={idx} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-slate-700/40 rounded-md flex items-center justify-between">
                          <div>
                            <div className="font-medium">Swap {s.from.name} → {s.to.name}</div>
                            <div className="text-xs text-slate-400">Score +{s.delta} → <span className="text-amber-300">{s.score}</span></div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button onClick={() => applySuggestion(s)} className="px-3 py-2 bg-amber-500 text-slate-900 rounded-md text-sm">Apply</button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </>
                ) : result ? (
                  <div className="text-slate-400 text-sm">No big swap suggestions. Deck looks balanced — try replacing weak cards to improve.</div>
                ) : null}
              </div>

              <div className="mt-5">
                <div className="text-xs text-slate-400 mb-2">Deck preview</div>
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {selected.length ? selected.map((c, i) => (
                    <div key={c.id} className="flex-shrink-0 w-14 h-20 bg-slate-700 rounded-lg p-2 flex flex-col items-center justify-between">
                      <div className="text-2xl">{getIcon(c.id)}</div>
                      <div className="text-xs text-center">{c.name.split(' ')[0]}</div>
                      <div className="text-xs bg-slate-800 px-2 py-1 rounded">#{i + 1}</div>
                    </div>
                  )) : (
                    <div className="text-slate-500 text-sm">No cards selected</div>
                  )}
                </div>
              </div>

              <div className="mt-5 text-center text-slate-400 text-xs">Made with ❤️ • DeckScore</div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
