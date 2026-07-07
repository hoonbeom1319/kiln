'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { reviseMutationOptions } from '@/entities/job';
import { ChatInput } from './ui/chat-input';

interface ReviseChatProps {
  name: string; // the project being revised
  // Lifts the started revise job id up to the screen, which streams progress + refreshes on done.
  onStarted: (jobId: string) => void;
  disabled?: boolean;
}

// Feature root (conventions.md §5): owns the feedback input + revise action, calls the entity
// mutation, hands the started job id upward. Thin — ChatInput is the presentation. Chat scope is
// the whole project (not a single screen) so a revision keeps cross-screen coherence.
export function ReviseChat({ name, onStarted, disabled }: ReviseChatProps) {
  const [feedback, setFeedback] = useState('');

  const mutation = useMutation({
    ...reviseMutationOptions(),
    onSuccess: (res) => {
      setFeedback('');
      onStarted(res.id);
    },
  });

  const submit = () => {
    const trimmed = feedback.trim();
    if (!trimmed) return;
    mutation.mutate({ name, feedback: trimmed });
  };

  return (
    <ChatInput
      value={feedback}
      onChange={setFeedback}
      onSubmit={submit}
      pending={mutation.isPending || Boolean(disabled)}
      error={mutation.error?.message ?? null}
    />
  );
}
