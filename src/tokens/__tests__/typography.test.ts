import { textStyle } from '../typography';

describe('semantic text roles', () => {
  it('sectionHeader: 12px uppercase bold', () => {
    expect(textStyle.sectionHeader.fontSize).toBe(12);
    expect(textStyle.sectionHeader.textTransform).toBe('uppercase');
    expect(textStyle.sectionHeader.fontWeight).toBe('700');
  });
  it('fieldLabel: 11px uppercase', () => {
    expect(textStyle.fieldLabel.fontSize).toBe(11);
    expect(textStyle.fieldLabel.textTransform).toBe('uppercase');
  });
});
