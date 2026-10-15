'use client';
import { useEffect, useRef, useState } from 'react';
import type { PublicRoom } from '@/lib/types';

type Cue = 'card' | 'swap' | 'snap' | 'penalty' | 'buzzer' | 'cabo' | 'win' | 'deal';

// Small, locally synthesized effects: no audio downloads or tracking requests.
class TableAudio {
  context?: AudioContext;
  master?: GainNode;
  muted = false;
  async unlock() {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.muted ? 0 : 0.24;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') await this.context.resume();
    } catch {
      /* A browser without audio can still play the game. */
    }
  }
  mute(value: boolean) {
    this.muted = value;
    if (this.master && this.context)
      this.master.gain.setValueAtTime(value ? 0 : 0.24, this.context.currentTime);
  }
  play(cue: Cue) {
    const context = this.context,
      output = this.master;
    if (this.muted || !context || !output || context.state !== 'running') return;
    const start = context.currentTime;
    const tone = (
      frequency: number,
      offset: number,
      duration = 0.12,
      type: OscillatorType = 'sine',
    ) => {
      const oscillator = context.createOscillator(),
        envelope = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start + offset);
      envelope.gain.setValueAtTime(0, start + offset);
      envelope.gain.linearRampToValueAtTime(0.3, start + offset + 0.008);
      envelope.gain.exponentialRampToValueAtTime(0.001, start + offset + duration);
      oscillator.connect(envelope);
      envelope.connect(output);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + duration + 0.02);
      oscillator.onended = () => {
        oscillator.disconnect();
        envelope.disconnect();
      };
    };
    const brush = (offset: number, duration = 0.07) => {
      const buffer = context.createBuffer(
        1,
        Math.ceil(context.sampleRate * duration),
        context.sampleRate,
      );
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) * 0.28;
      const source = context.createBufferSource(),
        filter = context.createBiquadFilter();
      source.buffer = buffer;
      filter.type = 'bandpass';
      filter.frequency.value = 1800;
      source.connect(filter);
      filter.connect(output);
      source.start(start + offset);
      source.onended = () => {
        source.disconnect();
        filter.disconnect();
      };
    };
    if (cue === 'buzzer') {
      tone(210, 0, 0.19, 'triangle');
      tone(310, 0.08, 0.2, 'triangle');
    } else if (cue === 'penalty') {
      tone(260, 0);
      tone(185, 0.13, 0.18);
      brush(0.3);
    } else if (cue === 'snap') {
      brush(0, 0.04);
      tone(740, 0.025, 0.1, 'triangle');
    } else if (cue === 'cabo') {
      tone(392, 0);
      tone(523, 0.13);
      tone(784, 0.26, 0.24);
    } else if (cue === 'win') {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.25));
    } else if (cue === 'swap') {
      brush(0, 0.11);
      brush(0.18, 0.11);
      tone(330, 0.32, 0.055);
    } else if (cue === 'deal') {
      [0, 0.1, 0.2, 0.3].forEach((t) => brush(t));
    } else {
      brush(0);
      tone(180, 0.08, 0.055, 'triangle');
    }
  }
  close() {
    void this.context?.close().catch(() => {});
  }
}

export function useTableSounds(room: PublicRoom | null) {
  const [muted, setMuted] = useState(false);
  const audio = useRef<TableAudio | null>(null);
  const previous = useRef<PublicRoom | null>(null);
  useEffect(() => {
    const player = new TableAudio();
    audio.current = player;
    const saved = localStorage.getItem('cabo-muted') === 'true';
    player.mute(saved);
    setMuted(saved);
    const unlock = () => {
      if (!player.muted) void player.unlock();
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
      player.close();
    };
  }, []);
  useEffect(() => {
    const old = previous.current;
    previous.current = room;
    // Reconnecting must not replay the room's old sounds.
    if (!room || !old || old.code !== room.code || document.hidden) return;
    let cue: Cue | undefined;
    if (room.phase === 'results' && old.phase !== 'results') cue = 'win';
    else if (room.round !== old.round || (room.phase === 'peek' && old.phase !== 'peek'))
      cue = 'deal';
    else if (room.caboId && room.caboId !== old.caboId) cue = 'cabo';
    else if (room.snap && room.snap.pausedAt !== old.snap?.pausedAt) cue = 'buzzer';
    else if (room.movement?.id && room.movement.id !== old.movement?.id)
      cue =
        room.movement.kind === 'gift'
          ? 'snap'
          : room.movement.kind === 'discard'
            ? 'card'
            : room.movement.kind;
    else if (room.replacement?.at && room.replacement.at !== old.replacement?.at) cue = 'swap';
    else if (room.drawn?.id && room.drawn.id !== old.drawn?.id) cue = 'card';
    else if (JSON.stringify(room.looks) !== JSON.stringify(old.looks) && room.looks.length)
      cue = 'card';
    if (cue) audio.current?.play(cue);
  }, [room]);
  const toggle = () => {
    const next = !muted;
    setMuted(next);
    localStorage.setItem('cabo-muted', String(next));
    audio.current?.mute(next);
    if (!next) void audio.current?.unlock().then(() => audio.current?.play('card'));
  };
  return { muted, toggle };
}
