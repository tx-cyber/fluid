import type { Metadata } from "next";
import { getPortalLinks } from "@/lib/portal-links";
import { fetchRecentTopics, getDiscourseConfig } from "@/lib/discourse";
import { ForumWidget } from "@/components/developer-portal/ForumWidget";

export async function generateMetadata(): Promise<Metadata> {
  const { siteUrl } = getPortalLinks();
  const title = "Fluid Community Forum";
  const description =
    "Browse recent discussions, get help, and connect with other Fluid developers in the community forum.";

  return {
    title,
    description,
    keywords: ["Fluid", "community", "forum", "Discourse", "Stellar", "support"],
    metadataBase: new URL(siteUrl),
    alternates: { canonical: "/forum" },
    openGraph: { title, description, url: `${siteUrl}/forum`, siteName: "Fluid", type: "website" },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: true, follow: true },
  };
}

export default async function ForumPage() {
  const config = getDiscourseConfig();
  const topics = await fetchRecentTopics(config, 10);

  return <ForumWidget topics={topics} config={config} />;
}
