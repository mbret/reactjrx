export const arrayEqual = <A, B>(a: readonly A[], b: readonly B[]) => {
  if (a.length !== b.length) return false

  // A loop rather than `every`, which skips the holes of a sparse array.
  for (let index = 0; index < a.length; index++) {
    if ((a[index] as unknown) !== b[index]) return false
  }

  return true
}
