package grabarmdb;

import com.healthmarketscience.jackcess.util.MemFileChannel;

import java.io.IOException;
import java.nio.ByteBuffer;

import org.teavm.jso.JSExport;
import org.teavm.jso.typedarrays.Int8Array;

/**
 * API exportada a JavaScript (TeaVM). La página la usa así, dentro de un Web Worker:
 *   nuevaBase(); agregarBytes(parte) por trozos; grabar(json, ahora, spec, nombre) -> JSON de resultado;
 *   extraer(generado, nombre) -> datos de calibración (formato datos_calibracion.json);
 *   tamano() + leerBytes(pos, len) por trozos para armar el .mdb descargable; liberar().
 * Todo ocurre en memoria: el archivo original del PC nunca se modifica.
 */
public class WebApi {
  private static MemFileChannel canal;
  private static long escrito;

  public static void main(String[] args) { }

  @JSExport
  public static void nuevaBase() {
    canal = MemFileChannel.newChannel();
    escrito = 0L;
  }

  @JSExport
  public static void agregarBytes(Int8Array parte) throws IOException {
    byte[] b = parte.copyToJavaArray();
    canal.write(ByteBuffer.wrap(b), escrito);
    escrito += b.length;
  }

  /** Graba el JSON del botón "Grabar a la base de datos" y autoverifica la base resultante. */
  @JSExport
  public static String grabar(String json, String ahora, boolean actualizarSpec, String nombreBase) {
    try {
      if (canal == null) throw new IllegalStateException("No hay base cargada.");
      GrabarMdb.Resultado r = GrabarMdb.procesarCanal(canal, json, GrabarMdb.parseNow(ahora), actualizarSpec, nombreBase);
      r.verificacion = Verificador.verificar(canal, r);
      return GrabarMdb.resultadoJson(r);
    } catch (Throwable t) {
      canal = null;
      return GrabarMdb.errorJson(t);
    }
  }

  /**
   * Lee de la base cargada (o recién grabada) los datos con que la app autollena notificaciones y reportes, con el
   * formato de datos_calibracion.json (port de src/extract_ranges.ps1). Devuelve ese JSON, o {"ok":false,...}.
   */
  @JSExport
  public static String extraer(String generado, String nombreBase) {
    try {
      if (canal == null) throw new IllegalStateException("No hay base cargada.");
      return Extractor.extraerJson(canal, generado, nombreBase);
    } catch (Throwable t) {
      return GrabarMdb.errorJson(t);
    }
  }

  @JSExport
  public static int tamano() {
    try {
      return canal == null ? 0 : (int) canal.size();
    } catch (Exception e) {
      return 0;
    }
  }

  @JSExport
  public static Int8Array leerBytes(int pos, int len) throws IOException {
    return Int8Array.fromJavaArray(GrabarMdb.leer(canal, pos, len));
  }

  @JSExport
  public static void liberar() {
    canal = null;
    escrito = 0L;
  }
}
