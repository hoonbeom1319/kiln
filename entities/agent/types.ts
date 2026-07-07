// A local BYO coding agent the engine can drive (detected on the machine running the engine).
// The picker offers the available ones; the chosen alias is passed to forge/revise as `model`.
export interface AgentInfo {
  alias: string; // model alias passed to the engine (e.g. 'claude-code', 'codex')
  label: string; // human name for the picker
  available: boolean; // installed + runs --version
  version: string | null;
}

export interface AgentsResponse {
  agents: AgentInfo[];
  error?: string;
}
