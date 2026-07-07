'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { startForgeMutationOptions } from '@/entities/job';
import { ForgeForm } from './ui/forge-form';

interface ForgeRunProps {
  // Lifts the new job id up to the screen, which coordinates the progress + gallery views.
  onStarted: (jobId: string) => void;
  // The local BYO agent to run on (chosen in the picker). Runs on the user's own CLI.
  agent: string | null;
  disabled?: boolean;
}

// Feature root (conventions.md §5): owns the input state + start action, calls the entity
// mutation, and hands the started job id upward. Stays thin — the form is the presentation.
export function ForgeRun({ onStarted, agent, disabled }: ForgeRunProps) {
  const [idea, setIdea] = useState('');

  const mutation = useMutation({
    ...startForgeMutationOptions(),
    onSuccess: (res) => onStarted(res.id),
  });

  const submit = () => {
    const trimmed = idea.trim();
    if (!trimmed) return;
    // Runs on the selected local agent (default claude-code if unset). Tests/dev can still POST
    // { model: 'echo' } to /api/forge directly to exercise the offline mock.
    mutation.mutate({ idea: trimmed, ...(agent ? { model: agent } : {}) });
  };

  return (
    <ForgeForm
      value={idea}
      onChange={setIdea}
      onSubmit={submit}
      pending={mutation.isPending || Boolean(disabled)}
      error={mutation.error?.message ?? null}
    />
  );
}
