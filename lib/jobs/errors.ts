// Errors a user may see. Any other error is logged in full on the server and
// shown as "{Kind label} failed. Please try again."
import { msgKindFailed } from "./limits";

export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

export function userMessage(e: unknown, kind: string): string {
  return e instanceof UserFacingError ? e.message : msgKindFailed(kind);
}
