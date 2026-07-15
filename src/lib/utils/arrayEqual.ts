export const arrayEqual = <A, B>(a: readonly A[], b: readonly B[]) =>
  a.length === b.length && a.every((v, i) => (v as unknown) === b[i])
