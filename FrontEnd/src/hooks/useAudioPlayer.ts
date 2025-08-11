// src/hooks/useAudioPlayer.ts
import { useState, useEffect, useRef } from 'react';
// Assuming SoundSettings is defined in '@/types/SoundSettings'
export interface SoundSettings {
  enabled: boolean;
  newOrderSound: boolean;
  nearFinishedSound: boolean;
  volume: number;
  hasCustomNewOrderSound: boolean;
  hasCustomNearFinishedSound: boolean;
  customNewOrderFileName?: string;
  customNearFinishedFileName?: string;
}

export const useAudioPlayer = (soundSettings?: SoundSettings) => {
  // State to track if user interaction is needed to enable audio playback
  const [needsInteraction, setNeedsInteraction] = useState(() => {
    if (typeof window !== 'undefined') {
      // Check localStorage to persist the audio enabled state across sessions
      const audioEnabled = localStorage.getItem('kds_audio_enabled');
      // If 'kds_audio_enabled' is not explicitly 'true', assume interaction is needed
      return audioEnabled === null || audioEnabled === 'false';
    }
    // Default to true for SSR or initial render before localStorage is accessible
    return true;
  });

  // useRef to hold the Audio object, preventing re-creation on re-renders
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // State to keep track of the currently playing sound URL
  const [currentSound, setCurrentSound] = useState<string | null>(null);
  // useRef to hold the promise returned by audio.play() for better control
  const playPromiseRef = useRef<Promise<void> | null>(null);
  // State to control if the current sound should loop
  const [isLooping, setIsLooping] = useState<boolean>(false);

  // Default sound settings if none are provided to the hook
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

  // Merge provided settings with defaults
  const settings = soundSettings || defaultSoundSettings;

  // Effect to initialize the Audio element and attempt autoplay silently
  useEffect(() => {
    // Only initialize if audioRef.current is null (first render)
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'auto'; // Preload audio for faster playback
    }

    // Set initial volume and loop status based on state/settings
    if (audioRef.current) {
        audioRef.current.volume = settings.volume;
        audioRef.current.loop = isLooping;
    }


    // Function to test if autoplay is allowed by the browser
    const testAutoplay = async () => {
      // Only proceed if audioRef exists and interaction is currently needed
      if (!audioRef.current || !needsInteraction) return;

      try {
        // Use a tiny silent WAV file for the autoplay test
        const silentAudioData = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQEAAAC/';
        audioRef.current.src = silentAudioData;
        audioRef.current.volume = 0; // Play silently

        // Attempt to play and capture the promise
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          await playPromise; // Wait for the play promise to resolve
          setNeedsInteraction(false); // Autoplay allowed
          localStorage.setItem('kds_audio_enabled', 'true');
          audioRef.current?.pause(); // Pause the silent audio
          console.log('DEBUG (useAudioPlayer): Autoplay allowed, audio context ready');
        }
      } catch (error) {
        // Autoplay blocked, user interaction required
        console.log('DEBUG (useAudioPlayer): Autoplay blocked, needs user interaction:', error);
        setNeedsInteraction(true);
        localStorage.setItem('kds_audio_enabled', 'false');
      } finally {
        // Reset audio element regardless of autoplay success/failure
        if (audioRef.current) {
          audioRef.current.src = ''; // Clear the silent audio source
          audioRef.current.volume = settings.volume; // Restore original volume
        }
      }
    };

    testAutoplay(); // Run the autoplay test on component mount

    // Cleanup function for useEffect
    return () => {
      if (audioRef.current) {
        audioRef.current.pause(); // Pause any playing audio
        audioRef.current.src = ''; // Clear source
        audioRef.current = null; // Clear the ref
      }
    };
  }, [isLooping, settings.volume]); // Re-run if looping or volume settings change

  // Effect to update volume when settings.volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = settings.volume;
    }
  }, [settings.volume]);

  /**
   * Attempts to enable audio playback by a user interaction.
   * This is typically called from a button click handler.
   */
  const enableAudio = async (): Promise<boolean> => {
    if (!audioRef.current) {
      console.error('DEBUG (useAudioPlayer): Audio element not initialized.');
      return false;
    }

    try {
      // Use a silent audio to "unlock" the audio context
      const silentAudioData = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQEAAAC/';
      audioRef.current.src = silentAudioData;
      audioRef.current.volume = 0; // Play silently

      await audioRef.current.play(); // Attempt play
      audioRef.current.pause(); // Pause immediately

      audioRef.current.src = ''; // Clear the silent audio source
      audioRef.current.volume = settings.volume; // Restore original volume

      setNeedsInteraction(false); // Audio context is now enabled
      localStorage.setItem('kds_audio_enabled', 'true');
      console.log('DEBUG (useAudioPlayer): Audio context enabled by user interaction');
      return true;
    } catch (error) {
      console.error('DEBUG (useAudioPlayer): Failed to enable audio:', error);
      return false;
    }
  };

  /**
   * Plays a sound based on whether it's a new order or near finish.
   * Includes logic for custom sounds and retry attempts.
   * @param isNewOrder - True for new order sound, false for near finish sound.
   */
  const playSound = async (isNewOrder: boolean) => {
    // Check if audio is globally enabled or if audioRef is not ready
    if (!settings.enabled || !audioRef.current) {
      console.log('DEBUG (useAudioPlayer): Audio disabled or no audio element');
      return;
    }
    // Check if specific sound type is enabled in settings
    if (isNewOrder && !settings.newOrderSound) {
      console.log('DEBUG (useAudioPlayer): New order sound disabled');
      return;
    }
    if (!isNewOrder && !settings.nearFinishedSound) {
      console.log('DEBUG (useAudioPlayer): Order completed sound disabled');
      return;
    }

    // Determine API URL for fetching custom sounds
    const apiUrl = import.meta.env.VITE_API_URL || 'http://192.168.1.102:3000';
    // Select custom file name or default sound path
    const customFileName = isNewOrder
      ? settings.customNewOrderFileName
      : settings.customNearFinishedFileName;
    const defaultSound = isNewOrder ? '/sounds/new_order.mp3' : '/sounds/order_completed.mp3';
    let soundUrl = defaultSound;

    // Check if a custom sound is configured and exists on the server
    if (customFileName && (isNewOrder ? settings.hasCustomNewOrderSound : settings.hasCustomNearFinishedSound)) {
      try {
        const response = await fetch(`${apiUrl}/api/audio/check-audio?fileName=${customFileName}`);
        const data = await response.json();
        if (data.exists) {
          soundUrl = `${apiUrl}/api/audio/play-audio?fileName=${customFileName}`;
        } else {
          console.warn(`DEBUG (useAudioPlayer): Custom sound "${customFileName}" not found on server, falling back to default.`);
        }
      } catch (error) {
        console.error('DEBUG (useAudioPlayer): Error checking custom sound:', error);
        // Fallback to default sound on error
      }
    }

    // Prevent re-playing the same sound if it's already active and not paused
    if (currentSound === soundUrl && !audioRef.current.paused) {
      console.log('DEBUG (useAudioPlayer): Sound already playing, skipping');
      return;
    }

    // Set the new sound source and loop status
    setCurrentSound(soundUrl);
    audioRef.current.src = soundUrl;
    audioRef.current.loop = isLooping;

    // Helper function to attempt playing with retries
    const attemptPlay = async (retries = 3): Promise<void> => {
      for (let i = 0; i < retries; i++) {
        try {
          console.log(`DEBUG (useAudioPlayer): Attempting to play ${soundUrl}, attempt ${i + 1}`);
          playPromiseRef.current = audioRef.current!.play(); // Capture the play promise
          await playPromiseRef.current; // Wait for it to resolve
          console.log(`DEBUG (useAudioPlayer): Playing ${soundUrl}`);
          return; // Success, exit loop
        } catch (error) {
          console.warn(`DEBUG (useAudioPlayer): Play attempt ${i + 1} failed:`, error);
          if (i === retries - 1) {
            // If all retries failed, require user interaction
            setNeedsInteraction(true);
            localStorage.setItem('kds_audio_enabled', 'false');
            console.error('DEBUG (useAudioPlayer): Max retries reached, requiring user interaction');
            return;
          }
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    };

    await attemptPlay(); // Start playing
  };

  /**
   * Stops the currently playing sound and resets its position.
   */
  const stopSound = () => {
    if (audioRef.current) {
      audioRef.current.pause(); // Pause playback
      audioRef.current.currentTime = 0; // Reset to start
      setCurrentSound(null); // Clear current sound state
      // If there was an active play promise, ensure it's handled to avoid unhandled rejections
      if (playPromiseRef.current) {
        playPromiseRef.current.then(() => {
          // Additional pause in case the promise resolved *after* initial pause call
          audioRef.current?.pause();
        }).catch(() => {}); // Catch potential errors if promise rejected
      }
      console.log('DEBUG (useAudioPlayer): Sound stopped');
    }
  };

  /**
   * Sets the looping status for the audio player.
   * @param loop - True to loop, false to not loop.
   */
  const setLooping = (loop: boolean) => {
    setIsLooping(loop);
    if (audioRef.current) {
      audioRef.current.loop = loop; // Apply loop status to the audio element
    }
  };

  // Return the controls and state from the hook
  return { playSound, stopSound, needsInteraction, enableAudio, setLooping };
};
