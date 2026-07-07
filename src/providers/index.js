// Importing this module registers every built-in provider. Each file self-registers on
// import; the heavy SDKs inside gemini/claude are dynamically imported only on first use,
// so importing this file is cheap and never requires an SDK to be installed.
import './echo.js';
import './gemini.js';
import './claude.js';
