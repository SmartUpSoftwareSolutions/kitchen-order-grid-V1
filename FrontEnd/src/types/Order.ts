
export interface OrderItem {
  name: string;
  quantity: number;
  comments?: string;
}

export interface Order {
  id: string;
  items: OrderItem[];
  comments?: string;
  createdAt: string;
  elapsedTime: number;
}
