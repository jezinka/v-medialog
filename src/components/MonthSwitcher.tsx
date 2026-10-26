import { MONTH_NAMES } from "@/lib/utils";
import { shiftMonth } from "@/lib/schedule";

/** "‹ <label> <month> <year> ›" header that moves a "YYYY-MM" month back and forth */
export default function MonthSwitcher({ label, month, onChange }: { label: string; month: string; onChange: (month: string) => void }) {
  const [y, m] = month.split("-").map(Number);
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => onChange(shiftMonth(month, -1))} aria-label="Poprzedni miesiąc" className="w-7 h-7 rounded-full hover:bg-gray-100 text-gray-600 font-bold">‹</button>
      <h2 className="text-base font-semibold text-gray-800 min-w-[11rem] text-center">{label}: {MONTH_NAMES[m - 1].toLowerCase()} {y}</h2>
      <button onClick={() => onChange(shiftMonth(month, 1))} aria-label="Następny miesiąc" className="w-7 h-7 rounded-full hover:bg-gray-100 text-gray-600 font-bold">›</button>
    </div>
  );
}
