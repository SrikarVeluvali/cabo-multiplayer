/** Raw snapshots let storage atomically compare the entire prior state. */
export interface RoomStorage {
  read(code: string): Promise<string | null>;
  create(code: string, snapshot: string, ttlSeconds: number): Promise<boolean>;
  compareAndSet(
    code: string,
    expected: string,
    snapshot: string,
    ttlSeconds: number,
  ): Promise<boolean>;
}

export class StorageUnavailableError extends Error {
  constructor(message = 'The room service is temporarily unavailable. Please try again.') {
    super(message);
    this.name = 'StorageUnavailableError';
  }
}
