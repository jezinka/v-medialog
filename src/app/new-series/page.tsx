import PageContainer from "@/components/PageContainer";
import NewSeriesList from "@/components/NewSeriesList";
import { monthRange } from "@/lib/schedule";

export default async function NewSeriesRoute({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) {
  const { month } = await searchParams;
  // Opened from the schedule with its month; otherwise the browser's current month
  const initialMonth = typeof month === "string" && monthRange(month) ? month : null;
  return (
    <PageContainer>
      <NewSeriesList initialMonth={initialMonth} />
    </PageContainer>
  );
}
