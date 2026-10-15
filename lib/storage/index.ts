import path from 'node:path';
import { FileRoomStorage } from './file';
import { RedisRoomStorage } from './redis';
import { StorageUnavailableError, type RoomStorage } from './types';

let storage: RoomStorage | undefined;
export function getRoomStorage(): RoomStorage {
  if (storage) return storage;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) {
    const prefix =
      process.env.ROOM_STORE_PREFIX || `cabo:${process.env.VERCEL_ENV || 'development'}:room:`;
    storage = new RedisRoomStorage(url, token, prefix);
  } else if (process.env.VERCEL || url || token) {
    throw new StorageUnavailableError(
      'Multiplayer storage is not configured. Connect an Upstash Redis database in Vercel.',
    );
  } else {
    storage = new FileRoomStorage(path.join(process.cwd(), '.data', 'rooms'));
  }
  return storage;
}
