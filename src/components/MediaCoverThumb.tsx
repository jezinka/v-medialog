"use client";
import CoverImg from "./CoverImg";
import { MEDIA_TYPE_EMOJI } from "@/lib/utils";

interface Props {
  coverUrl: string | null;
  title: string;
  mediaType?: string;
  /** Tailwind size classes, e.g. "w-10 h-14" */
  className?: string;
  sizes?: string;
  objectFit?: "cover" | "contain";
}

export default function MediaCoverThumb({
  coverUrl,
  title,
  mediaType,
  className = "w-10 h-14",
  sizes = "40px",
  objectFit = "contain",
}: Props) {
  return (
    <div className={`relative ${className} shrink-0 rounded overflow-hidden bg-gray-100 flex items-center justify-center`}>
      {coverUrl ? (
        <CoverImg src={coverUrl} alt={title} fill className={`object-${objectFit}`} sizes={sizes} />
      ) : mediaType ? (
        <span className="text-xl">{MEDIA_TYPE_EMOJI[mediaType] ?? "📄"}</span>
      ) : null}
    </div>
  );
}
