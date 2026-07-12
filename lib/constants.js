// ─── Greek Calendar Constants & Logic ───
// Perpetual mapping: every Greek date maps to the SAME Gregorian date every
// year (see GreekCalendar_Reference). Ruling 2026-07-07 (Connor): Planning Day
// is Dec 31 only, in all years. Consequence: Feb 29 in leap years is absorbed
// into Gamma as a doubled Gamma 3 (flagged `isLeapEcho`), so Nu always ends
// Dec 30 and the month table below is true in every year.

export const GREEK_MONTHS = [
  { id: "M01", name: "Alpha",   letter: "Α", start: "01-01", end: "01-28" },
  { id: "M02", name: "Beta",    letter: "Β", start: "01-29", end: "02-25" },
  { id: "M03", name: "Gamma",   letter: "Γ", start: "02-26", end: "03-25" },
  { id: "M04", name: "Delta",   letter: "Δ", start: "03-26", end: "04-22" },
  { id: "M05", name: "Epsilon", letter: "Ε", start: "04-23", end: "05-20" },
  { id: "M06", name: "Zeta",    letter: "Ζ", start: "05-21", end: "06-17" },
  { id: "M07", name: "Eta",     letter: "Η", start: "06-18", end: "07-15" },
  { id: "M08", name: "Theta",   letter: "Θ", start: "07-16", end: "08-12" },
  { id: "M09", name: "Iota",    letter: "Ι", start: "08-13", end: "09-09" },
  { id: "M10", name: "Kappa",   letter: "Κ", start: "09-10", end: "10-07" },
  { id: "M11", name: "Lambda",  letter: "Λ", start: "10-08", end: "11-04" },
  { id: "M12", name: "Mu",      letter: "Μ", start: "11-05", end: "12-02" },
  { id: "M13", name: "Nu",      letter: "Ν", start: "12-03", end: "12-30" },
];

export const SEASONAL_THEMES = {
  M01: { theme: "Hearth",        meaning: "Deepest dark · endurance",    color: "#4a5468" },
  M02: { theme: "Stirring",      meaning: "First return of light",       color: "#5a6878" },
  M03: { theme: "Thaw",          meaning: "Ground softens",              color: "#6a6258" },
  M04: { theme: "Sowing",        meaning: "First ground worked",         color: "#8a7848" },
  M05: { theme: "Greening",      meaning: "Life surges",                 color: "#6a8a48" },
  M06: { theme: "Rising",        meaning: "Momentum builds",             color: "#5a8848" },
  M07: { theme: "Sun's Peak",    meaning: "Full power",                  color: "#c9a84c" },
  M08: { theme: "First Fruit",   meaning: "Early harvest",               color: "#b89148" },
  M09: { theme: "Reaping",       meaning: "Main grain harvest",          color: "#b87848" },
  M10: { theme: "Gathering",     meaning: "Bringing in",                 color: "#a85838" },
  M11: { theme: "Winter Nights", meaning: "Ancestors · threshold",       color: "#8a3838" },
  M12: { theme: "Descent",       meaning: "Inward turn",                 color: "#58385a" },
  M13: { theme: "Yule",          meaning: "Sacred dark · reflection",    color: "#3848a8" },
  PLANNING: { theme: "Threshold", meaning: "Year-turn · ✦ Planning",     color: "#c9a84c" },
};

// ─── Year / day-of-year helpers ───
export const isLeapYear = (y) =>
  (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

const dayOfYear = (date) => {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date - start;
  return Math.floor(diff / 86400000) + 1;
};

// Effective day-of-year for the perpetual mapping: in leap years Feb 29
// (raw doy 60) collapses onto Feb 28's slot, so every date from Mar 1 on
// keeps the same Greek date it has in a common year.
const effectiveDayOfYear = (date) => {
  const doy = dayOfYear(date);
  if (isLeapYear(date.getFullYear()) && doy > 59) return doy - 1;
  return doy;
};

export const gregToGreek = (input) => {
  if (!input) return null;
  let date;
  if (typeof input === "string") {
    date = new Date(input + "T12:00:00");
  } else {
    // Normalize Date inputs to local noon so DST transitions can never
    // shift the day-of-year computation.
    date = new Date(input.getFullYear(), input.getMonth(), input.getDate(), 12);
  }
  if (isNaN(date.getTime())) return null;
  const year = date.getFullYear();

  // Planning Day: Dec 31, every year, only.
  if (date.getMonth() === 11 && date.getDate() === 31) {
    return {
      isPlanningDay: true,
      planningDayNumber: 1,
      year,
      monthId: "PLANNING",
      letter: "✦",
      monthName: "Planning Day",
      day: 1,
    };
  }

  const eff = effectiveDayOfYear(date); // 1..364
  const monthIndex = Math.floor((eff - 1) / 28);
  const day = ((eff - 1) % 28) + 1;
  const m = GREEK_MONTHS[monthIndex];
  const isLeapEcho =
    isLeapYear(year) && date.getMonth() === 1 && date.getDate() === 29;
  return {
    monthId: m.id,
    letter: m.letter,
    monthName: m.name,
    day,
    isPlanningDay: false,
    year,
    // Feb 29 shares Gamma 3 with Feb 28; flag it for any UI that wants
    // to render the doubled day distinctly.
    isLeapEcho,
  };
};

export const greekToGreg = (greek) => {
  if (!greek) return null;
  const y = greek.year || new Date().getFullYear();
  if (greek.isPlanningDay || greek.monthId === "PLANNING") {
    return `${y}-12-31`;
  }
  const monthIndex = GREEK_MONTHS.findIndex(m => m.id === greek.monthId);
  if (monthIndex < 0) return null;
  const day = Math.min(28, Math.max(1, greek.day || 1));
  const eff = monthIndex * 28 + day;
  // Invert the Feb 29 collapse: from Gamma 4 (eff 60) onward, leap years
  // sit one raw day later. Gamma 3 canonically maps back to Feb 28.
  const doy = isLeapYear(y) && eff >= 60 ? eff + 1 : eff;
  const date = new Date(y, 0, doy);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export const fmtGreek = (dateStr) => {
  const g = gregToGreek(dateStr);
  if (!g) return "";
  if (g.isPlanningDay) return "✦";
  return `${g.letter}${g.day}`;
};

export const fmtGreekLong = (dateStr) => {
  const g = gregToGreek(dateStr);
  if (!g) return "";
  if (g.isPlanningDay) return "Planning Day";
  return `${g.monthName} ${g.day}`;
};

export const fmtGreg = (isoDate) => isoDate
  ? new Date(isoDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
  : "";

export const fmtGregLong = (isoDate) => isoDate
  ? new Date(isoDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
  : "";

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const greekMonthRange = (monthId, year) => {
  if (monthId === "PLANNING") {
    return { start: `${year}-12-31`, end: `${year}-12-31` };
  }
  return {
    start: greekToGreg({ monthId, day: 1, year }),
    end: greekToGreg({ monthId, day: 28, year }),
  };
};

export const greekMonthDays = (monthId, year) => {
  if (monthId === "PLANNING") {
    return [`${year}-12-31`];
  }
  const days = [];
  for (let d = 1; d <= 28; d++) {
    days.push(greekToGreg({ monthId, day: d, year }));
  }
  return days;
};

export const nextGreekMonth = (monthId, year) => {
  if (monthId === "PLANNING") return { monthId: "M01", year: year + 1 };
  if (monthId === "M13") return { monthId: "PLANNING", year };
  const idx = GREEK_MONTHS.findIndex(m => m.id === monthId);
  return { monthId: GREEK_MONTHS[idx + 1].id, year };
};

export const prevGreekMonth = (monthId, year) => {
  if (monthId === "PLANNING") return { monthId: "M13", year };
  if (monthId === "M01") return { monthId: "PLANNING", year: year - 1 };
  const idx = GREEK_MONTHS.findIndex(m => m.id === monthId);
  return { monthId: GREEK_MONTHS[idx - 1].id, year };
};

export const dayOfWeek = (isoDate) => {
  const d = new Date(isoDate + "T12:00:00");
  return d.getDay();
};
