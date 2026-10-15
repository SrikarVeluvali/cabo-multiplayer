import { StorageUnavailableError, type RoomStorage } from './types';

// Atomically compare the full snapshot; no expiring lock lease is needed.
const compareAndSetScript = `
  if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
  redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
  return 1
`;

export class RedisRoomStorage implements RoomStorage {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly prefix: string,
  ) {
    if (!url.startsWith('https://') || !token)
      throw new StorageUnavailableError('Room storage is not configured correctly.');
  }

  private async command<T>(command: (string | number)[]): Promise<T> {
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
        cache: 'no-store',
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) throw new StorageUnavailableError();
      const data = (await response.json()) as { result: T; error?: string };
      if (data.error) throw new StorageUnavailableError();
      return data.result;
    } catch {
      // Provider responses and connection credentials never reach the client.
      throw new StorageUnavailableError();
    }
  }

  read(code: string) {
    return this.command<string | null>(['GET', `${this.prefix}${code}`]);
  }
  async create(code: string, snapshot: string, ttlSeconds: number) {
    return (
      (await this.command<string | null>([
        'SET',
        `${this.prefix}${code}`,
        snapshot,
        'NX',
        'EX',
        ttlSeconds,
      ])) === 'OK'
    );
  }
  async compareAndSet(code: string, expected: string, snapshot: string, ttlSeconds: number) {
    return (
      (await this.command<number>([
        'EVAL',
        compareAndSetScript,
        1,
        `${this.prefix}${code}`,
        expected,
        snapshot,
        ttlSeconds,
      ])) === 1
    );
  }
}
