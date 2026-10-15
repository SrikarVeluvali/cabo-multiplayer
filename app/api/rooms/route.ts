import { joinRoom, openRoom, roomRequest } from '@/lib/store';
import type { Action } from '@/lib/types';
import { StorageUnavailableError } from '@/lib/storage/types';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
function failure(e: unknown) {
  return Response.json(
    { error: e instanceof Error ? e.message : 'Something went wrong. Please try again.' },
    {
      status: e instanceof StorageUnavailableError ? 503 : 400,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
export async function POST(req: Request) {
  try {
    const origin = req.headers.get('origin');
    if (origin && new URL(origin).host !== req.headers.get('host'))
      return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
    const raw = await req.text();
    if (raw.length > 8192)
      return Response.json({ error: 'The request is too large.' }, { status: 413 });
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object') throw new Error('Choose a valid game action.');
    if (body.type === 'create' || body.type === 'join') {
      if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 20)
        throw new Error('Enter a display name of 1–20 characters.');
      return Response.json(
        body.type === 'create'
          ? await openRoom(body.name)
          : await joinRoom(String(body.code).toUpperCase(), body.name),
      );
    }
    const token = req.headers.get('authorization')?.replace(/^Bearer /, '');
    if (!token) return Response.json({ error: 'Sign in to your seat again.' }, { status: 401 });
    if (!body.action || typeof body.action.type !== 'string')
      throw new Error('Choose a valid game action.');
    return Response.json({
      room: await roomRequest(String(body.code).toUpperCase(), token, body.action as Action),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function GET(req: Request) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer /, '');
    if (!token) return Response.json({ error: 'Missing seat token.' }, { status: 401 });
    return Response.json(
      {
        room: await roomRequest(
          new URL(req.url).searchParams.get('code')?.toUpperCase() || '',
          token,
        ),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return failure(e);
  }
}
