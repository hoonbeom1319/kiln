import type { Config } from 'tailwindcss';

// FSD layers live at repo root (conventions.md §1) — scan them all for classes.
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './screens/**/*.{ts,tsx}',
    './widgets/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
    './entities/**/*.{ts,tsx}',
    './shared/**/*.{ts,tsx}',
    './application/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--canvas)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        border: 'var(--border)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-on': 'var(--accent-on)',
        glow: 'var(--glow)',
        ok: 'var(--ok)',
        warn: 'var(--warn)',
        danger: 'var(--danger)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
