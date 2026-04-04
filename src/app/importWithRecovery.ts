const CHUNK_RETRY_KEY = 'mateo:chunk-retry-once';

const chunkFailurePatterns = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /Loading chunk [\d\w-]+ failed/i,
  /error loading dynamically imported module/i
];

const canUseSessionStorage = () => typeof window !== 'undefined' && 'sessionStorage' in window;

const isRecoverableChunkError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  return chunkFailurePatterns.some((pattern) => pattern.test(message));
};

const clearChunkRetryFlag = () => {
  if (!canUseSessionStorage()) {
    return;
  }

  window.sessionStorage.removeItem(CHUNK_RETRY_KEY);
};

export const importWithRecovery = async <T>(loader: () => Promise<T>) => {
  try {
    const loaded = await loader();
    clearChunkRetryFlag();
    return loaded;
  } catch (error) {
    if (
      isRecoverableChunkError(error) &&
      canUseSessionStorage() &&
      !window.sessionStorage.getItem(CHUNK_RETRY_KEY)
    ) {
      window.sessionStorage.setItem(CHUNK_RETRY_KEY, '1');
      window.location.reload();

      return new Promise<never>(() => undefined);
    }

    throw error;
  }
};
