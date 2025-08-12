import React, { useMemo, useEffect } from 'react';
import { ArrowLeft, CheckCircle, Clock, Utensils, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { KitchenOrder, GroupedKitchenOrder } from '@/types/KitchenOrder';

interface FullScreenOrderProps {
  orderGroup: GroupedKitchenOrder[];
  onBack: () => void;
  onFinish: (orderNo: number) => void;
  onOrderStatusChange?: (isNearFinish: boolean) => void;
  onCompletion: () => void;
}

const FullScreenOrder: React.FC<FullScreenOrderProps> = ({
  orderGroup,
  onBack,
  onFinish,
  onOrderStatusChange,
  onCompletion,
}) => {
  const { t, language } = useLanguage();

  // Get the main order details from the first grouped item
  const firstGroup = orderGroup[0];
  const mainOrderDetails = firstGroup?.main;

  // Parse order time with comprehensive error handling
  const orderTime = useMemo(() => {
    if (!mainOrderDetails?.order_time) {
      console.debug('FullScreenOrder: No order_time provided');
      return null;
    }
    
    let parsedTime: Date;
    if (typeof mainOrderDetails.order_time === 'string') {
      parsedTime = new Date(mainOrderDetails.order_time);
    } else if (mainOrderDetails.order_time instanceof Date) {
      parsedTime = mainOrderDetails.order_time;
    } else {
      console.debug('FullScreenOrder: Invalid order_time type:', typeof mainOrderDetails.order_time);
      return null;
    }
    
    // Check if the parsed date is valid
    if (isNaN(parsedTime.getTime())) {
      console.debug('FullScreenOrder: Invalid date parsed from order_time:', mainOrderDetails.order_time);
      return null;
    }
    
    return parsedTime;
  }, [mainOrderDetails?.order_time]);

  // Parse time to finish with comprehensive validation
  const timeToFinishMinutes = useMemo(() => {
    const rawTime = mainOrderDetails?.time_to_finish;
    
    // Handle null, undefined, empty string, etc.
    if (rawTime === undefined || rawTime === null) {
      console.debug('FullScreenOrder: No time_to_finish provided, defaulting to 0');
      return 0;
    }
    
    const parsed = Number(rawTime);
    
    // Check if conversion resulted in a valid number
    if (isNaN(parsed) || !isFinite(parsed)) {
      console.debug('FullScreenOrder: Invalid time_to_finish value:', rawTime, 'parsed as:', parsed);
      return 0;
    }
    
    // Ensure non-negative value
    if (parsed < 0) {
      console.debug('FullScreenOrder: Negative time_to_finish value:', parsed, 'setting to 0');
      return 0;
    }
    
    return parsed;
  }, [mainOrderDetails?.time_to_finish]);

  const orderNo = mainOrderDetails?.order_no ?? 0;
  const depType = mainOrderDetails?.dep_code || 'Kitchen';
  const itemType = mainOrderDetails?.item_type || 'Food';
  // Determine department name based on language
  const debTypeName = language === 'ar'
    ? mainOrderDetails?.dept_name_ar || mainOrderDetails?.dep_code || 'Unknown'
    : mainOrderDetails?.dept_name || mainOrderDetails?.dep_code || 'Unknown';
const tableId = mainOrderDetails?.table_id || 0;
const orderComments = mainOrderDetails?.order_comments || '';
  // Enhanced countdown hook with better validation (same as OrderCard)
  const useCountdown = (orderTime: Date | null, timeToFinishMinutes: number) => {
    const [remainingSeconds, setRemainingSeconds] = React.useState(() => {
      // Initial state calculation with validation
      if (!orderTime || !timeToFinishMinutes || timeToFinishMinutes <= 0) {
        console.debug('FullScreenOrder useCountdown: Invalid initial parameters, setting to 0');
        return 0;
      }
      
      try {
        const now = new Date();
        const finishTime = new Date(orderTime.getTime() + timeToFinishMinutes * 60000);
        const remaining = Math.max(0, Math.floor((finishTime.getTime() - now.getTime()) / 1000));
        
        // Additional validation for the calculated remaining time
        if (isNaN(remaining) || !isFinite(remaining)) {
          console.debug('FullScreenOrder useCountdown: Calculated invalid remaining time, setting to 0');
          return 0;
        }
        
        return remaining;
      } catch (error) {
        console.debug('FullScreenOrder useCountdown: Error calculating initial remaining time:', error);
        return 0;
      }
    });

    React.useEffect(() => {
      let interval: NodeJS.Timeout;
      
      // Validate parameters before starting interval
      if (!orderTime || !timeToFinishMinutes || timeToFinishMinutes <= 0) {
        console.debug('FullScreenOrder useCountdown: Invalid parameters, not starting interval');
        setRemainingSeconds(0);
        return;
      }
      
      // Only start interval if we have positive remaining time
      if (remainingSeconds > 0) {
        interval = setInterval(() => {
          try {
            const now = new Date();
            const finishTime = new Date(orderTime.getTime() + timeToFinishMinutes * 60000);
            const newRemaining = Math.max(0, Math.floor((finishTime.getTime() - now.getTime()) / 1000));
            
            // Validate calculated time
            if (isNaN(newRemaining) || !isFinite(newRemaining)) {
              console.debug('FullScreenOrder useCountdown: Calculated invalid time in interval, stopping');
              setRemainingSeconds(0);
              return;
            }
            
            setRemainingSeconds(newRemaining);
            
            // Call status change callback
            if (onOrderStatusChange) {
              const isNearFinish = newRemaining <= 300;
              onOrderStatusChange(isNearFinish);
            }
            
            // Trigger completion sound only once when timer expires
            if (newRemaining <= 0 && remainingSeconds > 0) {
              console.debug('FullScreenOrder useCountdown: Timer expired, triggering completion');
              onCompletion();
            }
          } catch (error) {
            console.debug('FullScreenOrder useCountdown: Error in interval:', error);
            setRemainingSeconds(0);
          }
        }, 1000);
      }
      
      return () => {
        if (interval) {
          clearInterval(interval);
        }
      };
    }, [orderTime, timeToFinishMinutes, remainingSeconds, onOrderStatusChange, onCompletion]);

    // Format time with validation
    const formatTime = (seconds: number): string => {
      if (!seconds || seconds <= 0 || isNaN(seconds) || !isFinite(seconds)) {
        return '00:00';
      }
      
      const minutes = Math.floor(seconds / 60);
      const secs = (seconds % 60);
      
      // Additional validation
      if (isNaN(minutes) || isNaN(secs) || !isFinite(minutes) || !isFinite(secs)) {
        return '00:00';
      }
      
      return `${minutes}:${String(secs).padStart(2, '0')}`;
    };

    const formattedTime = formatTime(remainingSeconds);
    const isExpired = remainingSeconds <= 0;
    const isUrgent = remainingSeconds <= 300 && remainingSeconds > 0; // 5 minutes or less

    return { formattedTime, isExpired, isUrgent };
  };

  const { formattedTime, isExpired, isUrgent } = useCountdown(orderTime, timeToFinishMinutes);

  // Calculate total items across all main items and their modifiers
  const totalItems = orderGroup.reduce((sum, group) => {
    let groupSum = group.main.qty || 0;
    groupSum += group.modifiers.reduce((modSum, mod) => modSum + (mod.qty || 0), 0);
    return sum + groupSum;
  }, 0);

  // Render error state if no valid main order details
  if (!mainOrderDetails) {
    return (
      <div className="fixed inset-0 bg-gray-900 z-50 flex items-center justify-center p-4">
        <Card className="border-2 border-red-500 bg-gray-800 w-full max-w-md">
          <CardContent className="p-4 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-red-400 mb-2">Invalid Order Data</h2>
            <Button
              onClick={onBack}
              className="mt-4 bg-red-600 hover:bg-red-700 text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Determine styling based on timer state
  const getCardStyling = () => {
    if (!orderTime || !timeToFinishMinutes) {
      return {
        bgColor: 'bg-gray-900',
        headerColor: 'bg-gray-700',
        timerColor: 'text-gray-400',
        borderColor: 'border-gray-600'
      };
    }
    
    if (isExpired) {
      return {
        bgColor: 'bg-red-900',
        headerColor: 'bg-red-700',
        timerColor: 'text-red-400',
        borderColor: 'border-red-500'
      };
    }
    
    if (isUrgent) {
      return {
        bgColor: 'bg-orange-900',
        headerColor: 'bg-orange-700',
        timerColor: 'text-orange-400',
        borderColor: 'border-orange-500'
      };
    }
    
    return {
      bgColor: 'bg-gray-900',
      headerColor: 'bg-gray-700',
      timerColor: 'text-green-400',
      borderColor: 'border-gray-600'
    };
  };

  const { bgColor, headerColor, timerColor, borderColor } = getCardStyling();

  return (
    <div className={`fixed inset-0 ${bgColor} text-white z-50 flex flex-col`}>
      {/* Header */}
      <header className={`${headerColor} p-4 flex items-center justify-between border-b-4 ${borderColor}`}>
        {/* Left side: Back button, items count, and department */}
        <div className="flex items-center gap-4">
          <Button
            onClick={onBack}
            variant="outline"
            className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 text-white border-gray-500"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          <span className="bg-blue-600 text-white px-3 py-2 rounded font-bold">
            {totalItems} {t('order.items')}
          </span>
          
          <span className="bg-gray-600 text-white px-3 py-2 rounded font-bold">
            {debTypeName}
          </span>
           <span className="bg-gray-600 text-white px-3 py-2 rounded font-bold">
            {orderComments ? `${orderComments}` : ''}
          </span>
             <span className="bg-gray-600 text-white px-3 py-2 rounded font-bold">
            {tableId ? `Table: ${tableId}` : ''}
          </span>
        </div>

        {/* Center: Order number (big and bold) */}
        <div className="flex items-center gap-4">
          <span className="text-4xl font-bold">#{orderNo}</span>
          {isExpired && orderTime && timeToFinishMinutes > 0 && (
            <span className="bg-red-600 text-white px-3 py-2 rounded font-bold animate-pulse">
              Order Late
            </span>
          )}
        </div>

        {/* Right side: Timer and Finish button */}
        <div className="flex items-center gap-4">
          <div className={`text-3xl font-mono font-bold ${timerColor}`}>
            {formattedTime}
          </div>

          <Button
            onClick={() => onFinish(orderNo)}
            className={`${isExpired && orderTime && timeToFinishMinutes > 0 ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-green-600 hover:bg-green-700'} text-white font-bold px-6 py-3 text-lg`}
          >
            <CheckCircle className="h-5 w-5 mr-2" />
            {t('kds.finish')}
          </Button>
        </div>
      </header>

      {/* Main Content - Smaller Cards Grid */}
      <main className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
          {orderGroup.map((group, idx) => (
            <Card key={group.main.id || idx} className="bg-gray-800 text-white shadow-lg border-2 border-gray-700 h-fit">
              <CardContent className="p-3">
                {/* Main Item - Compact Layout */}
                <div className="flex items-start gap-3 bg-gray-700 p-3 rounded-lg mb-3">
                  <span className="bg-blue-500 text-white font-bold rounded text-sm px-3 py-1 min-w-[40px] text-center flex-shrink-0">
                    {group.main.qty}×
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-base font-semibold mb-1 leading-tight">
                      {language === 'ar' ? group.main.item_name : group.main.item_engname || group.main.item_name}
                    </div>
                    {/* {group.main.order_comments && (
                      <div className="bg-yellow-600/20 border-l-2 border-yellow-400 p-2 rounded-r">
                        <div className="text-yellow-400 font-medium text-xs">Notes:</div>
                        <div className="text-yellow-200 text-xs mt-1 leading-tight">"{group.main.order_comments}"</div>
                      </div>
                    )} */}
                  </div>
                </div>

                {/* Modifiers - Compact Layout */}
                {group.modifiers.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-purple-400 font-semibold text-sm">Modifiers:</h4>
                    {group.modifiers.map((modifier, modIdx) => (
                      <div key={modIdx} className="flex items-start gap-2 bg-purple-900/30 p-2 rounded">
                        <span className="bg-purple-500 text-white font-bold rounded text-xs px-2 py-1 min-w-[30px] text-center flex-shrink-0">
                          {modifier.qty}×
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-gray-200 text-sm leading-tight">
                            {language === 'ar' ? modifier.item_name : modifier.item_engname || modifier.item_name}
                          </div>
                          {/* {modifier.order_comments && (
                            <div className="bg-yellow-600/20 border-l-2 border-yellow-400 p-1 rounded-r mt-1">
                              <div className="text-yellow-400 font-medium text-xs">Notes:</div>
                              <div className="text-yellow-200 text-xs leading-tight">"{modifier.order_comments}"</div>
                            </div>
                          )} */}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default FullScreenOrder;