import { mssqlClient } from '../lib/mssql-client';
import { ActivityLog } from '@/types/ActivityLog';

export const logActivity = async (
  userId: string,
  userName: string,
  action: string,
  details: Record<string, any>,
  component: string
): Promise<void> => {
  try {
    if (!mssqlClient) {
      console.warn('MSSQL client not available for logging');
      fallbackLog({ userId, userName, action, details, component });
      return;
    }

    await mssqlClient.from('USER_ACTIVITY_LOGS').insert([{
      USER_ID: userId,
      USER_NAME: userName,
      ACTION: action,
      DETAILS: JSON.stringify(details),
      TIMESTAMP: new Date().toISOString(),
      COMPONENT: component
    }]);
  } catch (error) {
    console.error('Failed to log activity to database:', error);
    fallbackLog({ userId, userName, action, details, component });
  }
};

const fallbackLog = (logData: Omit<ActivityLog, 'timestamp'>) => {
  try {
    const timestamp = new Date();
    const logs = JSON.parse(localStorage.getItem('activityLogs') || '[]');
    logs.push({ ...logData, timestamp });
    localStorage.setItem('activityLogs', JSON.stringify(logs));
  } catch (error) {
    console.error('Failed to fallback log to localStorage:', error);
  }
};

export const getCurrentUser = () => {
  if (typeof window !== 'undefined') {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
  }
  return null;
};

export const setCurrentUser = (user: { id: string; name: string } | null) => {
  if (typeof window !== 'undefined') {
    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
    } else {
      localStorage.removeItem('currentUser');
    }
  }
};

export const syncLocalLogs = async () => {
  try {
    const logs = JSON.parse(localStorage.getItem('activityLogs') || '[]');
    if (logs.length === 0 || !mssqlClient) return;

    const logsToSync = logs.map((log: ActivityLog) => ({
      USER_ID: log.userId,
      USER_NAME: log.userName,
      ACTION: log.action,
      DETAILS: JSON.stringify(log.details),
      TIMESTAMP: log.timestamp.toISOString(),
      COMPONENT: log.component
    }));

    await mssqlClient.from('USER_ACTIVITY_LOGS').insert(logsToSync);
    localStorage.removeItem('activityLogs');
  } catch (error) {
    console.error('Failed to sync local logs:', error);
  }
};

// Periodically attempt to sync local logs
if (typeof window !== 'undefined') {
  setInterval(syncLocalLogs, 5 * 60 * 1000); // Every 5 minutes
  window.addEventListener('online', syncLocalLogs);
}