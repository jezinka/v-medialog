"use client";

import { useRouter } from "next/navigation";
import CoverGallery from "@/components/CoverGallery";

export default function GalleryPage() {
  const router = useRouter();

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <CoverGallery onItemClick={(id) => router.push(`/media/${id}`)} />
    </main>
  );
}
