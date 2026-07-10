'use client';

import { useCallback, useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { reviseMutationOptions } from '@/entities/job';
import { ChatInput } from './ui/chat-input';

interface ReviseChatProps {
  name: string; // the project being revised
  // Lifts the started revise job id up to the screen, which streams progress + refreshes on done.
  onStarted: (jobId: string) => void;
  // The local BYO agent to run the revision on (chosen in the picker).
  agent: string | null;
  disabled?: boolean;
}

// Feature root (conventions.md §5): owns the feedback input + revise action, calls the entity
// mutation, hands the started job id upward. Thin — ChatInput is the presentation. Chat scope is
// the whole project (not a single screen) so a revision keeps cross-screen coherence.
export function ReviseChat({ name, onStarted, agent, disabled }: ReviseChatProps) {
  const draftKey = `kiln:revise-draft:${name}`;
  const [feedback, setFeedback] = useState('');

  // Restore a draft typed before a refresh (per project) so a reload doesn't lose it. Client-only.
  // Restore only reads — it never writes, so it can't wipe the saved draft (persistence happens on
  // edit via updateFeedback below, not in an effect that would fire with the initial empty value).
  useEffect(() => {
    try {
      setFeedback(localStorage.getItem(draftKey) ?? '');
    } catch {
      /* storage unavailable */
    }
  }, [draftKey]);

  // Write-through on every edit: keep localStorage in step with the box, clearing it when empty.
  const updateFeedback = useCallback(
    (v: string) => {
      setFeedback(v);
      try {
        if (v) localStorage.setItem(draftKey, v);
        else localStorage.removeItem(draftKey);
      } catch {
        /* storage unavailable */
      }
    },
    [draftKey],
  );

  const mutation = useMutation({
    ...reviseMutationOptions(),
    onSuccess: (res) => {
      updateFeedback('');
      onStarted(res.id);
    },
  });

  const submit = () => {
    const trimmed = feedback.trim();
    if (!trimmed) return;
    mutation.mutate({ name, feedback: trimmed, ...(agent ? { model: agent } : {}) });
  };

  return (
    <ChatInput
      value={feedback}
      onChange={updateFeedback}
      onSubmit={submit}
      pending={mutation.isPending || Boolean(disabled)}
      error={mutation.error?.message ?? null}
    />
  );
}
