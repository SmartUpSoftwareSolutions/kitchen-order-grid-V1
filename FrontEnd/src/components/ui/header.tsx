import React, { useState, useEffect, useRef } from 'react';
import { ChefHat, Settings, Monitor, Loader2, Volume2, VolumeX, HelpCircle, X, Zap, Cpu, Wifi, Activity, Layers, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const KDSHeader = ({ 
  t, 
  language, 
  isMuted, 
  toggleMute, 
  finishOrderNumber, 
  setFinishOrderNumber, 
  handleFinishOrder, 
  finishOrderMutation, 
  isConnected, 
  orderGroups, 
  selectedCategories, 
  kdsCategories, 
  setSettingsOpen, 
  toggleHelp, 
  inputRef 
}) => {
  const [headerAnimation, setHeaderAnimation] = useState(0);
  const [pulseActive, setPulseActive] = useState(false);
  const [dataFlow, setDataFlow] = useState([]);
  const headerRef = useRef(null);
  
  const isRTL = language === 'ar';

  // Create dynamic data flow animation
  useEffect(() => {
    const interval = setInterval(() => {
      setDataFlow(prev => {
        const newFlow = [...prev];
        if (newFlow.length < 8) {
          newFlow.push({
            id: Date.now() + Math.random(),
            progress: 0,
            speed: 0.5 + Math.random() * 1.5,
            lane: Math.floor(Math.random() * 3)
          });
        }
        return newFlow
          .map(item => ({ ...item, progress: item.progress + item.speed }))
          .filter(item => item.progress < 100);
      });
    }, 800);

    return () => clearInterval(interval);
  }, []);

  // Pulse animation when orders change
  useEffect(() => {
    setPulseActive(true);
    const timer = setTimeout(() => setPulseActive(false), 1000);
    return () => clearTimeout(timer);
  }, [orderGroups.length]);

  // Floating header animation
  useEffect(() => {
    const interval = setInterval(() => {
      setHeaderAnimation(prev => (prev + 1) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <header 
      ref={headerRef}
      className={`
        relative overflow-hidden select-none
        bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950
        backdrop-blur-xl
        ${isRTL ? 'rtl' : 'ltr'}
      `}
      style={{
        minHeight: '140px',
        background: `
          radial-gradient(circle at ${isRTL ? '80%' : '20%'} 20%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
          radial-gradient(circle at ${isRTL ? '20%' : '80%'} 80%, rgba(16, 185, 129, 0.08) 0%, transparent 50%),
          linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)
        `
      }}
    >
      {/* Animated Neural Network Background */}
      <div className="absolute inset-0 opacity-20">
        <svg className="w-full h-full" viewBox="0 0 400 140">
          <defs>
            <linearGradient id="neuralGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#10b981" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          
          {/* Neural nodes */}
          {[...Array(12)].map((_, i) => (
            <g key={i}>
              <circle
                cx={50 + (i * 30) % 350}
                cy={30 + (i * 25) % 80}
                r="2"
                fill="url(#neuralGradient)"
                opacity={0.6 + Math.sin(headerAnimation * 0.02 + i) * 0.4}
              />
              {/* Neural connections */}
              {i < 11 && (
                <line
                  x1={50 + (i * 30) % 350}
                  y1={30 + (i * 25) % 80}
                  x2={50 + ((i + 1) * 30) % 350}
                  y2={30 + ((i + 1) * 25) % 80}
                  stroke="url(#neuralGradient)"
                  strokeWidth="1"
                  opacity={0.3 + Math.sin(headerAnimation * 0.03 + i) * 0.2}
                />
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* Data Flow Visualization */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800/50 overflow-hidden">
        {dataFlow.map(item => (
          <div
            key={item.id}
            className={`absolute h-full w-8 bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-60 transform transition-all duration-300`}
            style={{
              left: `${isRTL ? 100 - item.progress : item.progress}%`,
              top: `${item.lane * 33}%`,
              height: '33%'
            }}
          />
        ))}
      </div>

      {/* Main Header Content */}
      <div className="relative z-10 container mx-auto px-6 py-6">
        
        {/* Top Section - Brand & Status */}
        <div className={`flex items-center justify-between mb-6 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          
          {/* Revolutionary Brand Section */}
          <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className="relative group">
              {/* Animated Logo Container */}
              <div 
                className={`
                  w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-emerald-500/20 
                  border border-blue-400/30 backdrop-blur-md flex items-center justify-center
                  transform transition-all duration-500 group-hover:scale-110 group-hover:rotate-3
                  ${pulseActive ? 'animate-pulse' : ''}
                `}
                style={{
                  boxShadow: `
                    0 0 20px rgba(59, 130, 246, 0.2),
                    inset 0 0 20px rgba(16, 185, 129, 0.1)
                  `
                }}
              >
                <ChefHat className="h-8 w-8 text-blue-400 transform group-hover:rotate-12 transition-transform duration-300" />
                
                {/* Floating notification badge */}
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                  <span className="text-xs font-bold text-white">{orderGroups.length}</span>
                </div>
                
                {/* Orbital rings */}
                <div className="absolute inset-0 rounded-2xl border border-blue-400/20 animate-ping"></div>
                <div className="absolute inset-0 rounded-2xl border border-emerald-400/20 animate-ping animation-delay-200"></div>
              </div>
            </div>

            {/* Dynamic Title Section */}
            <div className={`flex flex-col ${isRTL ? 'items-end text-right' : 'items-start text-left'}`}>
              <div className="relative">
                <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-emerald-400 to-purple-400 tracking-wide leading-none">
                  {t('kds.title')}
                </h1>
                {/* Animated underline */}
                <div 
                  className="absolute -bottom-1 h-0.5 bg-gradient-to-r from-blue-400 to-emerald-400 transition-all duration-1000"
                  style={{ width: `${50 + Math.sin(headerAnimation * 0.02) * 20}%` }}
                />
              </div>
              
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-slate-400 font-mono tracking-widest">
                  KITCHEN • DISPLAY • SYSTEM
                </span>
                
                {/* Real-time activity indicator */}
                <div className="flex items-center gap-1">
                  <Activity className="h-3 w-3 text-green-400" />
                  <div className="flex gap-1">
                    {[...Array(3)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 h-4 bg-green-400/60 rounded-full animate-pulse"
                        style={{ animationDelay: `${i * 0.2}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating Status Dashboard */}
          <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
            
            {/* Connection Status Orb */}
            <div className="relative">
              <div 
                className={`
                  w-12 h-12 rounded-full flex items-center justify-center
                  ${isConnected 
                    ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-400/40' 
                    : 'bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-400/40'
                  }
                  backdrop-blur-md transition-all duration-300
                `}
                style={{
                  boxShadow: isConnected 
                    ? '0 0 20px rgba(34, 197, 94, 0.3)' 
                    : '0 0 20px rgba(239, 68, 68, 0.3)'
                }}
              >
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
              </div>
              
              {/* Status label */}
              <div className={`absolute -bottom-6 ${isRTL ? 'right-0' : 'left-0'} text-xs font-medium ${isConnected ? 'text-green-300' : 'text-red-300'}`}>
                {isConnected ? 'LIVE' : 'DOWN'}
              </div>
            </div>

            {/* Audio Status */}
            <Button
              onClick={toggleMute}
              className={`
                w-12 h-12 rounded-xl backdrop-blur-md transition-all duration-300 transform hover:scale-110
                ${isMuted 
                  ? 'bg-red-500/20 border border-red-400/40 text-red-300 hover:bg-red-500/30' 
                  : 'bg-blue-500/20 border border-blue-400/40 text-blue-300 hover:bg-blue-500/30'
                }
              `}
              style={{
                boxShadow: isMuted 
                  ? '0 0 15px rgba(239, 68, 68, 0.2)' 
                  : '0 0 15px rgba(59, 130, 246, 0.2)'
              }}
            >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>

            {/* Settings & Help */}
            <div className="flex gap-2">
              <Button
                onClick={() => setSettingsOpen(true)}
                className="w-12 h-12 rounded-xl bg-slate-700/30 border border-slate-600/40 text-slate-300 hover:bg-slate-600/40 backdrop-blur-md transition-all duration-300 transform hover:scale-110"
              >
                <Settings className="h-5 w-5" />
              </Button>
              
              <Button
                onClick={toggleHelp}
                className="w-12 h-12 rounded-xl bg-slate-700/30 border border-slate-600/40 text-slate-300 hover:bg-slate-600/40 backdrop-blur-md transition-all duration-300 transform hover:scale-110"
              >
                <HelpCircle className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Control Section - Floating Command Center */}
        <div className="relative">
          <div 
            className={`
              flex items-center justify-center gap-6 p-4 
              bg-gradient-to-r from-slate-800/40 via-slate-700/40 to-slate-800/40 
              backdrop-blur-xl rounded-2xl border border-slate-600/30
              ${isRTL ? 'flex-row-reverse' : 'flex-row'}
            `}
            style={{
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
            }}
          >
            
            {/* Advanced Input Field */}
            <div className="relative flex-1 max-w-md">
              <div 
                className={`
                  relative overflow-hidden rounded-xl bg-slate-900/50 border border-slate-600/50
                  focus-within:border-blue-400/50 focus-within:bg-slate-900/80 transition-all duration-300
                `}
                style={{
                  boxShadow: 'inset 0 2px 10px rgba(0, 0, 0, 0.3)'
                }}
              >
                <Input
                  ref={inputRef}
                  placeholder={t('kds.enterOrderNumber')}
                  value={finishOrderNumber}
                  onChange={e => setFinishOrderNumber(e.target.value)}
                  className={`
                    h-14 text-lg bg-transparent border-0 text-slate-100 placeholder-slate-400 
                    focus:ring-0 focus:outline-none transition-all duration-300
                    ${isRTL ? 'text-right pr-6 pl-16' : 'text-left pl-6 pr-16'}
                  `}
                  style={{ fontSize: '18px' }}
                  disabled={!isConnected}
                  onKeyDown={e => e.key === 'Enter' && handleFinishOrder()}
                />
                
                {/* Input decoration */}
                <div className={`absolute ${isRTL ? 'left-4' : 'right-4'} top-1/2 transform -translate-y-1/2 flex items-center gap-2`}>
                  {finishOrderNumber && isConnected && (
                    <div className="bg-blue-500/20 px-3 py-1 rounded-lg border border-blue-400/30">
                      <span className="text-xs text-blue-300 font-medium">ENTER</span>
                    </div>
                  )}
                  <Zap className="h-4 w-4 text-slate-500" />
                </div>
                
                {/* Animated border */}
                <div className="absolute inset-0 rounded-xl border border-blue-400/20 animate-pulse opacity-50" />
              </div>
            </div>

            {/* Execute Button */}
            <Button
              onClick={handleFinishOrder}
              disabled={finishOrderMutation.isPending || !isConnected}
              className={`
                h-14 px-8 rounded-xl font-bold text-white transition-all duration-300 transform hover:scale-105
                bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500
                border border-emerald-400/30 shadow-lg
                disabled:from-slate-600 disabled:to-slate-700 disabled:border-slate-500/30
              `}
              style={{
                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)'
              }}
            >
              {finishOrderMutation.isPending && <Loader2 className="h-5 w-5 animate-spin mr-2" />}
              <span className="text-lg">{t('kds.finish')}</span>
            </Button>
          </div>
        </div>

        {/* Category Zone Display */}
        <div className="mt-6 flex justify-center">
          <div 
            className={`
              flex items-center gap-4 px-6 py-3 
              bg-gradient-to-r from-slate-800/30 via-slate-700/30 to-slate-800/30 
              backdrop-blur-md rounded-xl border border-slate-600/30
              ${isRTL ? 'flex-row-reverse' : 'flex-row'}
            `}
          >
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-purple-400" />
              <span className="text-sm text-slate-300 font-medium">
                {isRTL ? 'النطاقات النشطة' : 'ACTIVE ZONES'}
              </span>
            </div>
            
            <div className="w-px h-4 bg-slate-600/50" />
            
            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
              {selectedCategories.size > 0 ? (
                kdsCategories
                  .filter(cat => selectedCategories.has(cat.CAT_CODE))
                  .map((cat, index) => {
                    const translationKey = `category.${cat.CAT_NAME}`;
                    const displayName = t(translationKey) !== translationKey ? t(translationKey) : cat.CAT_NAME;
                    return (
                      <div
                        key={cat.CAT_CODE}
                        className={`
                          px-3 py-1 rounded-lg bg-gradient-to-r from-purple-500/20 to-blue-500/20 
                          border border-purple-400/30 text-purple-300 font-medium text-sm
                          transform transition-all duration-300 hover:scale-105
                        `}
                        style={{
                          boxShadow: '0 2px 10px rgba(147, 51, 234, 0.2)'
                        }}
                      >
                        {displayName}
                      </div>
                    );
                  })
              ) : (
                <div className="px-4 py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-400/30 rounded-lg">
                  <span className="text-amber-300 font-medium text-sm">
                    {t('kds.noCategoriesSelected') || 'NO ZONES ACTIVE'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Glow Effect */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />
      
      {/* Corner Accent Lights */}
      <div className="absolute top-4 left-4 w-2 h-2 bg-blue-400 rounded-full animate-pulse opacity-60" />
      <div className="absolute top-4 right-4 w-2 h-2 bg-emerald-400 rounded-full animate-pulse opacity-60" style={{ animationDelay: '0.5s' }} />
      <div className="absolute bottom-4 left-4 w-2 h-2 bg-purple-400 rounded-full animate-pulse opacity-60" style={{ animationDelay: '1s' }} />
      <div className="absolute bottom-4 right-4 w-2 h-2 bg-pink-400 rounded-full animate-pulse opacity-60" style={{ animationDelay: '1.5s' }} />
    </header>
  );
};

export default KDSHeader;