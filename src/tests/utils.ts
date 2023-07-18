export const waitForTimeout = async (timeout: number) =>
  await new Promise((resolve) => setTimeout(resolve, timeout))
