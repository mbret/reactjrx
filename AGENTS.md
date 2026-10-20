# Agent guidelines

## Breaking the public API is fine

Breaking the public API is allowed, and encouraged, whenever it makes the
code better. Never keep a worse design, an option that is typed but ignored,
or a misleading name just to avoid a breaking change. Consumers upgrade when
they need to.

- Don't add compatibility shims, deprecated aliases or fallback code paths
  to keep old call sites working. Remove or change the old API outright.
- Don't hold back a fix or a refactor, or split it into a "safe" version,
  because it would break callers.
- Do say plainly in the pull request description what breaks and how a
  caller migrates (for example: "rename `retryDelay` to `initialInterval`").

## Checks

Run these before pushing; CI runs the same:

- `npm run check` (biome lint and format)
- `npm run build` (tsc and vite)
- `npm run test:ci` (vitest)
