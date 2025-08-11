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

  // Parse order time with error handling
  const orderTime = useMemo(() => {
    if (!mainOrderDetails?.order_time) return null;
    const parsedTime = typeof mainOrderDetails.order_time === 'string'
      ? new Date(mainOrderDetails.order_time)
      : mainOrderDetails.order_time;
    return isNaN(parsedTime.getTime()) ? null : parsedTime;
  }, [mainOrderDetails?.order_time]);

  const timeToFinishMinutes = useMemo(() => {
    const rawTime = mainOrderDetails?.time_to_finish;
    if (rawTime === undefined || rawTime === null) return 0;
    const parsed = Number(rawTime);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }, [mainOrderDetails?.time_to_finish]);

  const orderNo = mainOrderDetails?.order_no ?? 0;
  const depType = mainOrderDetails?.dep_code || 'Kitchen';
  const itemType = mainOrderDetails?.item_type || 'Food';
  const debTypeName = language === 'ar' 
    ? mainOrderDetails?.dept_name_ar || mainOrderDetails?.dep_code || 'Unknown'
    : mainOrderDetails?.dept_name || mainOrderDetails?.dep_code || 'Unknown';

  // Countdown hook
  const useCountdown = (orderTime: Date | null, timeToFinishMinutes: number) => {
    const [remainingSeconds, setRemainingSeconds] = React.useState(() => {
      if (!orderTime) return 0;
      const now = new Date();
      const finishTime = new Date(orderTime.getTime() + timeToFinishMinutes * 60000);
      return Math.max(0, Math.floor((finishTime.getTime() - now.getTime()) / 1000));
    });

    React.useEffect(() => {
      let interval: NodeJS.Timeout;
      if (orderTime && remainingSeconds > 0) {
        interval = setInterval(() => {
          const now = new Date();
          const finishTime = new Date(orderTime.getTime() + timeToFinishMinutes * 60000);
          const newRemaining = Math.max(0, Math.floor((finishTime.getTime() - now.getTime()) / 1000));
          setRemainingSeconds(newRemaining);
          if (newRemaining <= 0) {
            onCompletion(); // Trigger completion sound when timer expires
          }
        }, 1000);
      }
      return () => clearInterval(interval);
    }, [orderTime, timeToFinishMinutes, remainingSeconds, onCompletion]); // Added onCompletion to deps

    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = (remainingSeconds % 60).toString().padStart(2, '0');
    const formattedTime = `${minutes}:${seconds}`;
    const isExpired = remainingSeconds <= 0;
    const isUrgent = remainingSeconds <= 300 && remainingSeconds > 0;

    return { formattedTime, isExpired, isUrgent };
  };

  const { formattedTime, isExpired, isUrgent } = useCountdown(orderTime, timeToFinishMinutes);

  // Calculate total items
  const totalItems = orderGroup.reduce((sum, group) => {
    let groupSum = group.main.qty || 0;
    groupSum += group.modifiers.reduce((modSum, mod) => modSum + (mod.qty || 0), 0);
    return sum + groupSum;
  }, 0);

  if (!mainOrderDetails || !orderTime) {
    return null; // Skip rendering invalid orders
  }

  const cardBorderColor = isExpired ? 'border-red-500' : isUrgent ? 'border-orange-500' : 'border-blue-500';
  const headerBgColor = isExpired ? 'bg-red-600' : isUrgent ? 'bg-orange-600' : 'bg-blue-600';

  // Determine items to display and the count of additional items
  const itemsToDisplay = orderGroup.slice(0, 3);
  const additionalItemCount = orderGroup.length > 3 ? orderGroup.length - 3 : 0;

  return (
    <Card className={`${cardBorderColor} border-4 bg-gray-800 text-white shadow-lg min-w-[280px] max-w-[320px]`}>
      <CardContent className="p-0">
        {/* Header */}
        <div className={`${headerBgColor} px-3 py-2 flex justify-between items-center`}>
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-sm">#{orderNo}</span>
            <span className="bg-white/20 text-white px-2 py-1 rounded text-xs font-medium">
              {totalItems} {t('order.items')}
            </span>
            <span className="bg-white/20 text-white px-2 py-1 rounded text-xs font-medium">
              {debTypeName}
            </span>
          </div>
          {isExpired && (
            <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold animate-pulse">
              Order Late
            </span>
          )}
        </div>

        {/* Timer Section */}
        <div className="bg-gray-700 px-3 py-2 text-center">
          <div className={`text-lg font-mono font-bold ${isExpired ? 'text-red-400' : isUrgent ? 'text-orange-400' : 'text-green-400'}`}>
            {formattedTime}
          </div>
        </div>

        {/* Items Section - Main Orders Only */}
        <div className="p-3 space-y-2 bg-gray-900 min-h-[120px]">
          {itemsToDisplay.map((group, idx) => (
            <div key={group.main.id || idx}>
              {/* Main Item Only */}
              <div className="flex items-center gap-2">
                <span className="bg-blue-500 text-white font-bold rounded text-xs px-2 py-1 min-w-[30px] text-center">
                  {group.main.qty}×
                </span>
                <div className="text-white text-sm font-medium flex-1">
                  {language === 'ar' ? group.main.item_name : group.main.item_engname || group.main.item_name}
                </div>
                {/* You had a button here, assuming it was for removing/toggling. 
                    I'm commenting it out as its function is unclear in this context. 
                    If it's needed, ensure its purpose is clear.
                <button className="bg-blue-500 text-white text-xs px-2 py-1 rounded hover:bg-blue-600">
                  ×
                </button>
                */}
              </div>
            </div>
          ))}
          {additionalItemCount > 0 && (
            <div className="text-sm text-gray-400 mt-2">
              + {additionalItemCount} {t('kds.moreItems')} {/* Using translation key */}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 p-3 bg-gray-800">
          <Button
            onClick={onFinish}
            className={`flex-1 flex items-center justify-center gap-2 text-sm font-semibold ${
              isExpired ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
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
