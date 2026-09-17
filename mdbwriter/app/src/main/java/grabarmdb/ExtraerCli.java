package grabarmdb;

import com.healthmarketscience.jackcess.util.MemFileChannel;

import java.io.File;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/**
 * Extrae en la JVM los datos de calibración (mismo formato que datos_calibracion.json) para compararlos con
 * src/extract_ranges.ps1. Uso: java grabarmdb.ExtraerCli base.mdb salida.json [generado]
 */
public class ExtraerCli {
  public static void main(String[] a) throws Exception {
    byte[] mdb = Files.readAllBytes(new File(a[0]).toPath());
    MemFileChannel ch = MemFileChannel.newChannel();
    ch.write(ByteBuffer.wrap(mdb), 0L);
    mdb = null;
    long t0 = System.currentTimeMillis();
    String json = Extractor.extraerJson(ch, a.length > 2 ? a[2] : "2026-01-01 00:00", new File(a[0]).getName());
    System.out.println("(JVM extraer " + (System.currentTimeMillis() - t0) + " ms, " + json.length() + " caracteres)");
    Files.write(new File(a[1]).toPath(), json.getBytes(StandardCharsets.UTF_8));
  }
}
