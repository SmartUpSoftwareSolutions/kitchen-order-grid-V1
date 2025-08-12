import React, { useMemo } from 'react';
import { CheckCircle, Clock, Eye, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { KitchenOrder, GroupedKitchenOrder } from '@/types/KitchenOrder';

interface OrderCardProps {
  orderGroup: GroupedKitchenOrder[];
  onFinish: () => void;
  onViewFullScreen: () => void;
  onCompletion: () => void;
}

const OrderCard: React.FC<OrderCardProps> = ({
  orderGroup,
  onFinish,
  onViewFullScreen,
  onCompletion,
}) => {
  const { t, language } = useLanguage();

  // Get the main order details from the first grouped item
  const firstGroup = orderGroup[0];
  const mainOrderDetails = firstGroup?.main;

  // Parse order time with comprehensive error handling
  const orderTime = useMemo(() => {
    if (!mainOrderDetails?.order_time) {
      console.debug('OrderCard: No order_time provided');
      return null;
    }
    
    let parsedTime: Date;
    if (typeof mainOrderDetails.order_time === 'string') {
      parsedTime = new Date(mainOrderDetails.order_time);
    } else if (mainOrderDetails.order_time instanceof Date) {
      parsedTime = mainOrderDetails.order_time;
    } else {
      console.debug('OrderCard: Invalid order_time type:', typeof mainOrderDetails.order_time);
      return null;
    }
    
    // Check if the parsed date is valid
    if (isNaN(parsedTime.getTime())) {
      console.debug('OrderCard: Invalid date parsed from order_time:', mainOrderDetails.order_time);
      return null;
    }
    
    return parsedTime;
  }, [mainOrderDetails?.order_time]);

  // Parse time to finish with comprehensive validation
  const timeToFinishMinutes = useMemo(() => {
    const rawTime = mainOrderDetails?.time_to_finish;
    
    // Handle null, undefined, empty string, etc.
    if (rawTime === undefined || rawTime === null ) {
      console.debug('OrderCard: No time_to_finish provided, defaulting to 0');
      return 0;
    }
    
    const parsed = Number(rawTime);
    
    // Check if conversion resulted in a valid number
    if (isNaN(parsed) || !isFinite(parsed)) {
      console.debug('OrderCard: Invalid time_to_finish value:', rawTime, 'parsed as:', parsed);
      return 0;
    }
    
    // Ensure non-negative value
    if (parsed < 0) {
      console.debug('OrderCard: Negative time_to_finish value:', parsed, 'setting to 0');
      return 0;
    }
    
    return parsed;
  }, [mainOrderDetails?.time_to_finish]);

  const orderNo = mainOrderDetails?.order_no ?? 0;
  const depType = mainOrderDetails?.dep_code || 'Kitchen';
  const itemType = mainOrderDetails?.item_type || 'Food';
  const debTypeName = language === 'ar' 
    ? mainOrderDetails?.dept_name_ar || mainOrderDetails?.dep_code || 'Unknown'
    : mainOrderDetails?.dept_name || mainOrderDetails?.dep_code || 'Unknown';
const tableId = mainOrderDetails?.table_id || 0;

  // Enhanced countdown hook with better validation
  const useCountdown = (orderTime: Date | null, timeToFinishMinutes: number) => {
    const [remainingSeconds, setRemainingSeconds] = React.useState(() => {
      // Initial state calculation with validation
      if (!orderTime || !timeToFinishMinutes || timeToFinishMinutes <= 0) {
        console.debug('OrderCard useCountdown: Invalid initial parameters, setting to 0');
        return 0;
      }
      
      try {
        const now = new Date();
        const finishTime = new Date(orderTime.getTime() + timeToFinishMinutes * 60000);
        const remaining = Math.max(0, Math.floor((finishTime.getTime() - now.getTime()) / 1000));
        
        // Additional validation for the calculated remaining time
        if (isNaN(remaining) || !isFinite(remaining)) {
          console.debug('OrderCard useCountdown: Calculated invalid remaining time, setting to 0');
          return 0;
        }
        
        return remaining;
      } catch (error) {
        console.debug('OrderCard useCountdown: Error calculating initial remaining time:', error);
        return 0;
      }
    });

    React.useEffect(() => {
      let interval: NodeJS.Timeout;
      
      // Validate parameters before starting interval
      if (!orderTime || !timeToFinishMinutes || timeToFinishMinutes <= 0) {
        console.debug('OrderCard useCountdown: Invalid parameters, not starting interval');
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
              console.debug('OrderCard useCountdown: Calculated invalid time in interval, stopping');
              setRemainingSeconds(0);
              return;
            }
            
            setRemainingSeconds(newRemaining);
            
            // Trigger completion sound only once when timer expires
            if (newRemaining <= 0 && remainingSeconds > 0) {
              console.debug('OrderCard useCountdown: Timer expired, triggering completion');
              onCompletion();
            }
          } catch (error) {
            console.debug('OrderCard useCountdown: Error in interval:', error);
            setRemainingSeconds(0);
          }
        }, 1000);
      }
      
      return () => {
        if (interval) {
          clearInterval(interval);
        }
      };
    }, [orderTime, timeToFinishMinutes, remainingSeconds, onCompletion]);

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

  // Calculate total items
  const totalItems = orderGroup.reduce((sum, group) => {
    let groupSum = group.main.qty || 0;
    groupSum += group.modifiers.reduce((modSum, mod) => modSum + (mod.qty || 0), 0);
    return sum + groupSum;
  }, 0);

  // Don't render if essential data is missing
  if (!mainOrderDetails) {
    console.debug('OrderCard: No main order details, not rendering');
    return null;
  }

  // Determine card styling based on timer state
  const getCardStyling = () => {
    if (!orderTime || !timeToFinishMinutes) {
      return {
        cardBorderColor: 'border-gray-500',
        headerBgColor: 'bg-gray-600',
        timerTextColor: 'text-gray-400'
      };
    }
    
    if (isExpired) {
      return {
        cardBorderColor: 'border-red-500',
        headerBgColor: 'bg-red-600',
        timerTextColor: 'text-red-400'
      };
    }
    
    if (isUrgent) {
      return {
        cardBorderColor: 'border-orange-500',
        headerBgColor: 'bg-orange-600',
        timerTextColor: 'text-orange-400'
      };
    }
    
    return {
      cardBorderColor: 'border-blue-500',
      headerBgColor: 'bg-blue-600',
      timerTextColor: 'text-green-400'
    };
  };

  const { cardBorderColor, headerBgColor, timerTextColor } = getCardStyling();

  // Determine items to display and the count of additional items
  const itemsToDisplay = orderGroup.slice(0, 3);
  const additionalItemCount = orderGroup.length > 3 ? orderGroup.length - 3 : 0;

  return (
    <Card className={`${cardBorderColor} border-4 bg-gray-800 text-white shadow-lg min-w-[280px] max-w-[290px] h-[280px] flex flex-col`}>
      <CardContent className="p-0 flex flex-col h-full">
        {/* Header */}
        <div className={`${headerBgColor} px-3 py-2 flex justify-between items-center flex-shrink-0`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-bold text-sm">#{orderNo}</span>
            <span className="bg-white/20 text-white px-2 py-1 rounded text-xs font-medium">
              {totalItems} {t('order.items')}
            </span>
            <span className="bg-white/20 text-white px-2 py-1 rounded text-xs font-medium">
              {debTypeName}
            </span>
            {tableId > 0 && (
              <span className="bg-white/20 text-white px-2 py-1 rounded text-xs font-medium">
                Table: {tableId}
              </span>
            )}
          </div>
          {isExpired && orderTime && timeToFinishMinutes > 0 && (
            <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold animate-pulse flex-shrink-0">
              Order Late
            </span>
          )}
        </div>

        {/* Timer Section */}
        <div className="bg-gray-700 px-3 py-2 text-center flex-shrink-0">
          <div className={`text-lg font-mono font-bold ${timerTextColor}`}>
            {formattedTime}
          </div>
          {(!orderTime || !timeToFinishMinutes) && (
            <div className="text-xs text-gray-500 mt-1"></div>
          )}
        </div>

        {/* Items Section - Main Orders Only - Fixed height without scroll */}
        <div className="p-2 bg-gray-900 flex-grow">
          <div className="space-y-1 min-h-[100px]">
            {itemsToDisplay.map((group, idx) => (
              <div key={group.main.id || idx}>
                {/* Main Item Only */}
                <div className="flex items-center gap-1">
                  <span className="bg-blue-500 text-white font-bold rounded text-xs px-1 py-0.5 min-w-[24px] text-center flex-shrink-0 text-[10px]">
                    {group.main.qty}×
                  </span>
                  <div className="text-white text-xs font-medium flex-1 break-words leading-tight">
                    {language === 'ar' ? group.main.item_name : group.main.item_engname || group.main.item_name}
                  </div>
                </div>
              </div>
            ))}
            {additionalItemCount > 0 && (
              <div className="text-xs text-gray-400 mt-1">
                + {additionalItemCount} {t('kds.moreItems')}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 p-3 bg-gray-800 flex-shrink-0">
          <Button
            onClick={onFinish}
            className={`flex-1 flex items-center justify-center gap-2 text-sm font-semibold ${
              isExpired && orderTime && timeToFinishMinutes > 0 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-green-600 hover:bg-green-700'
            } text-white`}
          >
            <CheckCircle className="h-4 w-4" />
            {t('kds.finish')}
          </Button>
          <Button
            onClick={onViewFullScreen}
            className="bg-gray-600 hover:bg-gray-700 text-white p-2"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderCard;