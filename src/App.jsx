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

/* ---------- UI building blocks ---------- */
function ElixirDrop({ value }) {
  // stylized elixir circle with gradient
  return (
    <div style={{ width: 34, height: 34 }} className="flex items-center justify-center rounded-full" aria-hidden>
      <div style={{ background: "linear-gradient(180deg,#69b3ff,#2a8bff)" }} className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shadow-sm border border-white/10">
        {value ?? "-"}
      </div>
    </div>
  );
}

/* RadarChart (SVG) */
function RadarChart({ values, size = 160 }) {
  const axes = ["Offense", "Defense", "Synergy", "Cycle"];
  const vals = [values.offense, values.defense, values.synergy, values.cycle];
  const cx = size / 2, cy = size / 2, r = size * 0.36;
  const angle = i => (Math.PI / 2) - (i * (2 * Math.PI / axes.length));
  const points = vals.map((v,i)=> {
    const rad = (v/100)*r;
    const x = cx + Math.cos(angle(i))*rad;
    const y = cy - Math.sin(angle(i))*rad;
    return `${x},${y}`;
  }).join(" ");

  const rings = [0.25, 0.5, 0.75, 1];
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
        <defs>
          <linearGradient id="rf" x1="0" x2="1">
            <stop offset="0%" stopColor="#FFB86B" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#FF6B6B" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        {rings.map((f, idx) => <circle key={idx} cx={cx} cy={cy} r={r * f} fill="none" stroke="#263241" strokeWidth="1" />)}
        {Array.from({length: axes.length}).map((_, i) => {
          const x = cx + Math.cos(angle(i)) * r;
          const y = cy - Math.sin(angle(i)) * r;
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#263241" strokeWidth="1" />;
        })}

        <polygon points={points} fill="url(#rf)" fillOpacity="0.95" stroke="#FF9A55" strokeWidth="2" />
        {vals.map((v,i) => {
          const rad = (v/100)*r; const x = cx + Math.cos(angle(i))*rad; const y = cy - Math.sin(angle(i))*rad;
          return <circle key={i} cx={x} cy={y} r={3} fill="#FF9A55" />;
        })}
      </svg>

      {/* legend, centered and spaced so it doesn't overlap */}
      <div className="mt-3 flex gap-4 text-xs text-slate-400 justify-center w-full">
        <div className="text-center"><div className="text-slate-300 text-[11px]">Offense</div></div>
        <div className="text-center"><div className="text-slate-300 text-[11px]">Defense</div></div>
        <div className="text-center"><div className="text-slate-300 text-[11px]">Synergy</div></div>
        <div className="text-center"><div className="text-slate-300 text-[11px]">Cycle</div></div>
      </div>
    </div>
  );
}

/* small stat bar with numeric */
function StatBar({ label, value, accent="amber" }) {
  const w = `${clamp(value/100,0,1)*100}%`;
  const cls = accent === "cyan" ? "bg-cyan-400" : "bg-amber-400";
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-300">
        <div className="capitalize">{label}</div>
        <div className="text-xs font-semibold">{value}/100</div>
      </div>
      <div className="w-full bg-slate-900 h-2 rounded overflow-hidden mt-1">
        <div className={`${cls} h-2`} style={{ width: w }} />
      </div>
    </div>
  );
}

/* ---------- MAIN APP ---------- */
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
      ids.slice(0,8).forEach((id,i) => { const f = cards.find(c=>c.id===id); if (f) loaded[i]=f; });
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
    const score = Math.round(0.25 * offense + 0.25 * defense + 0.20 * synergy + 0.15 * cycle + 0.15 * (winBonus ? 100 : 40));
    return clamp(score, 0, 100);
  }, [offense, defense, synergy, cycle, winCard, filledDeck]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(c => (c.name||"").toLowerCase().includes(q) || (c.id||"").toLowerCase().includes(q));
  }, [query]);

  /* actions */
  function openModalForSlot(slot = null) {
    setActiveSlot(slot);
    setQuery("");
    setModalOpen(true);
  }

  function addCardToSlot(card) {
    if (deckSlots.find(d => d && d.id === card.id)) return;
    const ns = [...deckSlots];
    if (activeSlot !== null) ns[activeSlot] = card;
    else {
      const idx = ns.findIndex(s => s === null);
      if (idx === -1) return;
      ns[idx] = card;
    }
    setDeckSlots(ns);

    // if that made the deck complete (8), close modal immediately
    const newCount = ns.filter(Boolean).length;
    if (newCount === 8) {
      setModalOpen(false);
      setActiveSlot(null);
    }
  }

  function removeAt(i) { const ns = [...deckSlots]; ns[i] = null; setDeckSlots(ns); }
  function toggleSlot(i) { if (deckSlots[i]) removeAt(i); else openModalForSlot(i); }
  function clearAll() { setDeckSlots(Array(8).fill(null)); setQuery(""); setModalOpen(false); }
  function shareLink() {
    const code = deckSlots.map(c => c ? c.id : "").join(",");
    const url = `${window.location.origin}${window.location.pathname}?deck=${encodeURIComponent(code)}`;
    if (navigator.share) {
      navigator.share({ title: "DeckScore — my deck", text: "Check my Clash Royale deck", url }).catch(()=>{});
    } else {
      navigator.clipboard.writeText(url).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),1400); });
    }
  }

  const isSelected = c => deckSlots.find(s => s && s.id === c.id);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-slate-100 p-4">
      <div className="max-w-xl mx-auto">
        {/* header */}
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-extrabold tracking-tight">DeckScore</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => openModalForSlot(null)} disabled={filledCount === 8} className={`px-3 py-2 rounded-md flex items-center gap-2 ${filledCount === 8 ? "bg-slate-700 text-slate-400" : "bg-cyan-500 text-slate-900"}`}><Plus size={14}/> {filledCount === 8 ? "Deck complete" : "Select 8 cards"}</button>
            <button onClick={clearAll} className="bg-slate-700 px-3 py-2 rounded-md"><Trash2 size={14}/></button>
          </div>
        </header>

        {/* export root */}
        <div id="deck-export-root" className="rounded-lg">
          {/* deck 2x4 */}
          <section className="mb-4">
            <div className="text-xs text-slate-400 mb-2">Your deck ({filledCount}/8)</div>

            <div className="grid grid-cols-4 gap-2 mb-2">
              {deckSlots.slice(0,4).map((c,i)=>(
                <div key={i} onClick={()=>toggleSlot(i)} className={`w-full h-28 rounded-lg p-2 flex flex-col justify-between text-sm cursor-pointer ${c ? "bg-gradient-to-br from-amber-900/10 to-amber-700/10 border border-amber-300 shadow-md" : "bg-slate-800/40 border border-slate-700"}`}>
                  {c ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="font-semibold leading-tight" style={{lineHeight:'1.05'}}>{c.name}</div>
                        <ElixirDrop value={c.elixir} />
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <div className="text-xs text-slate-400">Type: {c.type}</div>
                        <button onClick={(e)=>{ e.stopPropagation(); removeAt(i); }} className="text-red-400 text-xs">Remove</button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 text-xs"><div className="mb-1">Empty</div><div className="text-cyan-300 font-semibold">Tap to add</div></div>
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-2">
              {deckSlots.slice(4,8).map((c,i)=>{ const idx = i+4; return (
                <div key={idx} onClick={()=>toggleSlot(idx)} className={`w-full h-28 rounded-lg p-2 flex flex-col justify-between text-sm cursor-pointer ${c ? "bg-gradient-to-br from-amber-900/10 to-amber-700/10 border border-amber-300 shadow-md" : "bg-slate-800/40 border border-slate-700"}`}>
                  {c ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="font-semibold leading-tight" style={{lineHeight:'1.05'}}>{c.name}</div>
                        <ElixirDrop value={c.elixir} />
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <div className="text-xs text-slate-400">Type: {c.type}</div>
                        <button onClick={(e)=>{ e.stopPropagation(); removeAt(idx); }} className="text-red-400 text-xs">Remove</button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 text-xs"><div className="mb-1">Empty</div><div className="text-cyan-300 font-semibold">Tap to add</div></div>
                  )}
                </div>
              )})}
            </div>
          </section>

          {/* search CTA */}
          <div className="mb-4">
            <button onClick={()=>openModalForSlot(null)} className="w-full bg-slate-800/40 border border-slate-700 rounded-md px-3 py-2 flex items-center gap-3"><Search size={16} className="text-slate-400"/> <span className="text-slate-400">Search cards...</span></button>
          </div>

          {/* radar + centered details */}
          <section className="bg-slate-800/40 rounded-2xl p-4 shadow-lg mb-8">
            <div className="flex flex-col items-center">
              <div className="w-40 h-40">
                <RadarChart values={{ offense, defense, synergy, cycle }} size={160} />
              </div>

              {/* centered DeckScore & Avg Elixir */}
              <div className="mt-4 text-center">
                <div className="text-xs text-slate-400">DeckScore</div>
                <div className="text-4xl font-extrabold text-amber-300 mt-1">{deckScore !== null ? deckScore : "--"}</div>
                <div className="mt-2 text-xs text-slate-400">Avg Elixir — <span className="font-semibold text-amber-300">{filledDeck.length ? avg.toFixed(2) : "--"}</span></div>
              </div>

              {/* 3 boxes centered */}
              <div className="mt-4 w-full grid grid-cols-3 gap-2">
                <div className="p-3 bg-slate-900/30 rounded text-center">
                  <div className="text-xs text-slate-400">Win Condition</div>
                  <div className="mt-1 font-medium">{winCard ? winCard.name : "None detected"}</div>
                </div>
                <div className="p-3 bg-slate-900/30 rounded text-center">
                  <div className="text-xs text-slate-400">Cycle</div>
                  <div className="mt-1 font-medium">{filledDeck.length ? (cycle >= 66 ? "Fast" : cycle >= 40 ? "Normal" : "Slow") : "--"}</div>
                </div>
                <div className="p-3 bg-slate-900/30 rounded text-center">
                  <div className="text-xs text-slate-400">Synergy</div>
                  <div className="mt-1 font-medium">{synergy}%</div>
                </div>
              </div>

              {/* offense/defense bars (full width under boxes) */}
              <div className="mt-4 w-full space-y-3">
                <StatBar label="Offense" value={offense} />
                <StatBar label="Defense" value={defense} accent="cyan" />
              </div>

              {/* share only */}
              <div className="mt-4 w-full">
                <button onClick={shareLink} className="w-full bg-cyan-500 text-slate-900 px-3 py-2 rounded-md flex items-center justify-center gap-2"><Share2 size={14}/> Share</button>
              </div>
              <div className="mt-2 text-xs text-slate-400">{copied && <span>Link copied to clipboard</span>}</div>
            </div>
          </section>
        </div>
      </div>

      {/* modal */}
      <AnimatePresence>
        {modalOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="fixed inset-0 bg-black z-40" onClick={() => { setModalOpen(false); setActiveSlot(null); }} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 320, damping: 30 }} className="fixed inset-x-0 bottom-0 top-12 z-50">
              <div className="max-w-xl mx-auto h-full bg-slate-900 rounded-t-2xl shadow-xl p-4 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-1.5 bg-slate-700 rounded" />
                    <div className="text-lg font-semibold">Search cards</div>
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

                <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                  {filtered.map(c => {
                    const selected = isSelected(c);
                    return (
                      <motion.button key={c.id} whileTap={{ scale: selected ? 1 : 0.97 }} disabled={selected} onClick={() => addCardToSlot(c)} className={`w-full p-3 rounded-md flex items-center gap-3 text-left ${selected ? "bg-amber-900/10 border border-amber-400" : "bg-slate-800/40 hover:bg-slate-800/30"}`}>
                        <ElixirDrop value={c.elixir} />
                        <div className="min-w-0">
                          <div className="font-medium truncate">{c.name}</div>
                          <div className="text-xs text-slate-400 truncate">{c.type} • {(c.tags||[]).slice(0,3).join(", ")}</div>
                        </div>
                        <div className="ml-auto text-xs text-slate-300">{selected ? <span className="text-amber-300">Selected</span> : "Tap to add"}</div>
                      </motion.button>
                    );
                  })}
                </div>

                <div className="mt-3 text-xs text-slate-400 text-center">Pick cards until your deck has 8 cards. Tap a slot to place the next card there.</div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
