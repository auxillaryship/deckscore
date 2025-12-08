<div className="sticky top-6 bg-gradient-to-b from-slate-800/40 to-slate-700/30 rounded-2xl p-5 shadow-lg">
  <div className="flex items-start gap-4">
    <div className="flex-shrink-0">
      <div className="w-28 h-28 bg-gradient-to-br from-amber-500 to-rose-500 rounded-full flex items-center justify-center shadow-2xl">
        <AnimatePresence>
          {result ? (
            <motion.div key={result.final} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-3xl font-extrabold text-slate-900">
              {result.final}
            </motion.div>
          ) : (
            <div className="text-slate-200 text-sm text-center px-2">Select 8 cards</div>
          )}
        </AnimatePresence>
      </div>
    </div>

    <div className="flex-1">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-400">Deck Rating</div>
          <div className="text-sm text-slate-300">Quick insights</div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div>Elixir</div>
          <div className="text-slate-200">{result ? result.avgElixir : "--"}</div>
        </div>
        <div className="w-full bg-slate-900 h-2 rounded overflow-hidden">
          <div style={{ width: result ? `${Math.min(100, (result.avgElixir/6)*100)}%` : "0%" }} className="h-2 bg-amber-400"></div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400">
          <div>Variance</div>
          <div className="text-slate-200">{result ? result.sigma : "--"}</div>
        </div>
        <div className="w-full bg-slate-900 h-2 rounded overflow-hidden">
          <div style={{ width: result ? `${Math.min(100, (1 - Math.min(1, result.sigma/4))*100)}%` : "0%" }} className="h-2 bg-amber-400"></div>
        </div>

        <div className="mt-2 grid grid-cols-1 gap-2">
          {result ? Object.entries(result.breakdown).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between text-xs text-slate-300">
              <div className="capitalize">{k}</div>
              <div className="flex items-center gap-3" style={{minWidth:120}}>
                <div className="w-28 bg-slate-900 h-2 rounded overflow-hidden">
                  <div style={{ width: `${v}%` }} className="h-2 bg-amber-400"></div>
                </div>
                <div className="w-6 text-right">{v}%</div>
              </div>
            </div>
          )) : <div className="text-slate-500 text-sm">No rating yet — pick 8 cards</div>}
        </div>
      </div>
    </div>
  </div>

  <div className="mt-4 flex items-center gap-3 justify-end">
    <button onClick={copyShare} className="px-3 py-2 bg-amber-500 text-slate-900 rounded-md flex items-center gap-2 text-sm"><Link2 size={14}/>Copy Link</button>
    <button onClick={downloadDeck} className="px-3 py-2 bg-slate-700 rounded-md flex items-center gap-2 text-sm"><Download size={14}/>Download JSON</button>
  </div>

  <div className="mt-4">
    <div className="text-xs text-slate-400 mb-2">Deck preview</div>
    <div className="flex items-center gap-2 overflow-x-auto py-1">
      {selected.length ? selected.map((c,i)=>(
        <div key={c.id} className="flex-shrink-0 w-14 h-20 bg-slate-700 rounded-lg p-2 flex flex-col items-center justify-between">
          <div className="text-sm font-semibold text-amber-300">{c.elixir ?? "-"}</div>
          <div className="text-xs text-center truncate">{c.name.split(' ')[0]}</div>
          <div className="text-xs bg-slate-800 px-2 py-1 rounded">#{i+1}</div>
        </div>
      )) : <div className="text-slate-500 text-sm">No cards selected</div>}
    </div>
  </div>
</div>
