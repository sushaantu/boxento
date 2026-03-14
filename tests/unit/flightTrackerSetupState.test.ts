import { describe, expect, it } from 'vitest';

import { resolveFlightTrackerSetupState } from '@/components/widgets/FlightTrackerWidget/setup';

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
});
