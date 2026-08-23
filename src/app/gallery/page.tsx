"use client";

import { useRouter } from "next/navigation";
import PageContainer from "@/components/PageContainer";
import CoverGallery from "@/components/CoverGallery";

export default function GalleryPage() {
  const router = useRouter();

  return (
    <PageContainer>
      <CoverGallery onItemClick={(id) => router.push(`/media/${id}`)} />
    </PageContainer>
  );
}
