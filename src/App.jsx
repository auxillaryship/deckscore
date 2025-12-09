// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Plus, Trash2, Download, Link2 } from "lucide-react";
import cards from "./cards.json";

/* -------------------------
   Helpers & Heuristic
   ------------------------- */
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
function calcElixirAvg(deck) {
  return deck.reduce((s, c) => s + (c.elixir || 0), 0) / deck.length;
}
function calcSigma(deck, avg) {
  return Math.sqrt(deck.reduce((s, c) => s + Math.pow((c.elixir || 0) - avg, 2), 0) / deck.length);
}
function getSynergy(a, b) {
  if (!a || !b) return 0;
  if ((a.tags || []).includes("evolution") || (b.tags || []).includes("evolution")) return 0.18;
  if (a.type === "hero" || b.type === "hero") return 0.22;
  const shared = (a.tags || []).filter((t) => (b.tags || []).includes(t));
  return Math.min(0.35, shared.length * 0.12);
}
function computeHeuristic(deck) {
  if (!deck || deck.length !== 8) return null;
  const avg = calcElixirAvg(deck);
  const sigma = calcSigma(deck, avg);

  const roles = { win: 0, support: 0, spell: 0, building: 0, air: 0, swarm: 0 };
  deck.forEach((c) => (c.tags || []).forEach((t) => { if (roles[t] !== undefined) roles[t] += 1; if (t === "spell") roles.spell += 1; }));

  const win_ok = deck.some((d) => (d.tags || []).includes("win")) ? 1 : 0;
  const spell_ok = Math.min(1, roles.spell / 2);
  const air_ok = Math.min(1, roles.air / 1);
  const swarm_ok = Math.min(1, roles.swarm / 1);
  const elixir_ok = clamp(1 - Math.abs(avg - 3.8) / 3.8, 0, 1);
  const balance_ok = 1 - clamp(sigma / 3, 0, 1);

  let synergy = 0, pairs = 0;
  for (let i = 0; i < deck.length; i++) for (let j = i + 1; j < deck.length; j++) { synergy += getSynergy(deck[i], deck[j]); pairs++; }
  const synergy_score = pairs ? clamp((synergy / pairs + 1) / 2, 0, 1) : 0.5;

  const score = Math.round(30 * win_ok + 15 * spell_ok + 10 * air_ok + 10 * swarm_ok + 15 * elixir_ok + 10 * balance_ok + 10 * synergy_score);

  return {
    final: score,
    breakdown: { win: Math.round(win_ok * 100), spell: Math.round(spell_ok * 100), air: Math.round(air_ok * 100), elixir: Math.round(elixir_ok * 100), synergy: Math.round(synergy_score * 100) },
    avgElixir: +avg.toFixed(2),
    sigma: +sigma.toFixed(2),
  };
}

/* -------------------------
   Small UI utilities
   ------------------------- */
function ElixirBadge({ value }) {
  return (
    <div className="w-10 h-10 rounded-md bg-amber-600/10 border border-amber-500/30 flex flex-col items-center justify-center text-xs text-amber-300 font-semibold">
      <div className="leading-none">{value ?? "-"}</div>
    </div>
  );
}

/* -------------------------
   Main component
   ------------------------- */
export default function App() {
  const [deck, setDeck] = useState([]); // selected cards (max 8)
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // auto compute when deck has 8 cards
    if (deck.length === 8) {
      const r = computeHeuristic(deck);
      setResult(r);

      // suggestions
      const base = r ? r.final : 0;
      const suggs = [];
      for (let i = 0; i < deck.length; i++) {
        for (const candidate of cards) {
          if (deck.find((d) => d.id === candidate.id)) continue;
          const trial = deck.slice();
          trial[i] = candidate;
          const s = computeHeuristic(trial);
          if (s && s.final - base >= 8) suggs.push({ slot: i, from: deck[i], to: candidate, delta: s.final - base, score: s.final });
        }
      }
      suggs.sort((a, b) => b.delta - a.delta);
      setSuggestions(suggs.slice(0, 3));
      // auto-close modal when 8 selected (per your request)
      setModalOpen(false);
    } else {
      setResult(null);
      setSuggestions([]);
    }
  }, [deck]);

  useEffect(() => {
    // load deck from URL param if present
    const params = new URLSearchParams(window.location.search);
    const code = params.get("deck");
    if (code) {
      const ids = code.split(",");
      const d = ids.map((id) => cards.find((c) => c.id === id)).filter(Boolean);
      if (d.length === 8) setDeck(d);
    }
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  }, [query]);

  function openModal() {
    setModalOpen(true);
    setQuery("");
  }

  function addCard(c) {
    if (deck.find((d) => d.id === c.id)) return; // already in deck
    if (deck.length >= 8) return;
    // add to deck
    setDeck((prev) => [...prev, c]);
    // keep modal open until 8
    if (deck.length + 1 >= 8) {
      // will auto-close in effect
    } else {
      // keep focus in modal, leave it open
    }
  }

  function removeAt(i) {
    setDeck((prev) => prev.filter((_, idx) => idx !== i));
  }

  function clearDeck() {
    setDeck([]);
    setResult(null);
    setSuggestions([]);
  }

  function copyShare() {
    const code = deck.map((c) => c.id).join(",");
    const u = `${window.location.origin}${window.location.pathname}?deck=${encodeURIComponent(code)}`;
    navigator.clipboard.writeText(u).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function downloadDeck() {
    const data = JSON.stringify(deck.map((c) => c.id), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "deck.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  // suggestion apply
  function applySuggestion(s) {
    setDeck((prev) => prev.map((c, i) => (i === s.slot ? s.to : c)));
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4">
      {/* Top header */}
      <div className="max-w-xl mx-auto">
        <header className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">DeckScore</h1>
            <div className="text-xs text-slate-400">Mobile-first deck rater</div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={openModal} className="bg-amber-500 text-slate-900 px-3 py-2 rounded-md flex items-center gap-2">
              <Plus size={14} /> Add card
            </button>
            <button onClick={clearDeck} className="bg-slate-700 px-3 py-2 rounded-md"><Trash2 size={14} /></button>
          </div>
        </header>

        {/* Deck bar (8 slots) */}
        <div className="bg-slate-800/40 rounded-xl p-3 mb-4">
          <div className="text-xs text-slate-400 mb-2">Your deck</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {Array.from({ length: 8 }).map((_, i) => {
              const card = deck[i];
              return (
                <div key={i} className={`flex-shrink-0 w-20 h-24 rounded-md border ${card ? "border-amber-400 bg-amber-900/5" : "border-slate-700 bg-slate-800/40"} p-2 flex flex-col justify-between`}>
                  {card ? (
                    <>
                      <div className="text-xs text-slate-300 truncate">{card.name}</div>
                      <div className="flex items-center justify-between">
                        <div className="text-amber-300 font-semibold">{card.elixir ?? "-"}</div>
                        <button onClick={() => removeAt(i)} className="text-xs text-red-400">Remove</button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs">
                      <div className="mb-1">Empty</div>
                      <div className="text-amber-400">Tap + to add</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Search / Add control (small on main screen) */}
        <div className="mb-4">
          <button onClick={openModal} className="w-full bg-slate-800/40 border border-slate-700 rounded-md px-3 py-2 flex items-center gap-3">
            <Search size={16} className="text-slate-400" />
            <span className="text-slate-400">Search cards...</span>
          </button>
        </div>

        {/* Rating / visualization (mobile - below) */}
        <div className="bg-slate-800/40 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs text-slate-400">Deck Rating</div>
              <div className="text-lg font-bold">{result ? result.final : "--"}</div>
            </div>

            <div className="space-y-2 text-right">
              <div className="text-xs text-slate-400">Elixir</div>
              <div className="text-sm text-slate-200">{result ? result.avgElixir : "--"}</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-slate-400">Breakdown</div>
            {result ? Object.entries(result.breakdown).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-xs text-slate-300">
                <div className="capitalize">{k}</div>
                <div className="flex items-center gap-2" style={{ minWidth: 120 }}>
                  <div className="w-28 bg-slate-900 h-2 rounded overflow-hidden">
                    <div style={{ width: `${v}%` }} className="h-2 bg-amber-400"></div>
                  </div>
                  <div className="w-6 text-right">{v}%</div>
                </div>
              </div>
            )) : (
              <div className="text-slate-500 text-sm">Select 8 cards to see a full rating</div>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <button onClick={copyShare} className="flex-1 bg-amber-500 text-slate-900 px-3 py-2 rounded-md flex items-center justify-center gap-2"><Link2 size={14}/>Share</button>
            <button onClick={downloadDeck} className="flex-1 bg-slate-700 px-3 py-2 rounded-md flex items-center justify-center gap-2"><Download size={14}/>Export</button>
          </div>

          {/* suggestions */}
          {suggestions.length ? (
            <div className="mt-3">
              <div className="text-xs text-slate-400 mb-2">Top suggestions</div>
              <div className="space-y-2">
                {suggestions.map((s, idx) => (
                  <div key={idx} className="p-2 bg-slate-700/30 rounded-md flex items-center justify-between">
                    <div className="text-xs">
                      Swap <span className="font-medium">{s.from.name}</span> → <span className="font-medium">{s.to.name}</span>
                      <div className="text-slate-400 text-[11px]">+{s.delta} → {s.score}</div>
                    </div>
                    <button onClick={() => applySuggestion(s)} className="bg-amber-500 text-slate-900 px-2 py-1 rounded text-xs">Apply</button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Floating search modal (sheet) */}
      <AnimatePresence>
        {modalOpen && (
          <>
            {/* backdrop */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.55 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} className="fixed inset-0 bg-black z-40" onClick={() => setModalOpen(false)} />

            {/* sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="fixed inset-x-0 bottom-0 top-12 z-50"
            >
              <div className="max-w-xl mx-auto h-full bg-slate-900 rounded-t-2xl shadow-xl p-4 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-1.5 bg-slate-700 rounded" />
                    <div className="text-lg font-semibold">Search Cards</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setModalOpen(false); }} className="p-2 rounded-md bg-slate-800"><X size={16} /></button>
                  </div>
                </div>

                {/* Search input */}
                <div className="mb-3">
                  <div className="relative">
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      autoFocus
                      placeholder="Type card name or id..."
                      className="w-full bg-slate-800/60 border border-slate-700 rounded-md px-3 py-2 placeholder-slate-400"
                    />
                    <div className="absolute right-3 top-2.5 text-slate-400"><Search size={16} /></div>
                  </div>
                </div>

                {/* results list */}
                <div className="flex-1 overflow-y-auto pr-2">
                  <div className="space-y-2">
                    {filtered.map((c) => {
                      const disabled = deck.find((d) => d.id === c.id);
                      return (
                        <motion.button
                          key={c.id}
                          whileTap={{ scale: disabled ? 1 : 0.98 }}
                          onClick={() => !disabled && addCard(c)}
                          className={`w-full text-left rounded-md p-3 flex items-center gap-3 ${disabled ? "bg-slate-800/30 opacity-60" : "bg-slate-800/40 hover:bg-slate-800/30"}`}
                        >
                          <div className="flex items-center gap-3">
                            <ElixirBadge value={c.elixir} />
                            <div className="min-w-0">
                              <div className="font-medium truncate">{c.name}</div>
                              <div className="text-xs text-slate-400 truncate">{c.type} • {(c.tags || []).slice(0, 3).join(", ")}</div>
                            </div>
                          </div>
                          <div className="ml-auto text-xs text-slate-300">{disabled ? "Selected" : "Tap to add"}</div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* footer hint */}
                <div className="mt-3 text-xs text-slate-400 text-center">
                  Tap to add cards. Modal stays open until 8 cards are chosen. Close anytime with the X.
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
