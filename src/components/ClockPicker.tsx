import { useRef, useState } from "react";

/* ── Types ──────────────────────────────────────────────────────── */
type Mode = "hours" | "minutes" | "seconds";

interface ClockPickerProps {
  initialHours?: string;
  initialMinutes?: string;
  initialSeconds?: string;
  onConfirm: (hours: string, minutes: string, seconds: string) => void;
  onClose: () => void;
}

/* ── Constants ──────────────────────────────────────────────────── */
const SIZE    = 268;
const CENTER  = SIZE / 2;
const OUTER_R = 104;
const INNER_R = 70;
const NUM_R   = 18;

/* ── Helpers ────────────────────────────────────────────────────── */
function polar(angleDeg: number, r: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) };
}

const OUTER_HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const INNER_HOURS = [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
const MIN_MARKS   = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

/* ── Component ──────────────────────────────────────────────────── */
export function ClockPicker({
  initialHours = "",
  initialMinutes = "",
  initialSeconds = "",
  onConfirm,
  onClose,
}: ClockPickerProps) {
  const [mode, setMode] = useState<Mode>("hours");
  const [h, setH] = useState<number>(initialHours   !== "" ? parseInt(initialHours)   : -1);
  const [m, setM] = useState<number>(initialMinutes !== "" ? parseInt(initialMinutes) : -1);
  const [s, setS] = useState<number>(initialSeconds !== "" ? parseInt(initialSeconds) : -1);
  const svgRef = useRef<SVGSVGElement>(null);

  const isDark    = document.documentElement.classList.contains("dark");
  const faceFill  = isDark ? "#1C1F27" : "#EEF0F5";
  const fgText    = isDark ? "#D1D5DB" : "#111827";
  const dimText   = isDark ? "#6B7280" : "#9CA3AF";
  const tickMajor = isDark ? "#374151" : "#C4C9D4";
  const tickMinor = isDark ? "#2D3340" : "#DDE1EA";

  /* ── Click handler ─────────────────────────────────────────────── */
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect     = svgRef.current.getBoundingClientRect();
    const scaleX   = SIZE / rect.width;
    const scaleY   = SIZE / rect.height;
    const dx       = (e.clientX - rect.left) * scaleX - CENTER;
    const dy       = (e.clientY - rect.top)  * scaleY - CENTER;
    const angleDeg = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
    const dist     = Math.sqrt(dx * dx + dy * dy);

    if (mode === "hours") {
      const pos     = Math.round(angleDeg / 30) % 12;
      const isInner = dist < (OUTER_R + INNER_R) / 2;
      const val     = isInner ? (pos === 0 ? 0 : pos + 12) : (pos === 0 ? 12 : pos);
      setH(val);
      setTimeout(() => setMode("minutes"), 220);
    } else if (mode === "minutes") {
      const val = Math.round(angleDeg / 6) % 60;
      setM(val);
      setTimeout(() => setMode("seconds"), 220);
    } else {
      const val = Math.round(angleDeg / 6) % 60;
      setS(val);
    }
  };

  /* ── Hand geometry ─────────────────────────────────────────────── */
  const getHand = () => {
    if (mode === "hours") {
      if (h === -1) return null;
      let ang = 0;
      if      (h === 12) ang = 0;
      else if (h === 0)  ang = 0;
      else if (h > 12)   ang = ((h - 12) % 12) * 30;
      else               ang = h * 30;
      const r   = (h === 0 || h > 12) ? INNER_R : OUTER_R;
      const tip = polar(ang, r - NUM_R);
      return { ang, r, tip };
    }
    const val = mode === "minutes" ? m : s;
    if (val === -1) return null;
    const ang = val * 6;
    const tip = polar(ang, OUTER_R - NUM_R);
    return { ang, r: OUTER_R, tip };
  };
  const hand = getHand();

  const fmt = (v: number) => (v === -1 ? "00" : String(v).padStart(2, "0"));

  const handleConfirm = () => {
    onConfirm(
      String(h === -1 ? 0 : h),
      String(m === -1 ? 0 : m),
      String(s === -1 ? 0 : s),
    );
  };

  return (
    <div
      className="fixed inset-0 z-[400] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-[340px] overflow-hidden"
        style={{ animation: "modal-pop 0.22s cubic-bezier(0.34,1.56,0.64,1) both" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Purple header ─────────────────────────────────────── */}
        <div
          className="px-6 pt-5 pb-4"
          style={{ background: "linear-gradient(135deg, #6F3C97 0%, #A47CF3 100%)" }}
        >
          <p className="text-purple-200 text-[10px] uppercase tracking-widest mb-3 font-semibold">
            Select Time
          </p>
          {/* HH : MM : SS display */}
          <div className="flex items-center gap-0.5">
            {(["hours", "minutes", "seconds"] as Mode[]).map((md, i) => (
              <span key={md} className="flex items-center gap-0.5">
                {i > 0 && (
                  <span className="text-[36px] font-bold text-white/50 leading-none select-none">:</span>
                )}
                <button
                  onClick={() => setMode(md)}
                  className={`text-[36px] font-bold leading-none px-1.5 py-0.5 rounded-xl transition-all ${
                    mode === md ? "text-white bg-white/20" : "text-white/45 hover:text-white/70"
                  }`}
                >
                  {md === "hours" ? fmt(h) : md === "minutes" ? fmt(m) : fmt(s)}
                </button>
              </span>
            ))}
          </div>
          {/* Mode pills */}
          <div className="flex gap-1.5 mt-2.5">
            {(["hours", "minutes", "seconds"] as Mode[]).map((md) => (
              <button
                key={md}
                onClick={() => setMode(md)}
                className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium transition-all ${
                  mode === md ? "bg-white/30 text-white" : "text-white/50 hover:text-white/70"
                }`}
              >
                {md === "hours" ? "Hour" : md === "minutes" ? "Min" : "Sec"}
              </button>
            ))}
          </div>
        </div>

        {/* ── Clock face ────────────────────────────────────────── */}
        <div className="flex justify-center px-6 pt-5 pb-2">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="w-full max-w-[268px] cursor-pointer select-none"
            onClick={handleSvgClick}
          >
            {/* Face */}
            <circle cx={CENTER} cy={CENTER} r={CENTER - 6} fill={faceFill} />

            {/* Tick marks (minutes / seconds mode) */}
            {mode !== "hours" &&
              Array.from({ length: 60 }).map((_, i) => {
                const ang   = ((i * 6 - 90) * Math.PI) / 180;
                const isMaj = i % 5 === 0;
                const r1    = CENTER - 6 - (isMaj ? 9 : 4);
                const r2    = CENTER - 6;
                return (
                  <line
                    key={i}
                    x1={CENTER + r1 * Math.cos(ang)} y1={CENTER + r1 * Math.sin(ang)}
                    x2={CENTER + r2 * Math.cos(ang)} y2={CENTER + r2 * Math.sin(ang)}
                    stroke={isMaj ? tickMajor : tickMinor}
                    strokeWidth={isMaj ? 2 : 1} strokeLinecap="round"
                  />
                );
              })}

            {/* Hand */}
            {hand && (
              <>
                <line
                  x1={CENTER} y1={CENTER} x2={hand.tip.x} y2={hand.tip.y}
                  stroke="#6F3C97" strokeWidth="2.5" strokeLinecap="round"
                />
                <circle cx={CENTER} cy={CENTER} r="5" fill="#6F3C97" />
                <circle cx={hand.tip.x} cy={hand.tip.y} r={NUM_R} fill="#6F3C97" fillOpacity="0.13" />
              </>
            )}

            {/* Hour numbers */}
            {mode === "hours" && (
              <>
                {OUTER_HOURS.map((val, i) => {
                  const pos = polar(i * 30, OUTER_R);
                  const sel = h === val;
                  return (
                    <g key={`oh-${val}`}>
                      {sel && <circle cx={pos.x} cy={pos.y} r={NUM_R} fill="#6F3C97" />}
                      <text
                        x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
                        fontSize="13.5" fontWeight={sel ? "700" : "400"}
                        fill={sel ? "white" : fgText}
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}
                {INNER_HOURS.map((val, i) => {
                  const pos = polar(i * 30, INNER_R);
                  const sel = h === val;
                  return (
                    <g key={`ih-${val}`}>
                      {sel && <circle cx={pos.x} cy={pos.y} r={NUM_R - 5} fill="#6F3C97" />}
                      <text
                        x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
                        fontSize="11" fontWeight={sel ? "700" : "400"}
                        fill={sel ? "white" : dimText}
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}
              </>
            )}

            {/* Minute / Second numbers */}
            {mode !== "hours" &&
              MIN_MARKS.map((val, i) => {
                const pos    = polar(i * 30, OUTER_R);
                const curVal = mode === "minutes" ? m : s;
                const sel    = curVal === val;
                return (
                  <g key={`ms-${val}`}>
                    {sel && <circle cx={pos.x} cy={pos.y} r={NUM_R} fill="#6F3C97" />}
                    <text
                      x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
                      fontSize="13.5" fontWeight={sel ? "700" : "400"}
                      fill={sel ? "white" : fgText}
                    >
                      {String(val).padStart(2, "0")}
                    </text>
                  </g>
                );
              })}

            {/* Fine dot for non-labelled minute/second values */}
            {mode !== "hours" && (() => {
              const curVal = mode === "minutes" ? m : s;
              if (curVal === -1 || curVal % 5 === 0) return null;
              const pos = polar(curVal * 6, OUTER_R);
              return <circle key="fine" cx={pos.x} cy={pos.y} r="4" fill="#A47CF3" />;
            })()}
          </svg>
        </div>

        {/* Hint */}
        <p className="text-center text-[11px] text-gray-400 dark:text-muted-foreground pb-1">
          {mode === "hours"
            ? "Outer ring = 1–12 · inner ring = 0 & 13–23"
            : "Tap anywhere for exact value"}
        </p>

        {/* Buttons */}
        <div className="flex justify-end gap-2 px-6 pb-5 pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-gray-500 dark:text-muted-foreground rounded-xl hover:bg-gray-100 dark:hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-2 text-sm font-semibold text-white rounded-xl hover:shadow-lg transition-all"
            style={{ background: "linear-gradient(135deg, #6F3C97 0%, #A47CF3 100%)" }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
