'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Action, PublicRoom } from '@/lib/types';

type Seat = { code: string; token: string };
export function useCabo() {
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [seat, setSeat] = useState<Seat | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [now, setNow] = useState(Date.now());
  const offset = useRef(0);
  const generation = useRef(0);
  const accepted = useRef<{ code: string; version: number; serverNow: number; gen: number } | null>(
    null,
  );
  const accept = useCallback((next: PublicRoom, gen: number) => {
    if (gen !== generation.current) return;
    const previous = accepted.current;
    // An in-flight poll can arrive after the action response. Ignore it before
    // changing the clock, or an expired card flight could become active again.
    if (
      previous?.gen === gen &&
      previous.code === next.code &&
      (next.version < previous.version || next.serverNow < previous.serverNow)
    )
      return;
    accepted.current = { code: next.code, version: next.version, serverNow: next.serverNow, gen };
    offset.current = next.serverNow - Date.now();
    setNow(next.serverNow);
    setRoom((old) => (old?.code === next.code && old.version > next.version ? old : next));
    setOffline(false);
  }, []);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('cabo-seat');
      if (saved) setSeat(JSON.parse(saved));
      else setRestoring(false);
    } catch {
      sessionStorage.removeItem('cabo-seat');
      setRestoring(false);
    }
    const timer = setInterval(() => setNow(Date.now() + offset.current), 100);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!seat) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const gen = generation.current;
    async function poll() {
      try {
        const res = await fetch(`/api/rooms?code=${encodeURIComponent(seat!.code)}`, {
          headers: { Authorization: `Bearer ${seat!.token}` },
          cache: 'no-store',
          signal: controller.signal,
        });
        const data = await res.json();
        if (stopped) return;
        if (!res.ok) {
          if (res.status === 400 || res.status === 401) {
            sessionStorage.removeItem('cabo-seat');
            setSeat(null);
            setRoom(null);
            setError(data.error);
            return;
          }
          throw new Error(data.error);
        }
        accept(data.room, gen);
      } catch {
        if (!stopped) setOffline(true);
      } finally {
        if (!stopped) {
          setRestoring(false);
          timer = setTimeout(poll, document.hidden ? 3000 : 650);
        }
      }
    }
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [seat, accept]);
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), 6500);
    return () => clearTimeout(timer);
  }, [error]);
  async function enter(type: 'create' | 'join', name: string, code?: string, practice = false) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const nextSeat = { code: data.room.code, token: data.token };
      generation.current++;
      sessionStorage.setItem('cabo-seat', JSON.stringify(nextSeat));
      accept(data.room, generation.current);
      setSeat(nextSeat);
      setRestoring(false);
      if (practice) {
        const response = await fetch('/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
          body: JSON.stringify({ code: data.room.code, action: { type: 'bots', count: 2 } }),
        });
        const updated = await response.json();
        if (!response.ok) throw new Error(updated.error);
        accept(updated.room, generation.current);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the table. Try again.');
    } finally {
      setBusy(false);
    }
  }
  async function action(action: Action) {
    if (!seat || busy) return;
    setBusy(true);
    setError('');
    const gen = generation.current;
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seat.token}` },
        body: JSON.stringify({ code: seat.code, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (action.type === 'leave') {
        generation.current++;
        sessionStorage.removeItem('cabo-seat');
        setSeat(null);
        setRoom(null);
      } else accept(data.room, gen);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The move could not be sent. Try again.');
    } finally {
      setBusy(false);
    }
  }
  return { room, busy, error, offline, restoring, now, enter, action, setError };
}
