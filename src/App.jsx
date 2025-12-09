// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Plus, Trash2, Download, Link2, Check } from "lucide-react";
import cards from "./cards.json";

/* ---------- Helpers & Heuristic (same as before) ---------- */
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
function calcElixirAvg(deck) { return deck.reduce((s, c) => s + (c.elixir || 0), 0) / deck.length; }
function calcSigma(deck, avg) { return Math.sqrt(deck.reduce((s, c) => s + Math.pow((c.elixir || 0) - avg, 2), 0) / deck.length); }
function getSynergy(a, b) {
  if (!a || !b) return 0;
  if ((a.tags || []).includes("evolution") || (b.tags || []).includes("evolution")) return 0.18;
  if (a.type === "hero" || b.type === "hero") return 0.22;
  const shared = (a.tags || []).filter((t) => (b.tags || []).includes(t));
  return Math.min(0.35, shared.length * 0.12);
}
function computeHeuristic(deck) {
  if (!deck || deck.length !== 8) return null;
  const avg = calcElixirAvg(deck), sigma = calcSigma(deck, avg);
  const roles = { win: 0, support: 0, spell: 0, building: 0, air: 0, swarm: 0 };
  deck.forEach((c) => (c.tags || []).forEach((t) => { if (roles[t] !== undefined) roles[t] += 1; if (t === "spell") roles.spell += 1; }));
  const win_ok = deck.some((d) => (d.tags || []).includes("win")) ? 1 : 0;
  const spell_ok = Math.min(1, roles.spell / 2), air_ok = Math.min(1, roles.air / 1), swarm_ok = Math.min(1, roles.swarm / 1);
  const elixir_ok = clamp(1 - Math.abs(avg - 3.8) / 3.8, 0, 1), balance_ok = 1 - clamp(sigma / 3, 0, 1);
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

/* ---------- Small UI building blocks ---------- */
function ElixirBadge({ value }) {
  return (
    <div className="w-10 h-10 rounded-md bg-amber-600/10 border border-amber-500/20 flex flex-col items-center justify-center text-xs text-amber-300 font-semibold">
      <div className="leading-none">{value ?? "-"}</div>
    </div>
  );
}

/* ---------- Main App ---------- */
export default function App() {
  // deck array length <= 8; empty slots are null
  const [deckSlots, setDeckSlots] = useState(Array(8).fill(null));
  const [modalOpen, setModalOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState(null); // index of slot user is filling
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const filled = deckSlots.filter(Boolean);
    if (filled.length === 8) {
      const r = computeHeuristic(filled);
      setResult(r);
      // suggestions
      const base = r ? r.final : 0; const suggs = [];
      for (let i = 0; i < filled.length; i++) {
        for (const candidate of cards) {
          if (filled.find((d) => d.id === candidate.id)) continue;
          const trial = filled.slice(); trial[i] = candidate;
          const s = computeHeuristic(trial);
          if (s && s.final - base >= 8) suggs.push({ slot: i, from: filled[i], to: candidate, delta: s.final - base, score: s.final });
        }
      }
      suggs.sort((a, b) => b.delta - a.delta);
      setSuggestions(suggs.slice(0, 3));
      setModalOpen(false);
    } else {
      setResult(null); setSuggestions([]);
    }
  }, [deckSlots]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("deck");
    if (code) {
      const ids = code.split(",");
      const loaded = Array(8).fill(null);
      ids.slice(0,8).forEach((id, i) => { const c = cards.find((x) => x.id === id); if (c) loaded[i] = c; });
      setDeckSlots(loaded);
    }
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase(); if (!q) return cards;
    return cards.filter((c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  }, [query]);

  /* --- Open modal for a specific slot or for next empty --- */
  function openModalForSlot(slotIndex = null) {
    setActiveSlot(slotIndex);
    setQuery("");
    setModalOpen(true);
  }

  /* --- Add card into active slot or next empty --- */
  function addCardToSlot(card) {
    // if already picked in some slot, don't add
    if (deckSlots.find((d) => d && d.id === card.id)) return;
    const newSlots = deckSlots.slice();
    if (activeSlot !== null) {
      newSlots[activeSlot] = card;
    } else {
      // find first empty
      const idx = newSlots.findIndex((s) => s === null);
      if (idx === -1) return; // full
      newSlots[idx] = card;
    }
    setDeckSlots(newSlots);
    // keep modal open until 8 cards are selected — handled by effect
  }

  function removeAt(i) {
    const ns = deckSlots.slice(); ns[i] = null; setDeckSlots(ns);
  }
  function clearAll() { setDeckSlots(Array(8).fill(null)); setResult(null); setSuggestions([]); }
  function copyShare() {
    const code = deckSlots.map((c) => c ? c.id : "").join(","); const u = `${window.location.origin}${window.location.pathname}?deck=${encodeURIComponent(code)}`; navigator.clipboard.writeText(u).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),1500); });
  }
  function downloadDeck() { const data = JSON.stringify(deckSlots.map((c) => c ? c.id : null), null, 2); const blob = new Blob([data], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "deck.json"; a.click(); URL.revokeObjectURL(url); }

  /* render helpers */
  const filledCount = deckSlots.filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-slate-100 p-4">
      <div className="max-w-xl mx-auto">
        {/* header */}
        <header className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">DeckScore</h1>
            <div className="text-xs text-slate-400">Mobile-first • pick 8 cards</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => openModalForSlot(null)} className="bg-cyan-500 text-slate-900 px-3 py-2 rounded-md flex items-center gap-2"><Plus size={14}/> Add</button>
            <button onClick={clearAll} className="bg-slate-700 px-3 py-2 rounded-md"><Trash2 size={14}/></button>
          </div>
        </header>

        {/* deck: show as 2 rows x 4 */}
        <section className="mb-4">
          <div className="text-xs text-slate-400 mb-2">Your deck ({filledCount}/8)</div>

          <div className="grid grid-cols-4 gap-2">
            {deckSlots.slice(0,4).map((c,i) => (
              <div key={i} className={`w-full h-28 rounded-lg p-2 flex flex-col justify-between text-sm ${c ? "bg-gradient-to-br from-amber-900/8 to-amber-700/6 border border-amber-400 shadow-md" : "bg-slate-800/40 border border-slate-700"}`} onClick={()=>openModalForSlot(i)}>
                {c ? (
                  <>
                    <div className="flex items-start justify-between">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="bg-amber-500 text-slate-900 rounded-full px-2 py-0.5 text-xs font-semibold flex items-center gap-1"><Check size={12}/>1</div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <div className="font-semibold text-amber-300">{c.elixir}</div>
                      <button onClick={(e)=>{ e.stopPropagation(); removeAt(i); }} className="text-xs text-red-400">Remove</button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 text-xs">
                    <div className="mb-1">Empty</div>
                    <div className="text-cyan-300 font-semibold">Tap to add</div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-4 gap-2">
            {deckSlots.slice(4,8).map((c,i) => {
              const idx = i + 4;
              return (
                <div key={idx} className={`w-full h-28 rounded-lg p-2 flex flex-col justify-between text-sm ${c ? "bg-gradient-to-br from-amber-900/8 to-amber-700/6 border border-amber-400 shadow-md" : "bg-slate-800/40 border border-slate-700"}`} onClick={()=>openModalForSlot(idx)}>
                  {c ? (
                    <>
                      <div className="flex items-start justify-between">
                        <div className="font-medium truncate">{c.name}</div>
                        <div className="bg-amber-500 text-slate-900 rounded-full px-2 py-0.5 text-xs font-semibold flex items-center gap-1"><Check size={12}/>1</div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <div className="font-semibold text-amber-300">{c.elixir}</div>
                        <button onClick={(e)=>{ e.stopPropagation(); removeAt(idx); }} className="text-xs text-red-400">Remove</button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 text-xs">
                      <div className="mb-1">Empty</div>
                      <div className="text-cyan-300 font-semibold">Tap to add</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* small search CTA */}
        <div className="mb-4">
          <button onClick={()=>openModalForSlot(null)} className="w-full bg-slate-800/40 border border-slate-700 rounded-md px-3 py-2 flex items-center gap-3">
            <Search size={16} className="text-slate-400" /><span className="text-slate-400">Search cards...</span>
          </button>
        </div>

        {/* Rating / Visual (more attractive) */}
        <section className="bg-gradient-to-br from-slate-800/40 to-slate-700/30 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-28 h-28 rounded-full flex items-center justify-center shadow-2xl" style={{ background: "linear-gradient(135deg,#FFB86B,#FF6B6B)" }}>
              <div className="text-3xl font-extrabold text-slate-900">{result ? result.final : "--"}</div>
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-300">Deck Rating</div>
                  <div className="text-sm text-slate-100 font-semibold">{result ? "Score based on balance & synergy" : "Select 8 cards"}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Elixir</div>
                  <div className="text-sm font-semibold text-amber-300">{result ? result.avgElixir : "--"}</div>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {result ? Object.entries(result.breakdown).map(([k,v])=>(
                  <div key={k} className="flex items-center justify-between text-xs text-slate-200">
                    <div className="capitalize">{k}</div>
                    <div className="flex items-center gap-3" style={{ minWidth: 130 }}>
                      <div className="w-36 bg-slate-900 h-2 rounded overflow-hidden">
                        <div style={{ width: `${v}%` }} className={`h-2 ${k==="elixir" ? "bg-cyan-400" : "bg-amber-400"}`}></div>
                      </div>
                      <div className="w-8 text-right">{v}%</div>
                    </div>
                  </div>
                )) : <div className="text-slate-400 text-sm">Pick 8 cards to get a full score and suggestions.</div>}
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button onClick={copyShare} className="flex-1 bg-cyan-500 text-slate-900 px-3 py-2 rounded-md flex items-center justify-center gap-2"><Link2 size={14}/>Share</button>
            <button onClick={downloadDeck} className="flex-1 bg-slate-700 px-3 py-2 rounded-md flex items-center justify-center gap-2"><Download size={14}/>Export</button>
          </div>

          {suggestions.length ? (
            <div className="mt-4">
              <div className="text-xs text-slate-400 mb-2">Suggestions</div>
              <div className="space-y-2">
                {suggestions.map((s,idx)=>(
                  <div key={idx} className="p-2 rounded-md bg-slate-800/30 flex items-center justify-between">
                    <div className="text-xs"><span className="font-medium">{s.from.name}</span> → <span className="font-medium">{s.to.name}</span><div className="text-slate-400 text-[11px]">+{s.delta} → {s.score}</div></div>
                    <button onClick={()=>applySuggestion(s)} className="bg-amber-500 text-slate-900 px-2 py-1 rounded text-xs">Apply</button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {/* Floating Search Modal (sheet) */}
      <AnimatePresence>
        {modalOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }} className="fixed inset-0 bg-black z-40" onClick={() => { setModalOpen(false); setActiveSlot(null); }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 320, damping: 30 }} className="fixed inset-x-0 bottom-0 top-12 z-50">
              <div className="max-w-xl mx-auto h-full bg-slate-900 rounded-t-2xl shadow-xl p-4 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-1.5 bg-slate-700 rounded" />
                    <div className="text-lg font-semibold">Search Cards</div>
                    <div className="text-xs text-slate-400 ml-2">{filledCount}/8 selected</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setModalOpen(false); setActiveSlot(null); }} className="p-2 rounded-md bg-slate-800"><X size={16} /></button>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="relative">
                    <input value={query} onChange={(e)=>setQuery(e.target.value)} autoFocus placeholder="Type card name or id..." className="w-full bg-slate-800/60 border border-slate-700 rounded-md px-3 py-2 placeholder-slate-400" />
                    <div className="absolute right-3 top-2.5 text-slate-400"><Search size={16} /></div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2">
                  <div className="space-y-2">
                    {filtered.map((c) => {
                      const already = deckSlots.find((d) => d && d.id === c.id);
                      return (
                        <motion.button key={c.id} whileTap={{ scale: already ? 1 : 0.98 }} onClick={() => { if (!already) addCardToSlot(c); }} className={`w-full text-left rounded-md p-3 flex items-center gap-3 ${already ? "bg-amber-900/10 border border-amber-400" : "bg-slate-800/40 hover:bg-slate-800/30"}`}>
                          <ElixirBadge value={c.elixir} />
                          <div className="min-w-0">
                            <div className="font-medium truncate">{c.name}</div>
                            <div className="text-xs text-slate-400 truncate">{c.type} • {(c.tags||[]).slice(0,3).join(", ")}</div>
                          </div>

                          <div className="ml-auto text-xs text-slate-300">
                            {already ? <span className="flex items-center gap-1"><Check size={14} /> Selected</span> : "Tap to add"}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3 text-xs text-slate-400 text-center">
                  Pick cards until your deck has 8 cards. Tap a slot to target where the next card will go.
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
