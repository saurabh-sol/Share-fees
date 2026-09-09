const STORAGE_PREFIX = "accrued_vk:";

function storageKey(prefix: string) {
  return `${STORAGE_PREFIX}${prefix}`;
}

/** Persist plaintext acc_ key in this browser (local + session). */
export function cacheVirtualKeyPlaintext(prefix: string, plaintext: string) {
  if (typeof window === "undefined") return;
  const key = storageKey(prefix);
  try {
    localStorage.setItem(key, plaintext);
  } catch {
    /* quota / private mode */
  }
  try {
    sessionStorage.setItem(key, plaintext);
  } catch {
    /* unavailable */
  }
}

/** Read a cached plaintext key for this prefix, if the user minted it in this browser. */
export function readCachedVirtualKeyPlaintext(prefix: string): string | null {
  if (typeof window === "undefined") return null;
  const key = storageKey(prefix);
  try {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function clearCachedVirtualKeyPlaintext(prefix: string) {
  if (typeof window === "undefined") return;
  const key = storageKey(prefix);
  try {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  } catch {
    /* unavailable */
  }
}
