"use client";

import { useParams, useRouter } from "next/navigation";
import PersonDetailPage from "@/components/PersonDetailPage";

export default function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const personId = parseInt(id, 10);

  if (isNaN(personId)) return <p className="p-8 text-red-500">Nieprawidłowe ID osoby.</p>;

  return (
    <PersonDetailPage
      personId={personId}
      onBack={() => router.back()}
      onOpenMedia={(mediaId) => router.push(`/media/${mediaId}`)}
    />
  );
}
