// Activity log
export interface ActivityLog {
  userId: string;
  userName: string;
  action: string;
  details: Record<string, any>;
  timestamp: Date;
  component: string;
}