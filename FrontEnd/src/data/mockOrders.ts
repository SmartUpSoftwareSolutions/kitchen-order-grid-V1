
import { Order } from '../types/Order';

export const mockOrders: Order[] = [
  {
    id: 'order_001',
    items: [
      { name: 'Grilled Chicken Breast', quantity: 2, comments: 'No seasoning, well done' },
      { name: 'Caesar Salad', quantity: 1, comments: 'Dressing on the side' }
    ],
    comments: 'Customer has nut allergy',
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    elapsedTime: 300
  },
  {
    id: 'order_002',
    items: [
      { name: 'Margherita Pizza', quantity: 1 },
      { name: 'Garlic Bread', quantity: 2, comments: 'Extra garlic' }
    ],
    createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    elapsedTime: 480
  },
  {
    id: 'order_003',
    items: [
      { name: 'Fish and Chips', quantity: 1, comments: 'Light batter' },
      { name: 'Mushy Peas', quantity: 1 }
    ],
    comments: 'Table 7 - Anniversary dinner',
    createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    elapsedTime: 720
  },
  {
    id: 'order_004',
    items: [
      { name: 'Beef Burger', quantity: 1, comments: 'Medium rare, no onions' },
      { name: 'Sweet Potato Fries', quantity: 1 }
    ],
    createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    elapsedTime: 180
  },
  {
    id: 'order_005',
    items: [
      { name: 'Vegetable Stir Fry', quantity: 1, comments: 'Extra spicy' },
      { name: 'Jasmine Rice', quantity: 2 }
    ],
    comments: 'Vegan customer',
    createdAt: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
    elapsedTime: 960
  },
  {
    id: 'order_006',
    items: [
      { name: 'Spaghetti Carbonara', quantity: 1 },
      { name: 'Bruschetta', quantity: 1, comments: 'No tomatoes' }
    ],
    createdAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
    elapsedTime: 420
  }
];
