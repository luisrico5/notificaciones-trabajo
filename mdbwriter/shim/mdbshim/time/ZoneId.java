package mdbshim.time;

/**
 * Zona horaria por identificador. Solo UTC admite conversiones; cualquier otra lanza.
 * Con valores LocalDateTime (lo único que usamos) Jackcess nunca convierte con zona.
 */
public final class ZoneId {
  private final String id;

  private ZoneId(String id) { this.id = id; }

  public static ZoneId of(String id) { return new ZoneId(id); }

  public String getId() { return id; }

  boolean isUtc() {
    return "UTC".equals(id) || "Z".equals(id) || "GMT".equals(id) || "Etc/UTC".equals(id)
        || "Etc/GMT".equals(id) || "UTC0".equals(id);
  }

  int offsetSeconds() {
    if (isUtc()) return 0;
    throw new UnsupportedOperationException("mdbshim: conversión con la zona '" + id + "' no soportada");
  }

  @Override public boolean equals(Object o) { return (o instanceof ZoneId) && ((ZoneId) o).id.equals(id); }
  @Override public int hashCode() { return id.hashCode(); }
  @Override public String toString() { return id; }
}
