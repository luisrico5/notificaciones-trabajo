package mdbshim;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.ReadableByteChannel;
import java.nio.channels.SeekableByteChannel;
import java.nio.channels.WritableByteChannel;
import java.nio.file.OpenOption;
import java.nio.file.Path;

/**
 * Sustituto de java.nio.channels.FileChannel con la misma forma abstracta. En el navegador solo existe
 * el canal en memoria de Jackcess (MemFileChannel); abrir archivos del disco no está disponible.
 */
public abstract class FileChannel implements SeekableByteChannel {
  private boolean open = true;

  protected FileChannel() {}

  public static FileChannel open(Path path, OpenOption... options) throws IOException {
    throw new UnsupportedOperationException("mdbshim: FileChannel.open no disponible (solo canal en memoria)");
  }

  public abstract int read(ByteBuffer dst) throws IOException;
  public abstract long read(ByteBuffer[] dsts, int offset, int length) throws IOException;
  public final long read(ByteBuffer[] dsts) throws IOException { return read(dsts, 0, dsts.length); }
  public abstract int write(ByteBuffer src) throws IOException;
  public abstract long write(ByteBuffer[] srcs, int offset, int length) throws IOException;
  public final long write(ByteBuffer[] srcs) throws IOException { return write(srcs, 0, srcs.length); }
  public abstract long position() throws IOException;
  public abstract FileChannel position(long newPosition) throws IOException;
  public abstract long size() throws IOException;
  public abstract FileChannel truncate(long size) throws IOException;
  public abstract void force(boolean metaData) throws IOException;
  public abstract long transferTo(long position, long count, WritableByteChannel target) throws IOException;
  public abstract long transferFrom(ReadableByteChannel src, long position, long count) throws IOException;
  public abstract int read(ByteBuffer dst, long position) throws IOException;
  public abstract int write(ByteBuffer src, long position) throws IOException;
  public abstract MappedByteBuffer map(MapMode mode, long position, long size) throws IOException;
  public abstract FileLock lock(long position, long size, boolean shared) throws IOException;
  public final FileLock lock() throws IOException { return lock(0L, Long.MAX_VALUE, false); }
  public abstract FileLock tryLock(long position, long size, boolean shared) throws IOException;
  public final FileLock tryLock() throws IOException { return tryLock(0L, Long.MAX_VALUE, false); }

  @Override public final boolean isOpen() { return open; }

  @Override public final void close() throws IOException {
    if (open) {
      open = false;
      implCloseChannel();
    }
  }

  protected abstract void implCloseChannel() throws IOException;

  public static class MapMode {
    public static final MapMode READ_ONLY = new MapMode("READ_ONLY");
    public static final MapMode READ_WRITE = new MapMode("READ_WRITE");
    public static final MapMode PRIVATE = new MapMode("PRIVATE");
    private final String name;
    private MapMode(String name) { this.name = name; }
    @Override public String toString() { return name; }
  }
}
