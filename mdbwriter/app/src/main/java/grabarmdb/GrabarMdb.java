package grabarmdb;

import com.healthmarketscience.jackcess.Column;
import com.healthmarketscience.jackcess.Cursor;
import com.healthmarketscience.jackcess.CursorBuilder;
import com.healthmarketscience.jackcess.Database;
import com.healthmarketscience.jackcess.DatabaseBuilder;
import com.healthmarketscience.jackcess.DateTimeType;
import com.healthmarketscience.jackcess.IndexCursor;
import com.healthmarketscience.jackcess.Row;
import com.healthmarketscience.jackcess.Table;
import com.healthmarketscience.jackcess.util.MemFileChannel;

import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import mdbshim.time.LocalDate;
import mdbshim.time.LocalDateTime;
import mdbshim.time.LocalTime;

/**
 * Port fiel de src/grabar_reporte.ps1 sobre Jackcess, para ejecutarse en el navegador (compilado a
 * JavaScript con TeaVM) o en la JVM (pruebas). Recibe la base .mdb en bytes y el MISMO JSON que descarga el
 * botón "Grabar a la base de datos", y devuelve la base actualizada en bytes. Todo ocurre en memoria: si algo
 * falla se lanza la excepción y no se devuelve nada (equivale a la transacción con rollback del script).
 *
 * Cada paso replica el script (mismas tablas, mismas columnas, misma plantilla, mismas reglas Pass/Fail,
 * misma actualización de la especificación y del contador IDs) y sus conversiones de PowerShell 5.1:
 * [string]$null = "", [double]"" = 0, [double]"  " = null, [int] con redondeo bancario, @($null).Count = 1.
 */
public final class GrabarMdb {
  private GrabarMdb() {}

  /** Resultado de una grabación. */
  public static final class Resultado {
    public byte[] mdb;
    /** Tamaño en bytes de la base resultante. */
    public long bytes;
    public final List<String> log = new ArrayList<>();
    public int insertados;
    public int omitidos;
    public final List<Map<String, Object>> calibraciones = new ArrayList<>();
    /** Conteo de filas de las tablas tocadas ANTES de grabar (para la verificación). */
    final Map<String, Integer> conteosAntes = new LinkedHashMap<>();
    /** Lo que se espera encontrar en la base resultante por cada calibración insertada. */
    final List<Esperado> esperados = new ArrayList<>();
    /** Filas de INSTSPEC esperadas al final por "tag|grupo" (en minúsculas) y variación neta de INSTSPEC. */
    final Map<String, Integer> specFinal = new LinkedHashMap<>();
    int specDelta;
    /** Resultado de Verificador.verificar (null si no se ejecutó). */
    public Map<String, Object> verificacion;

    void log(String s) { log.add(s); }
  }

  static final class Esperado {
    String tag;
    int cid, note, grpRows, detRows, tstRows;
  }

  static final String[] TABLAS = {"CALIBRAT", "CalGroups", "CALDET", "CALTEST", "PCNotes", "IDs", "INSTSPEC", "InstSpecGroup"};

  // ======================================================================================================
  // Conversiones con la semántica de PowerShell 5.1 sobre valores de ConvertFrom-Json
  // ======================================================================================================

  /** [string]$v */
  static String str(Object v) {
    if (v == null) return "";
    if (v instanceof String) return (String) v;
    if (v instanceof Json.Num) return ((Json.Num) v).text;
    if (v instanceof Boolean) return ((Boolean) v) ? "True" : "False";
    if (v instanceof List) {
      StringBuilder sb = new StringBuilder();
      for (Object o : (List<?>) v) { if (sb.length() > 0) sb.append(' '); sb.append(str(o)); }
      return sb.toString();
    }
    return String.valueOf(v);
  }

  /** Función Dbl del script: null -> null; [double](([string]$v).Replace(",",".")) o null si falla. */
  static Double dbl(Object v) {
    if (v == null) return null;
    if (v instanceof Boolean || v instanceof Map || v instanceof List) return null;
    String s = str(v).replace(",", ".");
    if (s.isEmpty()) return 0.0d;
    try {
      String t = s.trim();
      if (t.isEmpty()) return null;
      return Double.parseDouble(t);
    } catch (NumberFormatException e) {
      return null;
    }
  }

  /** [int]$v (redondeo al par más cercano). */
  static int toInt(Object v) {
    if (v == null) return 0;
    if (v instanceof Boolean) return ((Boolean) v) ? 1 : 0;
    String s = str(v).trim();
    if (s.isEmpty()) return 0;
    double d;
    try {
      d = Double.parseDouble(s.replace(",", "."));
    } catch (NumberFormatException e) {
      throw new IllegalArgumentException("No se puede convertir a entero: " + s);
    }
    double r = Math.rint(d);
    if (r > Integer.MAX_VALUE || r < Integer.MIN_VALUE) throw new IllegalArgumentException("Entero fuera de rango: " + s);
    return (int) r;
  }

  static boolean isNullOrWhiteSpace(String s) { return s == null || s.trim().isEmpty(); }

  /** foreach($x in $v): null no itera; arreglo itera sus elementos; un objeto suelto itera una vez. */
  static List<Object> each(Object v) {
    if (v == null) return Collections.emptyList();
    if (v instanceof List) {
      @SuppressWarnings("unchecked") List<Object> l = (List<Object>) v;
      return l;
    }
    return Collections.singletonList(v);
  }

  /** @($v) como arreglo (para .Count y para indexar): null -> [null]. */
  static List<Object> asArray(Object v) {
    if (v == null) return Collections.singletonList(null);
    return each(v);
  }

  /** $obj.prop sobre un PSCustomObject (null si no es objeto o no existe). */
  static Object prop(Object obj, String name) {
    if (!(obj instanceof Map)) return null;
    return ((Map<?, ?>) obj).get(name);
  }

  static final Pattern DMY = Pattern.compile("^(\\d{1,2})/(\\d{1,2})/(\\d{4})$");
  static final Pattern DMY2 = Pattern.compile("^(\\d{2})/(\\d{2})/(\\d{4})$");
  static final Pattern DMY_HMS = Pattern.compile("^(\\d{2})/(\\d{2})/(\\d{4}) (\\d{2}):(\\d{2}):(\\d{2})$");
  static final Pattern YMD = Pattern.compile("^(\\d{4})-(\\d{2})-(\\d{2})$");
  static final Pattern MDY_INV = Pattern.compile("^(\\d{1,2})/(\\d{1,2})/(\\d{4})(?:\\s+(\\d{1,2}):(\\d{2})(?::(\\d{2}))?)?$");
  static final Pattern ISO_INV = Pattern.compile("^(\\d{4})[-/](\\d{1,2})[-/](\\d{1,2})(?:[T\\s](\\d{1,2}):(\\d{2})(?::(\\d{2}))?)?$");

  static LocalDateTime ymdhms(int y, int mo, int d, int h, int mi, int s) {
    try {
      return LocalDateTime.of(LocalDate.of(y, mo, d), LocalTime.of(h, mi, s));
    } catch (RuntimeException e) {
      return null;
    }
  }

  static int grp(Matcher m, int i) { String g = m.group(i); return (g == null) ? 0 : Integer.parseInt(g); }

  /**
   * Función ParseDate del script: ParseExact con "dd/MM/yyyy", "d/M/yyyy", "dd/MM/yyyy HH:mm:ss",
   * "yyyy-MM-dd" (InvariantCulture) y, si ninguno aplica, DateTime.Parse invariante (formatos M/d/yyyy e ISO).
   */
  static LocalDateTime parseDate(Object v) {
    String raw = str(v);
    if (isNullOrWhiteSpace(raw)) return null;
    String s = raw.trim();
    Matcher m = DMY2.matcher(s);
    if (m.matches()) { LocalDateTime r = ymdhms(grp(m, 3), grp(m, 2), grp(m, 1), 0, 0, 0); if (r != null) return r; }
    m = DMY.matcher(s);
    if (m.matches()) { LocalDateTime r = ymdhms(grp(m, 3), grp(m, 2), grp(m, 1), 0, 0, 0); if (r != null) return r; }
    m = DMY_HMS.matcher(s);
    if (m.matches()) { LocalDateTime r = ymdhms(grp(m, 3), grp(m, 2), grp(m, 1), grp(m, 4), grp(m, 5), grp(m, 6)); if (r != null) return r; }
    m = YMD.matcher(s);
    if (m.matches()) { LocalDateTime r = ymdhms(grp(m, 1), grp(m, 2), grp(m, 3), 0, 0, 0); if (r != null) return r; }
    // DateTime.Parse(s, InvariantCulture): cultura invariante = mes/día/año, o ISO año-mes-día.
    m = MDY_INV.matcher(s);
    if (m.matches()) { LocalDateTime r = ymdhms(grp(m, 3), grp(m, 1), grp(m, 2), grp(m, 4), grp(m, 5), grp(m, 6)); if (r != null) return r; }
    m = ISO_INV.matcher(s);
    if (m.matches()) { LocalDateTime r = ymdhms(grp(m, 1), grp(m, 2), grp(m, 3), grp(m, 4), grp(m, 5), grp(m, 6)); if (r != null) return r; }
    return null;
  }

  // ======================================================================================================
  // Utilidades sobre Jackcess
  // ======================================================================================================

  /** Comparación de texto de Jet con '=' (sin distinguir mayúsculas). */
  static boolean eqi(Object dbValue, String s) { return (dbValue instanceof String) && ((String) dbValue).equalsIgnoreCase(s); }

  static int intOf(Object v) { return (v instanceof Number) ? ((Number) v).intValue() : 0; }

  /** Row-Hash: TODAS las columnas de la fila plantilla, con los overrides aplicados (nombres sin distinguir mayúsculas). */
  static Map<String, Object> rowHash(Table t, Map<String, Object> template, Map<String, Object> overrides) {
    Map<String, Object> ov = lowerKeys(overrides);
    Map<String, Object> h = new LinkedHashMap<>();
    for (Column c : t.getColumns()) {
      String k = c.getName().toLowerCase(Locale.ROOT);
      h.put(c.getName(), ov.containsKey(k) ? ov.get(k) : template.get(c.getName()));
    }
    return h;
  }

  /** Insert-Hash: solo las columnas presentes en el hash (el resto queda NULL, como el INSERT del script). */
  static void insertHash(Table t, Map<String, Object> hash) throws java.io.IOException {
    Map<String, Object> hv = lowerKeys(hash);
    Map<String, Object> row = new LinkedHashMap<>();
    for (Column c : t.getColumns()) {
      String k = c.getName().toLowerCase(Locale.ROOT);
      if (hv.containsKey(k)) row.put(c.getName(), hv.get(k));
    }
    t.addRowFromMap(row);
  }

  static Map<String, Object> lowerKeys(Map<String, Object> m) {
    Map<String, Object> r = new HashMap<>();
    for (Map.Entry<String, Object> e : m.entrySet()) r.put(e.getKey().toLowerCase(Locale.ROOT), e.getValue());
    return r;
  }

  static Map<String, Object> ov(Object... kv) {
    Map<String, Object> m = new LinkedHashMap<>();
    for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
    return m;
  }

  static Collection<String> cols(String... names) { return Arrays.asList(names); }

  /** MAX(col) de una columna entera (0 si no hay filas, como [int]DBNull en el script). */
  static int maxInt(Table t, String col) throws java.io.IOException {
    Cursor c = CursorBuilder.createCursor(t);
    Collection<String> only = cols(col);
    int max = 0;
    boolean any = false;
    for (Row r = c.getNextRow(only); r != null; r = c.getNextRow(only)) {
      Object v = r.get(col);
      if (v instanceof Number) { int x = ((Number) v).intValue(); if (!any || x > max) { max = x; any = true; } }
    }
    return any ? max : 0;
  }

  /** Filas cuya clave primaria empieza por el valor dado, en el orden del índice. Copias en memoria. */
  static List<Map<String, Object>> byPkPrefix(Table t, Object firstKey) throws java.io.IOException {
    IndexCursor ic = CursorBuilder.createPrimaryKeyCursor(t);
    List<Map<String, Object>> out = new ArrayList<>();
    for (Row r : ic.newEntryIterable(firstKey)) out.add(new LinkedHashMap<String, Object>(r));
    return out;
  }

  /** Candidato a plantilla: ORDER BY CalibrationDate DESC, CalibrationID DESC (NULL es el menor valor en Jet). */
  static final class Tpl {
    int id;
    LocalDateTime date;
    Tpl(int id, LocalDateTime date) { this.id = id; this.date = date; }
    boolean beats(Tpl o) {
      if (o == null) return true;
      if (date != null && o.date == null) return true;
      if (date == null && o.date != null) return false;
      if (date != null) { int c = date.compareTo(o.date); if (c != 0) return c > 0; }
      return id > o.id;
    }
  }

  static String num(Double d) {
    if (d == null) return "";
    double x = d;
    if (x == Math.rint(x) && Math.abs(x) < 1e15) return String.valueOf((long) x);
    return String.valueOf(x);
  }

  // ======================================================================================================
  // Proceso principal (equivale al cuerpo del script)
  // ======================================================================================================

  public static Resultado procesar(byte[] mdbBytes, String json, LocalDateTime now, boolean updateSpec, String nombreBase)
      throws Exception {
    MemFileChannel ch = MemFileChannel.newChannel();
    ch.write(ByteBuffer.wrap(mdbBytes), 0L);
    Resultado res = procesarCanal(ch, json, now, updateSpec, nombreBase);
    res.mdb = leer(ch, 0L, (int) ch.size());
    return res;
  }

  /** Lee len bytes del canal desde pos. */
  public static byte[] leer(MemFileChannel ch, long pos, int len) throws java.io.IOException {
    byte[] out = new byte[len];
    ByteBuffer bb = ByteBuffer.wrap(out);
    long p = pos;
    while (bb.hasRemaining()) {
      int k = ch.read(bb, p);
      if (k <= 0) break;
      p += k;
    }
    return out;
  }

  /**
   * Graba sobre la base que ya está en el canal en memoria (lo modifica en el lugar). Si lanza excepción, el
   * contenido del canal no debe usarse.
   */
  public static Resultado procesarCanal(MemFileChannel ch, String json, LocalDateTime now, boolean updateSpec, String nombreBase)
      throws Exception {
    Resultado res = new Resultado();

    Object d = Json.parse(json);
    List<Object> list;
    Object calibs = prop(d, "calibraciones");
    if (d instanceof List) list = each(d);
    else if (calibs != null) list = each(calibs);
    else list = Collections.singletonList(d);
    if (list.isEmpty()) throw new IllegalArgumentException("El JSON no trae calibraciones.");

    Database db = new DatabaseBuilder().setChannel(ch).setReadOnly(false).setAutoSync(false).open();
    try {
      db.setDateTimeType(DateTimeType.LOCAL_DATE_TIME);
      res.log("Base editable: " + nombreBase);
      res.log("Instrumentos en el archivo: " + list.size());
      res.log("Especificación (InstSpecGroup+INSTSPEC): " + (updateSpec ? "se actualiza para reflejar puntos/rangos" : "NO se actualiza (-NoSpec)"));

      Table cal = db.getTable("CALIBRAT");
      Table grp = db.getTable("CalGroups");
      Table det = db.getTable("CALDET");
      Table tst = db.getTable("CALTEST");
      Table notes = db.getTable("PCNotes");
      Table ids = db.getTable("IDs");
      Table spec = db.getTable("INSTSPEC");
      Table specGrp = db.getTable("InstSpecGroup");
      if (cal == null || grp == null || det == null || tst == null || notes == null || ids == null || spec == null || specGrp == null) {
        throw new IllegalStateException("La base no tiene las tablas de DPCTrack2 (CALIBRAT, CalGroups, CALDET, CALTEST, PCNotes, IDs, INSTSPEC, InstSpecGroup).");
      }
      for (String t : TABLAS) res.conteosAntes.put(t, db.getTable(t).getRowCount());

      // IDs de arranque = 1 + max(MAX(tabla), IDs.LastID)
      int maxCal = maxInt(cal, "CalibrationID");
      int maxNote = maxInt(notes, "NoteID");
      int nextCid = Math.max(maxCal, lastId(ids, "CALIBRAT")) + 1;
      int nextNote = Math.max(maxNote, lastId(ids, "PCNOTES")) + 1;

      // Índice de plantillas: ITEMCODE (sin mayúsculas) -> mejor (fecha desc, id desc) entre ITEMTYPE='Instrument'.
      Map<String, Tpl> tplIndex = new HashMap<>();
      {
        Cursor c = CursorBuilder.createCursor(cal);
        Collection<String> only = cols("CalibrationID", "CalibrationDate", "ITEMTYPE", "ITEMCODE");
        for (Row r = c.getNextRow(only); r != null; r = c.getNextRow(only)) {
          if (!eqi(r.get("ITEMTYPE"), "Instrument")) continue;
          Object code = r.get("ITEMCODE");
          if (!(code instanceof String)) continue;
          String k = ((String) code).toLowerCase(Locale.ROOT);
          Tpl cand = new Tpl(intOf(r.get("CalibrationID")), (LocalDateTime) r.get("CalibrationDate"));
          if (cand.beats(tplIndex.get(k))) tplIndex.put(k, cand);
        }
      }

      for (Object item : list) {
        if (processCal(res, item, nextCid, nextNote, now, updateSpec, tplIndex, cal, grp, det, tst, notes, spec, specGrp)) {
          nextCid++;
          nextNote++;
          res.insertados++;
        } else {
          res.omitidos++;
        }
      }

      // Contador interno de DPCTrack: solo se sube (WHERE LastID < ?).
      bumpId(ids, "CALIBRAT", nextCid - 1);
      bumpId(ids, "PCNOTES", nextNote - 1);

      res.log("LISTO. Insertados: " + res.insertados + "  |  omitidos (sin plantilla): " + res.omitidos);

      db.flush();
      res.bytes = ch.size();
      return res;
    } finally {
      try { db.close(); } catch (Exception ignore) { }
    }
  }

  static int lastId(Table ids, String name) throws java.io.IOException {
    for (Row r : ids) {
      if (eqi(r.get("TABLENAME"), name)) return intOf(r.get("LastID"));
    }
    return 0;
  }

  static void bumpId(Table ids, String name, int value) throws java.io.IOException {
    Cursor c = CursorBuilder.createCursor(ids);
    for (Row r = c.getNextRow(); r != null; r = c.getNextRow()) {
      if (!eqi(r.get("TABLENAME"), name)) continue;
      Object v = r.get("LastID");
      if (v instanceof Number && ((Number) v).intValue() < value) {
        Map<String, Object> upd = new HashMap<String, Object>(r);
        upd.put("LastID", value);
        c.updateCurrentRowFromMap(upd);
      }
    }
  }

  static boolean processCal(Resultado res, Object dd, int cid, int note, LocalDateTime now, boolean updateSpec,
      Map<String, Tpl> tplIndex, Table cal, Table grp, Table det, Table tst, Table notes, Table spec, Table specGrp)
      throws Exception {
    String tag = str(prop(dd, "tag"));
    if (isNullOrWhiteSpace(tag)) { res.log("  (omitido: calibración sin 'tag')"); return false; }
    Tpl best = tplIndex.get(tag.toLowerCase(Locale.ROOT));
    if (best == null) { res.log("  OMITIDO " + tag + " (sin calibración previa de plantilla)"); return false; }
    int tpl = best.id;

    Row calRow = CursorBuilder.findRowByPrimaryKey(cal, tpl);
    if (calRow == null) throw new IllegalStateException("No se encontró la calibración plantilla " + tpl);
    Map<String, Object> dtCal = new LinkedHashMap<String, Object>(calRow);
    List<Map<String, Object>> dtGrp = byPkPrefix(grp, tpl);
    List<Map<String, Object>> dtDet = byPkPrefix(det, tpl);

    List<Object> grupos = each(prop(dd, "grupos"));

    // Límites por (grupo|posición) y resultado global desde los puntos del reporte
    Map<String, Double[]> lim = new HashMap<>();
    for (Object g : grupos) {
      int gn = toInt(prop(g, "gn"));
      for (Object pt : each(prop(g, "puntos"))) {
        int pos = toInt(prop(pt, "pos"));
        lim.put(gn + "|" + pos, new Double[] {dbl(prop(pt, "low")), dbl(prop(pt, "high"))});
      }
    }
    boolean anyFail = false;
    boolean anyFoundFail = false;
    for (Object g : grupos) {
      int gn = toInt(prop(g, "gn"));
      for (Object pt : each(prop(g, "puntos"))) {
        int pos = toInt(prop(pt, "pos"));
        for (String rt : new String[] {"FoundAs", "LeftAs"}) {
          Double v = rt.equals("FoundAs") ? dbl(prop(pt, "found")) : dbl(prop(pt, "left"));
          if (!inLim(lim, gn, pos, v)) { anyFail = true; if (rt.equals("FoundAs")) anyFoundFail = true; }
        }
      }
    }
    String grpStatus = anyFail ? "Fail" : "Pass";

    // 1) PCNotes
    insertHash(notes, ov("NoteID", note, "DateEntered", now, "WHOENTERED", "User", "Note", str(prop(dd, "nota"))));

    // 2) CALIBRAT
    String finBy = str(prop(dd, "finalizadoPor"));
    if (finBy.isEmpty()) finBy = "User";
    LocalDateTime calDate = parseDate(prop(dd, "fecha"));
    Map<String, Object> ovCal = ov(
        "CalibrationID", cid, "STRINGID", String.valueOf(cid),
        "CalibrationDate", calDate, "WHOCALIBRATED", str(prop(dd, "por")),
        "TEMPERATURE", str(prop(dd, "temp")), "HUMIDITY", str(prop(dd, "humedad")),
        "CALIBRATIONTYPE", str(prop(dd, "tipo")), "CALIBRATIONCERTIFICATENUMBER", str(prop(dd, "certificado")),
        "NoteID", note, "DateEntered", now, "LastModified", now, "DateFinalized", now,
        "Finalized", Boolean.TRUE, "FINALIZEDBY", finBy, "ENTEREDBY", "User", "MODIFIEDBY", "User",
        "Failed", anyFail, "AsFoundFailed", anyFoundFail, "IncompleteCal", Boolean.FALSE, "DateExported", null,
        "ITEMNAME", str(prop(dd, "nombre")));
    Map<String, Object> newCal = rowHash(cal, dtCal, ovCal);
    cal.addRowFromMap(newCal);
    // la nueva calibración puede ser plantilla de otra del mismo TAG más adelante en el lote (igual que en la transacción)
    if (eqi(newCal.get("ITEMTYPE"), "Instrument") && newCal.get("ITEMCODE") instanceof String) {
      String k = ((String) newCal.get("ITEMCODE")).toLowerCase(Locale.ROOT);
      Tpl cand = new Tpl(cid, calDate);
      if (cand.beats(tplIndex.get(k))) tplIndex.put(k, cand);
    }

    Esperado esp = new Esperado();
    esp.tag = tag;
    esp.cid = cid;
    esp.note = note;
    esp.grpRows = dtGrp.size();

    // 3) CalGroups
    for (Map<String, Object> row : dtGrp) {
      int gn = intOf(row.get("GroupNumber"));
      Object jg = null;
      for (Object g : grupos) { if (toInt(prop(g, "gn")) == gn) { jg = g; break; } }
      Map<String, Object> ovG = ov("CalibrationID", cid, "ASFOUNDSTATUS", grpStatus, "ASLEFTSTATUS", grpStatus);
      if (jg != null) {
        ovG.put("Divisions", asArray(prop(jg, "puntos")).size());
        Double iLo = dbl(prop(jg, "inLow")), iHi = dbl(prop(jg, "inHigh"));
        Double oLo = dbl(prop(jg, "outLow")), oHi = dbl(prop(jg, "outHigh"));
        if (iLo != null) ovG.put("InputLowRange", iLo);
        if (iHi != null) ovG.put("InputHighRange", iHi);
        if (oLo != null) ovG.put("OutputLowRange", oLo);
        if (oHi != null) ovG.put("OutputHighRange", oHi);
      }
      grp.addRowFromMap(rowHash(grp, row, ovG));
    }

    // 4) CALDET (2 filas por punto, posiciones secuenciales)
    for (Object g : grupos) {
      int gn = toInt(prop(g, "gn"));
      Map<String, Object> tplRow = null;
      for (Map<String, Object> r : dtDet) { if (intOf(r.get("GroupNumber")) == gn) { tplRow = r; break; } }
      if (tplRow == null) {
        if (!dtDet.isEmpty()) tplRow = dtDet.get(0);
        else throw new IllegalStateException("Sin plantilla CALDET para " + tag);
      }
      int p = 0;
      for (Object pt : each(prop(g, "puntos"))) {
        p++;
        Double inNom = dbl(prop(pt, "inNom")), outNom = dbl(prop(pt, "outNom"));
        Double lo = dbl(prop(pt, "low")), hi = dbl(prop(pt, "high"));
        for (String rt : new String[] {"FoundAs", "LeftAs"}) {
          Double v = rt.equals("FoundAs") ? dbl(prop(pt, "found")) : dbl(prop(pt, "left"));
          String rs = "Pass";
          if (lo != null && hi != null && v != null && (v < lo - 1e-9 || v > hi + 1e-9)) rs = "Fail";
          Map<String, Object> o = ov("CalibrationID", cid, "GroupNumber", gn, "Position", p, "READINGTYPE", rt,
              "InputSignal", inNom, "OutputSignal", outNom, "NominalInputSignal", inNom,
              "LowLimit", lo, "HighLimit", hi, "Reading", v, "ReadingEntered", Boolean.TRUE, "RESULTSTATUS", rs);
          det.addRowFromMap(rowHash(det, tplRow, o));
          esp.detRows++;
        }
      }
    }

    // 5) CALTEST
    String comp = str(dtCal.get("COMPANYNAME"));
    List<Object> patrones = each(prop(dd, "patrones"));
    for (Object pobj : patrones) {
      List<Object> pa = each(pobj);
      Object p0 = pa.size() > 0 ? pa.get(0) : null;
      Object p5 = pa.size() > 5 ? pa.get(5) : null;
      Object p6 = pa.size() > 6 ? pa.get(6) : null;
      insertHash(tst, ov("CalibrationID", cid, "COMPANYNAME", comp, "TESTINSTRUMENTCODE", str(p0),
          "LastCalibrationDate", parseDate(p5), "NextCalibrationDate", parseDate(p6), "STATUS", "En servicio",
          "DateEntered", now, "ENTEREDBY", "User", "CountScheduleEnabled", Boolean.FALSE, "ItemCountID", 0,
          "MaxCount", 0, "LastReset", 0, "MeterValue", 0, "CalTestID", 0));
      esp.tstRows++;
    }

    // 6) Especificación
    List<String> specLog = new ArrayList<>();
    if (updateSpec) updateSpec(res, specLog, tag, grupos, spec, specGrp);
    res.esperados.add(esp);

    res.log("  OK " + tag + " -> CalibrationID=" + cid + ", NoteID=" + note + " (plantilla=" + tpl + ", grupos="
        + asArray(prop(dd, "grupos")).size() + ", patrones=" + asArray(prop(dd, "patrones")).size() + ")");
    Map<String, Object> resumen = new LinkedHashMap<>();
    resumen.put("tag", tag);
    resumen.put("calibrationId", cid);
    resumen.put("noteId", note);
    resumen.put("plantilla", tpl);
    resumen.put("grupos", grupos.size());
    resumen.put("patrones", patrones.size());
    resumen.put("resultado", anyFail ? "Fail" : "Pass");
    resumen.put("spec", specLog);
    res.calibraciones.add(resumen);
    return true;
  }

  static boolean inLim(Map<String, Double[]> lim, int gn, int pos, Double val) {
    if (val == null) return true;
    Double[] l = lim.get(gn + "|" + pos);
    if (l == null) return true;
    if (l[0] == null || l[1] == null) return true;
    return val >= l[0] - 1e-9 && val <= l[1] + 1e-9;
  }

  static void updateSpec(Resultado res, List<String> specLog, String tag, List<Object> grupos, Table spec, Table specGrp)
      throws Exception {
    for (Object g : grupos) {
      int gn = toInt(prop(g, "gn"));

      // SELECT * FROM INSTSPEC WHERE INSTRUMENTCODE=tag AND GroupNumber=gn (orden físico)
      List<Map<String, Object>> dtSpec = new ArrayList<>();
      {
        Cursor c = CursorBuilder.createCursor(spec);
        for (Row r = c.getNextRow(); r != null; r = c.getNextRow()) {
          if (eqi(r.get("INSTRUMENTCODE"), tag) && intOf(r.get("GroupNumber")) == gn) dtSpec.add(new LinkedHashMap<String, Object>(r));
        }
      }
      if (dtSpec.isEmpty()) {
        String m = "    (spec: sin INSTSPEC para grupo " + gn + " de " + tag + "; se omite la spec de ese grupo)";
        res.log(m);
        specLog.add(m.trim());
        continue;
      }
      Map<String, Object> tplSpec = dtSpec.get(0);
      List<Object> pts = asArray(prop(g, "puntos"));
      int ndiv = pts.size();
      if (ndiv < 1) continue;
      Double iLo = dbl(prop(g, "inLow"));   if (iLo == null) iLo = dbl(prop(pts.get(0), "inNom"));
      Double iHi = dbl(prop(g, "inHigh"));  if (iHi == null) iHi = dbl(prop(pts.get(ndiv - 1), "inNom"));
      Double oLo = dbl(prop(g, "outLow"));  if (oLo == null) oLo = dbl(prop(pts.get(0), "outNom"));
      Double oHi = dbl(prop(g, "outHigh")); if (oHi == null) oHi = dbl(prop(pts.get(ndiv - 1), "outNom"));

      // 1) UPDATE InstSpecGroup SET Divisions, rangos WHERE INSTRUMENTCODE=tag AND GroupNumber=gn
      {
        Cursor c = CursorBuilder.createCursor(specGrp);
        for (Row r = c.getNextRow(); r != null; r = c.getNextRow()) {
          if (!eqi(r.get("INSTRUMENTCODE"), tag) || intOf(r.get("GroupNumber")) != gn) continue;
          Map<String, Object> upd = new HashMap<String, Object>(r);
          upd.put("Divisions", ndiv);
          upd.put("InputLowRange", iLo);
          upd.put("InputHighRange", iHi);
          upd.put("OutputLowRange", oLo);
          upd.put("OutputHighRange", oHi);
          c.updateCurrentRowFromMap(upd);
        }
      }
      // 2) DELETE FROM INSTSPEC WHERE INSTRUMENTCODE=tag AND GroupNumber=gn
      {
        Cursor c = CursorBuilder.createCursor(spec);
        for (Row r = c.getNextRow(); r != null; r = c.getNextRow()) {
          if (eqi(r.get("INSTRUMENTCODE"), tag) && intOf(r.get("GroupNumber")) == gn) c.deleteCurrentRow();
        }
      }
      // 3) INSERT de los puntos del reporte copiando el resto de columnas de la fila plantilla
      int pos = 0;
      for (Object pt : pts) {
        pos++;
        Map<String, Object> o = ov("Position", pos, "InputSignal", dbl(prop(pt, "inNom")), "OutputSignal", dbl(prop(pt, "outNom")),
            "LowLimit", dbl(prop(pt, "low")), "HighLimit", dbl(prop(pt, "high")));
        spec.addRowFromMap(rowHash(spec, tplSpec, o));
      }
      res.specDelta += ndiv - dtSpec.size();
      res.specFinal.put(tag.toLowerCase(Locale.ROOT) + "|" + gn, ndiv);
      String m = "    spec actualizada: grupo " + gn + " -> " + ndiv + " puntos, entrada " + num(iLo) + ".." + num(iHi)
          + ", salida " + num(oLo) + ".." + num(oHi);
      res.log(m);
      specLog.add(m.trim());
    }
  }

  // ======================================================================================================
  // Resultado como JSON (para la página)
  // ======================================================================================================

  static String q(String s) {
    StringBuilder sb = new StringBuilder(s.length() + 2);
    q(sb, s);
    return sb.toString();
  }

  /** Escribe la cadena JSON en sb. Los tramos sin caracteres a escapar se copian de una vez (rápido en TeaVM). */
  static void q(StringBuilder sb, String s) {
    sb.append('"');
    int n = s.length(), desde = 0;
    for (int i = 0; i < n; i++) {
      char c = s.charAt(i);
      if (c >= 0x20 && c != '"' && c != '\\') continue;
      if (i > desde) sb.append(s, desde, i);
      desde = i + 1;
      switch (c) {
        case '"': sb.append("\\\""); break;
        case '\\': sb.append("\\\\"); break;
        case '\n': sb.append("\\n"); break;
        case '\r': sb.append("\\r"); break;
        case '\t': sb.append("\\t"); break;
        default: { String h = Integer.toHexString(c); sb.append("\\u"); for (int k = h.length(); k < 4; k++) sb.append('0'); sb.append(h); }
      }
    }
    if (n > desde) sb.append(s, desde, n);
    sb.append('"');
  }

  static String toJson(Object v) {
    StringBuilder sb = new StringBuilder();
    toJson(sb, v);
    return sb.toString();
  }

  /** Mismo resultado que antes, pero escribiendo todo en un único StringBuilder (sin cadenas intermedias). */
  static void toJson(StringBuilder sb, Object v) {
    if (v == null) { sb.append("null"); return; }
    if (v instanceof String) { q(sb, (String) v); return; }
    if (v instanceof Number || v instanceof Boolean) { sb.append(String.valueOf(v)); return; }
    if (v instanceof Json.Num) { sb.append(((Json.Num) v).text); return; }
    if (v instanceof Map) {
      sb.append('{');
      boolean first = true;
      for (Map.Entry<?, ?> e : ((Map<?, ?>) v).entrySet()) {
        if (!first) sb.append(',');
        first = false;
        q(sb, String.valueOf(e.getKey()));
        sb.append(':');
        toJson(sb, e.getValue());
      }
      sb.append('}');
      return;
    }
    if (v instanceof List) {
      sb.append('[');
      boolean first = true;
      for (Object o : (List<?>) v) { if (!first) sb.append(','); first = false; toJson(sb, o); }
      sb.append(']');
      return;
    }
    q(sb, String.valueOf(v));
  }

  public static String resultadoJson(Resultado r) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("ok", Boolean.TRUE);
    m.put("insertados", r.insertados);
    m.put("omitidos", r.omitidos);
    m.put("bytes", r.bytes);
    m.put("calibraciones", r.calibraciones);
    m.put("log", r.log);
    if (r.verificacion != null) m.put("verificacion", r.verificacion);
    return toJson(m);
  }

  public static String errorJson(Throwable t) {
    String msg = t.getMessage();
    if (msg == null || msg.isEmpty()) msg = t.getClass().getName();
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("ok", Boolean.FALSE);
    m.put("error", msg);
    m.put("tipo", t.getClass().getName());
    return toJson(m);
  }

  /** "yyyy-MM-ddTHH:mm:ss(.SSS)" en hora local -> LocalDateTime (con milisegundos). */
  public static LocalDateTime parseNow(String iso) {
    Matcher m = Pattern.compile("^(\\d{4})-(\\d{2})-(\\d{2})[T ](\\d{2}):(\\d{2}):(\\d{2})(?:\\.(\\d{1,3}))?$").matcher(iso.trim());
    if (!m.matches()) throw new IllegalArgumentException("Fecha/hora 'now' inválida: " + iso);
    int ms = 0;
    if (m.group(7) != null) { String f = (m.group(7) + "00").substring(0, 3); ms = Integer.parseInt(f); }
    return LocalDateTime.of(LocalDate.of(grp(m, 1), grp(m, 2), grp(m, 3)), LocalTime.of(grp(m, 4), grp(m, 5), grp(m, 6), ms * 1_000_000));
  }
}
