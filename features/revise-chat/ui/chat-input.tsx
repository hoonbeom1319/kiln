import { Button } from '@/shared/ui';

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  pending: boolean;
  error?: string | null;
}

// Pure presentation (conventions.md §5): the revise chat box. Cmd/Ctrl+Enter submits.
export function ChatInput({ value, onChange, onSubmit, pending, error }: ChatInputProps) {
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending) onSubmit();
      }}
    >
      <label htmlFor="revise-feedback" className="text-sm font-medium text-muted">
        수정 요청 — 프로젝트 전체 맥락을 이해하고 일관되게 다시 굽습니다
      </label>
      <textarea
        id="revise-feedback"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !pending) {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder="예) 전체를 다크 테마로 바꾸고 포인트 컬러를 오렌지로 통일해줘"
        rows={2}
        disabled={pending}
        className="w-full resize-y rounded-lg border border-border bg-surface-2 p-3 text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">⌘/Ctrl + Enter로 전송</span>
        <Button type="submit" size="sm" disabled={pending || !value.trim()}>
          {pending ? '다시 굽는 중…' : '수정 요청'}
        </Button>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </form>
  );
}
