import { EventEmitter } from './EventEmitter.ts';
import type {
  MediaTrack,
  RepeatMode,
  MediaPlyrEventType,
  MediaPlyrEventCallback,
  QueueState,
} from '../types/index.ts';

export class QueueManager {
  private tracks: MediaTrack[] = [];
  private originalOrder: MediaTrack[] = [];
  private currentIndex = -1;
  private repeat: RepeatMode = 'none';
  private shuffled = false;
  private emitter = new EventEmitter();

  constructor(tracks: MediaTrack[] = []) {
    if (tracks.length > 0) {
      this.tracks = [...tracks];
      this.originalOrder = [...tracks];
      this.currentIndex = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Public API – Navigation
  // ---------------------------------------------------------------------------

  getCurrentTrack(): MediaTrack | null {
    if (this.currentIndex < 0 || this.currentIndex >= this.tracks.length) return null;
    return this.tracks[this.currentIndex];
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  getState(): QueueState {
    return {
      tracks: [...this.tracks],
      currentIndex: this.currentIndex,
      repeat: this.repeat,
      shuffle: this.shuffled,
    };
  }

  next(): MediaTrack | null {
    if (this.tracks.length === 0) return null;

    if (this.repeat === 'one') {
      this.emitter.emit('trackchange', { index: this.currentIndex, track: this.getCurrentTrack() });
      return this.getCurrentTrack();
    }

    const nextLogical = this.currentIndex + 1;

    if (nextLogical >= this.tracks.length) {
      if (this.repeat === 'all') {
        this.currentIndex = 0;
      } else {
        return null;
      }
    } else {
      this.currentIndex = nextLogical;
    }

    const track = this.getCurrentTrack();
    this.emitter.emit('trackchange', { index: this.currentIndex, track });
    this.emitter.emit('queuechange', this.getState());
    return track;
  }

  prev(): MediaTrack | null {
    if (this.tracks.length === 0) return null;

    if (this.repeat === 'one') {
      this.emitter.emit('trackchange', { index: this.currentIndex, track: this.getCurrentTrack() });
      return this.getCurrentTrack();
    }

    const prevLogical = this.currentIndex - 1;

    if (prevLogical < 0) {
      if (this.repeat === 'all') {
        this.currentIndex = this.tracks.length - 1;
      } else {
        return null;
      }
    } else {
      this.currentIndex = prevLogical;
    }

    const track = this.getCurrentTrack();
    this.emitter.emit('trackchange', { index: this.currentIndex, track });
    this.emitter.emit('queuechange', this.getState());
    return track;
  }

  skipTo(index: number): MediaTrack | null {
    if (index < 0 || index >= this.tracks.length) return null;
    this.currentIndex = index;
    const track = this.getCurrentTrack();
    this.emitter.emit('trackchange', { index: this.currentIndex, track });
    this.emitter.emit('queuechange', this.getState());
    return track;
  }

  hasNext(): boolean {
    if (this.tracks.length === 0) return false;
    if (this.repeat === 'all' || this.repeat === 'one') return true;
    return this.currentIndex < this.tracks.length - 1;
  }

  hasPrev(): boolean {
    if (this.tracks.length === 0) return false;
    if (this.repeat === 'all' || this.repeat === 'one') return true;
    return this.currentIndex > 0;
  }

  // ---------------------------------------------------------------------------
  // Public API – Queue Mutation
  // ---------------------------------------------------------------------------

  setTracks(tracks: MediaTrack[]): void {
    this.tracks = [...tracks];
    this.originalOrder = [...tracks];
    this.currentIndex = tracks.length > 0 ? 0 : -1;
    this.shuffled = false;
    this.emitter.emit('queuechange', this.getState());
  }

  addTrack(track: MediaTrack, position?: number): void {
    if (position !== undefined && position >= 0 && position <= this.tracks.length) {
      this.tracks.splice(position, 0, track);
      if (position <= this.currentIndex) {
        this.currentIndex++;
      }
    } else {
      this.tracks.push(track);
    }
    this.originalOrder.push(track);
    if (this.currentIndex < 0) this.currentIndex = 0;
    this.emitter.emit('queuechange', this.getState());
  }

  removeTrack(index: number): void {
    if (index < 0 || index >= this.tracks.length) return;

    const removed = this.tracks[index];
    this.tracks.splice(index, 1);

    const origIdx = this.originalOrder.indexOf(removed);
    if (origIdx !== -1) this.originalOrder.splice(origIdx, 1);

    if (this.tracks.length === 0) {
      this.currentIndex = -1;
    } else if (index < this.currentIndex) {
      this.currentIndex--;
    } else if (index === this.currentIndex) {
      this.currentIndex = Math.min(this.currentIndex, this.tracks.length - 1);
    }

    this.emitter.emit('queuechange', this.getState());
  }

  reorder(fromIndex: number, toIndex: number): void {
    if (
      fromIndex < 0 || fromIndex >= this.tracks.length ||
      toIndex < 0 || toIndex >= this.tracks.length ||
      fromIndex === toIndex
    ) return;

    const [moved] = this.tracks.splice(fromIndex, 1);
    this.tracks.splice(toIndex, 0, moved);

    if (fromIndex === this.currentIndex) {
      this.currentIndex = toIndex;
    } else if (fromIndex < this.currentIndex && toIndex >= this.currentIndex) {
      this.currentIndex--;
    } else if (fromIndex > this.currentIndex && toIndex <= this.currentIndex) {
      this.currentIndex++;
    }

    this.emitter.emit('queuechange', this.getState());
  }

  clear(): void {
    this.tracks = [];
    this.originalOrder = [];
    this.currentIndex = -1;
    this.emitter.emit('queuechange', this.getState());
  }

  // ---------------------------------------------------------------------------
  // Public API – Repeat & Shuffle
  // ---------------------------------------------------------------------------

  setRepeat(mode: RepeatMode): void {
    this.repeat = mode;
    this.emitter.emit('repeat', { mode });
    this.emitter.emit('queuechange', this.getState());
  }

  getRepeat(): RepeatMode {
    return this.repeat;
  }

  setShuffle(enabled: boolean): void {
    if (this.shuffled === enabled) return;
    this.shuffled = enabled;

    const current = this.getCurrentTrack();

    if (enabled) {
      const rest = this.tracks.filter((_, i) => i !== this.currentIndex);
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      this.tracks = current ? [current, ...rest] : rest;
      this.currentIndex = current ? 0 : -1;
    } else {
      this.tracks = [...this.originalOrder];
      this.currentIndex = current
        ? this.tracks.indexOf(current)
        : 0;
      if (this.currentIndex === -1) this.currentIndex = 0;
    }

    this.emitter.emit('shuffle', { shuffle: enabled });
    this.emitter.emit('queuechange', this.getState());
  }

  getShuffle(): boolean {
    return this.shuffled;
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  on(event: MediaPlyrEventType, callback: MediaPlyrEventCallback): void {
    this.emitter.on(event, callback);
  }

  off(event: MediaPlyrEventType, callback: MediaPlyrEventCallback): void {
    this.emitter.off(event, callback);
  }

  destroy(): void {
    this.emitter.removeAllListeners();
  }
}
