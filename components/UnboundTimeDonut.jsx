import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { COLORS, FONTS } from '../lib/theme';
import { unboundTimeWeek, recentWeeksUnbound } from '../lib/selectors';

const SIZE = 140;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Ring geometry: the progress Circle is drawn from angle 0 (3 o'clock) and
// rotated -90deg so it starts at 12 and sweeps clockwise as strokeDashoffset
// shrinks. Under the output model the whole ring IS the target, so there is
// no interior threshold tick to draw — a full ring means target met.

// Caption strings for the OUTPUT model (Option B). CANDIDATE TEXT —
// Connor should ratify or rewrite these, not treat them as finished copy.
// Note what these deliberately never do: frame a shortfall as failure.
// Unbound Time's base is unconditional; this ring tracks only the separate
// additive tier, so a miss is information, not a penalty.
function captionFor(stats) {
  if (stats.done === 0) {
    return { text: 'No High+Mid completions logged this week.', color: COLORS.textFaint };
  }
  if (stats.atThreshold) {
    return { text: 'Target met \u2014 counts toward the monthly tier.', color: COLORS.ok };
  }
  const remaining = stats.target - stats.done;
  return {
    text: `${remaining} more High+Mid to reach this week's target.`,
    color: COLORS.textMuted,
  };
}

export default function UnboundTimeDonut({ tasks, today }) {
  const stats = useMemo(() => unboundTimeWeek(tasks, today), [tasks, today]);
  // "Last 4 weeks" is a deliberate choice, not "this month" — Greek months
  // run 28 days Thu-Wed while ISO weeks are Mon-Sun, so a Greek month
  // straddles five partial ISO weeks and never contains a clean four. Which
  // four weeks count toward the monthly tier is Connor's call to make, not
  // a boundary to guess at here. Until he rules, this is an honest rolling
  // strip, not a monthly verdict — do not add a "N/4 toward monthly tier"
  // readout without that decision.
  const weeks = useMemo(() => recentWeeksUnbound(tasks, today, 4), [tasks, today]);

  const arcColor = stats.done === 0
    ? COLORS.bgElevated
    : (stats.atThreshold ? COLORS.ok : COLORS.accent);
  const offset = CIRCUMFERENCE - (stats.pct / 100) * CIRCUMFERENCE;
  const caption = captionFor(stats);

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>UNBOUND TIME · {stats.weekTag}</Text>

      <View style={styles.card}>
        <View style={styles.ringWrap}>
          <Svg width={SIZE} height={SIZE}>
            <Circle
              cx={CENTER} cy={CENTER} r={RADIUS}
              stroke={COLORS.bgElevated} strokeWidth={STROKE} fill="none"
            />
            {stats.done > 0 && (
              <Circle
                cx={CENTER} cy={CENTER} r={RADIUS}
                stroke={arcColor} strokeWidth={STROKE} fill="none"
                strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform={`rotate(-90 ${CENTER} ${CENTER})`}
              />
            )}
          </Svg>
          <View style={styles.ringCenter} pointerEvents="none">
            <Text style={styles.pct}>{stats.done}/{stats.target}</Text>
            <Text style={styles.frac}>HIGH+MID DONE</Text>
          </View>
        </View>

        <Text style={[styles.caption, { color: caption.color }]}>{caption.text}</Text>

        <Text style={styles.stripLabel}>LAST 4 WEEKS</Text>
        <View style={styles.strip}>
          {weeks.map((w) => (
            <View key={w.weekTag} style={styles.stripItem}>
              <View
                style={[styles.stripBar, {
                  backgroundColor: w.atThreshold ? COLORS.ok : COLORS.borderMid,
                }]}
              />
              <Text style={styles.stripTag}>{w.weekTag}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 0 },
  sectionTitle: {
    fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 2,
    color: COLORS.textFaint, marginTop: 20, marginBottom: 8,
  },
  card: {
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1, borderColor: COLORS.borderSubtle, borderRadius: 6,
    paddingVertical: 16, alignItems: 'center',
  },
  ringWrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  pct: { fontSize: 26, fontFamily: FONTS.display, color: COLORS.textPrimary },
  frac: {
    fontSize: 8, fontFamily: FONTS.mono, letterSpacing: 1.5,
    color: COLORS.textMuted, marginTop: 2,
  },
  caption: {
    fontSize: 10, fontFamily: FONTS.mono, textAlign: 'center',
    marginTop: 12, paddingHorizontal: 16, lineHeight: 15,
  },
  stripLabel: {
    fontSize: 8, fontFamily: FONTS.mono, letterSpacing: 1.5,
    color: COLORS.textFaint, marginTop: 16, marginBottom: 6,
  },
  strip: { flexDirection: 'row', gap: 14 },
  stripItem: { alignItems: 'center', gap: 4 },
  stripBar: { width: 22, height: 6, borderRadius: 3 },
  stripTag: { fontSize: 8, fontFamily: FONTS.mono, color: COLORS.textMuted },
});
