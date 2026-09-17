package mdbshim;

/** Sustituto de java.lang.System.Logger: solo los métodos que usa Jackcess. */
public interface SysLogger {
  enum Level { ALL, TRACE, DEBUG, INFO, WARNING, ERROR, OFF }

  boolean isLoggable(Level level);

  void log(Level level, String msg);

  void log(Level level, String msg, Throwable thrown);
}
