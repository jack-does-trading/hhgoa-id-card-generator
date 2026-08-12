import type { Metadata, Viewport } from "next";
import { Imbue, Victor_Mono, Martel } from "next/font/google";
import AppShell from "@/components/AppShell";
import "./globals.css";

// Real HH Goa 2026 brand fonts, confirmed from hhgoa.com's own stylesheet
// (--font-imbue / --font-victor-mono custom properties + font-family rules).
// Both are free, open-source Google Fonts, self-hosted here via next/font.
const imbue = Imbue({
  variable: "--font-imbue",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const victorMono = Victor_Mono({
  variable: "--font-victor-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

// Bold slab-serif Devanagari display face — matches the saved reference look
// (high-contrast strokes, bracketed serifs, vintage Indian shop-signage feel)
// for the "हैकर हाउस" lettering painted onto the beach-shack backdrop's sign.
const martel = Martel({
  variable: "--font-martel",
  subsets: ["devanagari", "latin"],
  weight: ["800", "900"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Builder ID Card — HH Goa 2026",
  description:
    "Turn your photo into an on-brand HH Goa 2026 Builder ID Card. Upload, generate, download, share to X. #FrameInGoa",
  openGraph: {
    title: "Builder ID Card — HH Goa 2026",
    description:
      "Turn your photo into an on-brand HH Goa 2026 Builder ID Card.",
    url: siteUrl,
    siteName: "HH Goa 2026 Builder ID Card",
    images: ["/og-default.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Builder ID Card — HH Goa 2026",
    description:
      "Turn your photo into an on-brand HH Goa 2026 Builder ID Card.",
    images: ["/og-default.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0b6839",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${imbue.variable} ${victorMono.variable} ${martel.variable} h-full`}
    >
      {/*
        `sm:h-screen sm:overflow-hidden` locks the app to a single, non-
        scrolling viewport from tablet width up — the generator panel is
        sized/laid out (see BuilderIdCardApp) to actually fit within that,
        rather than this just clipping overflow. Below `sm:` (phones) it's
        left scrollable, since a tall form on a small screen genuinely needs
        it.
      */}
      <body className="min-h-full flex flex-col bg-[var(--bland-bg)] text-[var(--bland-fg)] antialiased sm:h-screen sm:overflow-hidden">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
