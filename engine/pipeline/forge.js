import { prdStage } from './stages/prd.js';
import { designStage } from './stages/design.js';
import { handoffStage } from './stages/handoff.js';

// Unattended forge = the three stages composed. Manual mode reuses the very same stage
// functions individually (bin/plan.js, bin/design.js), so there is one implementation.
//
// Multi-model hybrid default (DECISIONS.md): cheap flash builds, strong pro judges the
// final hi-fi. Override per stage via opts.
/**
 * @param {{name:string,dir:string,idea?:string}} ctx
 * @param {{emit:Function, model?:string, judge?:string}} [opts]
 */
export async function forge(ctx, { emit, model = 'gemini-flash', judge = 'gemini-pro' } = {}) {
  const prd = await prdStage(ctx, { emit, model });
  const design = await designStage(ctx, { emit, model, judge });
  const handoff = await handoffStage(ctx, { emit });
  return {
    name: ctx.name,
    dir: ctx.dir,
    prdGate: prd.gate,
    verdict: design.verdict?.result,
    handoffGate: handoff.gate,
  };
}
