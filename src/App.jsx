/* RadarChart — labels precisely placed at top/right/bottom/left */
function RadarChart({ values, size = 160 }) {
  const axes = ["Offense", "Defense", "Synergy", "Cycle"];
  const vals = [values.offense, values.defense, values.synergy, values.cycle];
  const cx = size / 2,
    cy = size / 2,
    r = size * 0.36;

  const angle = (i) =>
    Math.PI / 2 - (i * (2 * Math.PI)) / axes.length;

  const points = vals
    .map((v, i) => {
      const rad = (v / 100) * r;
      const x = cx + Math.cos(angle(i)) * rad;
      const y = cy - Math.sin(angle(i)) * rad;
      return `${x},${y}`;
    })
    .join(" ");

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <div className="relative inline-flex flex-col items-center justify-center">
      <svg
        width={220}
        height={220}
        viewBox="0 0 220 220"
        className="mx-auto"
      >
        <defs>
          <linearGradient id="rf2" x1="0" x2="1">
            <stop offset="0%" stopColor="#FFB86B" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#FF6B6B" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        {rings.map((f, idx) => (
          <circle
            key={idx}
            cx={cx}
            cy={cy}
            r={r * f}
            fill="none"
            stroke="#263241"
            strokeWidth="1"
          />
        ))}

        {Array.from({ length: axes.length }).map((_, i) => {
          const x = cx + Math.cos(angle(i)) * r;
          const y = cy - Math.sin(angle(i)) * r;
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="#263241"
              strokeWidth="1"
            />
          );
        })}

        <polygon
          points={points}
          fill="url(#rf2)"
          fillOpacity="0.95"
          stroke="#FF9A55"
          strokeWidth="2"
        />

        {vals.map((v, i) => {
          const rad = (v / 100) * r;
          const x = cx + Math.cos(angle(i)) * rad;
          const y = cy - Math.sin(angle(i)) * rad;
          return <circle key={i} cx={x} cy={y} r={3} fill="#FF9A55" />;
        })}

        {/* Labels inside SVG for better positioning */}
        <text
          x={cx}
          y={25}
          textAnchor="middle"
          className="fill-slate-300 text-xs"
          pointerEvents="none"
        >
          Offense
        </text>
        <text
          x={195}
          y={cy + 4}
          textAnchor="start"
          className="fill-slate-300 text-xs"
          pointerEvents="none"
        >
          Defense
        </text>
        <text
          x={cx}
          y={210}
          textAnchor="middle"
          className="fill-slate-300 text-xs"
          pointerEvents="none"
        >
          Synergy
        </text>
        <text
          x={10}
          y={cy + 4}
          textAnchor="end"
          className="fill-slate-300 text-xs"
          pointerEvents="none"
        >
          Cycle
        </text>
      </svg>
    </div>
  );
}
