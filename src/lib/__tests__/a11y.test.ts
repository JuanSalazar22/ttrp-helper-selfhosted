import { Platform } from 'react-native';
import { hoverTitle } from '../a11y';

describe('hoverTitle', () => {
  afterEach(() => {
    Platform.OS = 'ios';
  });

  it('returns a title prop on web', () => {
    Platform.OS = 'web';
    expect(hoverTitle('Remove Dagger')).toEqual({ title: 'Remove Dagger' });
  });

  it('returns nothing on native platforms', () => {
    Platform.OS = 'ios';
    expect(hoverTitle('Remove Dagger')).toEqual({});
    Platform.OS = 'android';
    expect(hoverTitle('Remove Dagger')).toEqual({});
  });
});
