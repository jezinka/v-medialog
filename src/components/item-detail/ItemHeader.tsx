import Image from "next/image";
import Link from "next/link";
import { MEDIA_TYPE_ICONS, MEDIA_TYPE_COLORS, MEDIA_TYPE_LABELS } from "@/lib/utils";
import type { MediaData } from "./types";

/** Sticky bar with home / back links, the title, the type badge and edit / delete buttons. */
export default function ItemHeader({ media, onClose, onEdit, onDelete }: {
  media: MediaData;
  onClose?: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const icon = MEDIA_TYPE_ICONS[media.media_type];
  const color = MEDIA_TYPE_COLORS[media.media_type] ?? "bg-gray-100 text-gray-700";
  const label = MEDIA_TYPE_LABELS[media.media_type] ?? media.media_type;
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
      <Link
        href="/"
        className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors shrink-0"
        title="Strona główna"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7m-9 5v6h4v-6m-4 0H9m6 0h-2" />
        </svg>
      </Link>
      <button
        onClick={() => onClose?.()}
        className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors shrink-0"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Wróć
      </button>
      <h1 className="flex-1 text-center font-semibold text-gray-900 truncate text-sm sm:text-base">
        {media.title}
      </h1>
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${color}`}>
        {icon && <Image src={icon} alt="" width={10} height={10} />}
        {label}
      </span>
      <button
        onClick={onEdit}
        className="shrink-0 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        title="Edytuj medium"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>
      <button
        onClick={onDelete}
        className="shrink-0 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        title="Usuń medium"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}
