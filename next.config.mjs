import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // A stray lockfile in the home dir made Next infer the wrong workspace root. Pin tracing
  // to this repo so file tracing on `next build` stays inside kiln/.
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
  // The forge engine (engine/pipeline → engine/providers) dynamically imports the model SDKs
  // and spawns scripts/*.cjs gates via child_process. Keep these server-only packages external so
  // the bundler doesn't try to trace/inline them — they run on the Node runtime only.
  serverExternalPackages: ['@google/genai', '@anthropic-ai/sdk'],
};

export default nextConfig;
