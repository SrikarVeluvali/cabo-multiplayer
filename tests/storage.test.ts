import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRoom } from '../lib/game';
import { updateRoom } from '../lib/store';
import { FileRoomStorage } from '../lib/storage/file';

test('concurrent room mutations retry compare-and-set rather than overwriting each other', async () => {
  const base = path.resolve('.data');
  await mkdir(base, { recursive: true });
  const directory = await mkdtemp(path.join(base, 'cabo-test-'));
  try {
    const storage = new FileRoomStorage(directory),
      room = createRoom('ABC234', 'Host', 'token');
    assert.equal(await storage.create(room.code, JSON.stringify(room)), true);
    assert.equal(await storage.create(room.code, 'duplicate'), false);
    const writes = await Promise.allSettled(
      Array.from({ length: 12 }, () =>
        updateRoom(
          room.code,
          (r) => {
            r.round++;
            return r.round;
          },
          storage,
        ),
      ),
    );
    for (const result of writes) if (result.status === 'rejected') throw result.reason;
    const final = JSON.parse((await storage.read(room.code))!);
    assert.equal(final.round, 12);
    assert.equal(final.version, 12);
    assert.equal(await storage.compareAndSet(room.code, 'stale', 'overwritten'), false);
    assert.equal((await storage.read(room.code))!, JSON.stringify(final));
  } finally {
    assert.ok(path.resolve(directory).startsWith(base + path.sep + 'cabo-test-'));
    await rm(directory, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
  }
});
test('storage rejects traversal and malformed room codes', async () => {
  const storage = new FileRoomStorage(tmpdir());
  await assert.rejects(() => storage.read('../secret'), /Invalid room code/);
  await assert.rejects(() => updateRoom('bad', () => null, storage), /six-character/);
});
