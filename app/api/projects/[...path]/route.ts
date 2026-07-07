import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { PROJECTS_ROOT } from '@/pipeline/project.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// GET /api/projects/<name>/... — serve a generated artifact from projects/ so the gallery
// can iframe the hi-fi screens and handoff docs. Read-only; guarded against path traversal.
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const rel = normalize(join(...path)).replace(/^(\.\.[/\\])+/, '');
  const abs = join(PROJECTS_ROOT, rel);

  // Never escape the projects root.
  if (!abs.startsWith(PROJECTS_ROOT)) {
    return new Response('forbidden', { status: 403 });
  }

  try {
    const info = await stat(abs);
    if (!info.isFile()) return new Response('not found', { status: 404 });
    const data = await readFile(abs);
    const type = MIME[extname(abs).toLowerCase()] ?? 'application/octet-stream';
    return new Response(new Uint8Array(data), {
      headers: { 'Content-Type': type, 'Cache-Control': 'no-store' },
    });
  } catch {
    return new Response('not found', { status: 404 });
  }
}
