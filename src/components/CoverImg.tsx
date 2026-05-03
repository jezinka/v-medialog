/**
 * CoverImg — renders a cover image.
 * Uses a plain <img> for locally stored covers (/api/covers/*) to avoid
 * Next.js Image optimization issues with runtime-written files.
 * Falls back to Next.js <Image> for external URLs (TMDB, OpenLibrary).
 */
import Image from "next/image";

interface Props {
  src: string;
  alt: string;
  className?: string;
  /** Used for Next.js Image fill mode — parent must have position:relative */
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
}

export default function CoverImg({ src, alt, className, fill, width, height, sizes }: Props) {
  const isLocal = src.startsWith("/api/covers/") || src.startsWith("/covers/");

  if (isLocal) {
    if (fill) {
      // fill mode: position absolute to fill parent
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className={`absolute inset-0 w-full h-full ${className ?? "object-cover"}`}
        />
      );
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
      />
    );
  }

  if (fill) {
    return <Image src={src} alt={alt} fill className={className} sizes={sizes} />;
  }
  return <Image src={src} alt={alt} width={width ?? 40} height={height ?? 56} className={className} sizes={sizes} />;
}
