import { Button } from '@/shared/ui';

interface ForgeFormProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  pending: boolean;
  error?: string | null;
}

// Pure presentation (conventions.md §5): holds no domain logic, just wires props to the DOM.
export function ForgeForm({ value, onChange, onSubmit, pending, error }: ForgeFormProps) {
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending) onSubmit();
      }}
    >
      <label htmlFor="idea" className="text-sm font-medium text-muted">
        아이디어 한 줄 → 기획·디자인·handoff까지
      </label>
      <textarea
        id="idea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="예) 사내 점심 투표 앱"
        rows={3}
        disabled={pending}
        className="w-full resize-y rounded-lg border border-border bg-surface-2 p-3.5 font-serif text-lg text-text placeholder:font-sans placeholder:text-base placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60"
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !value.trim()}>
          {pending ? '🔥 가마에 불 붙이는 중…' : 'Forge 시작'}
        </Button>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </form>
  );
}
