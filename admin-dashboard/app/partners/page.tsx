import type { Metadata } from "next";
import { Suspense } from "react";
import { getPortalLinks } from "@/lib/portal-links";
import { getApprovedPartners } from "@/lib/partners-data";
import { PartnerDirectory } from "@/components/developer-portal/PartnerDirectory";

export async function generateMetadata(): Promise<Metadata> {
  const { siteUrl } = getPortalLinks();
  const title = "Fluid Certified Partners";
  const description =
    "Discover vetted dApps and integrations that carry the Fluid Certified Partner badge — quality-assured Stellar integrations you can trust.";

  return {
    title,
    description,
    metadataBase: new URL(siteUrl),
    alternates: { canonical: "/partners" },
    openGraph: { title, description, url: `${siteUrl}/partners`, siteName: "Fluid", type: "website" },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: true, follow: true },
  };
}

export default async function PartnersPage() {
  const partners = await getApprovedPartners();
  return (
    <Suspense>
      <PartnerDirectory partners={partners} />
    </Suspense>
  );
}
