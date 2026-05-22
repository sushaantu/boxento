import { parseJsonResponseText } from '@/lib/jsonResponseGuard';

const getPayloadMessage = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') return null;

  const record = payload as Record<string, unknown>;
  const error = record.error;
  const message = record.message;

  if (typeof error === 'string' && error.trim()) return error;
  if (typeof message === 'string' && message.trim()) return message;

  return null;
};

export const readMonitoringJson = async <T>(
  response: Response,
  serviceName: string,
): Promise<T> => {
  const body = await response.text();
  const payload = parseJsonResponseText<unknown>(body, response, `${serviceName} endpoint`);

  if (!response.ok) {
    throw new Error(getPayloadMessage(payload) || `HTTP ${response.status}`);
  }

  return payload as T;
};
