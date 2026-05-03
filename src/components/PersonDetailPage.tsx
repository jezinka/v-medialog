"use client";

import { useEffect, useState } from "react";
import CoverImg from "./CoverImg";
import { MEDIA_TYPE_EMOJI, MEDIA_TYPE_LABELS } from "@/lib/utils";
import { toast } from "./Toast";

interface MediaEntry {
  media_id: number;
  title: string;
  media_type: string;
  cover_url: string | null;
  release_year: number | null;
  role: string;
  character_name: string | null;
}

interface PersonDetail {
  id: number;
  name: string;
  photo_url: string | null;
  tmdb_id: number | null;
  media: MediaEntry[];
}

interface Props {
  personId: number;
  onBack: () => void;
  onOpenMedia?: (mediaId: number) => void;
}

const ROLE_BADGE: Record<string, string> = {
  actor: "bg-blue-100 text-blue-700",
  director: "bg-purple-100 text-purple-700",
  creator: "bg-indigo-100 text-indigo-700",
  author: "bg-green-100 text-green-700",
};

const ROLE_NAME: Record<string, string> = {
  actor: "Aktor",
  director: "Reżyser",
  creator: "Twórca",
  author: "Autor",
};

const SCREEN_AND_GAME_ROLES = ["actor", "director", "creator"];
const BOOK_ROLES = ["author"];

function Initials({ name, size = "sm" }: { name: string; size?: "sm" | "lg" }) {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? parts[0][0] + parts[parts.length - 1][0]
      : parts[0]?.[0] ?? "?";
  const cls =
    size === "lg"
      ? "w-full h-full flex items-center justify-center bg-gray-200 text-gray-600 font-bold text-2xl select-none"
      : "w-full h-full flex items-center justify-center bg-gray-200 text-gray-500 font-semibold text-xs select-none";
  return <div className={cls}>{initials.toUpperCase()}</div>;
}

function MediaRow({
  entry,
  onClick,
}: {
  entry: MediaEntry;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="flex items-center gap-3 w-full text-left p-2 rounded-lg hover:bg-gray-50 transition-colors group"
    >
      {/* Cover */}
      <div className="w-8 h-12 flex-shrink-0 rounded overflow-hidden bg-gray-100 border border-gray-200">
        {entry.cover_url ? (
          <CoverImg
            src={entry.cover_url}
            alt={entry.title}
            width={32}
            height={48}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-base">
            {MEDIA_TYPE_EMOJI[entry.media_type] ?? "🎬"}
          </div>
        )}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate group-hover:text-purple-700">
          {entry.title}
        </p>
        <p className="text-xs text-gray-400">
          {MEDIA_TYPE_EMOJI[entry.media_type] ?? ""}{" "}
          {MEDIA_TYPE_LABELS[entry.media_type] ?? entry.media_type}
          {entry.release_year ? ` · ${entry.release_year}` : ""}
          {entry.character_name ? ` · ${entry.character_name}` : ""}
        </p>
      </div>
    </button>
  );
}

export default function PersonDetailPage({ personId, onBack, onOpenMedia }: Props) {
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/persons/${personId}`)
      .then((r) => r.json())
      .then((data: PersonDetail) => setPerson(data))
      .catch(() => toast("Błąd ładowania osoby", "error"))
      .finally(() => setLoading(false));
  }, [personId]);

  if (loading) {
    return (
      <div className="p-6 text-sm text-gray-400">Ładowanie…</div>
    );
  }

  if (!person) {
    return (
      <div className="p-6 space-y-2">
        <p className="text-sm text-gray-500">Nie znaleziono osoby.</p>
        <button onClick={onBack} className="text-sm text-blue-600 hover:underline">
          ← Wróć
        </button>
      </div>
    );
  }

  // Collect unique roles for header badges
  const uniqueRoles = [...new Set(person.media.map((m) => m.role))];

  // Group media by section
  const screenEntries = person.media.filter((m) =>
    SCREEN_AND_GAME_ROLES.includes(m.role)
  );
  const bookEntries = person.media.filter((m) =>
    BOOK_ROLES.includes(m.role)
  );

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        ← Wróć
      </button>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full overflow-hidden flex-shrink-0 border border-gray-200 shadow-sm">
          {person.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={person.photo_url}
              alt={person.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <Initials name={person.name} size="lg" />
          )}
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{person.name}</h1>
          <div className="flex flex-wrap gap-1">
            {uniqueRoles.map((role) => (
              <span
                key={role}
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[role] ?? "bg-gray-100 text-gray-600"}`}
              >
                {ROLE_NAME[role] ?? role}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Section: Filmy i seriale */}
      {screenEntries.length > 0 && (
        <section className="space-y-1">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Filmy i seriale
          </h2>
          <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden shadow-sm">
            {screenEntries.map((entry) => (
              <MediaRow
                key={`${entry.media_id}-${entry.role}`}
                entry={entry}
                onClick={onOpenMedia ? () => onOpenMedia(entry.media_id) : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {/* Section: Książki */}
      {bookEntries.length > 0 && (
        <section className="space-y-1">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Książki
          </h2>
          <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden shadow-sm">
            {bookEntries.map((entry) => (
              <MediaRow
                key={`${entry.media_id}-${entry.role}`}
                entry={entry}
                onClick={onOpenMedia ? () => onOpenMedia(entry.media_id) : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {person.media.length === 0 && (
        <p className="text-sm text-gray-400">Brak powiązanych mediów.</p>
      )}
    </div>
  );
}
