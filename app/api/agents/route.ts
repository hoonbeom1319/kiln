import { NextResponse } from 'next/server';
import { detectAgents } from '@/engine/model/agents.js';

// Detection spawns child processes (where/which + --version) — Node runtime, never static.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AgentRow {
  alias: string;
  label: string;
  available: boolean;
  version?: string | null;
}

// GET /api/agents — which local BYO agents are installed on the machine running the engine.
// The client shows the available ones in the picker; execution runs on the user's own CLI.
export async function GET() {
  try {
    const agents = (await detectAgents()) as AgentRow[];
    return NextResponse.json({
      agents: agents.map((a) => ({
        alias: a.alias,
        label: a.label,
        available: a.available,
        version: a.version ?? null,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ agents: [], error: msg }, { status: 500 });
  }
}
