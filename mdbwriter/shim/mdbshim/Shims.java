package mdbshim;

import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.TimeZone;

import mdbshim.time.ZoneId;

/** Reemplazos de métodos del JDK que TeaVM no trae (las llamadas se redirigen aquí al reescribir Jackcess). */
public final class Shims {
  private Shims() {}

  private static final SysLogger NOOP = new SysLogger() {
    public boolean isLoggable(Level level) { return false; }
    public void log(Level level, String msg) {}
    public void log(Level level, String msg, Throwable thrown) {}
  };

  /** Reemplaza System.getLogger(String): logger mudo. */
  public static SysLogger getLogger(String name) { return NOOP; }

  /** Reemplaza File.toPath(). */
  public static Path fileToPath(File file) { return Paths.get(file.getPath()); }

  /** Reemplaza TimeZone.toZoneId(). */
  public static ZoneId tzToZoneId(TimeZone tz) { return ZoneId.of(tz.getID()); }

  /** Reemplaza TimeZone.getTimeZone(ZoneId). */
  public static TimeZone tzFromZoneId(ZoneId zone) { return TimeZone.getTimeZone(zone.getId()); }

  /** Reemplaza Locale.forLanguageTag(String) para etiquetas simples "es", "es-CO", "en-US". */
  public static Locale localeForTag(String tag) {
    if (tag == null || tag.isEmpty()) return Locale.ROOT;
    String[] p = tag.replace('_', '-').split("-");
    if (p.length == 1) return new Locale(p[0]);
    return new Locale(p[0], p[1]);
  }
}
