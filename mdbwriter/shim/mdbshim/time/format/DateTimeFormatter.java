package mdbshim.time.format;

/** Solo lo usa el motor de fórmulas de Access, que queda desactivado: no disponible. */
public final class DateTimeFormatter {
  private DateTimeFormatter() {}

  public static DateTimeFormatter ofPattern(String pattern, java.util.Locale locale) {
    throw new UnsupportedOperationException("mdbshim: DateTimeFormatter no disponible");
  }
}
