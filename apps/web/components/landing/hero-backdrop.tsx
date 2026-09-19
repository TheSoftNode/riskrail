/**
 * Hero backdrop: converging rails carrying light toward the instrument.
 *
 * Replaces the generic square grid. The metaphor is the product — protocol
 * data travelling along rails into one point where it is scored. Pure SVG +
 * CSS so it costs nothing on the main thread and renders before hydration.
 *
 * Colour is restricted to the existing brand cyan and border tokens; the only
 * gradients here are single-hue alpha ramps used for fade, not new hues.
 */

const RAIL_COUNT = 9;
const FOCAL = { x: 1180, y: 430 };

function rails() {
  return Array.from({ length: RAIL_COUNT }, (_, i) => {
    const t = i / (RAIL_COUNT - 1);
    // Spread the origins well past the top and bottom edges so the
    // convergence reads as depth rather than a fan of lines.
    const y0 = -260 + t * 1420;
    const ctrlX = 430 + t * 180;
    const ctrlY = y0 + (FOCAL.y - y0) * 0.22;
    return {
      d: `M -80 ${y0.toFixed(0)} Q ${ctrlX.toFixed(0)} ${ctrlY.toFixed(0)} ${FOCAL.x} ${FOCAL.y}`,
      // Rails nearer the focal axis read as "closer", so they carry more light.
      weight: 0.55 + (1 - Math.abs(t - 0.5) * 2) * 0.45,
    };
  });
}

const PULSES = [
  { index: 1, delay: "0s", dur: "7.5s" },
  { index: 3, delay: "1.9s", dur: "6.4s" },
  { index: 4, delay: "3.4s", dur: "8.2s" },
  { index: 6, delay: "5.1s", dur: "7s" },
  { index: 7, delay: "2.6s", dur: "9s" },
];

export function HeroBackdrop() {
  const paths = rails();

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <defs>
          {/* Dissolve the rails before they reach any edge. */}
          <radialGradient id="rr-fade" cx="76%" cy="46%" r="64%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="52%" stopColor="white" stopOpacity="0.7" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="rr-mask">
            <rect x="0" y="0" width="1600" height="900" fill="url(#rr-fade)" />
          </mask>

          {/* Single-hue alpha ramp so a pulse has a leading edge. */}
          <linearGradient id="rr-pulse" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0" />
            <stop offset="70%" stopColor="var(--brand)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="1" />
          </linearGradient>

          <radialGradient id="rr-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.3" />
            <stop offset="45%" stopColor="var(--brand)" stopOpacity="0.09" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="rr-sweep-arm" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.5" />
          </linearGradient>
        </defs>

        <g mask="url(#rr-mask)">
          {/* Static rails */}
          {paths.map((p, i) => (
            <path
              key={`rail-${i}`}
              d={p.d}
              stroke="var(--border)"
              strokeWidth={1}
              strokeOpacity={0.95 * p.weight + 0.25}
            />
          ))}

          {/* Light travelling toward the focal point */}
          {PULSES.map((pulse, i) => (
            <path
              key={`pulse-${i}`}
              d={paths[pulse.index]!.d}
              stroke="url(#rr-pulse)"
              strokeWidth={2.2}
              strokeLinecap="round"
              className="rr-rail-pulse"
              style={
                {
                  "--rr-delay": pulse.delay,
                  "--rr-dur": pulse.dur,
                } as React.CSSProperties
              }
            />
          ))}

          {/* Convergence core */}
          <circle cx={FOCAL.x} cy={FOCAL.y} r={520} fill="url(#rr-core)" />
          <circle
            cx={FOCAL.x}
            cy={FOCAL.y}
            r={3}
            fill="var(--brand)"
            className="rr-breathe"
          />

          {/* Slow radar sweep — risk monitoring, not decoration */}
          <g
            className="rr-sweep"
            style={{ transformOrigin: `${FOCAL.x}px ${FOCAL.y}px` }}
          >
            <path
              d={`M ${FOCAL.x} ${FOCAL.y} L ${FOCAL.x + 430} ${FOCAL.y}`}
              stroke="url(#rr-sweep-arm)"
              strokeWidth={1.2}
            />
          </g>
          {[330, 470, 620].map((r) => (
            <circle
              key={`ring-${r}`}
              cx={FOCAL.x}
              cy={FOCAL.y}
              r={r}
              stroke="var(--brand)"
              strokeOpacity={0.11}
              strokeWidth={0.8}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
