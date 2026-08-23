"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageContainer from "@/components/PageContainer";
import UniverseView from "@/components/UniverseView";
import MergeMediaModal from "@/components/MergeMediaModal";

export default function LibraryPage() {
  const router = useRouter();
  const [showMerge, setShowMerge] = useState(false);

  return (
    <PageContainer className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setShowMerge(true)}
          className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          🔗 Połącz tomy / odcinki
        </button>
      </div>
      <UniverseView onItemClick={(id) => router.push(`/media/${id}`)} />
      {showMerge && (
        <MergeMediaModal onClose={() => setShowMerge(false)} onSuccess={() => {}} />
      )}
    </PageContainer>
  );
}
