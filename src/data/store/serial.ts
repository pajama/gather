/**
 * Runs async tasks one at a time, in the order they were queued. A failed
 * task rejects its own promise and does not stop the ones after it.
 *
 * SQLite needs this: expo-sqlite's withTransactionAsync is not exclusive, so
 * two collections writing at once on the shared connection would interleave
 * their BEGIN/COMMIT statements ("cannot start a transaction within a
 * transaction") and lose writes.
 */
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task, task);
    this.tail = result.catch(() => undefined);
    return result;
  }
}
