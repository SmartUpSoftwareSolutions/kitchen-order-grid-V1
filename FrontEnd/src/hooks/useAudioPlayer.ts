
// src/hooks/useAudioPlayer.ts
import { useState, useEffect, useRef } from 'react';
import { SoundSettings } from '@/types/SoundSettings';

export const useAudioPlayer = (soundSettings?: SoundSettings) => {
  const [needsInteraction, setNeedsInteraction] = useState(() => {
    if (typeof window !== 'undefined') {
      const audioEnabled = localStorage.getItem('kds_audio_enabled');
      return audioEnabled === null;
    }
    return true;
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentSound, setCurrentSound] = useState<string | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const [isLooping, setIsLooping] = useState<boolean>(false);

  // Default sound settings if none provided
  const defaultSoundSettings: SoundSettings = {
    enabled: true,
    newOrderSound: true,
    nearFinishedSound: true,
    volume: 0.7,
    hasCustomNewOrderSound: false,
    hasCustomNearFinishedSound: false,
    customNewOrderFileName: undefined,
    customNearFinishedFileName: undefined,
  };

  const settings = soundSettings || defaultSoundSettings;

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = settings.volume;
    audioRef.current.preload = 'auto';
    audioRef.current.loop = isLooping;

    const testAutoplay = async () => {
      if (!audioRef.current || !needsInteraction) return;

      try {
        const silentAudioData = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQEAAAC/';
        audioRef.current.src = silentAudioData;
        audioRef.current.volume = 0;

        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          await playPromise;
          setNeedsInteraction(false);
          localStorage.setItem('kds_audio_enabled', 'true');
          audioRef.current?.pause();
          console.log('DEBUG (useAudioPlayer): Autoplay allowed, audio context ready');
        }
      } catch (error) {
        console.log('DEBUG (useAudioPlayer): Autoplay blocked, needs user interaction:', error);
        setNeedsInteraction(true);
        localStorage.setItem('kds_audio_enabled', 'false');
      } finally {
        if (audioRef.current) {
          audioRef.current.src = '';
          audioRef.current.volume = settings.volume;
        }
      }
    };

    testAutoplay();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, [isLooping]);

  // Update volume when settings change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = settings.volume;
    }
  }, [settings.volume]);

  const enableAudio = async () => {
    if (!audioRef.current) return false;

    try {
      const silentAudioData = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQEAAAC/';
      audioRef.current.src = silentAudioData;
      audioRef.current.volume = 0;

      await audioRef.current.play();
      audioRef.current.pause();

      audioRef.current.src = '';
      audioRef.current.volume = settings.volume;

      setNeedsInteraction(false);
      localStorage.setItem('kds_audio_enabled', 'true');
      console.log('DEBUG (useAudioPlayer): Audio context enabled by user interaction');
      return true;
    } catch (error) {
      console.error('DEBUG (useAudioPlayer): Failed to enable audio:', error);
      return false;
    }
  };

  const playSound = async (isNewOrder: boolean) => {
    if (!settings.enabled || !audioRef.current) {
      console.log('DEBUG (useAudioPlayer): Audio disabled or no audio element');
      return;
    }
    if (isNewOrder && !settings.newOrderSound) {
      console.log('DEBUG (useAudioPlayer): New order sound disabled');
      return;
    }
    if (!isNewOrder && !settings.nearFinishedSound) {
      console.log('DEBUG (useAudioPlayer): Order completed sound disabled');
      return;
    }

    const apiUrl = import.meta.env.VITE_API_URL || 'http://192.168.1.102:3000';
    const customFileName = isNewOrder
      ? settings.customNewOrderFileName
      : settings.customNearFinishedFileName;
    const defaultSound = isNewOrder ? '/sounds/new_order.mp3' : '/sounds/order_completed.mp3';
    let soundUrl = defaultSound;

    // Check if custom sound exists
    if (customFileName && (isNewOrder ? settings.hasCustomNewOrderSound : settings.hasCustomNearFinishedSound)) {
      try {
        const response = await fetch(`${apiUrl}/api/audio/check-audio?fileName=${customFileName}`);
        const data = await response.json();
        if (data.exists) {
          soundUrl = `${apiUrl}/api/audio/play-audio?fileName=${customFileName}`;
        }
      } catch (error) {
        console.error('DEBUG (useAudioPlayer): Error checking custom sound:', error);
      }
    }

    if (currentSound === soundUrl && !audioRef.current.paused) {
      console.log('DEBUG (useAudioPlayer): Sound already playing, skipping');
      return;
    }

    setCurrentSound(soundUrl);
    audioRef.current.src = soundUrl;
    audioRef.current.loop = isLooping;

    const attemptPlay = async (retries = 3): Promise<void> => {
      for (let i = 0; i < retries; i++) {
        try {
          console.log(`DEBUG (useAudioPlayer): Attempting to play ${soundUrl}, attempt ${i + 1}`);
          playPromiseRef.current = audioRef.current!.play();
          await playPromiseRef.current;
          console.log(`DEBUG (useAudioPlayer): Playing ${soundUrl}`);
          return;
        } catch (error) {
          console.warn(`DEBUG (useAudioPlayer): Play attempt ${i + 1} failed:`, error);
          if (i === retries - 1) {
            setNeedsInteraction(true);
            localStorage.setItem('kds_audio_enabled', 'false');
            console.error('DEBUG (useAudioPlayer): Max retries reached, requiring user interaction');
            return;
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    };

    await attemptPlay();
  };

  const stopSound = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setCurrentSound(null);
      if (playPromiseRef.current) {
        playPromiseRef.current.then(() => {
          audioRef.current?.pause();
        }).catch(() => {});
      }
      console.log('DEBUG (useAudioPlayer): Sound stopped');
    }
  };

  const setLooping = (loop: boolean) => {
    setIsLooping(loop);
    if (audioRef.current) {
      audioRef.current.loop = loop;
    }
  };

  return { playSound, stopSound, needsInteraction, enableAudio, setLooping };
};


