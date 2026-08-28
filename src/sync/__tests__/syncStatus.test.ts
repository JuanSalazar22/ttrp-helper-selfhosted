import { nextStatus } from '../syncStatus';

describe('nextStatus', () => {
  it('is offline when not online (overrides everything)', () => {
    expect(nextStatus({ online: false, inFlight: 3, queueSize: 2 })).toBe('offline');
  });
  it('is syncing when online with in-flight pushes', () => {
    expect(nextStatus({ online: true, inFlight: 1, queueSize: 5 })).toBe('syncing');
  });
  it('is error when online, idle, but pushes are queued', () => {
    expect(nextStatus({ online: true, inFlight: 0, queueSize: 1 })).toBe('error');
  });
  it('is idle when online, nothing in flight, nothing queued', () => {
    expect(nextStatus({ online: true, inFlight: 0, queueSize: 0 })).toBe('idle');
  });
});
