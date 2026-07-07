import { NextResponse } from 'next/server';
import { fetchSessions } from '@/server/controllers/project-controller';

// GET /api/projects — the home list of past forge sessions. Coexists with the artifact
// route at app/api/projects/[...path]/route.ts: this static segment handles exactly
// /api/projects; the catch-all handles /api/projects/<name>/... Both are Node runtime
// (reads the projects/ filesystem).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const sessions = await fetchSessions();
  return NextResponse.json({ sessions }, { headers: { 'Cache-Control': 'no-store' } });
}
