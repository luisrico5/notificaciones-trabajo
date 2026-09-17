package mdbshim.time.temporal;

/** Sustituto mínimo de java.time.temporal.TemporalAccessor (solo lo que usa Jackcess). */
public interface TemporalAccessor {
  default <R> R query(TemporalQuery<R> query) { return query.queryFrom(this); }
}
