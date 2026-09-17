package mdbshim.time;

import mdbshim.time.temporal.Temporal;

/** Solo UTC (cualquier otra zona lanza). Jackcess lo usa solo con valores con zona, que no pasamos. */
public final class ZonedDateTime implements Temporal {
  private final LocalDateTime ldt;
  private final ZoneId zone;

  private ZonedDateTime(LocalDateTime ldt, ZoneId zone) { this.ldt = ldt; this.zone = zone; }

  public static ZonedDateTime of(LocalDate date, LocalTime time, ZoneId zone) {
    return new ZonedDateTime(LocalDateTime.of(date, time), zone);
  }

  public ZoneId getZone() { return zone; }
  public LocalDateTime toLocalDateTime() { return ldt; }

  public Instant toInstant() {
    long secs = Math.multiplyExact(ldt.toLocalDate().toEpochDay(), 86_400L)
        + ldt.toLocalTime().toNanoOfDay() / LocalTime.NANOS_PER_SECOND;
    return Instant.ofEpochSecond(Math.subtractExact(secs, (long) zone.offsetSeconds()), ldt.getNano());
  }

  public ZonedDateTime withZoneSameInstant(ZoneId newZone) {
    if (newZone.equals(zone)) return this;
    return new ZonedDateTime(LocalDateTime.ofInstant(toInstant(), newZone), newZone);
  }
}
