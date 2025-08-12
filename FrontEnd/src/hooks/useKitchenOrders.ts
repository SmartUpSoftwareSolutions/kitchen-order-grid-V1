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
  item_type: row.ITEM_TYPE,
  table_id: row.TABLE_ID,
  dep_code: row.DEP_CODE || '', // Fallback to empty string
  dept_name: row.DEPT_NAME || undefined, // Fallback to undefined
  dept_name_ar: row.DEPT_NAME_AR || undefined, // Fallback to undefined
});

export interface GroupedKitchenOrder {
  main: KitchenOrder;
  modifiers: KitchenOrder[];
}

export const useKitchenOrders = (kdsCatCodes: number[]) => {
  return useQuery<Record<number, GroupedKitchenOrder[]>, Error>({
    queryKey: ['kdsOrders', kdsCatCodes],
    queryFn: async () => {
      if (!kdsCatCodes?.length) {
        console.warn('No category codes provided for kitchen orders query');
        return {};
      }

      try {
        const ordersData = await mssqlClient
          .from(`${KDS_ORDER_TABLE_NAME} AS kds`)
          .select(`
            kds.CAT_CODE,
            kds.MAIN_ORDER_NO AS ORDER_NO,
            kds.ITEM_CODE,
            kds.TABLE_ID,
            im.ITEM_NAME2 AS ITEM_NAME,
            im.ITEM_NAME AS ITEM_ENGNAME,
            kds.ORDER_TIME,
            im.TIME_TO_FINISH,
            kds.TIME_TO_FINISH AS "kds.TIME_TO_FINISH",
            kds.QTY,
            kds.FINISHED,
            kds.TABLE_DESCRIPTION,
            kds.ORDER_COMMENTS,
            kds.ITEM_TYPE,
            kds.DEP_CODE,
            dept.DEPT_NAME,
            dept.DEPT_NAME_AR
          `)
          .join('DB_ITEM_MASTER AS im', 'kds.ITEM_CODE', 'im.ITEM_CODE')
          .join('DB_POS_DEPARTMENTS AS dept', 'kds.DEP_CODE', 'dept.DEPT_CODE', 'left') // Updated to DEPT_CODE
          .where('kds.FINISHED', 'IS', null)
          .whereIn('kds.CAT_CODE', kdsCatCodes)
          .order('kds.ORDER_TIME', { ascending: true })
          .get();

        if (!ordersData?.length) {
          console.debug('No orders found for the provided category codes:', kdsCatCodes);
          return {};
        }

        const flatGroupedOrders = new Map<number, KitchenOrder[]>();
        for (const row of ordersData) {
          const order = mapDbRowToKitchenOrder(row);
          if (order.order_no == null) {
            console.warn('Skipping order with null order_no:', row);
            continue;
          }
          
          if (!flatGroupedOrders.has(order.order_no)) {
            flatGroupedOrders.set(order.order_no, []);
          }
          flatGroupedOrders.get(order.order_no)!.push(order);
        }

        const groupedOrders: Record<number, GroupedKitchenOrder[]> = {};
        for (const [orderNo, items] of flatGroupedOrders.entries()) {
          const grouped: GroupedKitchenOrder[] = [];
          let current: GroupedKitchenOrder | null = null;

          for (const item of items) {
            const type = (item.item_type || '').toUpperCase();

            if (type === 'I') {
              if (current) {
                grouped.push(current);
              }
              current = { main: item, modifiers: [] };
            } else if (type === 'M' && current) {
              current.modifiers.push(item);
            } else {
              console.warn(`Unknown item_type '${type}' for item:`, item);
              if (current) {
                grouped.push(current);
              }
              current = { main: item, modifiers: [] };
            }
          }

          if (current) {
            grouped.push(current);
          }

          if (grouped.length > 0) {
            groupedOrders[orderNo] = grouped;
          }
        }

        console.debug('Grouped orders:', groupedOrders);
        return groupedOrders;
      } catch (error) {
        console.error('Error fetching kitchen orders:', error);
        throw error;
      }
    },
    enabled: kdsCatCodes.length > 0,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
};

export const useFinishOrder = (currentUser: string = 'system') => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: async (order_no) => {
      const { error } = await mssqlClient.query(`
UPDATE DB_POS_ORDER_KDS
SET 
  FINISH_TIME = GETDATE(),
  TIME_TO_FINISH = DATEDIFF(MINUTE, ORDER_TIME, GETDATE()),
  FINISH_BY = '${currentUser}',
  FINISHED = 1
WHERE MAIN_ORDER_NO = ${order_no};

UPDATE DB_POS_ORDER_KDS
SET 
  LATE = CASE
    WHEN COALESCE((
      SELECT TIME_TO_FINISH 
      FROM DB_ITEM_MASTER 
      WHERE ITEM_CODE = DB_POS_ORDER_KDS.ITEM_CODE
        AND DB_POS_ORDER_KDS.MAIN_ORDER_NO = ${order_no}
    ), 0) - COALESCE(DB_POS_ORDER_KDS.TIME_TO_FINISH, 0) > 0
    THEN 0 ELSE 1
  END
WHERE MAIN_ORDER_NO = ${order_no};
      `);

      if (error) {
        console.error(`Failed to finish order #${order_no}:`, error);
        throw new Error(`Failed to finish order: ${error.message}`);
      }
    },
    onSuccess: (_, order_no) => {
      console.debug(`Successfully finished order #${order_no}`);
      queryClient.invalidateQueries({ queryKey: ['kdsOrders'] });
    },
    onError: (error, order_no) => {
      console.error(`Error finishing order #${order_no}:`, error);
    },
  });
};