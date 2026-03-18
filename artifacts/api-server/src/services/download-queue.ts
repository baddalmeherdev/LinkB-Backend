// Concurrency-limited download queue
// Prevents server overload when many users download simultaneously

type Task<T> = () => Promise<T>;

class DownloadQueue {
  private readonly maxConcurrent: number;
  private running = 0;
  private readonly queue: Array<{ task: Task<unknown>; resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];

  constructor(maxConcurrent = 5) {
    this.maxConcurrent = maxConcurrent;
  }

  enqueue<T>(task: Task<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ task: task as Task<unknown>, resolve: resolve as (v: unknown) => void, reject });
      this.tick();
    });
  }

  private tick(): void {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) return;
    const item = this.queue.shift()!;
    this.running++;
    item.task()
      .then(item.resolve)
      .catch(item.reject)
      .finally(() => {
        this.running--;
        this.tick();
      });
  }

  get activeCount(): number { return this.running; }
  get pendingCount(): number { return this.queue.length; }
}

// Single shared queue for all download operations
export const downloadQueue = new DownloadQueue(5);
