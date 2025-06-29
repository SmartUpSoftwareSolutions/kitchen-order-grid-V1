import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Languages,
  Sun,
  Moon,
  X,
  Volume2,
  Database,
  Play,
  Upload,
  KeyRound,
  Plug,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { DatabaseConfig } from '@/types/DatabaseConfig';
import { SoundSettings } from '@/types/SoundSettings';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMute } from '@/contexts/MuteContext';

let currentUser: { id: string; name: string } | null = null;
const setCurrentUser = (user: { id: string; name: string }) => {
  currentUser = user;
};
const getCurrentUser = () => {
  return currentUser;
};

interface MssqlClient {
  from: (tableName: string) => {
    select: (columns: string) => {
      eq: (column: string, value: any) => {
        get: () => Promise<any[]>;
      };
    };
  };
}

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  onSoundSettingsChange: (settings: SoundSettings) => void;
  mssqlClient: MssqlClient;
  passwordVerificationTableName: string;
  onReconnectDatabase: (config: DatabaseConfig) => Promise<boolean>;
  kdsCategories: { CAT_CODE: string; CAT_NAME: string }[];
  selectedCategories: Set<string>;
  setSelectedCategories: React.Dispatch<React.SetStateAction<Set<string>>>;
  isConnected: boolean;
  setIsConnected: React.Dispatch<React.SetStateAction<boolean>>;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  theme,
  onThemeChange,
  onSoundSettingsChange,
  mssqlClient,
  passwordVerificationTableName,
  onReconnectDatabase,
  kdsCategories,
  selectedCategories,
  setSelectedCategories,
  isConnected,
  setIsConnected,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const { isMuted } = useMute();
  const queryClient = useQueryClient();
  const newOrderFileRef = useRef<HTMLInputElement>(null);
  const nearFinishedFileRef = useRef<HTMLInputElement>(null);
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [isUploadingNewOrder, setIsUploadingNewOrder] = useState(false);
  const [isUploadingNearFinished, setIsUploadingNearFinished] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectionError, setReconnectionError] = useState('');
  const [reconnectionSuccess, setReconnectionSuccess] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSoundType, setCurrentSoundType] = useState<'newOrder' | 'nearFinished' | null>(null);
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [dbConfig, setDbConfig] = useState<DatabaseConfig>(() => {
    const savedConfig = localStorage.getItem('kds_db_config');
    return savedConfig
      ? JSON.parse(savedConfig)
      : {
          server: 'DESKTOP-PG5CDRB',
          database: 'Mashwiz',
          user: 'sa',
          password: '123@123qw',
        };
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

  const isRTL = language === 'ar';

  useEffect(() => {
    localStorage.setItem('kds_db_config', JSON.stringify(dbConfig));
  }, [dbConfig]);

  useEffect(() => {
    localStorage.setItem('kds_sound_settings', JSON.stringify(soundSettings));
    onSoundSettingsChange(soundSettings);
  }, [soundSettings, onSoundSettingsChange]);

  useEffect(() => {
    if (!isOpen) {
      setIsPasswordVerified(false);
      setPasswordInput('');
      setPasswordError('');
      stopSound();
      setReconnectionError('');
      setReconnectionSuccess(false);
      setIsPlaying(false);
      setCurrentSoundType(null);
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
        resumeTimeoutRef.current = null;
      }
    }
  }, [isOpen, stopSound]);

  useEffect(() => {
    if (isMuted && isPlaying) {
      stopSound();
      setIsPlaying(false);
      setCurrentSoundType(null);
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
        resumeTimeoutRef.current = null;
      }
    }
  }, [isMuted, isPlaying, stopSound]);

  const verifyPasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      if (!isConnected && password === '911') {
        return { CASHER_KEY: '911', USER_NAME: 'Emergency User' };
      }
      const data = await mssqlClient
        .from('USER_TBL')
        .select('CASHER_KEY, USER_NAME')
        .eq('CASHER_KEY', password)
        .get();
      if (!data || data.length === 0) {
        throw new Error(t('settings.invalidPassword') || 'Invalid password');
      }
      return data[0];
    },
    onSuccess: userData => {
      const user = {
        id: userData.CASHER_KEY || 'unknown',
        name: userData.USER_NAME || 'Unknown User',
      };
      setCurrentUser(user);
      setIsPasswordVerified(true);
      setPasswordError('');
    },
    onError: (error: Error) => {
      setPasswordError(error.message);
    },
    onSettled: () => {
      setIsVerifyingPassword(false);
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) {
      setPasswordError(t('settings.passwordRequired') || 'Password is required');
      return;
    }
    setIsVerifyingPassword(true);
    verifyPasswordMutation.mutate(passwordInput.trim());
  };

  const handleThemeChange = (value: 'light' | 'dark') => {
    onThemeChange(value);
    const user = getCurrentUser() || { id: 'unknown', name: 'Unknown User' };
    console.log(`DEBUG (SettingsPanel): ${user.name} changed theme to ${value}`);
  };

  const handleLanguageChange = (value: string) => {
    setLanguage(value as 'en' | 'es' | 'ar');
    const user = getCurrentUser() || { id: 'unknown', name: 'Unknown User' };
    console.log(`DEBUG (SettingsPanel): ${user.name} changed language to ${value}`);
  };

  const handleDbConfigChange = (key: keyof DatabaseConfig, value: string) => {
    setDbConfig(prev => ({ ...prev, [key]: value }));
    setReconnectionError('');
    setReconnectionSuccess(false);
  };

  const handleSoundSettingsChange = (key: keyof SoundSettings, value: any) => {
    setSoundSettings(prev => ({ ...prev, [key]: value }));
  };

  const toggleCategory = (catCode: string) => {
    setSelectedCategories(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(catCode)) {
        newSelected.delete(catCode);
      } else {
        newSelected.add(catCode);
      }
      return newSelected;
    });
  };

  const retryFetch = async (url: string, options: RequestInit, retries = 2, timeout = 5000): Promise<Response> => {
    for (let i = 0; i <= retries; i++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        if (response.ok) return response;
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(t('settings.connectionTimeout') || 'Request timed out');
        }
        if (i === retries) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    throw new Error(t('settings.maxRetries') || 'Max retries reached');
  };

  const validateDbConfig = (config: DatabaseConfig): string | null => {
    if (!config.server.trim()) return t('settings.serverRequired') || 'Server is required';
    if (!config.database.trim()) return t('settings.databaseRequired') || 'Database is required';
    if (!config.user.trim()) return t('settings.userRequired') || 'User is required';
    if (!config.password.trim()) return t('settings.passwordRequired') || 'Password is required';
    return null;
  };

  const handleReconnect = async () => {
    setIsReconnecting(true);
    setReconnectionError('');
    setReconnectionSuccess(false);

    const validationError = validateDbConfig(dbConfig);
    if (validationError) {
      setReconnectionError(validationError);
      setIsReconnecting(false);
      return;
    }

    try {
      const response = await retryFetch('/api/system/reconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbConfig),
      });

      const result = await response.json();
      if (result.success) {
        const success = await onReconnectDatabase(dbConfig);
        if (success) {
          setIsConnected(true);
          setReconnectionSuccess(true);
          queryClient.invalidateQueries({ queryKey: ['kdsCategories'] });
        } else {
          throw new Error(t('settings.reconnectFailed') || 'Reconnection verification failed');
        }
      } else {
        throw new Error(result.message || t('settings.reconnectFailed') || 'Reconnection failed');
      }
    } catch (error: any) {
      let errorMessage = t('settings.reconnectFailed') || 'Failed to reconnect';
      if (error.message.includes('timed out')) {
        errorMessage = t('settings.connectionTimeout') || 'Connection timed out';
      } else if (error.message.includes('401') || error.message.includes('403')) {
        errorMessage = t('settings.authFailed') || 'Authentication failed. Check credentials';
      } else if (error.message.includes('404')) {
        errorMessage = t('settings.serverNotFound') || 'Server not found';
      }
      setReconnectionError(errorMessage);
      setIsConnected(false);
    } finally {
      setIsReconnecting(false);
    }
  };

  const playTestSound = async (isNewOrder: boolean) => {
    if (isMuted || !soundSettings.enabled) return;
    try {
      setIsPlaying(true);
      setCurrentSoundType(isNewOrder ? 'newOrder' : 'nearFinished');
      if (needsInteraction) await enableAudio();
      await playSound(isNewOrder);
    } catch (error) {
      setReconnectionError(t('settings.audioPlaybackError') || 'Error playing audio');
      setIsPlaying(false);
      setCurrentSoundType(null);
    }
  };

  const stopTestSound = () => {
    stopSound();
    setIsPlaying(false);
    setCurrentSoundType(null);
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }
  };

  const handleFileInputChange = (soundType: 'newOrder' | 'nearFinished') => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/') || !file.name.endsWith('.mp3')) {
      setReconnectionError(t('settings.invalidAudioFile') || 'Please select a valid .mp3 audio file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setReconnectionError(t('settings.fileTooLarge') || 'File size exceeds 5MB limit');
      return;
    }

    const fixedFileName = soundType === 'newOrder' ? 'neworder.mp3' : 'nearfinish.mp3';
    const apiUrl = import.meta.env.VITE_API_URL || 'http://192.168.1.102:3000';

    soundType === 'newOrder' ? setIsUploadingNewOrder(true) : setIsUploadingNearFinished(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', fixedFileName);

      const response = await retryFetch(`${apiUrl}/api/audio/save-audio`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t('settings.uploadError') || 'Failed to upload file');

      setSoundSettings(prev => ({
        ...prev,
        [soundType === 'newOrder' ? 'hasCustomNewOrderSound' : 'hasCustomNearFinishedSound']: true,
        [soundType === 'newOrder' ? 'customNewOrderFileName' : 'customNearFinishedFileName']: fixedFileName,
      }));

      if (!isMuted && soundSettings.enabled) {
        await playTestSound(soundType === 'newOrder');
      }
    } catch (error: any) {
      setReconnectionError(error.message || t('settings.uploadError') || 'Error uploading sound file');
    } finally {
      soundType === 'newOrder' ? setIsUploadingNewOrder(false) : setIsUploadingNearFinished(false);
    }
  };

  if (!isOpen) return null;

  if (!isPasswordVerified) {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-background border rounded-lg p-6 w-80 shadow-lg">
          <div className={`flex ${isRTL ? 'flex-row-reverse' : 'flex-row'} justify-between items-center mb-4`}>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              {t('settings.accessSettings') || 'Access Settings'}
            </h2>
            <Button onClick={onClose} variant="ghost" size="sm">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('settings.enterPassword') || 'Enter Password'}
              </label>
              <Input
                type="password"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                placeholder={t('settings.passwordPlaceholder') || 'Enter password to access settings'}
                className={passwordError ? 'border-red-500' : isRTL ? 'text-right' : 'text-left'}
              />
              {passwordError && (
                <div className={`text-xs text-red-600 mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {passwordError}
                </div>
              )}
              {!isConnected && (
                <div className={`text-xs text-yellow-600 mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('settings.disconnectedPassword') || 'Use password "911" when disconnected'}
                </div>
              )}
            </div>
            <Button
              type="submit"
              disabled={!passwordInput.trim() || isVerifyingPassword}
              className="w-full"
            >
              {isVerifyingPassword
                ? t('settings.verifying') || 'Verifying...'
                : t('settings.accessSettings') || 'Access Settings'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto shadow-lg">
        <div className={`flex ${isRTL ? 'flex-row-reverse' : 'flex-row'} justify-between items-center mb-4`}>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('settings.title') || 'Settings'}
          </h2>
          <div className={`flex ${isRTL ? 'flex-row-reverse' : 'flex-row'} gap-2`}>
            <Button
              onClick={stopTestSound}
              variant="ghost"
              size="sm"
              title={t('settings.stopAudio') || 'Stop Playing Audio'}
              disabled={needsInteraction || !isPlaying}
            >
              <Volume2 className="h-4 w-4 text-orange-500" />
            </Button>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              title={t('settings.close') || 'Close Settings'}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h3
              className={`text-sm font-medium mb-3 flex ${
                isRTL ? 'flex-row-reverse' : 'flex-row'
              } items-center gap-2`}
            >
              <Database className="h-4 w-4" />
              {t('settings.categories') || 'Categories'}
            </h3>
            <div className="flex flex-wrap gap-2">
              {kdsCategories.map(category => {
                const translationKey = `category.${category.CAT_NAME}`;
                const displayName = t(translationKey) !== translationKey ? t(translationKey) : category.CAT_NAME;
                const isSelected = selectedCategories.has(category.CAT_CODE);

                return (
                  <button
                    key={category.CAT_CODE}
                    onClick={() => toggleCategory(category.CAT_CODE)}
                    className={`
                      inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                      ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}
                    `}
                  >
                    <span>{displayName}</span>
                    {isSelected && <Check className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h3
              className={`text-sm font-medium mb-2 flex ${
                isRTL ? 'flex-row-reverse' : 'flex-row'
              } items-center gap-2`}
            >
              <Languages className="h-4 w-4" />
              {t('settings.language') || 'Language'}
            </h3>
            <Select value={language} onValueChange={handleLanguageChange}>
              <SelectTrigger className={isRTL ? 'text-right' : 'text-left'}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t('settings.english') || 'English'}</SelectItem>
                <SelectItem value="es">{t('settings.spanish') || 'Español'}</SelectItem>
                <SelectItem value="ar">{t('settings.arabic') || 'العربية'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <h3
              className={`text-sm font-medium mb-2 flex ${
                isRTL ? 'flex-row-reverse' : 'flex-row'
              } items-center gap-2`}
            >
              {theme === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {t('settings.theme') || 'Theme'}
            </h3>
            <Select value={theme} onValueChange={handleThemeChange}>
              <SelectTrigger className={isRTL ? 'text-right' : 'text-left'}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">{t('settings.light') || 'Light'}</SelectItem>
                <SelectItem value="dark">{t('settings.dark') || 'Dark'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <h3
              className={`text-sm font-medium mb-3 flex ${
                isRTL ? 'flex-row-reverse' : 'flex-row'
              } items-center gap-2`}
            >
              <Volume2 className="h-4 w-4" />
              {t('settings.soundSettings') || 'Sound Settings'}
            </h3>
            <div className="space-y-4">
              <div
                className={`flex ${isRTL ? 'flex-row-reverse' : 'flex-row'} items-center justify-between`}
              >
                <span className="text-sm">{t('settings.enableSounds') || 'Enable Sounds'}</span>
                <Switch
                  checked={soundSettings.enabled}
                  onCheckedChange={checked => handleSoundSettingsChange('enabled', checked)}
                />
              </div>

              <div className="space-y-2">
                <div
                  className={`flex ${isRTL ? 'flex-row-reverse' : 'flex-row'} items-center justify-between`}
                >
                  <span className="text-sm">{t('settings.newOrderSound') || 'New Order Sound'}</span>
                  <div className={`flex ${isRTL ? 'flex-row-reverse' : 'flex-row'} items-center gap-2`}>
                    <Switch
                      checked={soundSettings.newOrderSound}
                      onCheckedChange={checked => handleSoundSettingsChange('newOrderSound', checked)}
                      disabled={!soundSettings.enabled}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => playTestSound(true)}
                      disabled={!soundSettings.enabled || !soundSettings.newOrderSound || isPlaying || isMuted}
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div
                  className={`flex ${isRTL ? 'flex-row-reverse' : 'flex-row'} items-center gap-2 text-xs`}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => newOrderFileRef.current?.click()}
                    disabled={!soundSettings.enabled || isUploadingNewOrder}
                    className="flex items-center gap-1"
                  >
                    <Upload className="h-3 w-3" />
                    {isUploadingNewOrder
                      ? t('settings.uploading') || 'Uploading...'
                      : soundSettings.hasCustomNewOrderSound
                      ? t('settings.replaceCustom') || 'Replace Custom'
                      : t('settings.uploadCustom') || 'Upload Custom'}
                  </Button>
                  <input
                    ref={newOrderFileRef}
                    type="file"
                    accept="audio/mpeg"
                    onChange={handleFileInputChange('newOrder')}
                    className="hidden"
                  />
                </div>
                {soundSettings.hasCustomNewOrderSound && (
                  <div className={`text-xs text-green-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                    ✓ {t('settings.customSound') || 'Custom sound'}: {soundSettings.customNewOrderFileName || 'neworder.mp3'}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div
                  className={`flex ${isRTL ? 'flex-row-reverse' : 'flex-row'} items-center justify-between`}
                >
                  <span className="text-sm">{t('settings.orderFinishedSound') || 'Order Completed Sound'}</span>
                  <div className={`flex ${isRTL ? 'flex-row-reverse' : 'flex-row'} items-center gap-2`}>
                    <Switch
                      checked={soundSettings.nearFinishedSound}
                      onCheckedChange={checked => handleSoundSettingsChange('nearFinishedSound', checked)}
                      disabled={!soundSettings.enabled}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => playTestSound(false)}
                      disabled={!soundSettings.enabled || !soundSettings.nearFinishedSound || isPlaying || isMuted}
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div
                  className={`flex ${isRTL ? 'flex-row-reverse' : 'flex-row'} items-center gap-2 text-xs`}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => nearFinishedFileRef.current?.click()}
                    disabled={!soundSettings.enabled || isUploadingNearFinished}
                    className="flex items-center gap-1"
                  >
                    <Upload className="h-3 w-3" />
                    {isUploadingNearFinished
                      ? t('settings.uploading') || 'Uploading...'
                      : soundSettings.hasCustomNearFinishedSound
                      ? t('settings.replaceCustom') || 'Replace Custom'
                      : t('settings.uploadCustom') || 'Upload Custom'}
                  </Button>
                  <input
                    ref={nearFinishedFileRef}
                    type="file"
                    accept="audio/mpeg"
                    onChange={handleFileInputChange('nearFinished')}
                    className="hidden"
                  />
                </div>
                {soundSettings.hasCustomNearFinishedSound && (
                  <div className={`text-xs text-green-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                    ✓ {t('settings.customSound') || 'Custom sound'}: {soundSettings.customNearFinishedFileName || 'nearfinish.mp3'}
                  </div>
                )}
              </div>

              <div>
                <label className={`block text-sm mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('settings.volume') || 'Volume'}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={soundSettings.volume}
                  onChange={e => handleSoundSettingsChange('volume', parseFloat(e.target.value))}
                  disabled={!soundSettings.enabled}
                  className="w-full"
                />
                <div className={`text-xs text-muted-foreground mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {Math.round(soundSettings.volume * 100)}%
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3
              className={`text-sm font-medium mb-3 flex ${
                isRTL ? 'flex-row-reverse' : 'flex-row'
              } items-center gap-2`}
            >
              <Database className="h-4 w-4" />
              {t('settings.databaseConfig') || 'Database Configuration'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className={`block text-xs font-medium mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('settings.server') || 'Server'}
                </label>
                <Input
                  type="text"
                  value={dbConfig.server}
                  onChange={e => handleDbConfigChange('server', e.target.value)}
                  placeholder={t('settings.serverPlaceholder') || 'Server name or IP'}
                  className={isRTL ? 'text-right' : 'text-left'}
                />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('settings.database') || 'Database'}
                </label>
                <Input
                  type="text"
                  value={dbConfig.database}
                  onChange={e => handleDbConfigChange('database', e.target.value)}
                  placeholder={t('settings.databasePlaceholder') || 'Database name'}
                  className={isRTL ? 'text-right' : 'text-left'}
                />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('settings.user') || 'User'}
                </label>
                <Input
                  type="text"
                  value={dbConfig.user}
                  onChange={e => handleDbConfigChange('user', e.target.value)}
                  placeholder={t('settings.userPlaceholder') || 'Database user'}
                  className={isRTL ? 'text-right' : 'text-left'}
                />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('settings.password') || 'Password'}
                </label>
                <Input
                  type="password"
                  value={dbConfig.password}
                  onChange={e => handleDbConfigChange('password', e.target.value)}
                  placeholder={t('settings.passwordPlaceholder') || 'Database password'}
                  className={isRTL ? 'text-right' : 'text-left'}
                />
              </div>
              <Button
                onClick={handleReconnect}
                disabled={isReconnecting}
                className={`w-full mt-4 flex ${isRTL ? 'flex-row-reverse' : 'flex-row'} items-center gap-2`}
              >
                <Plug className="h-4 w-4" />
                {isReconnecting
                  ? t('settings.reconnecting') || 'Reconnecting...'
                  : t('settings.reconnectDatabase') || 'Reconnect Database'}
              </Button>
              {reconnectionError && (
                <div className={`text-sm text-red-600 mt-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {reconnectionError}
                </div>
              )}
              {reconnectionSuccess && (
                <div className={`text-sm text-green-600 mt-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('settings.connectionSuccess') || 'Connection successful'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;