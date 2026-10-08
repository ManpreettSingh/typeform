export type SaveStatus = "saved" | "saving" | "error";

type Patch = Record<string, unknown>;
type Run = (patch: Patch) => Promise<void>;
type Pending = { patch: Patch; run: Run; timer: ReturnType<typeof setTimeout> };

/**
 * Debounced, per-key save queue.
 *
 * - Edits to the same key (e.g. one question) merge into one patch until the debounce fires.
 * - Saves for the same key run strictly in order, so a slow request can't overwrite a newer one.
 * - `run` should roll back + report its own failure and then rethrow, so status becomes "error".
 */
export class Autosaver {
  private pending = new Map<string, Pending>();
  private chains = new Map<string, Promise<void>>();
  private inFlight = 0;
  private failed = false;

  constructor(private readonly onStatus: (status: SaveStatus) => void) {}

  queue(key: string, patch: Patch, run: Run, delayMs: number): void {
    const existing = this.pending.get(key);
    if (existing) clearTimeout(existing.timer);
    this.pending.set(key, {
      patch: { ...existing?.patch, ...patch },
      run,
      timer: setTimeout(() => void this.flush(key), delayMs),
    });
    this.emit();
  }

  /** Runs a one-off action (create/delete) in the key's order, counting it toward the save status. */
  now(key: string, run: () => Promise<void>): Promise<void> {
    return this.enqueue(key, run);
  }

  flush(key: string): Promise<void> {
    const entry = this.pending.get(key);
    if (!entry) return this.chains.get(key) ?? Promise.resolve();
    clearTimeout(entry.timer);
    this.pending.delete(key);
    return this.enqueue(key, () => entry.run(entry.patch));
  }

  /** Sends everything pending and resolves once all saves have settled. */
  async flushAll(): Promise<void> {
    await Promise.all([...this.pending.keys()].map((key) => this.flush(key)));
    await Promise.all(this.chains.values());
  }

  /** Drops an unsent patch (e.g. the question was deleted or rolled back). */
  cancel(key: string): void {
    const entry = this.pending.get(key);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(key);
    this.emit();
  }

  hasPending(key: string): boolean {
    return this.pending.has(key);
  }

  get busy(): boolean {
    return this.pending.size > 0 || this.inFlight > 0;
  }

  private enqueue(key: string, task: () => Promise<void>): Promise<void> {
    this.inFlight++;
    this.emit();
    const previous = this.chains.get(key) ?? Promise.resolve();
    const next = previous
      .then(task)
      .then(
        () => {
          this.failed = false;
        },
        () => {
          this.failed = true;
        },
      )
      .finally(() => {
        this.inFlight--;
        if (this.chains.get(key) === next) this.chains.delete(key);
        this.emit();
      });
    this.chains.set(key, next);
    return next;
  }

  private emit() {
    this.onStatus(this.busy ? "saving" : this.failed ? "error" : "saved");
  }
}
