import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mssqlClient } from '@/lib/mssql-client';
import { KitchenOrder } from '@/types/KitchenOrder';

const KDS_ORDER_TABLE_NAME = 'DB_POS_ORDER_KDS';

const mapDbRowToKitchenOrder = (row: any): KitchenOrder => ({
  id: row.ORDER_NO,
  cat_code: row.CAT_CODE,
  order_no: row.ORDER_NO,
  item_code: row.ITEM_CODE,
  item_name: row.ITEM_NAME,
  item_engname: row.ITEM_ENGNAME,
  qty: row.QTY,
  order_time: new Date(row.ORDER_TIME),
  time_to_finish: Number(row.TIME_TO_FINISH ?? 0),
  time_to_finish_db: Number(row['kds.TIME_TO_FINISH'] ?? 0),
  finished: row.FINISHED,
  table_description: row.TABLE_DESCRIPTION,
  order_comments: row.ORDER_COMMENTS,
});

export const useKitchenOrders = (kdsCatCodes: number[]) => {
  return useQuery<Record<number, KitchenOrder[]>, Error>({
    queryKey: ['kdsOrders', kdsCatCodes],
    queryFn: async () => {
      if (!kdsCatCodes?.length) return {};
      
      const ordersData = await mssqlClient
        .from(`${KDS_ORDER_TABLE_NAME} AS kds`)
        .select(`
          kds.CAT_CODE,
          kds.ORDER_NO,
          kds.ITEM_CODE,
          im.ITEM_NAME2 AS ITEM_NAME,
          im.ITEM_NAME AS ITEM_ENGNAME,
          kds.ORDER_TIME,
          im.TIME_TO_FINISH,
          kds.TIME_TO_FINISH AS "kds.TIME_TO_FINISH",
          kds.QTY,
          kds.FINISHED,
          kds.TABLE_DESCRIPTION,
          kds.ORDER_COMMENTS
        `)
        .join('DB_ITEM_MASTER AS im', 'kds.ITEM_CODE', 'im.ITEM_CODE')
        .where('kds.FINISHED', 'IS', null)
        .whereIn('kds.CAT_CODE', kdsCatCodes)
        .order('kds.ORDER_TIME', { ascending: true })
        .get();

      if (!ordersData?.length) return {};

      const groupedOrders = new Map<number, KitchenOrder[]>();
      for (const row of ordersData) {
        const order = mapDbRowToKitchenOrder(row);
        if (order.order_no == null) continue;
        
        if (!groupedOrders.has(order.order_no)) {
          groupedOrders.set(order.order_no, []);
        }
        groupedOrders.get(order.order_no)!.push(order);
      }

      return Object.fromEntries(groupedOrders);
    },
    enabled: kdsCatCodes.length > 0,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
};

export const useFinishOrder = (currentUser: string = 'system') => {
  const queryClient = useQueryClient();
  const finishTime = new Date().toISOString();

  return useMutation<void, Error, number>({
    mutationFn: async (order_no) => {
      const { error } = await mssqlClient.query(`
UPDATE DB_POS_ORDER_KDS
SET 
  FINISH_TIME = GETDATE(),
  TIME_TO_FINISH = DATEDIFF(MINUTE, ORDER_TIME, GETDATE()),
  FINISH_BY = '${currentUser}',
  FINISHED = 1
WHERE ORDER_NO = ${order_no};

UPDATE DB_POS_ORDER_KDS
SET 
  LATE = CASE
    WHEN COALESCE((
      SELECT TIME_TO_FINISH 
      FROM DB_ITEM_MASTER 
      WHERE ITEM_CODE = DB_POS_ORDER_KDS.ITEM_CODE
        AND DB_POS_ORDER_KDS.ORDER_NO = ${order_no}
    ), 0) - COALESCE(DB_POS_ORDER_KDS.TIME_TO_FINISH, 0) > 0
    THEN 1 ELSE 0
  END
WHERE ORDER_NO = ${order_no};
  `);


      if (error) throw new Error(`Failed to finish order: ${error.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kdsOrders'] });
    },
  });
};