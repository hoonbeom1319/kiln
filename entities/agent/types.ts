// One selectable model within an agent. `value` is the model id passed to the CLI (`--model`);
// '' means the CLI's own default (no --model). The picker builds the composite alias
// `${agent.alias}:${value}` (or just the alias when value is '').
export interface AgentModel {
  value: string;
  label: string;
}

// A local BYO coding agent the engine can drive (detected on the machine running the engine).
// The picker offers the available ones; the chosen alias is passed to forge/revise as `model`.
export interface AgentInfo {
  alias: string; // model alias passed to the engine (e.g. 'claude-code', 'codex')
  label: string; // human name for the picker
  available: boolean; // installed + runs --version
  models: AgentModel[]; // per-agent model menu (all cost 0 — run on the user's own CLI)
  version: string | null;
}

export interface AgentsResponse {
  agents: AgentInfo[];
  error?: string;
}
