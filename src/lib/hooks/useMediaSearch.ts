"use client";
import { useEffect, useRef, useState } from "react";

export interface MediaSearchItem {
  id: number;
  title: string;
  original_title: string | null;
  author: string | null;
  media_type: string;
  cover_url: string | null;
}

export function useMediaSearch() {
  const [allMedia, setAllMedia] = useState<MediaSearchItem[]>([]);
  const [mediaSearch, setMediaSearch] = useState("");
  const [filteredMedia, setFilteredMedia] = useState<MediaSearchItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/media?all=true")
      .then((r) => r.json())
      .then((data: MediaSearchItem[]) => setAllMedia(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setFilteredMedia([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSearchChange = (val: string) => {
    setMediaSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (val.trim().length >= 2) {
        const q = val.toLowerCase();
        setFilteredMedia(
          allMedia
            .filter(
              (m) =>
                m.title.toLowerCase().includes(q) ||
                (m.original_title?.toLowerCase().includes(q) ?? false)
            )
            .slice(0, 8)
        );
      } else {
        setFilteredMedia([]);
      }
    }, 300);
  };

  const clearResults = () => {
    setMediaSearch("");
    setFilteredMedia([]);
  };

  return { allMedia, mediaSearch, filteredMedia, handleSearchChange, dropdownRef, clearResults };
}
