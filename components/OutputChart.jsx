import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { COLORS, FONTS } from '../lib/theme';
import { dailyCompletions } from '../lib/selectors';
import { fmtGreek } from '../lib/constants';

const DAYS = 28;
const VB_W = 300;
const VB_H = 130; // equals the Svg's real rendered height (see width="100%"
                   // below) so y-coordinates map 1:1 to dp and absolute
                   // Text labels can be positioned with plain pixel values.
const PAD_TOP = 18;    // room for hollow over-cap markers + their value label
const PAD_BOTTOM = 6;

// Soft-cap scale for the y-axis. A straightforward percentile does NOT
// work here: with a sparse active-day count (this corpus runs ~7 active
// days per 28-day window), nearest-rank p90 of [1,2,2,2,3,8,27] lands on
// index 6 — the max itself — so the "cap" caps nothing and the single
// backfill day still flattens every real day into the baseline.
//
// Instead: peel at most ONE value off the top, and only when it dwarfs
// the next-highest day (>3x, and >5 in absolute terms so ordinary daily
// variance is never touched). That single day renders as a hollow,
// labeled marker (see overCap below) instead of setting the scale.
// A second big day is treated as real signal, not noise, and is never
// peeled — two comparably-large days is a pattern, not a fluke.
//   [1,2,2,2,3,8,27]  -> peels 27, scales to 8  (real-data case)
//   [2,3,27,27]       -> no peel, scales to 27  (two big days = signal)
//   [3,4,5,6,7]        -> no peel, gentle spread untouched
const softCapMax = (nonZeroCounts) => {
  if (nonZeroCounts.length === 0) return 5;
  const sorted = [...nonZeroCounts].sort((a, b) => a - b);
  const top = sorted[sorted.length - 1];
  const rest = sorted.slice(0, -1);
  const nextMax = rest.length > 0 ? rest[rest.length - 1] : 0;
  const effectiveTop = (top > 5 && nextMax > 0 && top > nextMax * 3) ? nextMax : top;
  return Math.max(5, Math.ceil(effectiveTop * 1.25));
};

export default function OutputChart({ tasks, today, softCap = true }) {
  const { display, rollingMean, yMax, hasAny } = useMemo(() => {
    // Fetch 6 extra buffer days so every one of the DAYS displayed days gets
    // a genuine 7-day TRAILING mean (including days just before the visible
    // window), rather than a partial average that reads artificially low
    // near the left edge of the chart.
    const buffered = dailyCompletions(tasks, today, DAYS + 6);
    const display = buffered.slice(6);

    const rollingMean = display.map((_, i) => {
      const windowSlice = buffered.slice(i, i + 7);
      const sum = windowSlice.reduce((s, r) => s + r.count, 0);
      return sum / 7;
    });

    const nonZero = display.map(r => r.count).filter(c => c > 0);
    const rawMax = Math.max(1, ...display.map(r => r.count));
    const yMax = softCap ? softCapMax(nonZero) : rawMax;

    return { display, rollingMean, yMax, hasAny: nonZero.length > 0 };
  }, [tasks, today, softCap]);

  const lastIdx = display.length - 1;
  const xFor = (i) => (i / lastIdx) * VB_W;
  const yFor = (count) => {
    const clamped = Math.min(count, yMax);
    const usable = VB_H - PAD_TOP - PAD_BOTTOM;
    return PAD_TOP + usable - (clamped / yMax) * usable;
  };
  const baselineY = yFor(0);

  const linePath = display
    .map((r, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(2)} ${yFor(r.count).toFixed(2)}`)
    .join(' ');
  const areaPath = `${linePath} L ${xFor(lastIdx).toFixed(2)} ${baselineY.toFixed(2)} `
    + `L ${xFor(0).toFixed(2)} ${baselineY.toFixed(2)} Z`;
  const meanPath = rollingMean
    .map((m, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(2)} ${yFor(m).toFixed(2)}`)
    .join(' ');

  const overCap = display
    .map((r, i) => ({ ...r, i }))
    .filter(r => r.count > yMax);

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>OUTPUT · LAST {DAYS} DAYS</Text>

      <View style={styles.card}>
        {!hasAny ? (
          <View>
            <Svg width="100%" height={VB_H} viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none">
              <Line x1={0} y1={baselineY} x2={VB_W} y2={baselineY} stroke={COLORS.borderSubtle} strokeWidth={1} />
            </Svg>
            <Text style={styles.emptyText}>No completions logged in this window.</Text>
          </View>
        ) : (
          <View>
            <Svg width="100%" height={VB_H} viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none">
              <Line x1={0} y1={baselineY} x2={VB_W} y2={baselineY} stroke={COLORS.borderSubtle} strokeWidth={1} />
              <Path d={areaPath} fill={COLORS.accent} fillOpacity={0.18} />
              <Path d={linePath} stroke={COLORS.accent} strokeWidth={2} fill="none" />
              <Path d={meanPath} stroke={COLORS.textMuted} strokeWidth={1} strokeDasharray="3,3" fill="none" />
              {overCap.map(r => (
                <Circle
                  key={`cap-${r.i}`}
                  cx={xFor(r.i)} cy={yFor(r.count)} r={4}
                  stroke={COLORS.accent} strokeWidth={1.5} fill={COLORS.bgSurface}
                />
              ))}
              <Circle cx={xFor(lastIdx)} cy={yFor(display[lastIdx].count)} r={3} fill={COLORS.accent} />
            </Svg>

            {/* Value labels for clamped days — left is a % of chart width
                (the Svg stretches via width="100%"), top is a literal
                pixel offset (VB_H is chosen to equal the Svg's real
                rendered height, so viewBox y-units already equal dp). */}
            {overCap.map(r => (
              <Text
                key={`cap-label-${r.i}`}
                style={[styles.capLabel, {
                  left: `${(r.i / lastIdx) * 100}%`,
                  top: yFor(r.count) - 13,
                }]}
              >
                {r.count}
              </Text>
            ))}
          </View>
        )}

        {hasAny && (
          <View style={styles.xLabels}>
            <Text style={styles.xLabel}>{fmtGreek(display[0].iso)}</Text>
            <Text style={styles.xLabel}>{fmtGreek(display[Math.floor(lastIdx / 2)].iso)}</Text>
            <Text style={styles.xLabel}>{fmtGreek(display[lastIdx].iso)}</Text>
          </View>
        )}

        {hasAny && (
          <View style={styles.legendRow}>
            <Text style={[styles.legendItem, { color: COLORS.accent }]}>— daily</Text>
            <Text style={[styles.legendItem, { color: COLORS.textMuted }]}>┄ 7-day mean</Text>
          </View>
        )}
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
    paddingVertical: 12, paddingHorizontal: 10,
  },
  emptyText: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    textAlign: 'center', textAlignVertical: 'center',
    fontSize: 11, fontFamily: FONTS.mono, color: COLORS.textFaint,
  },
  capLabel: {
    position: 'absolute',
    fontSize: 8, fontFamily: FONTS.mono, color: COLORS.accent,
    transform: [{ translateX: -8 }],
  },
  xLabels: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 6, paddingHorizontal: 2,
  },
  xLabel: { fontSize: 8, fontFamily: FONTS.mono, color: COLORS.textFaint },
  legendRow: { flexDirection: 'row', gap: 16, marginTop: 8, justifyContent: 'center' },
  legendItem: { fontSize: 9, fontFamily: FONTS.mono, letterSpacing: 0.5 },
});
