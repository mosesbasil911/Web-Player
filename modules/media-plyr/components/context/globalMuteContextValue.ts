import { createContext } from 'react';
import type { GlobalMuteManager } from '../../core/GlobalMuteManager.ts';

export interface GlobalMuteContextValue {
  muted: boolean;
  setMuted: (muted: boolean) => void;
  toggle: () => void;
  manager: GlobalMuteManager;
}

export const GlobalMuteContext = createContext<GlobalMuteContextValue | null>(
  null,
);
