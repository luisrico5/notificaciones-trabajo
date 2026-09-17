package mdbshim;

import java.io.IOException;
import java.io.OutputStream;

/** Solo firma: Jackcess lo usa para indexar objetos Java serializados, caso que no ocurre en una base Access. */
public class ObjectOutputStream extends OutputStream {
  public ObjectOutputStream(OutputStream out) throws IOException {
    throw new UnsupportedOperationException("mdbshim: ObjectOutputStream no disponible");
  }

  public void writeObject(Object obj) throws IOException {
    throw new UnsupportedOperationException("mdbshim: ObjectOutputStream no disponible");
  }

  @Override public void write(int b) throws IOException {
    throw new UnsupportedOperationException("mdbshim: ObjectOutputStream no disponible");
  }
}
