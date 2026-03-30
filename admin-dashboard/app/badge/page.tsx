import type { Metadata } from "next";
import { BadgeGenerator } from "@/components/developer-portal/BadgeGenerator";
import { getPortalLinks } from "@/lib/portal-links";

export async function generateMetadata(): Promise<Metadata> {
  const { siteUrl } = getPortalLinks();
  const title = "Powered-by-Fluid Badge Generator";
  const description =
    "Generate an embeddable SVG badge to signal gasless Stellar support in your dApp. Choose light, dark, or minimal style and copy the HTML or Markdown embed code.";

  return {
    title,
    description,
    metadataBase: new URL(siteUrl),
    alternates: { canonical: "/badge" },
    openGraph: { title, description, url: `${siteUrl}/badge`, siteName: "Fluid", type: "website" },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: true, follow: true },
  };
}

export default function BadgePage() {
  const serverUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      {/* Hero */}
      <section className="border-b border-border/80 bg-gradient-to-b from-sky-50/60 to-background">
        <div className="mx-auto max-w-3xl px-4 pb-12 pt-14 sm:px-6 lg:px-8">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-sky-600">
            Developer tools
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Badge Generator
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground">
            Add a <strong>Powered by Fluid</strong> badge to your dApp to show
            users their transactions are gasless. The badge is an SVG served
            directly by your Fluid server and optionally displays live
            sponsorship stats.
          </p>
        </div>
      </section>

      {/* Generator */}
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <BadgeGenerator serverUrl={serverUrl} />
      </main>
    </div>
  );
}
