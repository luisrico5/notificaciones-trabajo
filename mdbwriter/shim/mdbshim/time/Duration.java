package mdbshim.time;

import mdbshim.time.temporal.Temporal;
import mdbshim.time.temporal.TemporalAmount;

/** Duración normalizada: segundos (con signo) + nanos en [0, 1e9). */
public final class Duration implements TemporalAmount, Comparable<Duration> {
  private final long seconds;
  private final int nanos;

  private Duration(long s, int n) { seconds = s; nanos = n; }

  public static Duration ofSeconds(long seconds, long nanoAdjustment) {
    long secs = Math.addExact(seconds, Math.floorDiv(nanoAdjustment, LocalTime.NANOS_PER_SECOND));
    int nos = (int) Math.floorMod(nanoAdjustment, LocalTime.NANOS_PER_SECOND);
    return new Duration(secs, nos);
  }

  public static Duration between(Temporal startInclusive, Temporal endExclusive) {
    if (startInclusive instanceof LocalDateTime && endExclusive instanceof LocalDateTime) {
      LocalDateTime a = (LocalDateTime) startInclusive;
      LocalDateTime b = (LocalDateTime) endExclusive;
      long days = b.toLocalDate().toEpochDay() - a.toLocalDate().toEpochDay();
      long nod = b.toLocalTime().toNanoOfDay() - a.toLocalTime().toNanoOfDay();
      return ofSeconds(Math.multiplyExact(days, 86_400L), nod);
    }
    if (startInclusive instanceof Instant && endExclusive instanceof Instant) {
      Instant a = (Instant) startInclusive;
      Instant b = (Instant) endExclusive;
      return ofSeconds(b.getEpochSecond() - a.getEpochSecond(), (long) b.getNano() - a.getNano());
    }
    throw new UnsupportedOperationException("mdbshim: Duration.between no soportado para " + startInclusive);
  }

  public long getSeconds() { return seconds; }
  public int getNano() { return nanos; }

  @Override public int compareTo(Duration o) {
    int c = Long.compare(seconds, o.seconds);
    return (c != 0) ? c : Integer.compare(nanos, o.nanos);
  }

  @Override public boolean equals(Object o) {
    return (o instanceof Duration) && ((Duration) o).seconds == seconds && ((Duration) o).nanos == nanos;
  }

  @Override public int hashCode() { return Long.hashCode(seconds) + 51 * nanos; }
  @Override public String toString() { return "Duration[" + seconds + "s " + nanos + "ns]"; }
}
