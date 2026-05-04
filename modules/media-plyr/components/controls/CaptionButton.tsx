import { useEffect, useRef, useState } from 'react';
import type {
  MediaPlyrInstance,
  TextTrackChangeEvent,
  TextTrackInfo,
} from '../../types/index.ts';

interface CaptionButtonProps {
  player: MediaPlyrInstance | null;
}

function languageLabel(code: string): string {
  if (!code || code === 'und') return 'Default';
  try {
    const dn = new Intl.DisplayNames(undefined, { type: 'language' });
    return dn.of(code) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

function trackOptionLabel(track: TextTrackInfo): string {
  if (track.label) return track.label;
  return languageLabel(track.language);
}

function readPlayerState(player: MediaPlyrInstance | null) {
  if (!player)
    return {
      tracks: [] as TextTrackInfo[],
      activeId: null as number | null,
      visible: false,
    };
  const tracks = player.getTextTracks();
  const active = tracks.find((t) => t.active) ?? null;
  return {
    tracks,
    activeId: active?.id ?? null,
    visible: player.isTextVisible(),
  };
}

export function CaptionButton({ player }: CaptionButtonProps) {
  const [open, setOpen] = useState(false);
  const [tracks, setTracks] = useState<TextTrackInfo[]>(
    () => readPlayerState(player).tracks,
  );
  const [activeId, setActiveId] = useState<number | null>(
    () => readPlayerState(player).activeId,
  );
  const [visible, setVisible] = useState<boolean>(
    () => readPlayerState(player).visible,
  );
  const menuRef = useRef<HTMLDivElement>(null);

  // Reset on player identity change
  const [trackedPlayer, setTrackedPlayer] = useState(player);
  if (trackedPlayer !== player) {
    setTrackedPlayer(player);
    const next = readPlayerState(player);
    setTracks(next.tracks);
    setActiveId(next.activeId);
    setVisible(next.visible);
  }

  useEffect(() => {
    if (!player) return;

    const sync = (data?: unknown) => {
      const evt = data as TextTrackChangeEvent | undefined;
      const list = evt?.tracks ?? player.getTextTracks();
      setTracks(list);
      const active = evt?.active ?? list.find((t) => t.active) ?? null;
      setActiveId(active?.id ?? null);
      setVisible(evt?.visible ?? player.isTextVisible());
    };

    player.on('texttrackchange', sync);
    player.on('loaded', sync);
    return () => {
      player.off('texttrackchange', sync);
      player.off('loaded', sync);
    };
  }, [player]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  if (!player || tracks.length === 0) return null;

  const handleOff = () => {
    player.setTextVisible(false);
    setOpen(false);
  };

  const handleSelect = (track: TextTrackInfo) => {
    player.selectTextTrack(track.id);
    player.setTextVisible(true);
    setOpen(false);
  };

  const showingActive = visible && activeId !== null;

  return (
    <div className="media-plyr__captions" ref={menuRef}>
      <button
        className={`media-plyr__btn media-plyr__btn--captions${showingActive ? ' media-plyr__btn--active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={showingActive ? 'Captions on' : 'Captions off'}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="5" width="20" height="14" rx="3" />
          <path d="M7 14h2.5" />
          <path d="M7 11a2 2 0 0 1 2-2h.5" />
          <path d="M14 14h2.5" />
          <path d="M14 11a2 2 0 0 1 2-2h.5" />
        </svg>
      </button>

      {open && (
        <ul className="media-plyr__captions-menu" role="menu">
          <li role="menuitem">
            <button
              className={`media-plyr__captions-option${
                !showingActive ? ' media-plyr__captions-option--active' : ''
              }`}
              onClick={handleOff}
            >
              Off
            </button>
          </li>
          {tracks.map((track) => {
            const isSelected = showingActive && track.id === activeId;
            return (
              <li key={track.id} role="menuitem">
                <button
                  className={`media-plyr__captions-option${
                    isSelected ? ' media-plyr__captions-option--active' : ''
                  }`}
                  onClick={() => handleSelect(track)}
                >
                  {trackOptionLabel(track)}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
