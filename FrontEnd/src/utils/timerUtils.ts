// src/utils/timerUtils.ts
import { useEffect, useRef, useState } from 'react';

export function formatTimer(seconds: number): string {
  // Handle invalid or negative seconds
  if (!seconds || seconds <= 0 || isNaN(seconds) || !isFinite(seconds)) {
    return '00:00';
  }
  
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return hours > 0
    ? `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const useCountdown = (
  orderNo: number | string,
  orderTime: Date | null,
  totalTimeMinutes: number,
  onStatusChange?: (isNearFinish: boolean) => void,
  onSoundTrigger?: (percent: number) => void
) => {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const stableOrderNo = String(orderNo);
  const storageKey = `order_${stableOrderNo}_endTime`;
  const expiredKey = `order_${stableOrderNo}_expired`;
  const newOrderSoundPlayedKey = `order_${stableOrderNo}_newOrderSoundPlayed`;
  const nearFinishSoundPlayedKey = `order_${stableOrderNo}_nearFinishSoundPlayed`;
  const completedSoundPlayedKey = `order_${stableOrderNo}_completedSoundPlayed`;

  useEffect(() => {
    // Clear interval on cleanup
    const cleanup = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    // Validate inputs - if any are invalid, set to 00:00
    if (!orderTime || 
        isNaN(orderTime.getTime()) || 
        !totalTimeMinutes || 
        totalTimeMinutes <= 0 || 
        isNaN(totalTimeMinutes) || 
        !isFinite(totalTimeMinutes)) {
      
      console.debug(`DEBUG (useCountdown): Invalid input for order #${stableOrderNo}`, {
        orderTime: orderTime?.toString(),
        totalTimeMinutes,
        isValidTime: orderTime ? !isNaN(orderTime.getTime()) : false,
      });
      
      setRemainingSeconds(0);
      localStorage.removeItem(storageKey);
      localStorage.removeItem(expiredKey);
      localStorage.removeItem(newOrderSoundPlayedKey);
      localStorage.removeItem(nearFinishSoundPlayedKey);
      localStorage.removeItem(completedSoundPlayedKey);
      cleanup();
      return;
    }

    const nowMs = Date.now();
    const orderMs = orderTime.getTime();

    // Check if order is already marked as expired
    const isExpired = localStorage.getItem(expiredKey) === 'true';
    if (isExpired) {
      console.debug(`DEBUG (useCountdown): Order #${stableOrderNo} is expired, skipping timer`);
      setRemainingSeconds(0);
      cleanup();
      return;
    }

    let endTimeMs: number;
    const storedEndTime = localStorage.getItem(storageKey);
    
    if (storedEndTime && !isNaN(Number(storedEndTime)) && isFinite(Number(storedEndTime))) {
      endTimeMs = Number(storedEndTime);
      if (endTimeMs <= nowMs) {
        console.debug(`DEBUG (useCountdown): Stored end time for order #${stableOrderNo} is in the past`);
        setRemainingSeconds(0);
        localStorage.setItem(expiredKey, 'true');
        localStorage.removeItem(storageKey);
        localStorage.removeItem(newOrderSoundPlayedKey);
        localStorage.removeItem(nearFinishSoundPlayedKey);
        localStorage.removeItem(completedSoundPlayedKey);
        cleanup();
        return;
      }
    } else {
      const startMs = orderMs > nowMs ? nowMs : orderMs;
      endTimeMs = startMs + totalTimeMinutes * 60 * 1000;
      
      // Validate the calculated end time
      if (isNaN(endTimeMs) || !isFinite(endTimeMs)) {
        console.debug(`DEBUG (useCountdown): Calculated invalid end time for order #${stableOrderNo}`);
        setRemainingSeconds(0);
        cleanup();
        return;
      }
      
      localStorage.setItem(storageKey, String(endTimeMs));
      console.debug(`DEBUG (useCountdown): Set new end time for order #${stableOrderNo}`, {
        startMs,
        endTimeMs,
        totalTimeMinutes,
      });
    }

    const tick = () => {
      const now = Date.now();
      const diffMs = endTimeMs - now;
      const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));
      
      // Validate the calculated seconds
      if (isNaN(diffSeconds) || !isFinite(diffSeconds)) {
        console.debug(`DEBUG (useCountdown): Calculated invalid remaining seconds for order #${stableOrderNo}`);
        setRemainingSeconds(0);
        cleanup();
        return;
      }
      
      setRemainingSeconds(diffSeconds);

      const totalSeconds = totalTimeMinutes * 60;
      const elapsed = totalSeconds - diffSeconds;
      const percent = totalSeconds ? Math.max(0, Math.min(100, (elapsed / totalSeconds) * 100)) : 0;

      // Trigger sounds based on percentage completion
      if (percent >= 60 && localStorage.getItem(newOrderSoundPlayedKey) !== 'true') {
        if (onSoundTrigger) {
          onSoundTrigger(60);
          localStorage.setItem(newOrderSoundPlayedKey, 'true');
        }
      }
      if (percent >= 80 && localStorage.getItem(nearFinishSoundPlayedKey) !== 'true') {
        if (onSoundTrigger) {
          onSoundTrigger(80);
          localStorage.setItem(nearFinishSoundPlayedKey, 'true');
        }
      }
      if (diffSeconds <= 0 && localStorage.getItem(completedSoundPlayedKey) !== 'true') {
        if (onSoundTrigger) {
          onSoundTrigger(100);
          localStorage.setItem(completedSoundPlayedKey, 'true');
        }
      }

      // Clean up when timer expires
      if (diffSeconds <= 0) {
        cleanup();
        localStorage.setItem(expiredKey, 'true');
        localStorage.removeItem(storageKey);
        console.debug(`DEBUG (useCountdown): Timer expired for order #${stableOrderNo}`);
      }
    };

    // Initial tick and start interval
    tick();
    intervalRef.current = setInterval(tick, 1000);

    return cleanup;
  }, [stableOrderNo, orderTime, totalTimeMinutes, onSoundTrigger]);

  // Calculate derived values with validation
  const totalSeconds = Math.max(0, (totalTimeMinutes || 0) * 60);
  const elapsed = Math.max(0, totalSeconds - remainingSeconds);
  const percent = totalSeconds ? Math.max(0, Math.min(100, (elapsed / totalSeconds) * 100)) : 0;
  const isNearFinish = percent >= 80 && remainingSeconds > 0;
  const isExpired = remainingSeconds <= 0;

  useEffect(() => {
    console.debug(`DEBUG (useCountdown): Order #${stableOrderNo} isNearFinish=${isNearFinish}, percent=${percent.toFixed(1)}%`);
    if (typeof onStatusChange === 'function') {
      onStatusChange(isNearFinish);
    }
  }, [isNearFinish, onStatusChange, stableOrderNo, percent]);

  return {
    remainingSeconds,
    formattedTime: formatTimer(remainingSeconds),
    isNearFinish,
    isExpired,
    timerColor: getTimerColor(remainingSeconds, totalTimeMinutes),
    cardStyles: getCardBackground(remainingSeconds, totalTimeMinutes, isNearFinish),
  };
};

function getTimerColor(remainingSeconds: number, totalTimeMinutes: number): string {
  // Handle invalid inputs
  if (!remainingSeconds && remainingSeconds !== 0) return 'text-gray-400';
  if (!totalTimeMinutes || totalTimeMinutes <= 0) return 'text-gray-400';
  
  const totalSeconds = totalTimeMinutes * 60;
  if (totalSeconds === 0) return 'text-gray-400';
  
  const elapsed = totalSeconds - remainingSeconds;
  const percent = Math.max(0, Math.min(100, (elapsed / totalSeconds) * 100));
  
  if (remainingSeconds <= 0) return 'text-red-500';
  if (percent >= 80) return 'text-red-400';
  if (percent >= 60) return 'text-yellow-400';
  return 'text-green-400';
}

function getCardBackground(
  remainingSeconds: number,
  totalTimeMinutes: number,
  isNearFinish: boolean
): { background: string; border: string } {
  // Handle invalid inputs
  if (!remainingSeconds && remainingSeconds !== 0) {
    return { background: 'bg-gray-900/30', border: 'border-gray-500/70' };
  }
  if (!totalTimeMinutes || totalTimeMinutes <= 0) {
    return { background: 'bg-gray-900/30', border: 'border-gray-500/70' };
  }
  
  if (remainingSeconds <= 0) return { background: 'bg-red-900/50', border: 'border-red-500' };
  if (isNearFinish) return { background: 'bg-red-900/30', border: 'border-red-600/70' };
  
  const totalSeconds = totalTimeMinutes * 60;
  if (totalSeconds === 0) return { background: 'bg-gray-900/30', border: 'border-gray-500/70' };
  
  const elapsed = totalSeconds - remainingSeconds;
  const percent = Math.max(0, Math.min(100, (elapsed / totalSeconds) * 100));
  
  if (percent >= 60) return { background: 'bg-yellow-900/30', border: 'border-yellow-600/70' };
  return { background: 'bg-green-900/30', border: 'border-green-500/70' };
}