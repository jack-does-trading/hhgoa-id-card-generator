import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { decodeShareId } from "@/lib/shareId";
import { CARD_WIDTH, CARD_HEIGHT } from "@/lib/generateCard";

type Params = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const imageUrl = decodeShareId(id);

  const title = "My HH Goa 2026 Builder ID Card";
  const description = "Generated with the HH Goa 2026 Builder ID Card Generator. #FrameInGoa";

  if (!imageUrl) {
    return { title, description };
  }

  const image = {
    url: imageUrl,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  };

  return {
    title,
    description,
    openGraph: { title, description, images: [image] },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function SharedCardPage({ params }: { params: Params }) {
  const { id } = await params;
  const imageUrl = decodeShareId(id);
  if (!imageUrl) notFound();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-hh-green px-5 py-12 text-center">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl shadow-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="HH Goa 2026 Builder ID Card" className="w-full" />
      </div>
      <a
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
          "Just got my HH Goa 2026 ticket to 247 , ayoo where my sunglasses at🌴⚡️ #FrameInGoa"
        )}&url=${encodeURIComponent(`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/r/${id}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full bg-hh-pink px-6 py-3 text-sm font-bold text-white"
      >
        Share to 𝕏
      </a>
      <Link
        href="/"
        className="font-[family-name:var(--font-display)] text-lg font-bold text-hh-yellow underline"
      >
        Make your own Builder ID Card →
      </Link>
    </div>
  );
}
