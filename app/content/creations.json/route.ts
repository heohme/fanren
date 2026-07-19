import { getCreationPayload } from "@/lib/atlas-data";

export const dynamic = "force-static";

export async function GET() {
  return Response.json(await getCreationPayload(), {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
  });
}
