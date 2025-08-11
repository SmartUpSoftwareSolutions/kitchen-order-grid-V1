import React, { useState, useEffect, useRef } from 'react';
import { ChefHat, Settings, Monitor, Loader2, Volume2, VolumeX, HelpCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import OrderCard from '@/components/OrderCard';
import SettingsPanel from '@/components/SettingsPanel';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useKitchenOrders, useFinishOrder } from '@/hooks/useKitchenOrders';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { mssqlClient } from '@/lib/mssql-client';
import { KitchenOrder, GroupedKitchenOrder } from '@/types/KitchenOrder';
import { DatabaseConfig } from '@/types/DatabaseConfig';
import { SoundSettings } from '@/types/SoundSettings';
import FullScreenOrder from '@/components/FullScreenOrder';
import { useMute } from '@/contexts/MuteContext';

const CATEGORY_TABLE_NAME = 'DB_POS_CATEGORY';

interface IndexProps {
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
}

const Index: React.FC<IndexProps> = ({ theme, onThemeChange }) => {
  const { t, language } = useLanguage();
  const { isMuted, toggleMute } = useMute();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [finishOrderNumber, setFinishOrderNumber] = useState('');
  const [isConnected, setIsConnected] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousOrderNosRef = useRef<Set<string>>(new Set());
  const [fullScreenOrder, setFullScreenOrder] = useState<{
    isOpen: boolean;
    orderGroup: GroupedKitchenOrder[];
  }>({ isOpen: false, orderGroup: [] });

  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('kds_selected_categories');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const [soundSettings, setSoundSettings] = useState<SoundSettings>(() => {
    const saved = localStorage.getItem('kds_sound_settings');
    return saved
      ? JSON.parse(saved)
      : {
          enabled: true,
          newOrderSound: true,
          nearFinishedSound: true,
          volume: 0.7,
          hasCustomNewOrderSound: false,
          hasCustomNearFinishedSound: false,
        };
  });

  const { playSound, stopSound, needsInteraction, enableAudio } = useAudioPlayer(soundSettings);

  const { data: kdsCategories = [], isError: isCategoriesError } = useQuery({
    queryKey: ['kdsCategories'],
    queryFn: async () => {
      try {
        const data = await mssqlClient
          .from(CATEGORY_TABLE_NAME)
          .select('CAT_CODE,CAT_NAME')
          .eq('KDS', true)
          .get();
        setIsConnected(true);
        return data || [];
      } catch (error) {
        setIsConnected(false);
        return [];
      }
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    localStorage.setItem('kds_selected_categories', JSON.stringify([...selectedCategories]));
  }, [selectedCategories]);

  const kdsCatCodesForOrders = Array.from(selectedCategories)
    .filter(Boolean)
    .map(code => Number(code))
    .filter(code => !isNaN(code));

  const {
    data: ordersGrouped = {},
    isLoading,
    isError,
    error,
  } = useKitchenOrders(kdsCatCodesForOrders);

  const finishOrderMutation = useFinishOrder();

  const orderGroups = Object.entries(ordersGrouped).map(([orderno, groupedOrders]) => ({
    orderno: Number(orderno),
    orders: groupedOrders,
  }));

  useEffect(() => {
    if (isMuted || !soundSettings.enabled || !soundSettings.newOrderSound || needsInteraction) return;

    const currentOrderNos = new Set(orderGroups.map(group => String(group.orderno)));
    const newOrderNos = [...currentOrderNos].filter(
      orderno => !previousOrderNosRef.current.has(orderno)
    );

    if (newOrderNos.length > 0) {
      playSound(true)
        .then(() => console.debug(`🎵 Index: Played new order sound for orders ${newOrderNos.join(', ')}`))
        .catch(err => console.error('DEBUG (Index): Error playing new order sound:', err));
    }

    previousOrderNosRef.current = currentOrderNos;
  }, [orderGroups, isMuted, soundSettings, playSound, needsInteraction]);

  useEffect(() => {
    if (isMuted) {
      stopSound();
      console.debug('DEBUG (Index): Stopped all sounds due to mute');
    }
  }, [isMuted, stopSound]);

  useEffect(() => {
    const focusInput = () => {
      if (inputRef.current && !settingsOpen && !fullScreenOrder.isOpen && !showHelp) {
        inputRef.current.focus();
      }
    };

    focusInput();
    const timeoutId = setTimeout(focusInput, 300);
    return () => clearTimeout(timeoutId);
  }, [settingsOpen, fullScreenOrder.isOpen, showHelp]);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ignore keypresses if settings, full-screen order, or help modal is open
      if (settingsOpen || fullScreenOrder.isOpen || showHelp) {
        // Handle "-" or "Esc" to close full-screen order view
        if ((event.key === '-' || event.key === 'Escape') && fullScreenOrder.isOpen) {
          handleCloseFullScreenOrder();
        }
        return;
      }

      // Ignore if the active element is already an input or textarea
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
        return;
      }

      // Focus the input and append only if the key is a number
      if (
        inputRef.current &&
        /^\d$/.test(event.key) && // Only allow numeric keys (0-9)
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey
      ) {
        inputRef.current.focus();
        setFinishOrderNumber(prev => prev + event.key);
      }

      // Handle special keys
      if (event.key === '*') {
        toggleMute();
      } else if (event.key === '+') {
        if (finishOrderNumber.trim()) {
          const orderGroupToShow = findOrderGroup(finishOrderNumber.trim());
          if (orderGroupToShow) {
            setFullScreenOrder({
              isOpen: true,
              orderGroup: orderGroupToShow.orders,
            });
          } else {
            toast.error(t('kds.errors.orderNotFound'));
          }
        } else if (orderGroups.length > 0) {
          setFullScreenOrder({
            isOpen: true,
            orderGroup: orderGroups[0].orders,
          });
        }
      } else if (event.key === 'Enter' && finishOrderNumber.trim()) {
        event.preventDefault();
        handleFinishOrder();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [toggleMute, orderGroups, settingsOpen, showHelp, fullScreenOrder.isOpen, finishOrderNumber]);

  const findOrderGroup = (orderNumber: string) => {
    return orderGroups.find(
      group =>
        group.orderno.toString() === orderNumber ||
        group.orders.some(order => order.main.order_no?.toString() === orderNumber)
    );
  };

  const handleFinishOrder = () => {
    if (!finishOrderNumber.trim()) {
      toast.error(t('kds.errors.orderNumberRequired'));
      return;
    }

    const orderGroupToFinish = findOrderGroup(finishOrderNumber);

    if (!orderGroupToFinish) {
      toast.error(t('kds.errors.orderNotFound'));
      return;
    }

    finishOrderMutation.mutate(orderGroupToFinish.orderno, {
      onSuccess: () => {
        toast.success(t('kds.success.orderFinished'));
        setFinishOrderNumber('');
        const stableOrderNo = String(orderGroupToFinish.orderno);
        localStorage.removeItem(`order_${stableOrderNo}_endTime`);
        localStorage.removeItem(`order_${stableOrderNo}_expired`);
        localStorage.removeItem(`order_${stableOrderNo}_newOrderSoundPlayed`);
        localStorage.removeItem(`order_${stableOrderNo}_nearFinishSoundPlayed`);
        localStorage.removeItem(`order_${stableOrderNo}_completedSoundPlayed`);
        if (inputRef.current) {
          inputRef.current.focus();
        }
      },
      onError: error => toast.error(`${t('kds.errors.finishFailed')}: ${error.message}`),
    });
  };

  const handleCloseFullScreenOrder = () => {
    setFullScreenOrder({ isOpen: false, orderGroup: [] });
  };

  const handleFinishOrderFromCard = (orderno: number) => {
    finishOrderMutation.mutate(orderno, {
      onSuccess: () => {
        toast.success(t('kds.success.orderFinished'));
        const stableOrderNo = String(orderno);
        localStorage.removeItem(`order_${stableOrderNo}_endTime`);
        localStorage.removeItem(`order_${stableOrderNo}_expired`);
        localStorage.removeItem(`order_${stableOrderNo}_newOrderSoundPlayed`);
        localStorage.removeItem(`order_${stableOrderNo}_nearFinishSoundPlayed`);
        localStorage.removeItem(`order_${stableOrderNo}_completedSoundPlayed`);
        if (inputRef.current) {
          inputRef.current.focus();
        }
      },
      onError: error => toast.error(`${t('kds.errors.finishFailed')}: ${error.message}`),
    });
  };

  const handleReconnectDatabase = async (config: DatabaseConfig): Promise<boolean> => {
    try {
      setIsConnected(true);
      return true;
    } catch (error) {
      setIsConnected(false);
      console.error('Reconnection error:', error);
      return false;
    }
  };

  const handleOrderCompletionSound = (orderno: number) => {
    const stableOrderNo = String(orderno);
    const completedSoundPlayedKey = `order_${stableOrderNo}_completedSoundPlayed`;
    if (localStorage.getItem(completedSoundPlayedKey) !== 'true') {
      playSound(false)
        .then(() => {
          console.debug(`🎵 Index: Played completion sound for order ${stableOrderNo}`);
          localStorage.setItem(completedSoundPlayedKey, 'true');
        })
        .catch(err => console.error('DEBUG (Index): Error playing completion sound:', err));
    }
  };

  const handleViewFullScreen = (orderGroup: GroupedKitchenOrder[]) => {
    setFullScreenOrder({
      isOpen: true,
      orderGroup: orderGroup,
    });
  };

  const toggleHelp = () => {
    setShowHelp(prev => !prev);
  };

  const isRTL = language === 'ar';

  if (isLoading && isConnected) {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'} className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="h-screen bg-background text-foreground flex flex-col overflow-hidden select-none">
      {needsInteraction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg shadow-lg text-center max-w-sm">
            <p className="mb-4">{t('kds.enableSoundsPrompt')}</p>
            <Button
              onClick={async () => {
                await enableAudio();
                localStorage.setItem('kds_audio_enabled', 'true');
              }}
              className="w-full mb-2 min-h-[44px] text-lg"
            >
              {t('kds.enableSounds')}
            </Button>
          </div>
        </div>
      )}

      {showHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg shadow-lg max-w-md w-full">
            <div className={`flex ${isRTL ? 'flex-row-reverse' : 'flex-row'} justify-between items-center mb-4`}>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                {t('kds.help.title')}
              </h2>
              <Button onClick={toggleHelp} variant="ghost" size="sm">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-sm space-y-4">
              <p>{t('kds.help.description')}</p>
              <ul className={isRTL ? 'pr-5 list-disc' : 'pl-5 list-disc'}>
                <li>{t('kds.help.enterOrder')}</li>
                <li>{t('kds.help.fullScreen')}</li>
                <li>{t('kds.help.closeFullScreen')}</li>
                <li>{t('kds.help.mute')}</li>
                <li>{t('kds.help.settings')}</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <header className={`border-b shadow-md z-10 ${theme === 'dark' ? 'bg-gradient-to-r from-gray-800 to-gray-900' : 'bg-gradient-to-r from-white to-gray-100'}`}>
        <div className="container mx-auto px-6 py-3 flex items-center">
          <div className={`flex items-center gap-4 ${isRTL ? 'order-3 flex-row-reverse' : 'order-1'}`}>
            <div className="relative">
              <Input
                ref={inputRef}
                type="number"
                placeholder={t('kds.enterOrderNumber')}
                value={finishOrderNumber}
                onChange={e => {
                  const value = e.target.value;
                  if (/^\d*$/.test(value)) {
                    setFinishOrderNumber(value);
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleFinishOrder();
                  }
                }}
                className={`w-64 text-lg rounded-full px-4 py-2 ${isRTL ? 'text-right pr-10' : 'text-left pl-10'} border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/50 transition-all duration-300`}
                style={{ fontSize: '16px' }}
                disabled={!isConnected}
              />
              {finishOrderNumber && isConnected && (
                <div className={`absolute ${isRTL ? 'left-2' : 'right-2'} top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground flex gap-1`}>
                  <span className="bg-muted px-2 rounded-full">Enter</span>
                  <span className="bg-muted px-2 rounded-full">+</span>
                </div>
              )}
            </div>
            <Button
              onClick={handleFinishOrder}
              disabled={finishOrderMutation.isPending || !isConnected}
              className="bg-primary rounded-full px-6 py-2 hover:bg-primary/90 transition-colors duration-300"
            >
              {finishOrderMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t('kds.finish')}
            </Button>
            <Button
              onClick={toggleMute}
              variant="outline"
              className="border-2 border-primary rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-300"
            >
              {isMuted ? <VolumeX className="h-5 w-5 text-red-500" /> : <Volume2 className="h-5 w-5 text-green-500" />}
            </Button>
            <Button
              onClick={() => setSettingsOpen(true)}
              variant="outline"
              className="border-2 border-primary rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-300"
            >
              <Settings className="h-5 w-5" />
            </Button>
            <Button
              onClick={toggleHelp}
              variant="outline"
              className="border-2 border-primary rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-300"
            >
              <HelpCircle className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 flex justify-center order-2">
            <div className="flex items-center gap-2">
              <ChefHat className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('kds.title')}</h1>
            </div>
          </div>
          <div className={`flex items-center gap-2 ${isRTL ? 'order-1 flex-row-reverse' : 'order-3'}`}>
            <span
              className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
              title={isConnected ? t('kds.connected') : t('kds.disconnected')}
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {selectedCategories.size > 0
                ? kdsCategories
                    .filter(cat => selectedCategories.has(cat.CAT_CODE))
                    .map(cat => {
                      const translationKey = `category.${cat.CAT_NAME}`;
                      return t(translationKey) !== translationKey ? t(translationKey) : cat.CAT_NAME;
                    })
                    .join(', ')
                : t('kds.noCategoriesSelected') || 'No categories selected'}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-6 overflow-auto">
        {isConnected && orderGroups.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Monitor className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                {selectedCategories.size === 0
                  ? t('kds.noCategoriesSelected') || 'No categories selected'
                  : t('kds.noActiveOrders') || 'No active orders'}
              </h3>
              <p className="text-muted-foreground">
                {selectedCategories.size === 0
                  ? t('kds.selectCategoriesToSeeOrders') || 'Select categories in settings to see orders'
                  : t('kds.ordersWillAppear') || 'Orders will appear here when received'}
              </p>
            </div>
          </div>
        ) : !isConnected ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Monitor className="mx-auto h-12 w-12 text-destructive mb-4" />
              <h3 className="text-lg font-medium text-destructive mb-2">{t('kds.disconnected')}</h3>
              <p className="text-muted-foreground">
                {t('kds.disconnectedMessage') || 'Database is disconnected. Please reconnect from settings.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-80">
            {orderGroups.map(orderGroup => (
              <OrderCard
                key={orderGroup.orderno}
                orderGroup={orderGroup.orders}
                onFinish={() => handleFinishOrderFromCard(orderGroup.orderno)}
                onViewFullScreen={() => handleViewFullScreen(orderGroup.orders)}
                onCompletion={() => handleOrderCompletionSound(orderGroup.orderno)}
              />
            ))}
          </div>
        )}
      </main>

      {fullScreenOrder.isOpen && isConnected && (
        <FullScreenOrder
          orderGroup={fullScreenOrder.orderGroup}
          onBack={handleCloseFullScreenOrder}
          onFinish={() => {
            if (fullScreenOrder.orderGroup.length > 0) {
              handleFinishOrderFromCard(fullScreenOrder.orderGroup[0].main.order_no);
            }
            handleCloseFullScreenOrder();
          }}
        />
      )}

      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onThemeChange={onThemeChange}
        onSoundSettingsChange={setSoundSettings}
        mssqlClient={mssqlClient}
        onReconnectDatabase={handleReconnectDatabase}
        kdsCategories={kdsCategories}
        selectedCategories={selectedCategories}
        setSelectedCategories={setSelectedCategories}
        isConnected={isConnected}
        setIsConnected={setIsConnected}
      />
    </div>
  );
};

export default Index;