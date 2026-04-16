export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function listFromTextarea(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function stringifyPretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}
