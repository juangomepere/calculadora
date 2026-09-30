// Runs at worker startup (via execArgv --import), BEFORE the jsdom environment
// replaces AbortController/AbortSignal. Node's global fetch (undici) only accepts
// its own AbortSignal, so we stash Node's originals for the setup file to restore.
globalThis[Symbol.for('node.AbortController')] = globalThis.AbortController;
globalThis[Symbol.for('node.AbortSignal')] = globalThis.AbortSignal;
