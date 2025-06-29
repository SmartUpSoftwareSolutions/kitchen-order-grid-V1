// src/components/OrderCard.tsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { KitchenOrder } from '@/types/KitchenOrder';
import { useCountdown } from '@/utils/timerUtils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { SoundSettings } from '@/types/SoundSettings';
import { Minus, CheckCircle, AlertCircle, Maximize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useMute } from '@/contexts/MuteContext';

interface OrderCardProps {
  orderGroup: KitchenOrder[];
  onCompletion: () => void;
  onFinish: () => void;
  className?: string;
  'data-testid'?: string;
  isExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onViewFullScreen: () => void;
  onOrderStatusChange?: (isNearFinish: boolean) => void;
}

function parseLocalDateTime(dateStr: string): Date | null {
  if (!dateStr) return null;
  const [timePart, datePart] = dateStr.split(' ');
  if (!timePart || !datePart) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minute, seconds] = timePart.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minute, seconds);
}

const OrderCard: React.FC<OrderCardProps> = ({
  orderGroup,
  onFinish,
  onCompletion,
  className = '',
  'data-testid': testId = 'order-card',
  isExpanded = false,
  onExpandedChange,
  onViewFullScreen,
  onOrderStatusChange,
}) => {
  const { t, language } = useLanguage();
  const { isMuted } = useMute();
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(() => {
    if (typeof window !== 'undefined') {
      const savedSoundSettings = localStorage.getItem('kds_sound_settings');
      return savedSoundSettings
        ? JSON.parse(savedSoundSettings)
        : {
            enabled: true,
            newOrderSound: true,
            nearFinishedSound: true,
            volume: 0.7,
            hasCustomNewOrderSound: false,
            hasCustomNearFinishedSound: false,
            customNewOrderFileName: undefined,
            customNearFinishedFileName: undefined,
          };
    }
    return {
      enabled: true,
      newOrderSound: true,
      nearFinishedSound: true,
      volume: 0.7,
      hasCustomNewOrderSound: false,
      hasCustomNearFinishedSound: false,
      customNewOrderFileName: undefined,
      customNearFinishedFileName: undefined,
    };
  });

  const { playSound, stopSound, needsInteraction, enableAudio, setLooping } = useAudioPlayer(soundSettings);
  const [stableOrder, setStableOrder] = useState<KitchenOrder | null>(null);
  const prevOrderTimeRef = useRef<number | null>(null);
  const muteTimestampRef = useRef<number | null>(null);
  const isCompletionSoundPlayingRef = useRef<boolean>(false);

  useEffect(() => {
    if (orderGroup?.length) {
      const newOrder = orderGroup[0];
      const newOrderTimeNum = newOrder?.order_time ? new Date(newOrder.order_time).getTime() : null;
      if (prevOrderTimeRef.current !== newOrderTimeNum) {
        setStableOrder(newOrder);
        prevOrderTimeRef.current = newOrderTimeNum;
      }
    }
  }, [orderGroup]);

  const orderTime = useMemo(() => {
    if (!stableOrder?.order_time) return null;
    return new Date(stableOrder.order_time);
  }, [stableOrder?.order_time]);

  const timeToFinishMinutes = useMemo(() => {
    const val = Number(stableOrder?.time_to_finish);
    return isNaN(val) || val < 0 ? 0 : val;
  }, [stableOrder?.time_to_finish]);

  const orderNo = stableOrder?.order_no ?? '';

  const handleSoundTrigger = async (percent: number) => {
    try {
      if (needsInteraction) {
        await enableAudio();
      }
      if (percent === 100 && soundSettings.nearFinishedSound) {
        // Start looping completion sound, ignoring mute status initially
        setLooping(true);
        await playSound(false);
        isCompletionSoundPlayingRef.current = true;
        console.debug(`🎵 OrderCard: Started looping completion sound for order #${orderNo} at 100%`);
        onCompletion();
      } else if (!isMuted && soundSettings.enabled) {
        // Respect mute status for 60% and 80% triggers
        if (percent === 60 && soundSettings.newOrderSound) {
          await playSound(true);
          console.debug(`🎵 OrderCard: Played new order sound for order #${orderNo} at 60%`);
        } else if (percent === 80 && soundSettings.nearFinishedSound) {
          await playSound(false);
          console.debug(`🎵 OrderCard: Played near-finished sound for order #${orderNo} at 80%`);
        }
      } else {
        console.debug(`DEBUG (OrderCard): Sound blocked for order #${orderNo} at ${percent}% due to mute or disabled`);
      }
    } catch (error) {
      console.error(`DEBUG (OrderCard): Error playing sound at ${percent}% for order #${orderNo}:`, error);
    }
  };

  // Handle mute/unmute behavior for completion sound
  useEffect(() => {
    if (!isCompletionSoundPlayingRef.current) return;

    if (isMuted) {
      // Stop sound and record mute timestamp
      stopSound();
      muteTimestampRef.current = Date.now();
      console.debug(`DEBUG (OrderCard): Stopped completion sound for order #${orderNo} due to mute`);
    } else if (muteTimestampRef.current) {
      // Check if unmuted within 10 seconds
      const timeSinceMute = Date.now() - muteTimestampRef.current;
      if (timeSinceMute <= 10000 && soundSettings.nearFinishedSound) {
        // Resume looping completion sound
        setLooping(true);
        playSound(false).then(() => {
          console.debug(`🎵 OrderCard: Resumed looping completion sound for order #${orderNo} after unmute within 10s`);
        }).catch(error => {
          console.error(`DEBUG (OrderCard): Error resuming completion sound for order #${orderNo}:`, error);
        });
      } else {
        // Beyond 10 seconds, clear completion sound state
        isCompletionSoundPlayingRef.current = false;
        muteTimestampRef.current = null;
        setLooping(false);
        console.debug(`DEBUG (OrderCard): Completion sound for order #${orderNo} not resumed (beyond 10s)`);
      }
    }
  }, [isMuted, playSound, stopSound, soundSettings.nearFinishedSound, orderNo, setLooping]);

  // Cleanup on unmount or finish
  useEffect(() => {
    return () => {
      if (isCompletionSoundPlayingRef.current) {
        stopSound();
        setLooping(false);
        isCompletionSoundPlayingRef.current = false;
        muteTimestampRef.current = null;
        console.debug(`DEBUG (OrderCard): Cleaned up completion sound for order #${orderNo}`);
      }
    };
  }, [stopSound, setLooping, orderNo]);

  const {
    remainingSeconds,
    isNearFinish,
    formattedTime,
    timerColor,
    cardStyles,
    isExpired,
  } = useCountdown(orderNo, orderTime, timeToFinishMinutes, onOrderStatusChange, handleSoundTrigger);

  useEffect(() => {
    console.debug('⏱ OrderCard Timer Debug:', {
      order_no: stableOrder?.order_no,
      raw_order_time: stableOrder?.order_time,
      parsed_order_time: orderTime?.toString(),
      now: new Date().toString(),
      remainingSeconds,
      formattedTime,
      isNearFinish,
      isExpired,
    });
  }, [remainingSeconds, stableOrder, orderTime, formattedTime, isNearFinish, isExpired]);

  const handleFinish = useCallback(async () => {
    try {
      if (needsInteraction) {
        await enableAudio();
      }
      if (!isMuted && soundSettings.enabled && soundSettings.nearFinishedSound) {
        await playSound(false);
        console.debug(`🎵 OrderCard: Played order completed sound for order #${stableOrder?.order_no}`);
      }
    } catch (error) {
      console.error('DEBUG (OrderCard): Error playing order completed sound:', error);
    }
    // Stop completion sound if playing
    if (isCompletionSoundPlayingRef.current) {
      stopSound();
      setLooping(false);
      isCompletionSoundPlayingRef.current = false;
      muteTimestampRef.current = null;
      console.debug(`DEBUG (OrderCard): Stopped completion sound on finish for order #${orderNo}`);
    }
    onFinish();
  }, [onFinish, playSound, needsInteraction, enableAudio, soundSettings, stableOrder?.order_no, isMuted, stopSound, setLooping, orderNo]);

  const handleClose = useCallback(() => onExpandedChange?.(false), [onExpandedChange]);

  if (!orderGroup?.length) {
    return (
      <Card className="border-2 border-red-600/50 bg-red-900/30" data-testid={`${testId}-error`}>
        <CardContent className="p-3 text-center">
          <AlertCircle className="h-6 w-6 text-red-400 mx-auto mb-2" />
          <p className="text-red-400 font-medium text-sm">{t('order.noOrderData')}</p>
        </CardContent>
      </Card>
    );
  }

  if (!orderTime) {
    return (
      <Card className="border-2 border-yellow-600/50 bg-yellow-900/30" data-testid={`${testId}-invalid`}>
        <CardContent className="p-3 text-center">
          <AlertCircle className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
          <p className="text-yellow-400 font-medium text-sm">{t('order.invalidOrderData')}</p>
          <p className="text-yellow-300 text-xs mt-1">
            Order Time: {String(stableOrder?.order_time)} | Duration: {timeToFinishMinutes}min
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalItems = orderGroup.reduce((sum, item) => sum + (item.qty || 0), 0);
  const MAX_DISPLAYED_ITEMS = 3;
  const displayedItems = orderGroup.slice(0, MAX_DISPLAYED_ITEMS);
  const remainingItemsCount = orderGroup.length - MAX_DISPLAYED_ITEMS;
  const finalTimerColor = isExpired ? 'text-red-600 animate-pulse' : timerColor;

  return (
    <Card
      className={`${cardStyles.background} ${cardStyles.border} border-2 relative overflow-hidden rounded-lg shadow-md hover:brightness-110 transition-all duration-200 ${
        isExpanded ? 'fixed inset-4 z-50 bg-background' : 'h-48 w-full'
      } ${isExpired ? 'ring-2 ring-red-500' : ''} ${className}`}
      data-testid={testId}
    >
      <header className="absolute top-0 left-0 right-0 bg-primary/90 text-primary-foreground px-2 py-1 text-xs font-bold z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">#{stableOrder?.order_no}</span>
          <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-xs font-bold">
            {totalItems} {totalItems === 1 ? t('order.item') : t('order.items')}
          </span>
          {isExpired && (
            <span className="bg-red-600 text-white px-2 py-0.5 rounded text-xs font-bold animate-pulse">
              {t('order.expired')}
            </span>
          )}
        </div>
        {remainingSeconds > 0 && (
          <div className={`text-sm font-bold ${finalTimerColor}`}>{formattedTime}</div>
        )}
      </header>

      <CardContent className={isExpanded ? 'p-4 pt-12 overflow-y-auto max-h-full' : 'p-2 pt-8 pb-12'}>
        {(isExpanded ? orderGroup : displayedItems).map((item, idx) => (
          <div
            key={item.id || idx}
            className="flex items-center gap-2 border-l-4 border-blue-500 pl-2 py-1.5 bg-muted/20 rounded-r-md"
            data-testid={`order-item-${idx}`}
          >
            <span className="bg-blue-600 text-white font-bold rounded text-center text-xs px-1.5 py-0.5 min-w-[40px]">
              {item.qty}x
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate">
                {language === 'ar' ? item.item_name : item.item_engname || item.item_name}
              </div>
              {item.order_comments && (
                <div className="text-yellow-400 text-xs mt-0.5 truncate">"{item.order_comments}"</div>
              )}
            </div>
          </div>
        ))}
        {!isExpanded && remainingItemsCount > 0 && (
          <div className="text-center py-1">
            <span className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded font-medium">
              +{remainingItemsCount} {remainingItemsCount === 1 ? t('order.moreItem') : t('order.moreItems')}
            </span>
          </div>
        )}
      </CardContent>

      <footer
        className={`absolute bottom-0 left-0 right-0 flex gap-1 p-1.5 ${
          isExpanded ? 'relative mt-4' : 'bg-background/90 backdrop-blur-sm border-t border-border/50'
        }`}
      >
        <Button
          onClick={handleFinish}
          size={isExpanded ? 'default' : 'sm'}
          className={`flex-1 ${isExpired ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white font-bold ${
            isExpanded ? 'py-3 text-sm' : 'py-1 text-xs'
          } ${isExpired ? 'animate-pulse' : ''}`}
          data-testid="finish-button"
        >
          <CheckCircle className={isExpanded ? 'h-4 w-4 mr-2' : 'h-3 w-3 mr-1'} />
          {isExpired ? t('kds.complete') : t('kds.finish')}
        </Button>

        {isExpanded ? (
          <Button onClick={handleClose} variant="outline" size="default" data-testid="close-button">
            <Minus className="h-4 w-4 mr-2" />
            {t('order.close')}
          </Button>
        ) : (
          <Button onClick={onViewFullScreen} variant="outline" size="sm" className="px-2" data-testid="fullscreen-button">
            <Maximize className="h-3 w-3" />
          </Button>
        )}
      </footer>
    </Card>
  );
};
export default OrderCard;