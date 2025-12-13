function RadarChart({ values, size = 160 }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;

  const axes = [
    { label: "Offense", x: "50%", y: "0%" },
    { label: "Defense", x: "100%", y: "50%" },
    { label: "Synergy", x: "50%", y: "100%" },
    { label: "Cycle", x: "0%", y: "50%" },
  ];

  const vals = [
    values.offense,
    values.defense,
    values.synergy,
    values.cycle,
  ];

  const angle = i => Math.PI / 2 - i * (2 * Math.PI / 4);

  const points = vals
    .map((v, i) => {
      const rad = (v / 100) * r;
      const x = cx + Math.cos(angle(i)) * rad;
      const y = cy - Math.sin(angle(i)) * rad;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="relative w-[220px] h-[220px] mx-auto">
      {axes.map((a, i) => (
        <div
          key={i}
          className="absolute text-xs text-slate-300"
          style={{
            left: a.x,
            top: a.y,
            transform: "translate(-50%, -50%)",
          }}
        >
          {a.label}
        </div>
      ))}

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
      >
        {[0.25, 0.5, 0.75, 1].map((f, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r * f}
            fill="none"
            stroke="#263241"
            strokeWidth="1"
          />
        ))}

        {axes.map((_, i) => {
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
          fill="rgba(255,165,0,0.85)"
          stroke="#FF9A55"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}
