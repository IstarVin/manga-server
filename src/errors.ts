type errType = "Invalid request" | "Invalid passed body";

export function createErrorMessage(errType: errType, reason: object | string) {
  return {
    err: errType,
    reason: reason,
  };
}
