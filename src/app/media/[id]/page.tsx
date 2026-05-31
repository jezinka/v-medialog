"use client";

import { useParams, useRouter } from "next/navigation";
import ItemDetailPage from "@/components/ItemDetailPage";

export default function MediaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const mediaId = parseInt(id, 10);

  if (isNaN(mediaId)) return <p className="p-8 text-red-500">Nieprawidłowe ID medium.</p>;

  return (
    <ItemDetailPage
      mediaId={mediaId}
      onClose={() => router.push("/media")}
      onOpenPerson={(personId) => router.push(`/people/${personId}`)}
      onOpenDetail={(id) => router.push(`/media/${id}`)}
    />
  );
}
