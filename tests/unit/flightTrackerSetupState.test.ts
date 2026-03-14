import { describe, expect, it } from 'vitest';

import {
  readFlightTrackerSetupProbe,
  resolveFlightTrackerSetupState,
} from '@/components/widgets/FlightTrackerWidget/setup';

describe('resolveFlightTrackerSetupState', () => {
  it('marks the proxy as configured when it only needs a flight number', () => {
    expect(
      resolveFlightTrackerSetupState({
        status: 400,
        error: 'Flight number is required',
      })
    ).toBe('configured');
  });

  it('marks the proxy as unconfigured when the API key is missing', () => {
    expect(
      resolveFlightTrackerSetupState({
        status: 500,
        error: 'Failed to fetch flight data',
        message: 'API key not configured',
      })
    ).toBe('unconfigured');
  });

  it('marks the proxy as unconfigured when the route is missing', () => {
    expect(
      resolveFlightTrackerSetupState({
        status: 404,
        message: 'Not Found',
      })
    ).toBe('unconfigured');
  });

  it('marks unexpected proxy responses as generic setup errors', () => {
    expect(
      resolveFlightTrackerSetupState({
        status: 503,
        error: 'Service unavailable',
      })
    ).toBe('error');
  });
});

describe('readFlightTrackerSetupProbe', () => {
  it('ignores JSON arrays when parsing probe responses', async () => {
    const response = new Response(JSON.stringify(['unexpected']), {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    await expect(readFlightTrackerSetupProbe(response)).resolves.toEqual({});
  });
});
