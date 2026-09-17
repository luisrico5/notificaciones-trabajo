package mdbshim.time.temporal;

import mdbshim.time.LocalDate;
import mdbshim.time.LocalDateTime;
import mdbshim.time.LocalTime;
import mdbshim.time.ZoneId;
import mdbshim.time.ZonedDateTime;

public final class TemporalQueries {
  private TemporalQueries() {}

  private static final TemporalQuery<LocalDate> LOCAL_DATE = new TemporalQuery<LocalDate>() {
    public LocalDate queryFrom(TemporalAccessor t) {
      if (t instanceof LocalDateTime) return ((LocalDateTime) t).toLocalDate();
      if (t instanceof ZonedDateTime) return ((ZonedDateTime) t).toLocalDateTime().toLocalDate();
      if (t instanceof LocalDate) return (LocalDate) t;
      return null;
    }
  };
  private static final TemporalQuery<LocalTime> LOCAL_TIME = new TemporalQuery<LocalTime>() {
    public LocalTime queryFrom(TemporalAccessor t) {
      if (t instanceof LocalDateTime) return ((LocalDateTime) t).toLocalTime();
      if (t instanceof ZonedDateTime) return ((ZonedDateTime) t).toLocalDateTime().toLocalTime();
      if (t instanceof LocalTime) return (LocalTime) t;
      return null;
    }
  };
  private static final TemporalQuery<ZoneId> ZONE = new TemporalQuery<ZoneId>() {
    public ZoneId queryFrom(TemporalAccessor t) {
      return (t instanceof ZonedDateTime) ? ((ZonedDateTime) t).getZone() : null;
    }
  };

  public static TemporalQuery<LocalDate> localDate() { return LOCAL_DATE; }
  public static TemporalQuery<LocalTime> localTime() { return LOCAL_TIME; }
  public static TemporalQuery<ZoneId> zone() { return ZONE; }
}
