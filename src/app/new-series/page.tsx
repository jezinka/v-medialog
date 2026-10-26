import PageContainer from "@/components/PageContainer";
import NewSeriesList from "@/components/NewSeriesList";
import { monthRange } from "@/lib/schedule";
import { NEW_SERIES_COUNTRIES, NEW_SERIES_PLATFORMS } from "@/lib/new-series";

type Params = { month?: string | string[]; country?: string | string[]; platform?: string | string[] };

export default async function NewSeriesRoute({ searchParams }: { searchParams: Promise<Params> }) {
  const { month, country, platform } = await searchParams;
  // From a link or a reload; anything unknown falls back to the current month and no filter
  return (
    <PageContainer>
      <NewSeriesList
        initialMonth={typeof month === "string" && monthRange(month) ? month : null}
        initialCountry={typeof country === "string" && NEW_SERIES_COUNTRIES.includes(country) ? country : ""}
        initialPlatform={typeof platform === "string" && NEW_SERIES_PLATFORMS.includes(platform) ? platform : ""}
      />
    </PageContainer>
  );
}
