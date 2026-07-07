import { NextResponse } from 'next/server';
import { createReviseJob } from '@/server/controllers/forge-controller';

// The revise engine uses Node APIs and runs for minutes — Node runtime, never statically optimized.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/forge/revise — start a chat-style revision of an existing project.
// Body: { name, feedback, model?, planner? }. Returns the job id; progress streams on
// /api/forge/[id]/stream (same as forge), and the new version lands in revisions.json.
export async function POST(request: Request) {
  let body: { name?: string; feedback?: string; model?: string; planner?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문(JSON 아님)' }, { status: 400 });
  }

  const name = (body.name ?? '').trim();
  const feedback = (body.feedback ?? '').trim();
  if (!name) return NextResponse.json({ error: '프로젝트(name)가 비어 있습니다' }, { status: 400 });
  if (!feedback) return NextResponse.json({ error: '피드백(feedback)이 비어 있습니다' }, { status: 400 });

  try {
    const snapshot = await createReviseJob({ name, feedback, model: body.model, planner: body.planner });
    return NextResponse.json({ id: snapshot.id, name: snapshot.name, status: snapshot.status }, { status: 202 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 404 });
  }
}
