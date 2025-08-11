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
}

const FullScreenOrder: React.FC<FullScreenOrderProps> = ({
  orderGroup,
  onBack,
  onFinish,
  onOrderStatusChange,
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
  // Determine department name based on language
  const debTypeName = language === 'ar'
    ? mainOrderDetails?.dept_name_ar || mainOrderDetails?.dep_code || 'Unknown'
    : mainOrderDetails?.dept_name || mainOrderDetails?.dep_code || 'Unknown';

  // Custom useCountdown hook
  const useCountdown = (
    orderNo: number,
    orderTime: Date | null,
    timeToFinishMinutes: number,
    onOrderStatusChange?: (isNearFinish: boolean) => void
  ) => {
    const [remainingSeconds, setRemainingSeconds] = React.useState(() => {
      if (!orderTime) return 0;
      const now = new Date();
      const finishTime = new Date(orderTime.getTime() + timeToFinishMinutes * 60000);
      return Math.max(0, Math.floor((finishTime.getTime() - now.getTime()) / 1000));
    });

    useEffect(() => {
      let interval: NodeJS.Timeout;
      if (orderTime && remainingSeconds > 0) {
        interval = setInterval(() => {
          const now = new Date();
          const finishTime = new Date(orderTime.getTime() + timeToFinishMinutes * 60000);
          const newRemaining = Math.max(0, Math.floor((finishTime.getTime() - now.getTime()) / 1000));
          setRemainingSeconds(newRemaining);
          const isNearFinish = newRemaining <= 300;
          if (onOrderStatusChange) onOrderStatusChange(isNearFinish);
        }, 1000);
      }
      return () => clearInterval(interval);
    }, [orderTime, timeToFinishMinutes, onOrderStatusChange, remainingSeconds]);

    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = (remainingSeconds % 60).toString().padStart(2, '0');
    const formattedTime = `${minutes}:${seconds}`;
    const isExpired = remainingSeconds <= 0;
    const isUrgent = remainingSeconds <= 300 && remainingSeconds > 0;

    return { remainingSeconds, formattedTime, isExpired, isUrgent };
  };

  const { remainingSeconds, formattedTime, isExpired, isUrgent } = useCountdown(
    orderNo,
    orderTime,
    timeToFinishMinutes,
    onOrderStatusChange
  );

  // Calculate total items across all main items and their modifiers
  const totalItems = orderGroup.reduce((sum, group) => {
    let groupSum = group.main.qty || 0;
    groupSum += group.modifiers.reduce((modSum, mod) => modSum + (mod.qty || 0), 0);
    return sum + groupSum;
  }, 0);

  // Render error state if no valid main order details
  if (!mainOrderDetails || !orderTime) {
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

  const bgColor = isExpired ? 'bg-red-900' : isUrgent ? 'bg-orange-900' : 'bg-gray-900';
  const headerColor = isExpired ? 'bg-red-700' : isUrgent ? 'bg-orange-700' : 'bg-gray-700';
  const timerColor = isExpired ? 'text-red-400' : isUrgent ? 'text-orange-400' : 'text-green-400';

  return (
    <div className={`fixed inset-0 ${bgColor} text-white z-50 flex flex-col`}>
      {/* Header */}
      <header className={`${headerColor} p-4 flex items-center justify-between border-b-4 ${isExpired ? 'border-red-500' : isUrgent ? 'border-orange-500' : 'border-gray-600'}`}>
        <Button
          onClick={onBack}
          variant="outline"
          className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 text-white border-gray-500"
        >
          <ArrowLeft className="h-4 w-4" />
          
        </Button>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold">#{orderNo}</span>
            <span className="bg-blue-600 text-white px-3 py-2 rounded font-bold">
              {totalItems} {t('order.items')}
            </span>
            {/* Added Department Name */}
            <span className="bg-gray-600 text-white px-3 py-2 rounded font-bold">
              {debTypeName}
            </span>
         
            {isExpired && (
              <span className="bg-red-600 text-white px-3 py-2 rounded font-bold animate-pulse">
                Order Late
              </span>
            )}
          </div>

          <div className={`text-3xl font-mono font-bold ${timerColor}`}>
            {formattedTime}
          </div>
        </div>

        <Button
          onClick={() => onFinish(orderNo)}
          className={`${isExpired ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-green-600 hover:bg-green-700'} text-white font-bold px-6 py-3 text-lg`}
        >
          <CheckCircle className="h-5 w-5 mr-2" />
          {t('kds.finish')}
        </Button>
      </header>

      {/* Main Content - Grid of Cards for Each Main Item with Modifiers */}
      <main className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {orderGroup.map((group, idx) => (
            <Card key={group.main.id || idx} className="bg-gray-800 text-white shadow-lg border-2 border-gray-700">
              <CardContent className="p-4">
                <div className="mb-4">
                  {/* Main Item */}
                  <div className="flex items-start gap-4 bg-gray-700 p-4 rounded-lg">
                    <span className="bg-blue-500 text-white font-bold rounded-lg text-lg px-4 py-2 min-w-[60px] text-center">
                      {group.main.qty}×
                    </span>
                    <div className="flex-1">
                      <div className="text-white text-xl font-semibold mb-2">
                        {language === 'ar' ? group.main.item_name : group.main.item_engname || group.main.item_name}
                      </div>
                      {group.main.order_comments && (
                        <div className="bg-yellow-600/20 border-l-4 border-yellow-400 p-3 rounded-r">
                          <div className="text-yellow-400 font-medium">Special Instructions:</div>
                          <div className="text-yellow-200 mt-1">"{group.main.order_comments}"</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Modifiers */}
                {group.modifiers.length > 0 && (
                  <div className="ml-8 space-y-3">
                    <h4 className="text-purple-400 font-semibold text-lg">Modifiers:</h4>
                    {group.modifiers.map((modifier, modIdx) => (
                      <div key={modIdx} className="flex items-start gap-4 bg-purple-900/30 p-3 rounded-lg">
                        <span className="bg-purple-500 text-white font-bold rounded text-sm px-3 py-1 min-w-[50px] text-center">
                          {modifier.qty}×
                        </span>
                        <div className="flex-1">
                          <div className="text-gray-200 text-lg">
                            {language === 'ar' ? modifier.item_name : modifier.item_engname || modifier.item_name}
                          </div>
                          {modifier.order_comments && (
                            <div className="bg-yellow-600/20 border-l-4 border-yellow-400 p-2 rounded-r mt-2">
                              <div className="text-yellow-400 font-medium text-sm">Modifier Notes:</div>
                              <div className="text-yellow-200 text-sm mt-1">"{modifier.order_comments}"</div>
                            </div>
                          )}
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
