import type { Metadata } from "next";
import { getPortalLinks } from "@/lib/portal-links";
import { PartnerApplicationForm } from "@/components/developer-portal/PartnerApplicationForm";

export async function generateMetadata(): Promise<Metadata> {
  const { siteUrl } = getPortalLinks();
  return {
    title: "Apply for Fluid Certified Partner",
    description: "Submit your dApp for Fluid Certified Partner status.",
    metadataBase: new URL(siteUrl),
    alternates: { canonical: "/partners/apply" },
    robots: { index: true, follow: true },
  };
}

export default function PartnerApplyPage() {
  return <PartnerApplicationForm />;
}
