import { packHandoffZip } from '@/server/controllers/handoff-controller';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/handoff/<name> — download the project's handoff/ folder as a single zip. A dedicated
// segment (not the projects/[...path] file server) so it's a clean download URL. controller-only.
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const zip = await packHandoffZip(name);
  if (!zip) return new Response('handoff 없음', { status: 404 });

  return new Response(new Uint8Array(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}-handoff.zip"`,
      'Cache-Control': 'no-store',
    },
  });
}
