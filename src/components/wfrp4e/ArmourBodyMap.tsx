import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { ARMOUR_BODY_VIEWBOX, ARMOUR_BODY_REGIONS } from '@/data/wfrp-content/armourBodyPaths';
import { apLevel, GLOW_ALPHA } from './armourGlow';
import type { Wfrp4eCharacter, ArmourLocation } from '@/types/wfrp4e';

type Props = { armourPoints: Wfrp4eCharacter['armourPoints'] };

// The <Svg> below is rendered at a fixed height (SVG_DISPLAY_HEIGHT) that's smaller
// than the viewBox height, so every user unit (including font-size) gets scaled down
// by SVG_DISPLAY_HEIGHT / viewBoxHeight when actually painted on screen. Solve that
// back out so the AP numbers render at a legible ~12px regardless of viewBox size.
const SVG_DISPLAY_HEIGHT = 220;
const TARGET_LABEL_PX = 12;

// Roughly where each region's label reads best, as a fraction of the viewBox
// (0,0 = top-left, 1,1 = bottom-right) — tuned once against the actual geometry,
// not derived from it, since label placement is a readability choice independent
// of the exact path shapes.
const LABEL_POSITION: Record<Exclude<ArmourLocation, 'shield'>, { x: number; y: number }> = {
  head: { x: 0.5, y: 0.1 },
  body: { x: 0.5, y: 0.38 },
  leftArm: { x: 0.82, y: 0.45 },
  rightArm: { x: 0.18, y: 0.45 },
  leftLeg: { x: 0.59, y: 0.75 },
  rightLeg: { x: 0.41, y: 0.75 },
};

export function ArmourBodyMap({ armourPoints }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const [minX, minY, w, h] = ARMOUR_BODY_VIEWBOX.split(/\s+/).map(Number);

  const locations = Object.keys(ARMOUR_BODY_REGIONS) as Exclude<ArmourLocation, 'shield'>[];
  const labelFontSize = (TARGET_LABEL_PX * h) / SVG_DISPLAY_HEIGHT;

  return (
    <View style={styles.wrap}>
      <Svg viewBox={ARMOUR_BODY_VIEWBOX} width="100%" height={SVG_DISPLAY_HEIGHT}>
        {locations.map((loc) => {
          const level = apLevel(armourPoints[loc]);
          const fill = level === 0 ? t.colors.border : t.colors.accent + GLOW_ALPHA[level];
          return ARMOUR_BODY_REGIONS[loc].map((d, i) => (
            <Path key={`${loc}-${i}`} d={d} fill={fill} stroke={t.colors.border} strokeWidth={1} />
          ));
        })}
        {locations.map((loc) => {
          const pos = LABEL_POSITION[loc];
          return (
            <SvgText
              key={`${loc}-label`}
              x={minX + pos.x * w}
              y={minY + pos.y * h}
              fontSize={labelFontSize}
              fill={t.colors.text}
              textAnchor="middle"
              fontWeight="bold"
            >
              {armourPoints[loc]}
            </SvgText>
          );
        })}
      </Svg>
      <View style={[styles.shieldBadge, { borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}>
        <Text style={[styles.shieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.combat.loc.shield')}</Text>
        <Text style={[styles.shieldValue, { color: t.colors.text }]}>{armourPoints.shield}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: 12 },
  shieldBadge: {
    position: 'absolute', top: 4, right: 4,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  shieldLabel: { fontSize: 11, fontWeight: '600' },
  shieldValue: { fontSize: 13, fontWeight: '700' },
});
