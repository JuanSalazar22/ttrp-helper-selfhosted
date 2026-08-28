import { useWindowDimensions } from 'react-native';

/**
 * True when the screen is in landscape and roomy enough for a two-column sheet.
 * Drives the desktop/tablet-landscape layout; portrait stays single-column.
 */
export function useWideLayout() {
  const { width, height } = useWindowDimensions();
  const wide = width > height && width >= 500;
  return { wide, width, height };
}
