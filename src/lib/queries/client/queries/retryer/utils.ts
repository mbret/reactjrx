import { CancelledError } from "./CancelledError";

export function isCancelledError(value: any): value is CancelledError {
  return value instanceof CancelledError
}
