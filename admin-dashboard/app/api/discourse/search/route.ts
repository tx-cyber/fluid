import { NextRequest, NextResponse } from "next/server";
import { getDiscourseConfig, searchTopics } from "@/lib/discourse";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q") ?? "";

  if (!query.trim()) {
    return NextResponse.json({ results: [] });
  }

  const config = getDiscourseConfig();
  const results = await searchTopics(config, query);
  return NextResponse.json({ results });
}
