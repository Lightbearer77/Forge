import { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Circle, Rect, Text as SvgText } from 'react-native-svg';
import { COLORS, FONTS } from '../lib/theme';
import { dailyCompletions } from '../lib/selectors';
import { fmtGreek } from '../lib/constants';

const DAYS = 28;
const PLOT_H = 110;
const PAD_TOP = 12;
const LABEL_H = 16;   // strip below the baseline holding per-day counts
const CHART_H = PAD_TOP + PLOT_H + LABEL_H;

// Soft-cap scale for the y-axis. A straightforward percentile does NOT
// work here: with a sparse active-day count (this corpus runs ~7 active
// days per 28-day window), nearest-rank p90 of [1,2,2,2,3,8,27] lands on
// index 6 — the max itself — so the "cap" caps nothing and the single
// backfill day still flattens every real day into the baseline.
//
// Instead: peel at most ONE value off the top, and only when it dwarfs
// the next-highest day (>3x, and >5 in absolute terms so ordinary daily
// variance is never touched). That day's bar is clamped to the top of the
// plot, but its true count is still printed beneath it like every other
// day, so nothing is hidden — the outlier just stops setting the scale.
// A second comparably-large day is treated as signal, not noise, and is
// never peeled: two big days is a pattern.
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
  // Real rendered width, measured. The chart deliberately does NOT use a
  // viewBox with preserveAspectRatio="none": that stretches the x-axis
  // independently of y, which would visibly distort the per-day count
  // glyphs. Measuring once and drawing in true pixels keeps text upright.
  const [width, setWidth] = useState(0);

  const { series, yMax, hasAny } = useMemo(() => {
    const series = dailyCompletions(tasks, today, DAYS);
    const nonZero = series.map(r => r.count).filter(c => c > 0);
    const rawMax = Math.max(1, ...series.map(r => r.count));
    return {
      series,
      yMax: softCap ? softCapMax(nonZero) : rawMax,
      hasAny: nonZero.length > 0,
    };
  }, [tasks, today, softCap]);

  const lastIdx = series.length - 1;
  const slot = width / DAYS;
  const barW = Math.max(2, slot * 0.55);
  const xFor = (i) => slot * i + slot / 2;   // centre of each day's slot
  const baselineY = PAD_TOP + PLOT_H;
  const yFor = (count) => baselineY - (Math.min(count, yMax) / yMax) * PLOT_H;

  const linePath = series
    .map((r, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(2)} ${yFor(r.count).toFixed(2)}`)
    .join(' ');
  const areaPath = `${linePath} L ${xFor(lastIdx).toFixed(2)} ${baselineY.toFixed(2)} `
    + `L ${xFor(0).toFixed(2)} ${baselineY.toFixed(2)} Z`;

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>OUTPUT · LAST {DAYS} DAYS</Text>

      <View style={styles.card} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={width} height={CHART_H}>
            <Line
              x1={0} y1={baselineY} x2={width} y2={baselineY}
              stroke={COLORS.borderSubtle} strokeWidth={1}
            />

            {hasAny && (
              <>
                {/* Bars sit behind the line so the trend still reads on top. */}
                {series.map((r, i) => (
                  r.count > 0 ? (
                    <Rect
                      key={`bar-${r.iso}`}
                      x={xFor(i) - barW / 2}
                      y={yFor(r.count)}
                      width={barW}
                      height={Math.max(1, baselineY - yFor(r.count))}
                      fill={COLORS.accent}
                      fillOpacity={0.32}
                      rx={1}
                    />
                  ) : null
                ))}

                <Path d={areaPath} fill={COLORS.accent} fillOpacity={0.12} />
                <Path d={linePath} stroke={COLORS.accent} strokeWidth={2} fill="none" />
                <Circle cx={xFor(lastIdx)} cy={yFor(series[lastIdx].count)} r={3} fill={COLORS.accent} />

                {/* Per-day counts. Zero days are left blank rather than
                    printing 21 zeroes across a phone-width axis — the gap
                    already reads as nothing happened, and the noise would
                    bury the days that did. */}
                {series.map((r, i) => (
                  r.count > 0 ? (
                    <SvgText
                      key={`n-${r.iso}`}
                      x={xFor(i)}
                      y={baselineY + 11}
                      fontSize={7}
                      fill={COLORS.textMuted}
                      textAnchor="middle"
                    >
                      {String(r.count)}
                    </SvgText>
                  ) : null
                ))}
              </>
            )}
          </Svg>
        )}

        {!hasAny && width > 0 && (
          <Text style={styles.emptyText}>No completions logged in this window.</Text>
        )}

        {hasAny && (
          <View style={styles.xLabels}>
            <Text style={styles.xLabel}>{fmtGreek(series[0].iso)}</Text>
            <Text style={styles.xLabel}>{fmtGreek(series[Math.floor(lastIdx / 2)].iso)}</Text>
            <Text style={styles.xLabel}>{fmtGreek(series[lastIdx].iso)}</Text>
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
    textAlign: 'center', marginTop: -CHART_H / 2 - 4, marginBottom: CHART_H / 2 + 4,
    fontSize: 11, fontFamily: FONTS.mono, color: COLORS.textFaint,
  },
  xLabels: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 4, paddingHorizontal: 2,
  },
  xLabel: { fontSize: 8, fontFamily: FONTS.mono, color: COLORS.textFaint },
});
