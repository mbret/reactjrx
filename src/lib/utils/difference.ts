export const difference = <T>(a: T[], b: T[]) =>
  a.filter((element) => !b.includes(element));
