import { DAY_LABELS } from "@/lib/utils";
import { dateKey, monthCells } from "@/lib/calendar-days";

/**
 * One month of day circles, Monday first. Days in `days` get their color class,
 * days in `selected` are highlighted blue. Without `onDayClick` the days are plain, non-interactive.
 */
export default function MonthGrid({
  year,
  month,
  label,
  days,
  selected,
  onDayClick,
  onDayHover,
  className = "w-[180px]",
}: {
  year: number;
  month: number; // 1-12
  label: string;
  days: Map<string, string>; // date → tailwind color class
  selected?: Set<string>;
  onDayClick?: (date: string) => void | Promise<void>;
  onDayHover?: (date: string) => void;
  className?: string;
}) {
  return (
    <div className={`${className} shrink-0`}>
      <p className="text-xs font-semibold text-gray-700 mb-1.5">{label}</p>
      <div className="grid grid-cols-7 gap-px">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-[9px] text-gray-400 font-medium pb-0.5">{d}</div>
        ))}
        {monthCells(year, month).map((day, idx) => {
          if (day === null) return <div key={`e-${idx}`} />;
          const date = dateKey(year, month, day);
          const color = days.get(date);
          const base = "w-full aspect-square flex items-center justify-center text-[10px] rounded-full";
          if (!onDayClick) {
            return (
              <div key={date} title={color ? date : undefined} className={`${base} ${color ? `${color} text-white font-semibold` : "text-gray-400"}`}>
                {day}
              </div>
            );
          }
          return (
            <button
              key={date}
              type="button"
              onClick={() => onDayClick(date)}
              onMouseEnter={() => onDayHover?.(date)}
              title={date}
              aria-pressed={selected ? selected.has(date) : undefined}
              className={`${base} transition-colors ${
                color
                  ? `${color} text-white font-semibold hover:opacity-80`
                  : selected?.has(date)
                  ? "bg-blue-500 text-white font-semibold hover:bg-blue-600"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
