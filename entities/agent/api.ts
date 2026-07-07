import type { AgentInfo, AgentsResponse } from './types';

// Fetch the local agents detected on the engine host. Never throws — returns [] on any failure
// so the picker degrades to a plain "no agent detected" state instead of breaking the page.
export async function fetchAgents(): Promise<AgentInfo[]> {
  try {
    const res = await fetch('/api/agents');
    if (!res.ok) return [];
    const data = (await res.json()) as AgentsResponse;
    return data.agents ?? [];
  } catch {
    return [];
  }
}
