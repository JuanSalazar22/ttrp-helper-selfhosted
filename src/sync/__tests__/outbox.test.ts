import { enqueue, size, dequeueAll } from '../outbox';

beforeEach(() => dequeueAll()); // start each test with an empty queue

describe('outbox', () => {
  it('enqueue dedupes by id', () => {
    enqueue('a');
    enqueue('a');
    enqueue('b');
    expect(size()).toBe(2);
  });
  it('dequeueAll drains the queue', () => {
    enqueue('a');
    enqueue('b');
    expect(dequeueAll().sort()).toEqual(['a', 'b']);
    expect(size()).toBe(0);
    expect(dequeueAll()).toEqual([]);
  });
});
