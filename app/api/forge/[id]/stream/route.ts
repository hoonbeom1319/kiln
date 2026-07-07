import { openJobStream } from '@/server/controllers/forge-controller';
import type { KilnEvent } from '@/server/types/job';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/forge/[id]/stream — Server-Sent Events. Replays the buffered events (so a client
// that connects late sees the whole run), then streams live ones off the emit seam, and
// closes when the pipeline emits done/error.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let lastSeq = -1; // dedupe guard: never send an event whose seq we already sent

      const send = (ev: KilnEvent) => {
        if (closed || ev.seq <= lastSeq) return;
        lastSeq = ev.seq;
        controller.enqueue(encoder.encode(`id: ${ev.seq}\ndata: ${JSON.stringify(ev)}\n\n`));
      };

      const finish = () => {
        if (closed) return;
        closed = true;
        try {
          handle?.close();
        } catch {
          /* already gone */
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      const isEnd = (ev: KilnEvent) => ev.type === 'done' || ev.type === 'error';

      // Buffer live events that arrive during the replay loop so ordering stays correct;
      // flush them once replay is done.
      let replaying = true;
      const pending: KilnEvent[] = [];
      const deliver = (ev: KilnEvent) => {
        send(ev);
        if (isEnd(ev)) finish();
      };

      const handle = openJobStream(id, (ev) => {
        if (replaying) pending.push(ev);
        else deliver(ev);
      });

      if (!handle) {
        controller.enqueue(encoder.encode(`event: notfound\ndata: {"error":"job 없음"}\n\n`));
        controller.close();
        return;
      }

      for (const ev of handle.events) send(ev);
      const last = handle.events[handle.events.length - 1];
      replaying = false;
      for (const ev of pending) {
        if (closed) break;
        deliver(ev);
      }
      if (!closed && (handle.terminal || (last && isEnd(last)))) {
        finish();
        return;
      }

      request.signal.addEventListener('abort', finish);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
