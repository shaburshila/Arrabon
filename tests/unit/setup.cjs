// Stub 'server-only' so parsers can be imported outside Next.js runtime.
// This file is loaded via --require before any test module is resolved.
require.cache[require.resolve("server-only")] = {
  id: "server-only",
  filename: "server-only",
  loaded: true,
  exports: {},
  paths: [],
  parent: null,
  children: [],
};
