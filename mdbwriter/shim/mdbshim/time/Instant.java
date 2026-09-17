package mdbshim.time;

import mdbshim.time.temporal.Temporal;

public final class Instant implements Temporal, Comparable<Instant> {
  private final long epochSecond;
  private final int nano;

  private Instant(long s, int n) { epochSecond = s; nano = n; }

  public static Instant ofEpochSecond(long epochSecond, long nanoAdjustment) {
    long s = Math.addExact(epochSecond, Math.floorDiv(nanoAdjustment, LocalTime.NANOS_PER_SECOND));
    return new Instant(s, (int) Math.floorMod(nanoAdjustment, LocalTime.NANOS_PER_SECOND));
  }

  public static Instant ofEpochMilli(long epochMilli) {
    return new Instant(Math.floorDiv(epochMilli, 1000L), (int) (Math.floorMod(epochMilli, 1000L) * 1_000_000L));
  }

  public long getEpochSecond() { return epochSecond; }
  public int getNano() { return nano; }

  public long toEpochMilli() {
    return Math.addExact(Math.multiplyExact(epochSecond, 1000L), nano / 1_000_000L);
  }

  @Override public int compareTo(Instant o) {
    int c = Long.compare(epochSecond, o.epochSecond);
    return (c != 0) ? c : Integer.compare(nano, o.nano);
  }

  @Override public boolean equals(Object o) {
    return (o instanceof Instant) && ((Instant) o).epochSecond == epochSecond && ((Instant) o).nano == nano;
  }

  @Override public int hashCode() { return Long.hashCode(epochSecond) + 51 * nano; }
  @Override public String toString() { return "Instant[" + epochSecond + "s " + nano + "ns]"; }
}
