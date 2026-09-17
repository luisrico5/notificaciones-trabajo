package mdbshim.time;

import mdbshim.time.temporal.ChronoUnit;
import mdbshim.time.temporal.Temporal;
import mdbshim.time.temporal.TemporalUnit;

/** Fecha del calendario gregoriano proléptico. Implementación propia (días civiles desde 1970-01-01). */
public final class LocalDate implements Temporal, Comparable<LocalDate> {
  private final int year;
  private final int month;
  private final int day;

  private LocalDate(int y, int m, int d) { year = y; month = m; day = d; }

  static boolean isLeap(long y) { return ((y & 3) == 0) && ((y % 100) != 0 || (y % 400) == 0); }

  static int lengthOfMonth(long y, int m) {
    switch (m) {
      case 2: return isLeap(y) ? 29 : 28;
      case 4: case 6: case 9: case 11: return 30;
      default: return 31;
    }
  }

  public static LocalDate of(int year, int month, int day) {
    if (month < 1 || month > 12) throw new DateTimeException("Mes inválido: " + month);
    if (day < 1 || day > lengthOfMonth(year, month)) throw new DateTimeException("Día inválido: " + day);
    return new LocalDate(year, month, day);
  }

  /** Días desde 1970-01-01. */
  public long toEpochDay() {
    long y = year;
    long m = month;
    long d = day;
    if (m <= 2) y -= 1;
    long era = Math.floorDiv(y, 400L);
    long yoe = y - era * 400L;
    long mp = (m > 2) ? (m - 3) : (m + 9);
    long doy = (153L * mp + 2L) / 5L + d - 1L;
    long doe = yoe * 365L + yoe / 4L - yoe / 100L + doy;
    return era * 146097L + doe - 719468L;
  }

  public static LocalDate ofEpochDay(long epochDay) {
    long z = epochDay + 719468L;
    long era = Math.floorDiv(z, 146097L);
    long doe = z - era * 146097L;
    long yoe = (doe - doe / 1460L + doe / 36524L - doe / 146096L) / 365L;
    long y = yoe + era * 400L;
    long doy = doe - (365L * yoe + yoe / 4L - yoe / 100L);
    long mp = (5L * doy + 2L) / 153L;
    long d = doy - (153L * mp + 2L) / 5L + 1L;
    long m = (mp < 10) ? (mp + 3L) : (mp - 9L);
    if (m <= 2) y += 1;
    return new LocalDate((int) y, (int) m, (int) d);
  }

  public int getYear() { return year; }
  public int getMonthValue() { return month; }
  public int getDayOfMonth() { return day; }

  public LocalDateTime atTime(LocalTime time) { return LocalDateTime.of(this, time); }

  public long until(Temporal endExclusive, TemporalUnit unit) {
    LocalDate end;
    if (endExclusive instanceof LocalDate) end = (LocalDate) endExclusive;
    else if (endExclusive instanceof LocalDateTime) end = ((LocalDateTime) endExclusive).toLocalDate();
    else throw new DateTimeException("Tipo no soportado: " + endExclusive);
    if (unit != ChronoUnit.DAYS) throw new UnsupportedOperationException("mdbshim: LocalDate.until solo admite DAYS");
    return end.toEpochDay() - toEpochDay();
  }

  @Override public int compareTo(LocalDate o) { return Long.compare(toEpochDay(), o.toEpochDay()); }

  @Override public boolean equals(Object o) {
    if (!(o instanceof LocalDate)) return false;
    LocalDate x = (LocalDate) o;
    return x.year == year && x.month == month && x.day == day;
  }

  @Override public int hashCode() { return (year << 11) + (month << 6) + day; }

  @Override public String toString() {
    StringBuilder sb = new StringBuilder();
    int ay = Math.abs(year);
    if (year < 0) sb.append('-');
    if (ay < 10) sb.append("000"); else if (ay < 100) sb.append("00"); else if (ay < 1000) sb.append('0');
    sb.append(ay);
    sb.append(month < 10 ? "-0" : "-").append(month);
    sb.append(day < 10 ? "-0" : "-").append(day);
    return sb.toString();
  }
}
