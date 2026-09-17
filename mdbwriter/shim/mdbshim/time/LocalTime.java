package mdbshim.time;

import mdbshim.time.temporal.ChronoUnit;
import mdbshim.time.temporal.Temporal;
import mdbshim.time.temporal.TemporalUnit;

/** Hora del día con precisión de nanosegundos. */
public final class LocalTime implements Temporal, Comparable<LocalTime> {
  static final long NANOS_PER_SECOND = 1_000_000_000L;
  static final long NANOS_PER_DAY = 86_400L * NANOS_PER_SECOND;

  private final long nanoOfDay;

  private LocalTime(long nod) { nanoOfDay = nod; }

  public static LocalTime of(int hour, int minute) { return of(hour, minute, 0, 0); }

  public static LocalTime of(int hour, int minute, int second) { return of(hour, minute, second, 0); }

  public static LocalTime of(int hour, int minute, int second, int nano) {
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59
        || nano < 0 || nano > 999_999_999) {
      throw new DateTimeException("Hora inválida");
    }
    return new LocalTime(((hour * 60L + minute) * 60L + second) * NANOS_PER_SECOND + nano);
  }

  public static LocalTime ofNanoOfDay(long nod) {
    if (nod < 0 || nod >= NANOS_PER_DAY) throw new DateTimeException("nanoOfDay fuera de rango: " + nod);
    return new LocalTime(nod);
  }

  public long toNanoOfDay() { return nanoOfDay; }
  public int getHour() { return (int) (nanoOfDay / (3600L * NANOS_PER_SECOND)); }
  public int getMinute() { return (int) ((nanoOfDay / (60L * NANOS_PER_SECOND)) % 60L); }
  public int getSecond() { return (int) ((nanoOfDay / NANOS_PER_SECOND) % 60L); }
  public int getNano() { return (int) (nanoOfDay % NANOS_PER_SECOND); }

  public LocalDateTime atDate(LocalDate date) { return LocalDateTime.of(date, this); }

  public long until(Temporal endExclusive, TemporalUnit unit) {
    LocalTime end;
    if (endExclusive instanceof LocalTime) end = (LocalTime) endExclusive;
    else if (endExclusive instanceof LocalDateTime) end = ((LocalDateTime) endExclusive).toLocalTime();
    else throw new DateTimeException("Tipo no soportado: " + endExclusive);
    long nanos = end.nanoOfDay - nanoOfDay;
    ChronoUnit u = (ChronoUnit) unit;
    switch (u) {
      case NANOS: return nanos;
      case MICROS: return nanos / 1000L;
      case MILLIS: return nanos / 1_000_000L;
      case SECONDS: return nanos / NANOS_PER_SECOND;
      case MINUTES: return nanos / (60L * NANOS_PER_SECOND);
      case HOURS: return nanos / (3600L * NANOS_PER_SECOND);
      default: throw new UnsupportedOperationException("mdbshim: LocalTime.until " + unit);
    }
  }

  @Override public int compareTo(LocalTime o) { return Long.compare(nanoOfDay, o.nanoOfDay); }
  @Override public boolean equals(Object o) { return (o instanceof LocalTime) && ((LocalTime) o).nanoOfDay == nanoOfDay; }
  @Override public int hashCode() { return Long.hashCode(nanoOfDay); }

  @Override public String toString() {
    int h = getHour();
    int m = getMinute();
    int s = getSecond();
    int n = getNano();
    StringBuilder sb = new StringBuilder();
    sb.append(h < 10 ? "0" : "").append(h).append(m < 10 ? ":0" : ":").append(m);
    if (s > 0 || n > 0) {
      sb.append(s < 10 ? ":0" : ":").append(s);
      if (n > 0) {
        if (n % 1_000_000 == 0) sb.append('.').append(String.valueOf(n / 1_000_000 + 1000).substring(1));
        else if (n % 1000 == 0) sb.append('.').append(String.valueOf(n / 1000 + 1_000_000).substring(1));
        else sb.append('.').append(String.valueOf(n + 1_000_000_000).substring(1));
      }
    }
    return sb.toString();
  }
}
