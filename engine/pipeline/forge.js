import { prdStage } from './stages/prd.js';
import { designStage } from './stages/design.js';
import { handoffStage } from './stages/handoff.js';

// Unattended forge = the three stages composed. Manual mode reuses the very same stage
// functions individually (bin/plan.js, bin/design.js), so there is one implementation.
//
// Default model = 'claude-code': the user's local agent does every role. The old cheap-build /
// strong-judge split was a hosted-API cost optimization; a single BYO subscription has no cheaper
// tier, so one agent builds and judges. Override per stage via opts (e.g. a hosted API for A/B).
/**
 * @param {{name:string,dir:string,idea?:string}} ctx
 * @param {{emit:Function, model?:string, judge?:string}} [opts]
 */
export async function forge(ctx, { emit, model = 'claude-code', judge = 'claude-code' } = {}) {
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
