package mdbshim;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.channels.ReadableByteChannel;
import java.nio.channels.WritableByteChannel;

/** Sustituto de java.nio.channels.Channels (solo los adaptadores de flujo que usa Jackcess). */
public final class Channels {
  private Channels() {}

  public static ReadableByteChannel newChannel(final InputStream in) {
    return new ReadableByteChannel() {
      private boolean open = true;
      private final byte[] buf = new byte[65536];

      public int read(ByteBuffer dst) throws IOException {
        int want = Math.min(dst.remaining(), buf.length);
        if (want == 0) return 0;
        int n = in.read(buf, 0, want);
        if (n > 0) dst.put(buf, 0, n);
        return n;
      }

      public boolean isOpen() { return open; }

      public void close() throws IOException {
        open = false;
        in.close();
      }
    };
  }

  public static WritableByteChannel newChannel(final OutputStream out) {
    return new WritableByteChannel() {
      private boolean open = true;
      private final byte[] buf = new byte[65536];

      public int write(ByteBuffer src) throws IOException {
        int total = 0;
        while (src.hasRemaining()) {
          int n = Math.min(src.remaining(), buf.length);
          src.get(buf, 0, n);
          out.write(buf, 0, n);
          total += n;
        }
        return total;
      }

      public boolean isOpen() { return open; }

      public void close() throws IOException {
        open = false;
        out.close();
      }
    };
  }
}
