"use client";

import { useEffect, useState, useMemo } from "react";
import { toast } from "./Toast";

interface PersonItem {
  id: number;
  name: string;
  photo_url: string | null;
  tmdb_id: number | null;
  media_count: number;
  roles: string[];
}

interface Props {
  onOpenPerson: (personId: number) => void;
}

const ROLE_FILTERS = ["all", "actor", "director", "author"] as const;
type RoleFilter = (typeof ROLE_FILTERS)[number];

const ROLE_LABELS: Record<string, string> = {
  all: "Wszyscy",
  actor: "Aktorzy",
  director: "Reżyserzy",
  author: "Autorzy",
};

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

const PAGE_SIZE = 48;

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? parts[0][0] + parts[parts.length - 1][0]
      : parts[0]?.[0] ?? "?";
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-600 font-semibold text-lg select-none">
      {initials.toUpperCase()}
    </div>
  );
}

export default function PeopleView({ onOpenPerson }: Props) {
  const [persons, setPersons] = useState<PersonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    fetch("/api/persons")
      .then((r) => r.json())
      .then((data: PersonItem[]) => setPersons(data))
      .catch(() => toast("Błąd ładowania osób", "error"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return persons.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (roleFilter !== "all") {
        const roles = Array.isArray(p.roles) ? p.roles : [];
        if (!roles.includes(roleFilter)) return false;
      }
      return true;
    });
  }, [persons, search, roleFilter]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Szukaj osoby…"
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-56 focus:ring-2 focus:ring-purple-400 focus:outline-none"
        />
        <div className="flex gap-1 flex-wrap">
          {ROLE_FILTERS.map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                roleFilter === r
                  ? "bg-purple-600 text-white border-purple-600"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
              }`}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-500 ml-auto">{filtered.length} osób</span>
      </div>

      {/* Grid */}
      {loading ? (
        <p className="text-sm text-gray-400">Ładowanie…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400">Brak wyników.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {paginated.map((person) => {
              const roles = Array.isArray(person.roles) ? person.roles : [];
              return (
                <button
                  key={person.id}
                  onClick={() => onOpenPerson(person.id)}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all text-left bg-white"
                >
                  {/* Avatar */}
                  <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 border border-gray-200">
                    {person.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={person.photo_url}
                        alt={person.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Initials name={person.name} />
                    )}
                  </div>
                  {/* Name */}
                  <p className="text-sm font-medium text-center leading-tight line-clamp-2">
                    {person.name}
                  </p>
                  {/* Role badges */}
                  <div className="flex flex-wrap gap-1 justify-center">
                    {roles.map((role) => (
                      <span
                        key={role}
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_BADGE[role] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {ROLE_NAME[role] ?? role}
                      </span>
                    ))}
                  </div>
                  {/* Media count */}
                  <p className="text-xs text-gray-400">{person.media_count} mediów</p>
                </button>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Poprzednia
              </button>
              <span className="text-sm text-gray-600">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Następna →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
