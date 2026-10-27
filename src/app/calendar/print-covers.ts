import { DAY_LABELS, MONTH_NAMES } from "@/lib/utils";
import { dateKey, getDaysInMonth, getFirstDayOfMonth, getPolishHolidays } from "@/lib/calendar-days";

export interface PrintEntry {
  title: string;
  cover_url: string | null;
  assigned_day: number;
}

/** Opens an A4 print page with a month grid of covers and starts printing once they load. Returns false when the popup was blocked. */
export function printMonthCovers(year: number, month: number, monthEntries: PrintEntry[]): boolean {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;

  printWindow.opener = null;
  printWindow.document.write(`<!doctype html><html lang="pl"><head><title>Okładki ${MONTH_NAMES[month - 1]} ${year}</title><style>
    @page { size: A4 landscape; margin: 10mm; }
    body { font-family: Arial, sans-serif; margin: 0; color: #111; }
    h1 { font-size: 16pt; margin: 0 0 4mm; }
    .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: .75mm; }
    .label { text-align: center; font-size: 8pt; font-weight: bold; color: #666; padding: 1mm 0; }
    .day { position: relative; height: 27mm; border: .25mm solid #ddd; overflow: hidden; }
    .empty { background: #fafafa; }
    img { position: absolute; top: 5mm; width: 100%; height: calc(100% - 5mm); object-fit: contain; }
    .number { position: absolute; top: 0; left: 0; box-sizing: border-box; width: 100%; height: 5mm; padding: 1mm; border-bottom: .25mm solid #bbb; background: #fff; color-adjust: exact; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 8pt; font-weight: bold; color: #555; }
    .saturday .number { background: #e5e7eb; }
    .sunday .number { background: #fee2e2; color: #b91c1c; }
    .holiday .number { background: #fee2e2; color: #b91c1c; }
  </style></head><body><h1>${MONTH_NAMES[month - 1]} ${year}</h1><div class="grid"></div></body></html>`);
  printWindow.document.close();

  const grid = printWindow.document.querySelector(".grid");
  if (!grid) return true;

  const images: HTMLImageElement[] = [];
  for (const label of DAY_LABELS) {
    const header = printWindow.document.createElement("div");
    header.className = "label";
    header.textContent = label;
    grid.append(header);
  }

  const firstDay = getFirstDayOfMonth(year, month);
  for (let i = 0; i < firstDay; i++) {
    const empty = printWindow.document.createElement("div");
    empty.className = "day empty";
    grid.append(empty);
  }

  const entriesByDay = new Map(monthEntries.map((entry) => [entry.assigned_day, entry]));
  const holidays = getPolishHolidays(year);
  for (let day = 1; day <= getDaysInMonth(year, month); day++) {
    const cell = printWindow.document.createElement("div");
    const weekday = (firstDay + day - 1) % 7;
    cell.className = `day${holidays.has(dateKey(year, month, day)) ? " holiday" : weekday === 5 ? " saturday" : weekday === 6 ? " sunday" : ""}`;
    const entry = entriesByDay.get(day);
    if (entry?.cover_url) {
      const image = printWindow.document.createElement("img");
      image.src = new URL(entry.cover_url, window.location.href).href;
      image.alt = entry.title;
      cell.append(image);
      images.push(image);
    }
    const number = printWindow.document.createElement("span");
    number.className = "number";
    number.textContent = String(day);
    cell.append(number);
    grid.append(cell);
  }

  Promise.all(images.map((image) => new Promise<void>((resolve) => {
    image.onload = () => resolve();
    image.onerror = () => resolve();
    if (image.complete) resolve();
  }))).then(() => {
    printWindow.focus();
    printWindow.print();
  });
  return true;
}
