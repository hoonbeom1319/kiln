'use client';

import { useEffect } from 'react';
import { useAgents } from '@/entities/agent';

interface AgentPickerProps {
  // Composite alias: the agent alias, optionally with a model suffix — "claude-code" or
  // "claude-code:opus". Passed straight down to forge/revise as `model`.
  value: string | null;
  onChange: (alias: string) => void;
  disabled?: boolean;
}

// Split a composite alias into its agent + model parts. No suffix → model '' (the CLI default).
function parse(value: string | null): { agent: string; model: string } {
  if (!value) return { agent: '', model: '' };
  const i = value.indexOf(':');
  return i === -1
    ? { agent: value, model: '' }
    : { agent: value.slice(0, i), model: value.slice(i + 1) };
}

// Rebuild the composite alias. Empty model → just the agent alias (no colon).
const compose = (agent: string, model: string) => (model ? `${agent}:${model}` : agent);

const selectCls =
  'rounded-md border border-border bg-surface-2 px-2 py-1 text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60';

// Feature (conventions.md §5): choose which local BYO agent — and which of its models — runs the
// forge/revise. Two dependent selects: the agent, then that agent's model menu (shown only when it
// offers a real choice). Every option runs on the user's own CLI/subscription — operator cost 0.
export function AgentPicker({ value, onChange, disabled }: AgentPickerProps) {
  const { data: agents = [], isLoading } = useAgents();
  const available = agents.filter((a) => a.available);

  const { agent: agentAlias, model: modelValue } = parse(value);
  const current = available.find((a) => a.alias === agentAlias) ?? null;
  const models = current?.models ?? [];

  // Once detection resolves, default to the first available agent (its own default model).
  useEffect(() => {
    if (!value && available.length) onChange(available[0].alias);
  }, [value, available, onChange]);

  if (isLoading) return <p className="text-xs text-muted">실행 모델 감지 중…</p>;

  if (!available.length) {
    return (
      <p className="text-xs text-warn">
        실행할 모델이 없습니다 — <code className="font-mono">claude</code> 또는{' '}
        <code className="font-mono">codex</code> CLI를 설치하세요. 실행은 당신의 구독으로, 운영자 비용 0.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
      <span className="whitespace-nowrap">실행 모델</span>
      <select
        aria-label="실행 에이전트"
        value={agentAlias}
        // Switching agent resets to that agent's default model (its menu differs).
        onChange={(e) => onChange(compose(e.target.value, ''))}
        disabled={disabled}
        className={selectCls}
      >
        {agents.map((a) => (
          <option key={a.alias} value={a.alias} disabled={!a.available}>
            {a.label}
            {a.available ? '' : ' (미설치)'}
          </option>
        ))}
      </select>

      {models.length > 1 ? (
        <select
          aria-label="모델"
          value={modelValue}
          onChange={(e) => onChange(compose(agentAlias, e.target.value))}
          disabled={disabled}
          className={selectCls}
        >
          {models.map((m) => (
            <option key={m.value || 'default'} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
