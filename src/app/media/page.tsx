"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MediaLibraryView from "@/components/MediaLibraryView";
import MergeMediaModal from "@/components/MergeMediaModal";

export default function MediaPage() {
  const router = useRouter();
  const [showMerge, setShowMerge] = useState(false);

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setShowMerge(true)}
          className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          🔗 Połącz / zgrupuj media
        </button>
      </div>
      <MediaLibraryView onOpenDetail={(id) => router.push(`/media/${id}`)} />
      {showMerge && (
        <MergeMediaModal onClose={() => setShowMerge(false)} onSuccess={() => {}} />
      )}
    </main>
  );
}
