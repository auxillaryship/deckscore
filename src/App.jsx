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
    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-lg border-2 border-cyan-300" style={{ background: "linear-gradient(135deg, #ff1493, #c71585)" }}>
      {value ?? "-"}
    </div>
  );
}

function RadarChart({ values }) {
  const axes = ["Offense", "Defense", "Synergy", "Cycle"];
  const vals = [values.offense, values.defense, values.synergy, values.cycle];
  const cx = 160, cy = 150, r = 60;
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
      <svg width="100%" height={300} viewBox="0 0 340 300" preserveAspectRatio="xMidYMid meet" className="mx-auto">
        <defs>
          <linearGradient id="radarGrad" x1="0" x2="1">
            <stop offset="0%" stopColor="#00ffff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ff1493" stopOpacity="0.8" />
          </linearGradient>
        </defs>
        {rings.map((f, idx) => <circle key={idx} cx={cx} cy={cy} r={r * f} fill="none" stroke="#4a5568" strokeWidth="1" />)}
        {Array.from({length: axes.length}).map((_, i) => {
          const x = cx + Math.cos(angle(i)) * r;
          const y = cy - Math.sin(angle(i)) * r;
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#4a5568" strokeWidth="1" />;
        })}
        <polygon points={points} fill="url(#radarGrad)" fillOpacity="0.85" stroke="#00ffff" strokeWidth="2.5" />
        {vals.map((v, i) => {
          const rad = (v / 100) * r;
          const x = cx + Math.cos(angle(i)) * rad;
          const y = cy - Math.sin(angle(i)) * rad;
          return <circle key={i} cx={x} cy={y} r="4" fill="#ff1493" />;
        })}
        <text x={cx} y={35} textAnchor="middle" className="fill-cyan-300 text-base font-bold" pointerEvents="none">Offense</text>
<text x={290} y={cy + 8} textAnchor="start" className="fill-amber-300 text-base font-bold" pointerEvents="none">Defense</text>
        <text x={cx} y={285} textAnchor="middle" className="fill-cyan-300 text-base font-bold" pointerEvents="none">Synergy</text>
        <text x={10} y={cy + 8} textAnchor="start" className="fill-cyan-300 text-base font-bold" pointerEvents="none">Cycle</text>
      </svg>
    </div>
  );
}

function StatBar({ label, value, accent = "cyan" }) {
  const w = `${clamp(value / 100, 0, 1) * 100}%`;
  const cls = accent === "pink" ? "bg-pink-500" : "bg-cyan-400";
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
        <div className="font-semibold text-white">{label}</div>
        <div className="font-bold text-cyan-300">{value}</div>
      </div>
      <div className="w-full bg-gray-700 h-2.5 rounded-full overflow-hidden border border-cyan-500/50">
        <div className={`${cls} h-2.5 rounded-full transition-all duration-300 shadow-lg`} style={{ width: w }} />
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
    <div className="min-h-screen bg-gradient-to-b from-blue-950 via-blue-900 to-blue-950 text-slate-100 p-4">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-300 to-pink-400 bg-clip-text text-transparent">DeckScore</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => openModalForSlot(null)} disabled={filledCount === 8} className={`px-4 py-2 rounded-lg flex items-center gap-2 font-semibold transition-all border-2 ${filledCount === 8 ? "bg-gray-700 text-gray-400 border-gray-600 cursor-not-allowed" : "bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-cyan-300 hover:shadow-lg hover:shadow-cyan-500/50"}`}>
              <Plus size={16} />
              <span className="hidden sm:inline">{filledCount}/8</span>
            </button>
            <button onClick={clearAll} className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg transition-all border border-gray-600">
              <Trash2 size={16} />
            </button>
          </div>
        </header>

        <section className="mb-6">
          <div className="text-sm text-cyan-300 mb-3 font-semibold">Your Deck ({filledCount}/8)</div>
          <div className="grid grid-cols-4 gap-3">
            {deckSlots.map((c, i) => (
              <div key={i} onClick={() => toggleSlot(i)} className={`relative rounded-xl overflow-hidden cursor-pointer transition-all flex flex-col items-center justify-center min-h-40 border-2 ${c ? "bg-gradient-to-br from-purple-900/60 to-blue-900/60 border-cyan-400 shadow-lg shadow-cyan-500/30" : "bg-gray-800/50 border-gray-700 hover:border-cyan-500 hover:shadow-md hover:shadow-cyan-500/20"}`}>
                {c ? (
                  <>
                    <div className="flex flex-col items-center justify-center gap-2 w-full flex-1 px-2">
                      <h3 className="font-bold text-xs text-center text-white leading-tight line-clamp-3">{c.name}</h3>
                      <ElixirDrop value={c.elixir} />
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); removeAt(i); }} className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white text-xs font-bold py-2 transition-all border-t border-orange-400/50">
                      Remove
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                    <div className="text-gray-400 text-sm">Empty</div>
                    <div className="text-cyan-300 font-bold text-2xl">+</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <div className="mb-6">
          <button onClick={() => openModalForSlot(null)} className="w-full bg-gray-800 hover:bg-gray-700 border-2 border-cyan-500 hover:border-cyan-300 rounded-lg px-4 py-3 flex items-center gap-3 transition-all shadow-lg shadow-cyan-500/20">
            <Search size={18} className="text-cyan-400" />
            <span className="text-cyan-300 font-semibold">Search Cards...</span>
          </button>
        </div>

        <section className="bg-gradient-to-br from-gray-900 to-blue-900 rounded-2xl p-6 shadow-2xl border-2 border-cyan-500/50">
          <div className="mb-8">
            <RadarChart values={{ offense, defense, synergy, cycle }} />
          </div>

          <div className="text-center mb-8 p-4 bg-gradient-to-r from-blue-900/60 to-purple-900/60 rounded-xl border-2 border-cyan-400 shadow-lg shadow-cyan-500/20">
            <div className="text-xs text-cyan-300 font-bold uppercase tracking-wider mb-2">Average Elixir</div>
            <div className="flex items-center justify-center gap-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center font-black text-2xl text-white shadow-lg border-2 border-cyan-300" style={{ background: "linear-gradient(135deg, #00ffff, #0099ff)" }}>
                {filledDeck.length ? avg.toFixed(1) : "--"}
              </div>
              <div>
                <div className="text-3xl font-black bg-gradient-to-r from-cyan-300 to-pink-400 bg-clip-text text-transparent">
                  {deckScore !== null ? deckScore : "--"}
                </div>
                <div className="text-xs text-cyan-300 font-semibold">DeckScore</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-gray-800/80 rounded-lg p-3 text-center border-2 border-pink-500/50 shadow-md">
              <div className="text-xs text-pink-300 font-bold mb-1">Win Condition</div>
              <div className="text-sm font-bold text-cyan-300 line-clamp-2 break-words">{winCard ? winCard.name : "None"}</div>
            </div>
            <div className="bg-gray-800/80 rounded-lg p-3 text-center border-2 border-cyan-500/50 shadow-md">
              <div className="text-xs text-cyan-300 font-bold mb-1">Cycle Speed</div>
              <div className="text-sm font-bold text-cyan-300">{filledDeck.length ? (cycle >= 66 ? "🚀 Fast" : cycle >= 40 ? "⚡ Normal" : "🐢 Slow") : "--"}</div>
            </div>
            <div className="bg-gray-800/80 rounded-lg p-3 text-center border-2 border-pink-500/50 shadow-md">
              <div className="text-xs text-pink-300 font-bold mb-1">Synergy</div>
              <div className="text-sm font-bold text-cyan-300">{synergy}%</div>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <StatBar label="Offense" value={offense} accent="cyan" />
            <StatBar label="Defense" value={defense} accent="cyan" />
          </div>

          <button onClick={shareLink} className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 font-bold shadow-lg shadow-cyan-500/50 border border-cyan-400 hover:shadow-xl">
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
              <div className="max-w-2xl mx-auto h-full bg-gradient-to-b from-blue-950 to-blue-900 rounded-t-3xl shadow-2xl p-6 overflow-hidden flex flex-col border-t-2 border-cyan-500">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-cyan-300">Search Cards</h2>
                    <p className="text-xs text-cyan-400">{filledCount}/8 selected</p>
                  </div>
                  <button onClick={() => { setModalOpen(false); setActiveSlot(null); }} className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 border border-gray-600 transition-colors">
                    <X size={18} />
                  </button>
                </div>

                <div className="mb-4">
                  <div className="relative">
                    <input value={query} onChange={(e) => setQuery(e.target.value)} autoFocus placeholder="Type card name or ID..." className="w-full bg-gray-800 border-2 border-cyan-500 focus:border-cyan-300 rounded-lg px-4 py-3 placeholder-gray-500 focus:outline-none transition-colors font-semibold text-white" />
                    <Search size={18} className="absolute right-3 top-3 text-cyan-400" />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                  {filtered.length > 0 ? (
                    filtered.map((c) => {
                      const selected = isSelected(c);
                      return (
                        <button key={c.id} disabled={selected} onClick={() => addCardToSlot(c)} className={`w-full p-4 rounded-lg flex items-center gap-3 text-left transition-all border-2 ${selected ? "bg-purple-900/60 border-cyan-400 cursor-default shadow-md shadow-cyan-500/30" : "bg-gray-800/60 hover:bg-gray-800 border-gray-700 hover:border-cyan-500"}`}>
                          <ElixirDrop value={c.elixir} />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-white">{c.name}</div>
                            <div className="text-xs text-cyan-400">{c.type} • {(c.tags || []).slice(0, 2).join(", ")}</div>
                          </div>
                          {selected ? <span className="text-cyan-300 font-bold text-sm">✓</span> : <span className="text-gray-400 text-xs font-semibold">Add</span>}
                        </button>
                      );
                    })
                  ) : (
                    <div className="text-center text-gray-400 py-8">No cards found</div>
                  )}
                </div>

                <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-cyan-500/50">
                  <p className="text-xs text-cyan-400 text-center">Select 8 cards to complete your deck</p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

