import React, { useMemo } from 'react';
import { KitchenOrder } from '@/types/KitchenOrder';
import { useCountdown, formatTimer } from '../utils/timerUtils';
import { useLanguage } from '../contexts/LanguageContext';
import { ArrowLeft, CheckCircle, Clock, Utensils, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface FullScreenOrderProps {
  orderGroup: KitchenOrder[];
  onBack: () => void;
  onFinish: () => void;
  onOrderStatusChange?: (isNearFinish: boolean) => void;
}

const FullScreenOrder: React.FC<FullScreenOrderProps> = ({
  orderGroup,
  onBack,
  onFinish,
  onOrderStatusChange,
}) => {
  const { t, language } = useLanguage();
  const firstOrder = orderGroup[0];

  // Parse order time with error handling
  const orderTime = useMemo(() => {
    if (!firstOrder?.order_time) return null;
    const parsedTime = new Date(firstOrder.order_time);
    return isNaN(parsedTime.getTime()) ? null : parsedTime;
  }, [firstOrder?.order_time]);

  const timeToFinishMinutes = useMemo(() => {
    const rawTime = firstOrder?.time_to_finish;
    if (!rawTime) return 0;
    const parsed = Number(rawTime);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }, [firstOrder?.time_to_finish]);

const orderNo = firstOrder?.order_no ?? ''; // or 0 or some fallback

const {
  remainingSeconds,
  isNearFinish,
  formattedTime,
  timerColor,
  cardStyles,
  isExpired,
} = useCountdown(orderNo, orderTime, timeToFinishMinutes, onOrderStatusChange);

  const totalItems = orderGroup.reduce((sum, item) => sum + (item.qty || 0), 0);
  const timerDisplay = isExpired ? `⚠️ ${formattedTime}` : formattedTime;

  if (!firstOrder || !orderTime) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4">
        <Card className="border-2 border-red-600/50 bg-red-900/30 w-full max-w-md">
          <CardContent className="p-4 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-red-400 mb-2">{t('order.invalidOrderData')}</h2>
            <Button
              onClick={onBack}
              className="mt-4 bg-red-600 hover:bg-red-700 text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('order.back')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <header className={`${cardStyles.background} border-b p-3 flex items-center justify-between`}>
        <Button
          onClick={onBack}
          variant="outline"
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t('order.back')}</span>
        </Button>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">#{firstOrder.order_no}</span>
            <span className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-bold">
              {totalItems} {totalItems === 1 ? t('order.item') : t('order.items')}
            </span>
            {isExpired && (
              <span className="bg-red-600 text-white px-3 py-1 rounded text-sm font-bold animate-pulse">
                EXPIRED
              </span>
            )}
          </div>

          <div className={`text-2xl font-bold ${timerColor}`}>
            {timerDisplay}
          </div>
        </div>

        <Button
          onClick={onFinish}
          className={`${isExpired ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white`}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          {isExpired ? t('kds.complete') || 'Complete' : t('kds.finish')}
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4">
        <Card className={`${cardStyles.background} ${cardStyles.border} h-full`}>
          <CardContent className="p-4 h-full flex flex-col">
  
            <hr className="border-t border-border/50 mb-4" />

            {/* Order Items Section */}
            <section className="mb-6">
              <h3 className="font-bold mb-4 flex items-center gap-2 text-lg">
                <Utensils className="h-5 w-5" />
                {t('order.orderItems')}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {orderGroup.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="flex items-start gap-3 border-l-4 border-blue-500 pl-3 py-2 bg-muted/20 rounded-r-md"
                  >
                    <span className="bg-blue-600 text-white font-bold rounded text-center text-sm px-2 py-1 min-w-[40px]">
                      {item.qty}x
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground leading-tight">
                        {language === 'ar' ? item.item_name : item.item_engname || item.item_name}
                      </div>
                      {item.order_comments && (
                        <div className="text-yellow-400 text-sm mt-1">
                          <div className="font-medium">{t('order.specialInstructions')}:</div>
                          <div>"{item.order_comments}"</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

        
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default FullScreenOrder;