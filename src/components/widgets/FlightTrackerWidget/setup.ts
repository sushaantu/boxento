export type FlightTrackerSetupState =
  | 'checking'
  | 'configured'
  | 'unconfigured'
  | 'error';

type FlightTrackerSetupProbe = {
  status: number;
  error?: string | null;
  message?: string | null;
};

const CONFIGURED_RESPONSE = 'flight number is required';
const UNCONFIGURED_RESPONSE = 'api key not configured';

export function resolveFlightTrackerSetupState({
  status,
  error,
  message,
}: FlightTrackerSetupProbe): Exclude<FlightTrackerSetupState, 'checking'> {
  const combinedMessage = [error, message]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (status === 400 && combinedMessage.includes(CONFIGURED_RESPONSE)) {
    return 'configured';
  }

  if (status === 404 || combinedMessage.includes(UNCONFIGURED_RESPONSE)) {
    return 'unconfigured';
  }

  return 'error';
}

export async function readFlightTrackerSetupProbe(
  response: Pick<Response, 'headers' | 'json' | 'text'>
): Promise<{ error?: string; message?: string }> {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      const payload = await response.json();
      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        return payload as { error?: string; message?: string };
      }
    } catch {
      return {};
    }
  }

  try {
    const text = await response.text();
    return text ? { message: text } : {};
  } catch {
    return {};
  }
}
