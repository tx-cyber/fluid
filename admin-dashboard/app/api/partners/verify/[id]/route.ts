import { NextRequest, NextResponse } from "next/server";
import { getPartnerById } from "@/lib/partners-data";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const partner = await getPartnerById(id);

  if (!partner || partner.status !== "approved") {
    return NextResponse.json({ certified: false }, { status: 404 });
  }

  return NextResponse.json({
    certified: true,
    id: partner.id,
    projectName: partner.projectName,
    websiteUrl: partner.websiteUrl,
    certifiedSince: partner.reviewedAt,
  });
}
