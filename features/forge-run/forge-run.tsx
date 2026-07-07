'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { startForgeMutationOptions } from '@/entities/job';
import { ForgeForm } from './ui/forge-form';

interface ForgeRunProps {
  // Lifts the new job id up to the screen, which coordinates the progress + gallery views.
  onStarted: (jobId: string) => void;
  disabled?: boolean;
}

// Feature root (conventions.md §5): owns the input state + start action, calls the entity
// mutation, and hands the started job id upward. Stays thin — the form is the presentation.
export function ForgeRun({ onStarted, disabled }: ForgeRunProps) {
  const [idea, setIdea] = useState('');

  const mutation = useMutation({
    ...startForgeMutationOptions(),
    onSuccess: (res) => onStarted(res.id),
  });

  const submit = () => {
    const trimmed = idea.trim();
    if (!trimmed) return;
    // Model is server-default (gemini). Tests/dev exercise the echo mock by POSTing
    // { model: 'echo' } to /api/forge directly — no user-facing toggle needed.
    mutation.mutate({ idea: trimmed });
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
