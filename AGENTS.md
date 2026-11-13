# Agent guidelines

## The best design comes first

Always pick the design that is best for the library and its users in
general. Avoiding a breaking change is not a reason to settle for less, and
neither is how a particular app uses the library today. Consumers upgrade
when they need to.

- Breaking the public API is allowed, and encouraged, whenever it makes the
  code better. Never keep a worse design, an option that is typed but
  ignored, or a misleading name just to avoid a breaking change.
- Don't add compatibility shims, deprecated aliases or fallback code paths
  to keep old call sites working. Remove or change the old API outright.
- Don't hold back a fix or a refactor, or split it into a "safe" version,
  because it would break callers.
- Never choose a design for the release type it gets. When a problem has a
  clean fix that breaks callers and a weaker one that ships as a patch,
  take the clean fix and release it as a major version. The release type
  follows from the design, never the other way round.
- When a problem has more than one fix, compare them on their merits and
  take the cleanest, even when another keeps every caller working. Name the
  options you rejected in the pull request, and say why.

  Example: a first version of #291 kept `useObserve`'s subscription during
  render and released it with a 10 s timer, so that it could ship as a
  patch. The clean fix subscribes only after commit. It changes what the
  first render shows, so it ships as a major version.
- Judge a design on its merits for the general use case. Don't argue for or
  against it from how one app (oboku, for example) uses the library, and
  don't shape it around that app's code.
- Do say plainly in the pull request description what breaks and how a
  caller migrates (for example: "rename `retryDelay` to `initialInterval`").

## Checks

Run these before pushing; CI runs the same:

- `npm run check` (biome lint and format)
- `npm run build` (tsc and vite)
- `npm run test:ci` (vitest)
