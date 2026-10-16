import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { setTimeout as pause } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { RoomStorage } from './types';

const globalQueues = globalThis as typeof globalThis & {
  caboFileQueues?: Map<string, Promise<unknown>>;
};

/** Development fallback only. Vercel always uses shared Redis storage. */
export class FileRoomStorage implements RoomStorage {
  constructor(private readonly directory: string) {}
  private file(code: string) {
    if (!/^[A-Z2-9]{6}$/.test(code)) throw new Error('Invalid room code.');
    return path.join(this.directory, `${code}.json`);
  }
  private async readSnapshot(code: string) {
    try {
      return await readFile(this.file(code), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }
  async read(code: string) {
    // Windows cannot replace a file while another request has a read handle open.
    return this.exclusive(code, () => this.readSnapshot(code));
  }
  private async exclusive<T>(code: string, work: () => Promise<T>): Promise<T> {
    const queues = (globalQueues.caboFileQueues ??= new Map());
    const key = this.file(code);
    const pending = (queues.get(key) || Promise.resolve()).then(work, work);
    queues.set(key, pending);
    try {
      return await pending;
    } finally {
      if (queues.get(key) === pending) queues.delete(key);
    }
  }
  async create(code: string, snapshot: string) {
    return this.exclusive(code, async () => {
      await mkdir(this.directory, { recursive: true });
      try {
        await writeFile(this.file(code), snapshot, { flag: 'wx' });
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
        throw error;
      }
    });
  }
  async compareAndSet(code: string, expected: string, snapshot: string) {
    return this.exclusive(code, async () => {
      if ((await this.readSnapshot(code)) !== expected) return false;
      const target = this.file(code),
        temporary = `${target}.${randomUUID()}.tmp`;
      await writeFile(temporary, snapshot);
      try {
        // Windows indexing/antivirus can briefly hold the destination even
        // after our own read has closed. Keep the atomic replacement and room
        // queue intact while retrying only these transient sharing failures.
        for (let attempt = 0; ; attempt++) {
          try {
            await rename(temporary, target);
            break;
          } catch (error) {
            const code = (error as NodeJS.ErrnoException).code;
            if (
              process.platform !== 'win32' ||
              !['EPERM', 'EBUSY', 'EACCES'].includes(code ?? '') ||
              attempt >= 4
            )
              throw error;
            await pause(25 * 2 ** attempt);
          }
        }
      } finally {
        await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== 'ENOENT') throw error;
        });
      }
      return true;
    });
  }
}
