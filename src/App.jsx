// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Plus, Trash2, Share2 } from "lucide-react";
import cards from "./cards.json";

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

function avgElixir(deck) {
  if (!deck.length) return 0;
  return deck.reduce((s, c) => s + (c.elixir || 0), 0) / deck.length;
}

function sigmaElixir(deck, avg) {
  if (!deck.length) return 0;
  return Math.sqrt(deck.reduce((s, c) => s + Math.pow((c.elixir || 0) - avg, 2), 0) / deck.length);
}

function computeSynergy(deck) {
  if (!deck.length) return 0;
  let synergy = 0, pairs = 0;
  for (let i = 0; i < deck.length; i++) {
    for (let j = i + 1; j < deck.length; j++) {
      const a = deck[i], b = deck[j];
      if (!a || !b) continue;
      if ((a.tags || []).includes("evolution") || (b.tags || []).includes("evolution")) synergy += 0.18;
      const shared = (a.tags || []).filter(t => (b.tags || []).includes(t));
      synergy += Math.min(0.35, shared.length * 0.12);
      pairs++;
    }
  }
  const raw = pairs ? synergy / pairs : 0;
  return Math.round(clamp(raw, 0, 1) * 100);
}

function detectWinCondition(deck) {
  if (!deck || !deck.length) return null;
  const winKeywords = ["hog", "royal giant", "balloon", "golem", "miner", "pekka", "lava", "giant", "ram", "battle ram", "bowler", "archer queen", "golden knight", "mighty miner", "monk"];
  for (const c of deck) {
    if ((c.tags || []).includes("win")) return c;
    const name = (c.name || "").toLowerCase();
    for (const kw of winKeywords) if (name.includes(kw)) return c;
  }
  return null;
}

function computeOffenseDefense(deck) {
  let off = 0, def = 0;
  for (const c of deck) {
    if (!c) continue;
    const name = (c.name || "").toLowerCase();
    const tags = c.tags || [];
    const e = c.elixir || 0;
    off += clamp(e / 6, 0, 1) * 0.6;
    def += clamp((4 - Math.abs(e - 3.5)) / 4, 0, 1) * 0.2;
    if (c.type === "spell") { off += 0.45; def += 0.35; }
    if (c.type === "troop") {
      if (tags.includes("tank") || tags.includes("heavy")) { off += 0.65; def += 0.4; }
      if (tags.includes("support")) { off += 0.45; def += 0.15; }
      if (tags.includes("control") || tags.includes("stun")) def += 0.7;
      if (tags.includes("swarm")) { def += 0.5; off += 0.1; }
      if (tags.includes("air")) def += 0.5;
    }
    if (c.type === "building") { def += 0.9; off += 0.05; }
    if (name.includes("rocket") || name.includes("fireball") || name.includes("poison") || name.includes("lightning")) { off += 0.6; def += 0.2; }
    if (name.includes("tombstone") || name.includes("cannon") || name.includes("bomb") || name.includes("inferno") || name.includes("furnace")) def += 0.9;
    if (name.includes("zap") || name.includes("snowball") || name.includes("log")) def += 0.45;
    if (name.includes("fisherman") || name.includes("hunter") || name.includes("executioner") || name.includes("wizard") || name.includes("electro")) { def += 0.6; off += 0.25; }
    if (tags.includes("spawn") || tags.includes("split")) { off += 0.15; def += 0.15; }
  }
  const rawOff = clamp(off / (deck.length * 1.5), 0, 1);
  const rawDef = clamp(def / (deck.length * 1.5), 0, 1);
  return { offense: Math.round(rawOff * 100), defense: Math.round(rawDef * 100) };
}

function computeCycleScore(avgE, sigma) {
  if (!avgE) return 0;
  const score = clamp((4.5 - avgE) / 2.0, 0, 1);
  const stability = clamp(1 - sigma / 2.5, 0, 1);
  return Math.round(score * stability * 100);
}

function ElixirDrop({ value }) {
  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-lg" style={{ background: "linear-gradient(135deg, #ff6ad1, #c43be0)" }}>
      {value ?? "-"}
    </div>
  );
}

function RadarChart({ values }) {
  const axes = ["Offense", "Defense", "Synergy", "Cycle"];
  const vals = [values.offense, values.defense, values.synergy, values.cycle];
  const cx = 140, cy = 130, r = 60;
  const angle = (i) => Math.PI / 2 - (i * (2 * Math.PI)) / axes.length;
  const points = vals.map((v, i) => {
    const rad = (v / 100) * r;
    const x = cx + Math.cos(angle(i)) * rad;
    const y = cy - Math.sin(angle(i)) * rad;
    return `${x},${y}`;
  }).join(" ");
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <div className="flex flex-col items-center gap-6 px-4">
      <svg width="100%" height={300} viewBox="0 0 320 280" preserveAspectRatio="xMidYMid meet" className="mx-auto">
        <defs>
          <linearGradient id="radarGrad" x1="0" x2="1">
            <stop offset="0%" stopColor="#FFB86B" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#FF6B6B" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        {rings.map((f, idx) => <circle key={idx} cx={cx} cy={cy} r={r * f} fill="none" stroke="#334155" strokeWidth="1" />)}
        {Array.from({length: axes.length}).map((_, i) => {
          const x = cx + Math.cos(angle(i)) * r;
          const y = cy - Math.sin(angle(i)) * r;
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#334155" strokeWidth="1" />;
        })}
        <polygon points={points} fill="url(#radarGrad)" fillOpacity="0.85" stroke="#FF9A55" strokeWidth="2.5" />
        {vals.map((v, i) => {
          const rad = (v / 100) * r;
          const x = cx + Math.cos(angle(i)) * rad;
          const y = cy - Math.sin(angle(i)) * rad;
          return <circle key={i} cx={x} cy={y} r="4" fill="#FF9A55" />;
        })}
        <text x={cx} y={20} textAnchor="middle" className="fill-amber-300 text-base font-bold" pointerEvents="none">Offense</text>
        <text x={290} y={cy + 8} textAnchor="start" className="fill-amber-300 text-base font-bold" pointerEvents="none">Defense</text>
        <text x={cx} y={275} textAnchor="middle" className="fill-amber-300 text-base font-bold" pointerEvents="none">Synergy</text>
        <text x={10} y={cy + 8} textAnchor="start" className="fill-amber-300 text-base font-bold" pointerEvents="none">Cycle</text>
      </svg>
    </div>
  );
}

function StatBar({ label, value, accent = "amber" }) {
  const w = `${clamp(value / 100, 0, 1) * 100}%`;
  const cls = accent === "cyan" ? "bg-cyan-400" : "bg-amber-400";
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
        <div className="font-semibold">{label}</div>
        <div className="font-bold text-amber-300">{value}</div>
      </div>
      <div className="w-full bg-slate-700 h-2.5 rounded-full overflow-hidden">
        <div className={`${cls} h-2.5 rounded-full transition-all duration-300`} style={{ width: w }} />
      </div>
    </div>
  );
}

export default function App() {
  const [deckSlots, setDeckSlots] = useState(Array(8).fill(null));
  const [modalOpen, setModalOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState(null);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const filledCount = deckSlots.filter(Boolean).length;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("deck");
    if (code) {
      const ids = code.split(",");
      const loaded = Array(8).fill(null);
      ids.slice(0, 8).forEach((id, i) => {
        const f = cards.find((c) => c.id === id);
        if (f) loaded[i] = f;
      });
      setDeckSlots(loaded);
    }
  }, []);

  const filledDeck = useMemo(() => deckSlots.filter(Boolean), [deckSlots]);
  const avg = useMemo(() => avgElixir(filledDeck), [filledDeck]);
  const sigma = useMemo(() => sigmaElixir(filledDeck, avg), [filledDeck, avg]);
  const synergy = useMemo(() => computeSynergy(filledDeck), [filledDeck]);
  const winCard = useMemo(() => detectWinCondition(filledDeck), [filledDeck]);
  const { offense, defense } = useMemo(() => computeOffenseDefense(filledDeck), [filledDeck]);
  const cycle = useMemo(() => computeCycleScore(avg, sigma), [avg, sigma]);

  const deckScore = useMemo(() => {
    if (filledDeck.length !== 8) return null;
    const winBonus = winCard ? 1 : 0;
    const score = Math.round(0.25 * offense + 0.25 * defense + 0.2 * synergy + 0.15 * cycle + 0.15 * (winBonus ? 100 : 40));
    return clamp(score, 0, 100);
  }, [offense, defense, synergy, cycle, winCard, filledDeck]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(c => (c.name || "").toLowerCase().includes(q) || (c.id || "").toLowerCase().includes(q));
  }, [query]);

  function openModalForSlot(slot = null) {
    setActiveSlot(slot);
    setQuery("");
    setModalOpen(true);
  }

  function addCardToSlot(card) {
    if (deckSlots.find((d) => d && d.id === card.id)) return;
    const ns = [...deckSlots];
    if (activeSlot !== null) ns[activeSlot] = card;
    else {
      const idx = ns.findIndex((s) => s === null);
      if (idx === -1) return;
      ns[idx] = card;
    }
    setDeckSlots(ns);
    const newCount = ns.filter(Boolean).length;
    if (newCount === 8) {
      setModalOpen(false);
      setActiveSlot(null);
    }
  }

  function removeAt(i) {
    const ns = [...deckSlots];
    ns[i] = null;
    setDeckSlots(ns);
  }

  function toggleSlot(i) {
    if (deckSlots[i]) removeAt(i);
    else openModalForSlot(i);
  }

  function clearAll() {
    setDeckSlots(Array(8).fill(null));
    setQuery("");
    setModalOpen(false);
  }

  function shareLink() {
    const code = deckSlots.map((c) => (c ? c.id : "")).join(",");
    const url = `${window.location.origin}${window.location.pathname}?deck=${encodeURIComponent(code)}`;
    if (navigator.share) {
      navigator.share({ title: "DeckScore — my deck", text: "Check my Clash Royale deck", url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      });
    }
  }

  const isSelected = (c) => deckSlots.find((s) => s && s.id === c.id);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-slate-100 p-4">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-amber-400 to-amber-300 bg-clip-text text-transparent">DeckScore</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => openModalForSlot(null)} disabled={filledCount === 8} className={`px-4 py-2 rounded-lg flex items-center gap-2 font-semibold transition-all ${filledCount === 8 ? "bg-slate-700 text-slate-400 cursor-not-allowed" : "bg-cyan-500 text-white hover:bg-cyan-600 shadow-lg hover:shadow-xl"}`}>
              <Plus size={16} />
              <span className="hidden sm:inline">{filledCount}/8</span>
            </button>
            <button onClick={clearAll} className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg transition-all">
              <Trash2 size={16} />
            </button>
          </div>
        </header>

        <section className="mb-6">
          <div className="text-sm text-slate-400 mb-3 font-semibold">Your Deck ({filledCount}/8)</div>
          <div className="grid grid-cols-4 gap-3">
            {deckSlots.map((c, i) => (
              <div key={i} onClick={() => toggleSlot(i)} className={`relative rounded-xl overflow-hidden cursor-pointer transition-all flex flex-col items-center justify-center min-h-40 ${c ? "bg-gradient-to-br from-amber-600/30 to-amber-900/30 border-2 border-amber-400 shadow-lg" : "bg-slate-800/50 border-2 border-slate-700 hover:border-slate-600"}`}>
                {c ? (
                  <>
                    <div className="flex flex-col items-center justify-center gap-2 w-full flex-1 px-2">
                      <h3 className="font-bold text-xs text-center text-white leading-tight line-clamp-3">{c.name}</h3>
                      <ElixirDrop value={c.elixir} />
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); removeAt(i); }} className="w-full bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-2 transition-colors">
                      Remove
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                    <div className="text-slate-400 text-sm">Empty</div>
                    <div className="text-cyan-400 font-bold text-2xl">+</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <div className="mb-6">
          <button onClick={() => openModalForSlot(null)} className="w-full bg-slate-800/60 hover:bg-slate-800 border-2 border-slate-700 hover:border-slate-600 rounded-lg px-4 py-3 flex items-center gap-3 transition-all">
            <Search size={18} className="text-slate-400" />
            <span className="text-slate-300 font-semibold">Search Cards...</span>
          </button>
        </div>

        <section className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl p-6 shadow-2xl border border-slate-700">
          <div className="mb-8">
            <RadarChart values={{ offense, defense, synergy, cycle }} />
          </div>

          <div className="text-center mb-6">
            <div className="text-sm text-slate-400 font-semibold mb-1">Overall DeckScore</div>
            <div className="text-5xl font-black bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              {deckScore !== null ? deckScore : "--"}
            </div>
            <div className="text-xs text-slate-400 mt-2">
              Avg Elixir: <span className="font-bold text-amber-400">{filledDeck.length ? avg.toFixed(2) : "--"}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-slate-900/50 rounded-lg p-3 text-center border border-slate-700">
              <div className="text-xs text-slate-400 font-semibold mb-1">Win Condition</div>
              <div className="text-sm font-bold text-cyan-300 line-clamp-2 break-words">{winCard ? winCard.name : "None"}</div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 text-center border border-slate-700">
              <div className="text-xs text-slate-400 font-semibold mb-1">Cycle Speed</div>
              <div className="text-sm font-bold text-cyan-300">{filledDeck.length ? (cycle >= 66 ? "🚀 Fast" : cycle >= 40 ? "⚡ Normal" : "🐢 Slow") : "--"}</div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 text-center border border-slate-700">
              <div className="text-xs text-slate-400 font-semibold mb-1">Synergy</div>
              <div className="text-sm font-bold text-cyan-300">{synergy}%</div>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <StatBar label="Offense" value={offense} accent="amber" />
            <StatBar label="Defense" value={defense} accent="cyan" />
          </div>

          <button onClick={shareLink} className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 font-bold shadow-lg hover:shadow-xl transition-all">
            <Share2 size={16} />
            Share Deck
          </button>
          {copied && (
            <div className="mt-2 text-center text-sm text-green-400 font-semibold">
              ✓ Link copied to clipboard!
            </div>
          )}
        </section>
      </div>

      <AnimatePresence mode="wait">
        {modalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => { setModalOpen(false); setActiveSlot(null); }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed inset-x-0 bottom-0 top-20 z-50"
            >
              <div className="max-w-2xl mx-auto h-full bg-gradient-to-b from-slate-900 to-slate-800 rounded-t-3xl shadow-2xl p-6 overflow-hidden flex flex-col border-t-2 border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold">Search Cards</h2>
                    <p className="text-xs text-slate-400">{filledCount}/8 selected</p>
                  </div>
                  <button onClick={() => { setModalOpen(false); setActiveSlot(null); }} className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors">
                    <X size={18} />
                  </button>
                </div>

                <div className="mb-4">
                  <div className="relative">
                    <input value={query} onChange={(e) => setQuery(e.target.value)} autoFocus placeholder="Type card name or ID..." className="w-full bg-slate-800 border-2 border-slate-700 focus:border-cyan-500 rounded-lg px-4 py-3 placeholder-slate-500 focus:outline-none transition-colors font-semibold" />
                    <Search size={18} className="absolute right-3 top-3 text-slate-400" />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                  {filtered.length > 0 ? (
                    filtered.map((c) => {
                      const selected = isSelected(c);
                      return (
                        <button key={c.id} disabled={selected} onClick={() => addCardToSlot(c)} className={`w-full p-4 rounded-lg flex items-center gap-3 text-left transition-all ${selected ? "bg-amber-900/30 border-2 border-amber-400 cursor-default" : "bg-slate-800/60 hover:bg-slate-800 border-2 border-slate-700 hover:border-slate-600"}`}>
                          <ElixirDrop value={c.elixir} />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-white">{c.name}</div>
                            <div className="text-xs text-slate-400">{c.type} • {(c.tags || []).slice(0, 2).join(", ")}</div>
                          </div>
                          {selected ? <span className="text-amber-300 font-bold text-sm">✓</span> : <span className="text-slate-400 text-xs font-semibold">Add</span>}
                        </button>
                      );
                    })
                  ) : (
                    <div className="text-center text-slate-400 py-8">No cards found</div>
                  )}
                </div>

                <div className="mt-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                  <p className="text-xs text-slate-400 text-center">Select 8 cards to complete your deck</p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
