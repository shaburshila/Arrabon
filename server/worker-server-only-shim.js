// Makes `server-only` a no-op when running as a standalone worker process.
// The package throws outside Next.js; the worker runs in plain Node.js where
// the bundler guard is irrelevant — all modules here are already server-side.
const resolvedPath = require.resolve("server-only");
require.cache[resolvedPath] = {
  id: resolvedPath,
  filename: resolvedPath,
  loaded: true,
  exports: {},
  parent: null,
  children: [],
  paths: [],
};
