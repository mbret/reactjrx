export const waitForTimeout = async (timeout: number) =>
  await new Promise<undefined>((resolve) => setTimeout(resolve, timeout))
