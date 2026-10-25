import { BOOK_TYPES, SCREEN_TYPES } from "@/lib/utils";

/** Books and comics have parts ("Część") and reading history; everything else has seasons and watch history. */
export function partLabels(mediaType: string) {
  const isBook = BOOK_TYPES.includes(mediaType);
  return {
    isBook,
    hasSpecials: SCREEN_TYPES.includes(mediaType), // TMDB season 0
    partLabel: isBook ? "Część" : "Sezon",
    partsLabel: isBook ? "Części" : "Sezony",
    newPartLabel: isBook ? "Nowa część" : "Nowy sezon",
    historyLabel: isBook ? "Historia czytania" : "Historia oglądania",
  };
}
