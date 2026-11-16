import { revalidateTag } from "next/cache";

/** Called by the API after admin changes so cached pages refresh straight away. */
export async function POST(req: Request) {
  if (req.headers.get("x-revalidate-secret") !== (process.env.REVALIDATE_SECRET ?? "dev-revalidate-secret")) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const { tags } = (await req.json().catch(() => ({ tags: [] }))) as { tags?: string[] };
  for (const t of tags ?? []) revalidateTag(t, "max");
  return Response.json({ ok: true, tags });
}
