import "server-only";

/** An error whose message is safe to show the person who caused it. */
export class StoreError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
