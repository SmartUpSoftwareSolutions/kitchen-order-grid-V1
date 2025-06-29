// src/contexts/MuteContext.ts
import React, { createContext, useContext, useState, useRef } from 'react';

interface MuteContextType {
  isMuted: boolean;
  toggleMute: () => void;
}

const MuteContext = createContext<MuteContextType | undefined>(undefined);

export const MuteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMuted, setIsMuted] = useState(false);
  const muteTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (muteTimeoutRef.current) {
        clearTimeout(muteTimeoutRef.current);
        muteTimeoutRef.current = null;
      }
      console.debug('DEBUG (MuteContext): Sounds unmuted');
    } else {
      setIsMuted(true);
      if (muteTimeoutRef.current) {
        clearTimeout(muteTimeoutRef.current);
      }
      muteTimeoutRef.current = setTimeout(() => {
        setIsMuted(false);
        console.debug('DEBUG (MuteContext): Sounds automatically unmuted after 10 seconds');
      }, 10000);
    }
  };

  return (
    <MuteContext.Provider value={{ isMuted, toggleMute }}>
      {children}
    </MuteContext.Provider>
  );
};

export const useMute = () => {
  const context = useContext(MuteContext);
  if (!context) {
    throw new Error('useMute must be used within a MuteProvider');
  }
  return context;
};