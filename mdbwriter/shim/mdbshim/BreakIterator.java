package mdbshim;

import java.util.Locale;

/** Solo firma: lo usa una función de texto del motor de fórmulas, que está desactivado. */
public abstract class BreakIterator {
  protected BreakIterator() {}

  public static BreakIterator getWordInstance(Locale locale) {
    throw new UnsupportedOperationException("mdbshim: BreakIterator no disponible");
  }

  public abstract int first();

  public abstract int next();

  public abstract void setText(String text);
}
