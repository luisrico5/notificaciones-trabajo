package grabarmdb;

import com.healthmarketscience.jackcess.util.MemFileChannel;

import java.io.File;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/**
 * Ejecuta el port en la JVM (pruebas de fidelidad contra grabar_reporte.ps1), con la misma secuencia que la
 * página: grabar en el canal en memoria -> autoverificar -> escribir la salida.
 * Uso: java grabarmdb.Cli entrada.mdb grabar.json salida.mdb yyyy-MM-ddTHH:mm:ss(.SSS) [--no-spec]
 */
public class Cli {
  public static void main(String[] a) throws Exception {
    byte[] mdb = Files.readAllBytes(new File(a[0]).toPath());
    String json = new String(Files.readAllBytes(new File(a[1]).toPath()), StandardCharsets.UTF_8);
    boolean spec = !(a.length > 4 && a[4].equals("--no-spec"));
    long t0 = System.currentTimeMillis();
    MemFileChannel ch = MemFileChannel.newChannel();
    ch.write(ByteBuffer.wrap(mdb), 0L);
    mdb = null;
    GrabarMdb.Resultado r = GrabarMdb.procesarCanal(ch, json, GrabarMdb.parseNow(a[3]), spec, new File(a[0]).getName());
    long t1 = System.currentTimeMillis();
    r.verificacion = Verificador.verificar(ch, r);
    long t2 = System.currentTimeMillis();
    Files.write(new File(a[2]).toPath(), GrabarMdb.leer(ch, 0L, (int) ch.size()));
    for (String l : r.log) System.out.println(l);
    System.out.println("(JVM grabar " + (t1 - t0) + " ms, verificar " + (t2 - t1) + " ms)");
    System.out.println(GrabarMdb.resultadoJson(r));
  }
}
