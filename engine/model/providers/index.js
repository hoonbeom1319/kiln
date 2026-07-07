// Importing this module registers every built-in provider. Each file self-registers on import;
// the heavy SDK inside claude is dynamically imported only on first use, and the local-agent
// providers (claude-code, codex) shell out — so importing this file is cheap and needs no SDK.
import './echo.js';
import './claude.js';
import './claude-code.js';
import './codex.js';
