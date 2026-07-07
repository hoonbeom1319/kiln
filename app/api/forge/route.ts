import { NextResponse } from 'next/server';
import { createForgeJob } from '@/server/controllers/forge-controller';

// The forge engine uses Node APIs (fs, child_process gates, dynamic SDK imports) and runs
// for minutes — Node runtime, never statically optimized.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/forge — start a run. Body: { idea, name?, model?, judge? }.
// Returns immediately with the job id; progress is streamed via /api/forge/[id]/stream.
export async function POST(request: Request) {
  let body: { idea?: string; name?: string; model?: string; judge?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문(JSON 아님)' }, { status: 400 });
  }

  const idea = (body.idea ?? '').trim();
  if (!idea) {
    return NextResponse.json({ error: '아이디어(idea)가 비어 있습니다' }, { status: 400 });
  }

  const snapshot = await createForgeJob({
    idea,
    name: body.name,
    model: body.model,
    judge: body.judge,
  });

  return NextResponse.json(
    { id: snapshot.id, name: snapshot.name, status: snapshot.status },
    { status: 202 },
  );
}
