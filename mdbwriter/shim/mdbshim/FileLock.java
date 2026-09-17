package mdbshim;

/** Solo firma: MemFileChannel.lock/tryLock lanzan UnsupportedOperationException, nunca se crea. */
public abstract class FileLock {
  protected FileLock() {}
}
