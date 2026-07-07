import type { Metadata } from 'next';
import { Providers } from '@/application/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kiln — 아이디어를 굽는다',
  description: '한 줄 아이디어 → PRD · 디자인 · handoff. 진행 실시간 스트리밍.',
};

// Routing host (conventions.md §2.2): wraps children in the application providers, nothing more.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
