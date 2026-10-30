/** Bounds an external operation without treating a timeout as authorization. */
export async function withAuthTimeout<T>(
  operation: Promise<T>,
  message: string,
  timeoutMs = 12000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
