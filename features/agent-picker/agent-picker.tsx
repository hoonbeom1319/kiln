'use client';

import { useEffect } from 'react';
import { useAgents } from '@/entities/agent';

interface AgentPickerProps {
  value: string | null;
  onChange: (alias: string) => void;
  disabled?: boolean;
}

// Feature (conventions.md §5): choose which local BYO agent runs the forge/revise. Reads the
// detected agents, auto-selects the first available, and reports the chosen alias up. Execution
// happens on the user's own CLI (their auth/subscription) — the operator pays nothing.
export function AgentPicker({ value, onChange, disabled }: AgentPickerProps) {
  const { data: agents = [], isLoading } = useAgents();
  const available = agents.filter((a) => a.available);

  // Once detection resolves, default to the first available agent.
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
    <label className="flex items-center gap-2 text-xs text-muted">
      실행 모델
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="rounded-md border border-border bg-surface-2 px-2 py-1 text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60"
      >
        {agents.map((a) => (
          <option key={a.alias} value={a.alias} disabled={!a.available}>
            {a.label}
            {a.available ? '' : ' (미설치)'}
          </option>
        ))}
      </select>
    </label>
  );
}
