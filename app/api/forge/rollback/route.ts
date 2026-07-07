import { NextResponse } from 'next/server';
import { createRollbackJob } from '@/server/controllers/forge-controller';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/forge/rollback — restore a project to a past version (non-destructive: stacks a new
// head). Body: { name, version }. Returns a job id; progress streams on /api/forge/[id]/stream.
export async function POST(request: Request) {
  let body: { name?: string; version?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문(JSON 아님)' }, { status: 400 });
  }

  const name = (body.name ?? '').trim();
  const version = Number(body.version);
  if (!name) return NextResponse.json({ error: '프로젝트(name)가 비어 있습니다' }, { status: 400 });
  if (!Number.isInteger(version) || version < 1) {
    return NextResponse.json({ error: '되돌릴 버전(version)이 올바르지 않습니다' }, { status: 400 });
  }

  try {
    const snapshot = await createRollbackJob(name, version);
    return NextResponse.json({ id: snapshot.id, name: snapshot.name, status: snapshot.status }, { status: 202 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 404 });
  }
}
