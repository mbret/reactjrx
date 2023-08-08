/**
 * @important
 * The empty key `[]` is a special case and will not
 * be used to register cache, deduplicate, etc. It's a key
 * that is supposed to be valid in its own context (not shareable).
 *
 * It is the equivalent of passing undefined key and can be used
 * on isolated query when there is no need for key.
 */
export type QueryKey = readonly unknown[]
