// types/KitchenOrder.ts
export interface KitchenOrder {
  id: number; // This will map to AUTO_NO from the DB
  company?: string;
  branch?: string;
  pos_txn_ref?: string;
  rcpt_ref?: number;
  dep_code?: string;
  orig_terminal_send?: string;
  agent_id?: number;
  agent_name?: string;
  table_id?: number;
  table_description?: string;
  cat_code?: string;
  order_no: number;
  line_no?: number;
  open_day_code?: string;
  shift_id?: string;
  item_code?: string;
  item_name?: string;
  item_engname?: string;
  qty?: number;
 order_time?: string | Date;
   time_to_finish:Number;
  finish_time?: string;
  send_by?: string;
  send_datetime?: string;
  finish_by?: string;
  order_comments?: string;
  order_instr?: string;
  main_line_no?: number;
  item_type?: string;
  bom_code?: string;
  finished?: boolean;
  kitchen_order?: number; // This might be a boolean or number depending on DB
  time_for_preparation?: number;
  expected_time_to_finish?: string;
  received_time?: string;
  run_key?: string;
  auto_no?: number; // Redundant if 'id' is also auto_no, consider merging
  delivery_timestamp?: string;
  created_at?: string;
  updated_at?: string;
}

// Ensure your mapDbRowToKitchenOrder matches this
const mapDbRowToKitchenOrder = (row: any): KitchenOrder => ({
  id: row.AUTO_NO, // Maps to AUTO_NO
  company: row.COMPANY,
  branch: row.BRANCH,
  pos_txn_ref: row.POS_TXN_REF,
  rcpt_ref: row.RCPT_REF,
  dep_code: row.DEP_CODE,
  orig_terminal_send: row.ORIG_TERMINAL_SEND,
  agent_id: row.AGENT_ID,
  agent_name: row.AGENT_NAME,
  table_id: row.TABLE_ID,
  table_description: row.TABLE_DESCRIPTION,
  cat_code: row.CAT_CODE,
  order_no: row.ORDER_NO,
  line_no: row.LINE_NO,
  open_day_code: row.OPEN_DAY_CODE,
  shift_id: row.SHIFT_ID,
  item_code: row.ITEM_CODE,
  item_name: row.ITEM_NAME,
  qty: row.QTY,
  order_time: row.ORDER_TIME, 
  time_to_finish:row.TIME_TO_FINISH,
  finish_time: row.FINISH_TIME,
  send_by: row.SEND_BY,
  send_datetime: row.SEND_DATETIME,
  finish_by: row.FINISH_BY,
  order_comments: row.ORDER_COMMENTS,
  order_instr: row.ORDER_INSTR,
  main_line_no: row.MAIN_LINE_NO,
  item_type: row.ITEM_TYPE,
  bom_code: row.BOM_CODE,
  finished: row.FINISHED,
  kitchen_order: row.KITCHEN_ORDER,
  time_for_preparation: row.TIME_FOR_PREPARATION,
  expected_time_to_finish: row.EXPECTED_TIME_TO_FINISH,
  received_time: row.RECEIVED_TIME,
  run_key: row.RUN_KEY,
  auto_no: row.AUTO_NO, // Redundant with 'id', but keeping for direct mapping
  delivery_timestamp: row.DELIVERY_TIMESTAMP,
  created_at: row.CREATED_AT,
  updated_at: row.UPDATED_AT,
});