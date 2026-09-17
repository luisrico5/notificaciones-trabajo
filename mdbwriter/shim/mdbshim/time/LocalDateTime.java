package mdbshim.time;

import mdbshim.time.temporal.Temporal;
import mdbshim.time.temporal.TemporalAmount;

/** Fecha-hora local sin zona. Aritmética exacta sobre (epochDay, nanoOfDay). */
public final class LocalDateTime implements Temporal, Comparable<LocalDateTime> {
  private final LocalDate date;
  private final LocalTime time;

  private LocalDateTime(LocalDate d, LocalTime t) { date = d; time = t; }

  public static LocalDateTime of(LocalDate date, LocalTime time) {
    if (date == null || time == null) throw new NullPointerException("fecha u hora nula");
    return new LocalDateTime(date, time);
  }

  public static LocalDateTime of(int year, int month, int day, int hour, int minute, int second) {
    return new LocalDateTime(LocalDate.of(year, month, day), LocalTime.of(hour, minute, second));
  }

  static LocalDateTime ofEpoch(long epochDay, long nanoOfDay) {
    long d = Math.addExact(epochDay, Math.floorDiv(nanoOfDay, LocalTime.NANOS_PER_DAY));
    long n = Math.floorMod(nanoOfDay, LocalTime.NANOS_PER_DAY);
    return new LocalDateTime(LocalDate.ofEpochDay(d), LocalTime.ofNanoOfDay(n));
  }

  public static LocalDateTime ofInstant(Instant instant, ZoneId zone) {
    long local = Math.addExact(instant.getEpochSecond(), (long) zone.offsetSeconds());
    return ofEpoch(Math.floorDiv(local, 86_400L),
        Math.floorMod(local, 86_400L) * LocalTime.NANOS_PER_SECOND + instant.getNano());
  }

  public static LocalDateTime now(ZoneId zone) {
    return ofInstant(Instant.ofEpochMilli(System.currentTimeMillis()), zone);
  }

  public LocalDate toLocalDate() { return date; }
  public LocalTime toLocalTime() { return time; }
  public int getYear() { return date.getYear(); }
  public int getMonthValue() { return date.getMonthValue(); }
  public int getDayOfMonth() { return date.getDayOfMonth(); }
  public int getHour() { return time.getHour(); }
  public int getMinute() { return time.getMinute(); }
  public int getSecond() { return time.getSecond(); }
  public int getNano() { return time.getNano(); }

  public LocalDateTime plusDays(long days) {
    if (days == 0) return this;
    return new LocalDateTime(LocalDate.ofEpochDay(Math.addExact(date.toEpochDay(), days)), time);
  }

  public LocalDateTime plusSeconds(long seconds) {
    if (seconds == 0) return this;
    long days = Math.floorDiv(seconds, 86_400L);
    long secs = Math.floorMod(seconds, 86_400L);
    return ofEpoch(Math.addExact(date.toEpochDay(), days), time.toNanoOfDay() + secs * LocalTime.NANOS_PER_SECOND);
  }

  public LocalDateTime plusNanos(long nanos) {
    if (nanos == 0) return this;
    long days = Math.floorDiv(nanos, LocalTime.NANOS_PER_DAY);
    long rest = Math.floorMod(nanos, LocalTime.NANOS_PER_DAY);
    return ofEpoch(Math.addExact(date.toEpochDay(), days), time.toNanoOfDay() + rest);
  }

  public LocalDateTime plus(TemporalAmount amount) {
    if (!(amount instanceof Duration)) throw new UnsupportedOperationException("mdbshim: plus solo admite Duration");
    Duration d = (Duration) amount;
    return plusSeconds(d.getSeconds()).plusNanos(d.getNano());
  }

  public ZonedDateTime atZone(ZoneId zone) { return ZonedDateTime.of(date, time, zone); }

  @Override public int compareTo(LocalDateTime o) {
    int c = date.compareTo(o.date);
    return (c != 0) ? c : time.compareTo(o.time);
  }

  @Override public boolean equals(Object o) {
    return (o instanceof LocalDateTime) && ((LocalDateTime) o).date.equals(date) && ((LocalDateTime) o).time.equals(time);
  }

  @Override public int hashCode() { return date.hashCode() ^ time.hashCode(); }
  @Override public String toString() { return date.toString() + "T" + time.toString(); }
}
