import { NextRequest, NextResponse } from "next/server";

const VALID_MEDIA_TYPES = ["book", "comic", "movie", "series", "anime", "cartoon", "play", "game", "podcast", "record"];
const VALID_PRIORITIES = ["high", "normal", "low"];

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let i = 0;
  const n = text.length;

  while (i < n) {
    const row: string[] = [];
    while (i < n) {
      // Skip CR before LF at field boundaries
      if (text[i] === "\r") {
        i++;
        continue;
      }
      if (text[i] === "\n" && row.length === 0 && rows.length > 0) {
        i++;
        break;
      }

      if (text[i] === '"') {
        // Quoted field
        i++; // skip opening quote
        let field = "";
        while (i < n) {
          if (text[i] === '"') {
            if (i + 1 < n && text[i + 1] === '"') {
              field += '"';
              i += 2;
            } else {
              i++; // skip closing quote
              break;
            }
          } else {
            field += text[i];
            i++;
          }
        }
        row.push(field);
        // skip comma or newline after quoted field
        if (i < n && text[i] === ",") i++;
        else if (i < n && text[i] === "\r") i++;
        else if (i < n && text[i] === "\n") { i++; break; }
        else break; // end of input
      } else {
        // Unquoted field
        let field = "";
        while (i < n && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") {
          field += text[i];
          i++;
        }
        row.push(field.trim());
        if (i < n && text[i] === ",") { i++; }
        else if (i < n && text[i] === "\r") { i++; if (i < n && text[i] === "\n") i++; break; }
        else if (i < n && text[i] === "\n") { i++; break; }
        else break;
      }
    }
    if (row.length > 0) rows.push(row);
  }
  return rows;
}

interface MediaPreviewRow {
  title: string;
  original_title: string;
  author: string;
  media_type: string;
  start_date: string;
  end_date: string;
  season_number: string;
  tags: string;
  notes: string;
  discontinued: string;
  cover_url: string;
  cinema: string;
  
}

interface WishlistPreviewRow {
  title: string;
  author: string;
  media_type: string;
  priority: string;
  notes: string;
  cover_url: string;
}

type PreviewRow = MediaPreviewRow | WishlistPreviewRow;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { csv, type } = body as { csv: string; type: "media" | "wishlist" };

    if (!csv || !type) {
      return NextResponse.json({ error: "csv and type are required" }, { status: 400 });
    }

    const rows = parseCSV(csv.trim());
    if (rows.length < 2) {
      return NextResponse.json({ error: "CSV musi zawierać nagłówek i co najmniej jeden wiersz" }, { status: 400 });
    }

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const dataRows = rows.slice(1);

    const colIndex = (name: string) => header.indexOf(name);

    const valid: { row: number; data: PreviewRow }[] = [];
    const invalid: { row: number; error: string; raw: string }[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2; // 1-based, row 1 is header
      const raw = row.join(",");

      const get = (col: string) => {
        const idx = colIndex(col);
        return idx >= 0 && idx < row.length ? row[idx].trim() : "";
      };

      if (type === "media") {
        const title = get("title");
        const media_type = get("media_type");
        const start_date = get("start_date");

        if (!title) {
          invalid.push({ row: rowNum, error: "Brak wymaganego pola: title", raw });
          continue;
        }
        if (!media_type || !VALID_MEDIA_TYPES.includes(media_type)) {
          invalid.push({ row: rowNum, error: `Nieprawidłowy media_type: "${media_type}"`, raw });
          continue;
        }
        if (!start_date || !/^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
          invalid.push({ row: rowNum, error: "Brak lub nieprawidłowy format start_date (wymagany: YYYY-MM-DD)", raw });
          continue;
        }

        const data: MediaPreviewRow = {
          title,
          original_title: get("original_title") || title,
          author: get("author"),
          media_type,
          start_date,
          end_date: get("end_date"),
          season_number: get("season_number") || get("season") || get("volume_episode"),
          tags: get("tags"),
          notes: get("notes"),
          discontinued: get("discontinued") || "0",
          cover_url: get("cover_url"),
          cinema: get("cinema") || "0",
          
        };
        valid.push({ row: rowNum, data });
      } else {
        const title = get("title");
        const media_type = get("media_type");
        const rawPriority = get("priority");
        const priority = rawPriority && VALID_PRIORITIES.includes(rawPriority) ? rawPriority : "normal";

        if (!title) {
          invalid.push({ row: rowNum, error: "Brak wymaganego pola: title", raw });
          continue;
        }
        if (!media_type || !VALID_MEDIA_TYPES.includes(media_type)) {
          invalid.push({ row: rowNum, error: `Nieprawidłowy media_type: "${media_type}"`, raw });
          continue;
        }

        const data: WishlistPreviewRow = {
          title,
          author: get("author"),
          media_type,
          priority,
          notes: get("notes"),
          cover_url: get("cover_url"),
        };
        valid.push({ row: rowNum, data });
      }
    }

    return NextResponse.json({ valid, invalid, total: dataRows.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Błąd parsowania CSV" }, { status: 500 });
  }
}
