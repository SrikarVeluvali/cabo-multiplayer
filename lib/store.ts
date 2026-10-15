import { randomBytes, randomInt } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { act, addLog, createRoom, player, publicRoom, tick } from './game';
import { getRoomStorage } from './storage';
import { StorageUnavailableError, type RoomStorage } from './storage/types';
import type { Action, Room } from './types';

const roomLifetime = 24 * 60 * 60 * 1_000;
const heartbeatInterval = 15_000;
function validateCode(code: string) {
  if (!/^[A-Z2-9]{6}$/.test(code)) throw new Error('Enter a valid six-character room code.');
}
function ttl(room: Room) {
  return Math.max(1, Math.ceil((room.updated + roomLifetime - Date.now()) / 1_000));
}

/** Reapply a pure mutation after a CAS conflict across serverless instances. */
export async function updateRoom<T>(
  code: string,
  mutation: (room: Room) => T,
  storage: RoomStorage = getRoomStorage(),
): Promise<T> {
  validateCode(code);
  for (let attempt = 0; attempt < 24; attempt++) {
    const previous = await storage.read(code);
    if (!previous) throw new Error('Room not found or expired. Check the code and try again.');
    const room = JSON.parse(previous) as Room;
    if (Date.now() - room.updated > roomLifetime)
      throw new Error('Room not found or expired. Check the code and try again.');
    const version = room.version;
    const result = mutation(room);
    if (JSON.stringify(room) === previous) return result;
    room.version = version + 1;
    if (await storage.compareAndSet(code, previous, JSON.stringify(room), ttl(room))) {
      if (result && typeof result === 'object' && 'version' in result)
        result.version = room.version;
      return result;
    }
    await setTimeout(Math.min(150, 8 * attempt) + randomInt(5, 25));
  }
  throw new StorageUnavailableError('This table is busy. Please try your move again.');
}

export async function openRoom(name: string) {
  const storage = getRoomStorage(),
    alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
    const token = randomBytes(32).toString('hex'),
      room = createRoom(code, name, token);
    if (await storage.create(code, JSON.stringify(room), ttl(room)))
      return { token, room: publicRoom(room, room.hostId) };
  }
  throw new StorageUnavailableError('Could not open a table. Please try again.');
}

export async function joinRoom(code: string, name: string) {
  const token = randomBytes(32).toString('hex'),
    guest = player(name);
  const room = await updateRoom(code, (room) => {
    if (room.phase !== 'lobby')
      throw new Error('This table is already playing. Ask the host to return to the lobby.');
    if (room.players.length >= 6)
      throw new Error('This table is full. The host can reduce computer opponents to make room.');
    room.players.push(guest);
    if (!room.players.some((p) => p.id === room.hostId && !p.bot)) room.hostId = guest.id;
    room.tokens[token] = guest.id;
    room.updated = Date.now();
    addLog(room, `${guest.name} joined the table.`);
    return publicRoom(room, guest.id);
  });
  return { token, room };
}

export async function roomRequest(code: string, token: string, action?: Action) {
  return updateRoom(code, (room) => {
    const id = Object.hasOwn(room.tokens, token) ? room.tokens[token] : undefined;
    if (!id) throw new Error('Your session expired. Join the room again.');
    const current = room.players.find((p) => p.id === id);
    if (current && Date.now() - current.connected >= heartbeatInterval)
      current.connected = Date.now();
    tick(room);
    if (action) act(room, id, action);
    return publicRoom(room, id);
  });
}
