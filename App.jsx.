import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Share2, RefreshCcw } from 'lucide-react';
import cards from './cards.json';

// ----------------- HELPER FUNCTIONS -----------------

function clamp(v, a = 0, b = 1) {
  return Math.max(a, Math.min(b, v));
}
function calcElixirAvg(deck) {
  return deck.reduce((s, c) => s + c.elixir, 0) / deck.length;
}
function calcSigma(deck, avg) {
  return Math.sqrt(deck.reduce((s, c) => s + Math.pow(c.elixir - avg, 2), 0) / deck.length);
}
function detectWinCondition(deck) {
  return deck.find(c => c.tags.includes('win')) || null;
}
function getSynergy(a, b) {
  if (a.id.includes("evo") || b.id.includes("evo")) return 0.2;
  if (a.type === 'hero' || b.type === 'hero') return 0.25;
  return 0;
}

function computeHeuristic(deck) {
  const winCard = detectWinCondition(deck);
  const support_present = deck.some(c => c.tags.includes('support') || c.tags.includes('spell'));
  const spell_support = deck.some(c => c.type === 'spell');

  const win_score = (winCard ? 1 : 0.4) * (0.6 * (support_present ? 1 : 0) + 0.4 * (spell_support ? 1 : 0));

  let synergy_sum = 0;
  let pairs = 0;

  for (let i = 0; i < deck.length; i++) {
    for (let j = i + 1; j < deck.length; j++) {
      synergy_sum += getSynergy(deck[i], deck[j]);
      pairs++;
    }
  }

  const synergy_score = clamp((synergy_sum / pairs + 1) / 2, 0, 1);
  const avg = calcElixirAvg(deck);
  const sigma = calcSigma(deck, avg);

  const elixir_score = clamp(1 - Math.abs(avg - 3.8) / 3.8, 0, 1);
  const role_score = clamp(deck.length / 12, 0, 1);

  const final =
    25 * win_score +
    25 * synergy_score +
    20 * elixir_score +
    15 * role_score +
    15 * (1 - clamp(sigma / 4, 0, 1));

  return {
    final: Math.round(final),
    breakdown: {
      win: Math.round(win_score * 100),
      synergy: Math.round(synergy_score * 100),
      elixir: Math.round(elixir_score * 100),
      role: Math.round(role_score * 100)
    },
    avgElixir: avg.toFixed(2),
    sigma: sigma.toFixed(2)
  };
}

// ----------------- MAIN APP -----------------

export default function App() {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]);
  const [result, setResult] = useState(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return cards.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    if (selected.length === 8) {
      setResult(computeHeuristic(selected));
    } else {
      setResult(null);
    }
  }, [selected]);

  function toggleCard(card) {
    if (selected.find(c => c.id === card.id)) {
      setSelected(selected.filter(c => c.id !== card.id));
    } else if (selected.length < 8) {
      setSelected([...selected, card]);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-4">DeckScore</h1>

      <input
        placeholder="Search cards..."
        className="w-full p-2 mb-4 bg-slate-800 rounded"
        value={query}
        onChange={e => setQuery(e.target.value)}
      />

      <div className="grid grid-cols-4 gap-2">
        {filtered.map(card => (
          <button
            key={card.id}
            onClick={() => toggleCard(card)}
            className={`p-2 rounded bg-slate-800 border ${
              selected.find(c => c.id === card.id)
                ? "border-amber-400"
                : "border-slate-700"
            }`}
          >
            <div className="font-semibold">{card.name}</div>
            <div className="text-xs">{card.elixir} elixir</div>
            <div className="text-xs">{card.type}</div>
          </button>
        ))}
      </div>

      <h2 className="text-xl mt-6">Selected ({selected.length}/8)</h2>
      <div className="flex flex-wrap gap-2 mt-2">
        {selected.map(card => (
          <div key={card.id} className="bg-slate-800 px-3 py-2 rounded flex items-center gap-3">
            {card.name}
            <button
              className="text-red-400"
              onClick={() => setSelected(selected.filter(c => c.id !== card.id))}
            >
              X
            </button>
          </div>
        ))}
      </div>

      {result && (
        <div className="mt-6 p-4 bg-slate-800 rounded">
          <h3 className="text-2xl font-bold mb-2">Score: {result.final}</h3>
          <p>Average Elixir: {result.avgElixir}</p>
          <p>Elixir Variance: {result.sigma}</p>
        </div>
      )}
    </div>
  );
}
