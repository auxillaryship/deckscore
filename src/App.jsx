// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Plus, Trash2, Download, Link2, Share2 } from "lucide-react";
import cards from "./cards.json";

/* ---------- Helpers & Heuristic ---------- */
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
function calcElixirAvg(deck) { return deck.reduce((s, c) => s + (c.elixir || 0), 0) / deck.length; }
function calcSigma(deck, avg) { return Math.sqrt(deck.reduce((s, c) => s + Math.pow((c.elixir || 0) - avg, 2), 0) / deck.length); }
function getSynergy(a, b) {
  if (!a || !b) return 0;
  if (a.tags?.includes("evolution") || b.tags?.includes("evolution")) return 0.18;
  if (a.type === "hero" || b.type === "hero") return 0.22;
  const shared = (a.tags || []).filter((t) => (b.tags || []).includes(t));
  return Math.min(0.35, shared.length * 0.12);
}
function computeHeuristic(deck) {
  if (!deck || deck.length !== 8) return null;
  const avg = calcElixirAvg(deck), sigma = calcSigma(deck, avg);
  const roles = { win: 0, spell: 0, air: 0, swarm: 0, support: 0, building: 0 };
  deck.forEach((c) => (c.tags || []).forEach((t) => { if (roles[t] !== undefined) roles[t] += 1; if (t === "spell") roles.spell += 1; }));
  const win_ok = deck.some((c) => c.tags?.includes("win")) ? 1 : 0;
  const spell_ok = Math.min(1, roles.spell / 2), air_ok = Math.min(1, roles.air / 1), swarm_ok = Math.min(1, roles.swarm / 1);
  const elixir_ok = clamp(1 - Math.abs(avg - 3.8) / 3.8), balance_ok = 1 - clamp(sigma / 3);
  let synergy = 0, pairs = 0;
  for (let i = 0; i < deck.length; i++) for (let j = i + 1; j < deck.length; j++) { synergy += getSynergy(deck[i], deck[j]); pairs++; }
  const synergy_score = pairs ? clamp((synergy / pairs + 1) / 2) : 0.5;
  const score = Math.round(30 * win_ok + 15 * spell_ok + 10 * air_ok + 10 * swarm_ok + 15 * elixir_ok + 10 * balance_ok + 10 * synergy_score);
  return { final: score, breakdown: { win: Math.round(win_ok * 100), spell: Math.round(spell_ok * 100), air: Math.round(air_ok * 100), swarm: Math.round(swarm_ok * 100), elixir: Math.round(elixir_ok * 100), synergy: Math.round(synergy_score * 100) }, avgElixir: +avg.toFixed(2), sigma: +sigma.toFixed(2) };
}

/* ---------- Small UI helpers ---------- */
function ElixirBadge({ value }) {
  return (
    <div className="w-10 h-10 rounded-md bg-amber-600/10 border border-amber-500/20 flex flex-col items-center justify-center text-xs text-amber-300 font-semibold">
      <div>{value ?? "-"}</div>
    </div>
  );
}

/* ---------- Main component ---------- */
export default function App() {
  const [deckSlots, setDeckSlots] = useState(Array(8).fill(null));
  const [modalOpen, setModalOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [copied, setCopied] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState(null);

  const filledCount = deckSlots.filter(Boolean).length;

  useEffect(() => {
    // load from ?deck=...
    const params = new URLSearchParams(window.location.search);
    const code = params.get("deck");
    if (code) {
      const ids = code.split(",");
      const loaded = Array(8).fill(null);
      ids.slice(0, 8).forEach((id, i) => { const f = cards.find((c) => c.id === id); if (f) loaded[i] = f; });
      setDeckSlots(loaded);
    }
  }, []);

  useEffect(() => {
    const filled = deckSlots.filter(Boolean);
    if (filled.length === 8) {
      const r = computeHeuristic(filled);
      setResult(r);
      // suggestions
      const base = r.final; const sug = [];
      for (let i = 0; i < filled.length; i++) {
        for (const candidate of cards) {
          if (filled.find((d) => d.id === candidate.id)) continue;
          const test = filled.slice(); test[i] = candidate;
          const s = computeHeuristic(test);
          if (s && s.final - base >= 8) sug.push({ slot: i, from: filled[i], to: candidate, delta: s.final - base, score: s.final });
        }
      }
      sug.sort((a, b) => b.delta - a.delta);
      setSuggestions(sug.slice(0, 3));
      // close modal if open
      setModalOpen(false);
      setActiveSlot(null);
    } else {
      setResult(null);
      setSuggestions([]);
    }
  }, [deckSlots]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  }, [query]);

  function openModalForSlot(slot = null) { setActiveSlot(slot); setQuery(""); setModalOpen(true); }
  function addCardToSlot(card) {
    if (deckSlots.find((d) => d?.id === card.id)) return;
    const ns = [...deckSlots];
    if (activeSlot !== null) ns[activeSlot] = card;
    else { const idx = ns.findIndex((x) => x === null); if (idx === -1) return; ns[idx] = card; }
    setDeckSlots(ns);
  }
  function removeAt(i) { const ns = [...deckSlots]; ns[i] = null; setDeckSlots(ns); }
  function toggleSlot(i) { if (deckSlots[i]) { removeAt(i); } else openModalForSlot(i); }
  function clearAll() { setDeckSlots(Array(8).fill(null)); setResult(null); setSuggestions([]); }
  function applySuggestion(s) { if (!s || typeof s.slot !== "number") return; const ns = [...deckSlots]; ns[s.slot] = s.to; setDeckSlots(ns); }

  function shareLink() {
    const code = deckSlots.map((c) => (c ? c.id : "")).join(",");
    const url = `${window.location.origin}${window.location.pathname}?deck=${encodeURIComponent(code)}`;
    if (navigator.share) {
      navigator.share({ title: "DeckScore — my deck", text: "Check my Clash Royale deck rating", url }).catch(()=>{});
    } else {
      navigator.clipboard.writeText(url).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),1500); });
    }
  }

  // Export: close modal (if open), wait for UI to settle, then capture
  async function downloadDeckImage() {
    setDownloadMsg("Preparing image...");
    try {
      // ensure modal/backdrop hidden
      if (modalOpen) {
        setModalOpen(false);
        setActiveSlot(null);
        // wait for UI to settle (animation)
        await new Promise((r) => setTimeout(r, 300));
      }
      // dynamic load html2canvas if not present
      if (!window.html2canvas) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
          s.onload = res;
          s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      const root = document.getElementById("deck-export-root");
      if (!root) throw new Error("Export element not found");
      const canvas = await window.html2canvas(root, { scale: 2, useCORS: true });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a"); a.href = url; a.download = "deckscore.png"; a.click();
      setDownloadMsg("Downloaded!");
      setTimeout(()=>setDownloadMsg(null), 1500);
    } catch (err) {
      console.error(err);
      setDownloadMsg("Download failed");
      setTimeout(()=>setDownloadMsg(null), 2000);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-slate-100 p-4">
      <div className="max-w-xl mx-auto">
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-extrabold tracking-tight">DeckScore</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => openModalForSlot(null)} disabled={filledCount === 8} className={`px-3 py-2 rounded-md flex items-center gap-2 ${filledCount === 8 ? "bg-slate-700 text-slate-400" : "bg-cyan-500 text-slate-900"}`}><Plus size={14}/> {filledCount === 8 ? "Deck complete" : "Select 8 cards"}</button>
            <button onClick={clearAll} className="bg-slate-700 px-3 py-2 rounded-md"><Trash2 size={14}/></button>
          </div>
        </header>

        <div id="deck-export-root" className="rounded-lg">
          {/* deck */}
          <section className="mb-4">
            <div className="text-xs text-slate-400 mb-2">Your deck ({filledCount}/8)</div>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {deckSlots.slice(0,4).map((c,i)=>(
                <div key={i} onClick={()=>toggleSlot(i)} className={`w-full h-28 rounded-lg p-2 flex flex-col justify-between text-sm cursor-pointer ${c ? "bg-gradient-to-br from-amber-900/10 to-amber-700/10 border border-amber-300 shadow-md" : "bg-slate-800/40 border border-slate-700"}`}>
                  {c ? (
                    <>
                      <div className="font-semibold leading-tight" style={{lineHeight:'1.05'}}>{c.name}</div>
                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <div className="text-amber-300 font-semibold">{c.elixir}</div>
                        <button onClick={(e)=>{ e.stopPropagation(); removeAt(i); }} className="text-red-400 text-xs">Remove</button>
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

            <div className="grid grid-cols-4 gap-2">
              {deckSlots.slice(4,8).map((c,i)=>{ const idx = i+4; return (
                <div key={idx} onClick={()=>toggleSlot(idx)} className={`w-full h-28 rounded-lg p-2 flex flex-col justify-between text-sm cursor-pointer ${c ? "bg-gradient-to-br from-amber-900/10 to-amber-700/10 border border-amber-300 shadow-md" : "bg-slate-800/40 border border-slate-700"}`}>
                  {c ? (
                    <>
                      <div className="font-semibold leading-tight" style={{lineHeight:'1.05'}}>{c.name}</div>
                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <div className="text-amber-300 font-semibold">{c.elixir}</div>
                        <button onClick={(e)=>{ e.stopPropagation(); removeAt(idx); }} className="text-red-400 text-xs">Remove</button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 text-xs">
                      <div className="mb-1">Empty</div>
                      <div className="text-cyan-300 font-semibold">Tap to add</div>
                    </div>
                  )}
                </div>
              )})}
            </div>
          </section>

          <div className="mb-4">
            <button onClick={()=>openModalForSlot(null)} className="w-full bg-slate-800/40 border border-slate-700 rounded-md px-3 py-2 flex items-center gap-3"><Search size={16} className="text-slate-400"/> <span className="text-slate-400">Search cards...</span></button>
          </div>

          <section className="bg-slate-800/40 rounded-2xl p-4 shadow-lg mb-8">
            <div className="flex items-start gap-4">
              <div className="w-28 h-28 rounded-full flex items-center justify-center shadow-2xl" style={{ background: result ? "linear-gradient(135deg,#FFB86B,#FF6B6B)" : "linear-gradient(135deg,#4B5563,#6B7280)" }}>
                <div className="text-3xl font-extrabold text-slate-900">{result ? result.final : "--"}</div>
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400">Deck Rating</div>
                    <div className="text-sm font-semibold text-slate-100">{result ? "Based on synergy & balance" : "Select 8 cards"}</div>
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
                      <div className="flex items-center gap-3">
                        <div className="w-36 bg-slate-900 h-2 rounded overflow-hidden">
                          <div style={{ width: `${v}%` }} className={`h-2 ${k==="elixir" ? "bg-cyan-400" : "bg-amber-400"}`}></div>
                        </div>
                        <div className="w-8 text-right">{v}%</div>
                      </div>
                    </div>
                  )) : <div className="text-slate-400 text-sm">Pick 8 cards to show full rating breakdown.</div>}
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={shareLink} className="flex-1 bg-cyan-500 text-slate-900 px-3 py-2 rounded-md flex items-center justify-center gap-2"><Share2 size={14}/> Share</button>
              <button onClick={downloadDeckImage} className="flex-1 bg-slate-700 px-3 py-2 rounded-md flex items-center justify-center gap-2"><Download size={14}/> Download Image</button>
            </div>

            <div className="mt-3 text-xs text-slate-400">{copied && <span>Link copied to clipboard</span>}{downloadMsg && <span>{downloadMsg}</span>}</div>

            {suggestions.length > 0 && (
              <div className="mt-4">
                <div className="text-xs text-slate-400 mb-2">Suggestions</div>
                <div className="space-y-2">
                  {suggestions.map((s,i)=>(
                    <div key={i} className="p-2 rounded-md bg-slate-800/40 flex items-center justify-between">
                      <div className="text-xs"><div><span className="font-semibold">{s.from.name}</span> → <span className="font-semibold">{s.to.name}</span></div><div className="text-slate-400 text-[11px]">+{s.delta} (→ {s.score})</div></div>
                      <button onClick={()=>applySuggestion(s)} className="bg-amber-500 text-slate-900 px-2 py-1 rounded text-xs">Apply</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Floating search modal */}
      <AnimatePresence>
        {modalOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="fixed inset-0 bg-black z-40" onClick={() => { setModalOpen(false); setActiveSlot(null); }} />

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

                <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                  {filtered.map((c)=> {
                    const selected = deckSlots.find((d)=>d?.id === c.id);
                    return (
                      <motion.button key={c.id} whileTap={{ scale: selected ? 1 : 0.97 }} disabled={selected} onClick={()=>addCardToSlot(c)} className={`w-full p-3 rounded-md flex items-center gap-3 text-left ${selected ? "bg-amber-900/10 border border-amber-400" : "bg-slate-800/40 hover:bg-slate-800/30"}`}>
                        <ElixirBadge value={c.elixir} />
                        <div className="min-w-0">
                          <div className="font-medium truncate">{c.name}</div>
                          <div className="text-xs text-slate-400 truncate">{c.type} • {(c.tags||[]).slice(0,3).join(", ")}</div>
                        </div>
                        <div className="ml-auto text-xs text-slate-300">{selected ? <span className="text-amber-300">Selected</span> : "Tap to add"}</div>
                      </motion.button>
                    );
                  })}
                </div>

                <div className="mt-3 text-xs text-slate-400 text-center">Pick cards until your deck has 8 cards. Tap a slot to target where the next card will go.</div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
