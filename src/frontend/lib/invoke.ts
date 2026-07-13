// invoke() may return the value directly or wrapped as { body, metadata };
// none of our resolver return types have a `body` field, so this check is a
// safe way to unwrap either form.
export const unwrap = <T,>(value: T | { body: T }): T =>
  typeof value === "object" && value !== null && "body" in value
    ? (value as { body: T }).body
    : (value as T);

export const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : "Something went wrong";
