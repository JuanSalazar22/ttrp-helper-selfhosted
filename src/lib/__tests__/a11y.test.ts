import { Platform } from 'react-native';
import { hoverTitle } from '../a11y';

describe('hoverTitle', () => {
  afterEach(() => {
    Platform.OS = 'ios';
  });

  it('sets a title attribute on the DOM node via ref on web', () => {
    Platform.OS = 'web';
    const node = { setAttribute: jest.fn() };
    const { ref } = hoverTitle('Remove Dagger');
    ref?.(node);
    expect(node.setAttribute).toHaveBeenCalledWith('title', 'Remove Dagger');
  });

  it('does nothing when the ref callback receives no node', () => {
    Platform.OS = 'web';
    const { ref } = hoverTitle('Remove Dagger');
    expect(() => ref?.(null)).not.toThrow();
  });

  it('returns nothing on native platforms', () => {
    Platform.OS = 'ios';
    expect(hoverTitle('Remove Dagger')).toEqual({});
    Platform.OS = 'android';
    expect(hoverTitle('Remove Dagger')).toEqual({});
  });
});
