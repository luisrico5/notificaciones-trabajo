package grabarmdb;

import com.healthmarketscience.jackcess.Cursor;
import com.healthmarketscience.jackcess.CursorBuilder;
import com.healthmarketscience.jackcess.Database;
import com.healthmarketscience.jackcess.DatabaseBuilder;
import com.healthmarketscience.jackcess.DateTimeType;
import com.healthmarketscience.jackcess.Row;
import com.healthmarketscience.jackcess.Table;
import com.healthmarketscience.jackcess.util.MemFileChannel;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import mdbshim.time.LocalDateTime;

/**
 * Port fiel de src/extract_ranges.ps1: lee la base DPCTrack2 y arma los datos con que la app autollena las
 * notificaciones y los reportes por defecto, con la MISMA estructura que datos_calibracion.json:
 * {version:2, generado, tags, reportes, patrones, tecnicos} + base:{nombre, ultimoId, ultimaFecha} (para no
 * retroceder a una base más vieja). Solo lectura: la base no se modifica.
 *
 * Replica la semántica de PowerShell 5.1 / Jet que afecta al resultado: claves de hashtable sin distinguir
 * mayúsculas, Trim() de .NET (espacios Unicode), NumberFormat "0.####" (es-ES) y "0.######" (invariante) sobre la
 * representación de 15 dígitos con redondeo alejado de cero, agrupaciones de texto de Jet sin distinguir
 * mayúsculas, y el regex de la indicación con \s/\d/\S de .NET.
 */
public final class Extractor {
  private Extractor() { }

  // ---------------------------------------------------------------------------------------------------------
  // Conversiones .NET / PowerShell
  // ---------------------------------------------------------------------------------------------------------

  /** char.IsWhiteSpace de .NET. */
  static boolean netWs(char c) {
    return (c >= 0x09 && c <= 0x0D) || c == 0x20 || c == 0x85 || c == 0xA0 || c == 0x1680 || (c >= 0x2000 && c <= 0x200A)
        || c == 0x2028 || c == 0x2029 || c == 0x202F || c == 0x205F || c == 0x3000;
  }

  /** String.Trim() de .NET. */
  static String netTrim(String s) {
    int a = 0, b = s.length();
    while (a < b && netWs(s.charAt(a))) a++;
    while (b > a && netWs(s.charAt(b - 1))) b--;
    return s.substring(a, b);
  }

  /** [string]$v (DBNull -> ""). */
  static String raw(Object v) {
    if (v == null) return "";
    if (v instanceof String) return (String) v;
    return String.valueOf(v);
  }

  /** Función Str del script: "" o [string]$v recortado. */
  static String str(Object v) { return netTrim(raw(v)); }

  /** Clave de hashtable de PowerShell (sin distinguir mayúsculas). */
  static String ci(String s) {
    // Equivale a toLowerCase(Locale.ROOT) carácter a carácter, pero rápido en JavaScript (TeaVM): el camino ASCII
    // no crea objetos si el texto ya está en minúsculas.
    int n = s.length(), i = 0;
    while (i < n) {
      char c = s.charAt(i);
      if ((c >= 'A' && c <= 'Z') || c >= 128) break;
      i++;
    }
    if (i == n) return s;
    char[] out = new char[n];
    s.getChars(0, n, out, 0);
    for (; i < n; i++) {
      char c = out[i];
      if (c >= 'A' && c <= 'Z') out[i] = (char) (c + 32);
      else if (c >= 128) out[i] = Character.toLowerCase(c);
    }
    return new String(out);
  }

  /** NormTag: ToUpper() y quitar todo lo que no sea A-Z / 0-9 (-replace sin distinguir mayúsculas). */
  static String normTag(String t) {
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < t.length(); i++) {
      char c = Character.toUpperCase(t.charAt(i));
      if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) sb.append(c);
    }
    return sb.toString();
  }

  static Double dbl(Object v) { return (v instanceof Number) ? ((Number) v).doubleValue() : null; }

  static final long[] P10 = {1L, 10L, 100L, 1000L, 10000L, 100000L, 1000000L, 10000000L, 100000000L, 1000000000L,
      10000000000L, 100000000000L, 1000000000000L, 10000000000000L, 100000000000000L, 1000000000000000L,
      10000000000000000L, 100000000000000000L, 1000000000000000000L};

  /**
   * Redondeo de .NET para ToString("0.###…"): el double se lleva a 15 dígitos significativos y luego se redondea a
   * 'dec' decimales alejándose de cero. Devuelve {valor sin escala con signo, escala}. Camino rápido con aritmética
   * entera sobre la representación decimal más corta del double (≤17 dígitos): BigDecimal en JavaScript (TeaVM) es
   * muy lento. Solo si los dígitos descartados al pasar a 15 son exactamente la mitad se usa la expansión exacta.
   */
  static long[] redondear(double d, int dec) {
    if (d == 0.0 || Double.isNaN(d) || Double.isInfinite(d)) return new long[] {0L, 0L};
    boolean neg = d < 0;
    // Camino directo (sin textos): y = |d|·10^dec. El paso a 15 dígitos y la multiplicación mueven y como mucho
    // y·~5e-15; si la parte fraccionaria no está dentro de ese margen de 0,5, el redondeo es el mismo.
    double y = Math.abs(d) * (double) P10[dec];
    if (y < 4.0e15) {
      double f = Math.floor(y), frac = y - f;
      double margen = y * 1e-14 + 1e-12;
      if (Math.abs(frac - 0.5) > margen) {
        long q = (long) f + ((frac > 0.5) ? 1 : 0);
        int sc = dec;
        while (q != 0 && sc > 0 && q % 10 == 0) { q /= 10; sc--; }
        if (q == 0) return new long[] {0L, 0L};
        return new long[] {neg ? -q : q, sc};
      }
    }
    String t = Double.toString(Math.abs(d));
    int exp = 0;
    int ei = t.indexOf('E');
    String m = t;
    if (ei >= 0) { exp = Integer.parseInt(t.substring(ei + 1)); m = t.substring(0, ei); }
    int dot = m.indexOf('.');
    String digits = (dot < 0) ? m : (m.substring(0, dot) + m.substring(dot + 1));
    int scale = ((dot < 0) ? 0 : (m.length() - dot - 1)) - exp;       // valor = digits × 10^-scale
    int a = 0;
    while (a < digits.length() - 1 && digits.charAt(a) == '0') a++;
    int z = digits.length();
    while (z > a + 1 && digits.charAt(z - 1) == '0') { z--; scale--; }
    digits = digits.substring(a, z);
    if (digits.equals("0")) return new long[] {0L, 0L};
    long u;
    if (digits.length() > 15) {
      if (digits.length() > 18) return redondearExacto(d, dec);
      String resto = digits.substring(15);
      boolean mitad = resto.charAt(0) == '5';
      for (int i = 1; mitad && i < resto.length(); i++) if (resto.charAt(i) != '0') mitad = false;
      if (mitad) return redondearExacto(d, dec);
      u = Long.parseLong(digits.substring(0, 15));
      if (resto.charAt(0) > '5' || resto.charAt(0) == '5') u++;
      scale -= resto.length();
    } else {
      u = Long.parseLong(digits);
    }
    if (scale > dec) {
      int drop = scale - dec;
      if (drop > 18) { u = 0; }
      else { long p = P10[drop]; long q = u / p, r = u % p; if (r * 2 >= p) q++; u = q; }
      scale = dec;
    }
    while (u != 0 && scale > 0 && u % 10 == 0) { u /= 10; scale--; }
    if (u == 0) return new long[] {0L, 0L};
    return new long[] {neg ? -u : u, scale};
  }

  static long[] redondearExacto(double d, int dec) {
    BigDecimal bd = new BigDecimal(d).round(new MathContext(15, RoundingMode.HALF_EVEN)).setScale(dec, RoundingMode.HALF_UP);
    if (bd.signum() == 0) return new long[] {0L, 0L};
    bd = bd.stripTrailingZeros();
    if (bd.scale() < 0) bd = bd.setScale(0);
    return new long[] {bd.unscaledValue().longValue(), bd.scale()};
  }

  /** Texto plano de {valor sin escala, escala} con el separador decimal dado. */
  static String texto(long[] r, char sep) {
    long u = r[0];
    int scale = (int) r[1];
    if (u == 0) return "0";
    String sgn = (u < 0) ? "-" : "";
    String digits = Long.toString(Math.abs(u));
    if (scale <= 0) {
      StringBuilder sb = new StringBuilder(sgn).append(digits);
      for (int i = 0; i < -scale; i++) sb.append('0');
      return sb.toString();
    }
    while (digits.length() <= scale) digits = "0" + digits;
    return sgn + digits.substring(0, digits.length() - scale) + sep + digits.substring(digits.length() - scale);
  }

  /** ToString("0.###…", cultura): 15 dígitos significativos, redondeo a 'dec' decimales alejado de cero. */
  static String fmt(double d, int dec, char sep) { return texto(redondear(d, dec), sep); }

  /** Num del script: número con coma decimal (es-ES) y hasta 4 decimales, o null. */
  static String num(Object v) {
    Double d = dbl(v);
    return (d == null) ? null : fmt(d, 4, ',');
  }

  /** NumInv del script: [double]("0.######" invariante), o null. */
  static Object numInv(Object v) {
    // Se devuelve el número ya como texto JSON exacto ("3.97"): escribir doubles con Double.toString es muy lento
    // en JavaScript (TeaVM). JSON.parse de ese texto da el mismo double que [double] en PowerShell.
    Double d = dbl(v);
    if (d == null) return null;
    return new Json.Num(texto(redondear(d, 6), '.'));
  }

  static String z2(int n) { return (n < 10 ? "0" : "") + n; }

  /** DateDMY: d/M/yyyy o "". */
  static String dateDMY(Object v) {
    if (!(v instanceof LocalDateTime)) return "";
    LocalDateTime t = (LocalDateTime) v;
    return t.getDayOfMonth() + "/" + t.getMonthValue() + "/" + t.getYear();
  }

  static String rango(Object lo, Object hi, Object unit) {
    String a = num(lo), b = num(hi);
    if (a == null || b == null || a.equals(b)) return "";
    String u = netTrim(raw(unit));
    String t = a + " a " + b;
    if (!u.isEmpty()) t += " " + u;
    return t;
  }

  // Regex de la indicación con las clases de .NET: \s (espacios Unicode), \S (su negación), \d (dígitos Unicode).
  static final String WS = "\\t\\n\\u000B\\f\\r \\u0085\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000";
  static final String S_ = "[" + WS + "]";
  static final String NS = "[^" + WS + "]";
  static final Pattern RE_IND = Pattern.compile("indicaci" + NS + "?n" + S_ + "+de" + S_ + "+(?:entrega" + S_ + "+)?"
      + "([-+]?\\p{Nd}+(?:[.,]\\p{Nd}+)?" + S_ + "*[^" + WS + ".,;:]{0,12})", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
  static final Pattern RE_WS = Pattern.compile(S_ + "+");

  static String indicacion(String note) {
    if (note == null) return "";
    Matcher m = RE_IND.matcher(note);
    if (m.find()) return netTrim(RE_WS.matcher(m.group(1)).replaceAll(" "));
    return "";
  }

  /** Orden de texto de Jet para ORDER BY / GROUP BY (sin distinguir mayúsculas; NULL primero). */
  static int jetCmp(String a, String b) {
    if (a == null) return (b == null) ? 0 : -1;
    if (b == null) return 1;
    return ci(a).compareTo(ci(b));
  }

  static Collection<String> cols(String... c) { return Arrays.asList(c); }

  static List<Row> leer(Table t, Collection<String> c) throws java.io.IOException {
    List<Row> out = new ArrayList<>();
    Cursor cur = CursorBuilder.createCursor(t);
    for (Row r = cur.getNextRow(c); r != null; r = cur.getNextRow(c)) out.add(r);
    return out;
  }

  // ---------------------------------------------------------------------------------------------------------
  // Extracción
  // ---------------------------------------------------------------------------------------------------------

  static final class Latest {
    int cid;
    LocalDateTime date;          // null = [datetime]::MinValue
    boolean hasDate;
    String by, temp, hum, ctype, cert;
    Integer note;
  }

  static final class Agg {
    String code, inType, outType;
    int gn;
    Double iLo, iHi, oLo, oHi;
    void add(Double i, Double o) {
      if (i != null) { iLo = (iLo == null || i < iLo) ? i : iLo; iHi = (iHi == null || i > iHi) ? i : iHi; }
      if (o != null) { oLo = (oLo == null || o < oLo) ? o : oLo; oHi = (oHi == null || o > oHi) ? o : oHi; }
    }
  }

  static int cmpDate(LocalDateTime a, LocalDateTime b) {
    if (a == null) return (b == null) ? 0 : -1;
    if (b == null) return 1;
    return a.compareTo(b);
  }

  public static Map<String, Object> extraer(Database db, String generado, String nombreBase) throws Exception {
    Table tSpec = db.getTable("INSTSPEC"), tCal = db.getTable("CALIBRAT"), tNotes = db.getTable("PCNotes"),
        tTest = db.getTable("CALTEST"), tTi = db.getTable("TESTINST"), tInst = db.getTable("INSTRMNT");
    if (tSpec == null || tCal == null || tNotes == null || tTest == null || tTi == null || tInst == null) {
      throw new IllegalStateException("La base no tiene las tablas de DPCTrack2 (INSTSPEC, CALIBRAT, PCNotes, CALTEST, TESTINST, INSTRMNT).");
    }

    // ---- INSTSPEC (una sola lectura para TAG_RANGES y TAG_REPORT) ----
    List<Row> spec = leer(tSpec, cols("INSTRUMENTCODE", "GroupNumber", "Position", "InputSignal", "INPUTSIGNALTYPE", "OutputSignal",
        "OUTPUTSIGNALTYPE", "LowLimit", "HighLimit", "STATEDACCURACY", "RangeAccuracyPct", "ReadingAccuracyPct", "PlusMinus"));

    // Grupo primario: MIN(GroupNumber) por INSTRUMENTCODE (GROUP BY de Jet sin distinguir mayúsculas).
    Map<String, Integer> grp = new HashMap<>();
    for (Row r : spec) {
      Object code = r.get("INSTRUMENTCODE");
      Object g = r.get("GroupNumber");
      if (!(code instanceof String) || !(g instanceof Number)) continue;
      String k = ci((String) code);
      int gi = ((Number) g).intValue();
      Integer cur = grp.get(k);
      if (cur == null || gi < cur) grp.put(k, gi);
    }
    // MIN/MAX de entrada y salida por (código, grupo, tipo de entrada, tipo de salida).
    Map<String, Agg> aggs = new LinkedHashMap<>();
    for (Row r : spec) {
      Object code = r.get("INSTRUMENTCODE");
      Object g = r.get("GroupNumber");
      String it = (r.get("INPUTSIGNALTYPE") instanceof String) ? (String) r.get("INPUTSIGNALTYPE") : null;
      String ot = (r.get("OUTPUTSIGNALTYPE") instanceof String) ? (String) r.get("OUTPUTSIGNALTYPE") : null;
      String c = (code instanceof String) ? (String) code : null;
      int gi = (g instanceof Number) ? ((Number) g).intValue() : Integer.MIN_VALUE;
      String key = (c == null ? "\u0000" : ci(c)) + "|" + gi + "|" + (it == null ? "\u0000" : ci(it)) + "|" + (ot == null ? "\u0000" : ci(ot));
      Agg a = aggs.get(key);
      if (a == null) { a = new Agg(); a.code = c; a.gn = gi; a.inType = it; a.outType = ot; aggs.put(key, a); }
      a.add(dbl(r.get("InputSignal")), dbl(r.get("OutputSignal")));
    }
    List<Agg> aggList = new ArrayList<>(aggs.values());
    Collections.sort(aggList, new Comparator<Agg>() {
      @Override public int compare(Agg x, Agg y) {
        int c = jetCmp(x.code, y.code); if (c != 0) return c;
        c = Integer.compare(x.gn, y.gn); if (c != 0) return c;
        c = jetCmp(x.inType, y.inType); if (c != 0) return c;
        return jetCmp(x.outType, y.outType);
      }
    });

    Map<String, Map<String, Object>> mapa = new LinkedHashMap<>();   // k (NormTag) -> {r,s,p,by,d,li}
    for (Agg a : aggList) {
      String code = raw(a.code);
      Integer pg = grp.get(ci(code));
      if (a.code == null || pg == null) continue;
      if (a.gn != pg) continue;
      String k = normTag(code);
      if (!k.isEmpty() && !mapa.containsKey(ci(k))) {
        Map<String, Object> e = new LinkedHashMap<>();
        e.put("r", rango(a.iLo, a.iHi, a.inType));
        e.put("s", rango(a.oLo, a.oHi, a.outType));
        e.put("p", new ArrayList<Object>());
        e.put("_k", k);
        mapa.put(ci(k), e);
      }
    }

    // ---- CALIBRAT: reporte más reciente por ITEMCODE ----
    int ultimoId = 0;
    LocalDateTime ultimaFecha = null;
    Map<String, Latest> latest = new LinkedHashMap<>();
    Map<String, String> latestCode = new LinkedHashMap<>();
    for (Row r : leer(tCal, cols("ITEMTYPE", "ITEMCODE", "CalibrationID", "CalibrationDate", "WHOCALIBRATED", "NoteID",
        "TEMPERATURE", "HUMIDITY", "CALIBRATIONTYPE", "CALIBRATIONCERTIFICATENUMBER"))) {
      Object cidO = r.get("CalibrationID");
      if (cidO instanceof Number) ultimoId = Math.max(ultimoId, ((Number) cidO).intValue());
      if (!GrabarMdb.eqi(r.get("ITEMTYPE"), "Instrument")) continue;
      String code = raw(r.get("ITEMCODE"));
      if (code.isEmpty()) continue;
      int cid = ((Number) cidO).intValue();
      Object dv = r.get("CalibrationDate");
      LocalDateTime d = (dv instanceof LocalDateTime) ? (LocalDateTime) dv : null;
      if (d != null && (ultimaFecha == null || d.compareTo(ultimaFecha) > 0)) ultimaFecha = d;
      Latest cur = latest.get(ci(code));
      if (cur == null || cmpDate(d, cur.date) > 0 || (cmpDate(d, cur.date) == 0 && cid > cur.cid)) {
        Latest L = new Latest();
        L.cid = cid; L.date = d; L.hasDate = (d != null);
        L.by = (r.get("WHOCALIBRATED") == null) ? "" : netTrim(raw(r.get("WHOCALIBRATED")));
        Object nid = r.get("NoteID");
        L.note = (nid instanceof Number) ? ((Number) nid).intValue() : null;
        L.temp = str(r.get("TEMPERATURE")); L.hum = str(r.get("HUMIDITY"));
        L.ctype = str(r.get("CALIBRATIONTYPE")); L.cert = str(r.get("CALIBRATIONCERTIFICATENUMBER"));
        if (cur == null) latestCode.put(ci(code), code);
        latest.put(ci(code), L);
      }
    }

    // ---- PCNotes ----
    Map<Integer, String> notes = new HashMap<>();
    for (Row r : leer(tNotes, cols("NoteID", "Note"))) {
      Object nid = r.get("NoteID");
      if (nid instanceof Number) notes.put(((Number) nid).intValue(), raw(r.get("Note")));
    }

    // ---- TESTINST (catálogo; también el LEFT JOIN de CALTEST) ----
    List<Row> tiRows = leer(tTi, cols("TESTINSTRUMENTCODE", "TESTINSTRUMENTNAME", "MANUFACTURER", "MODELNUMBER", "SERIALNUMBER",
        "LastCalibrationDate", "NextCalibrationDate"));
    Map<String, List<Row>> tiByCode = new HashMap<>();
    for (Row r : tiRows) {
      Object c = r.get("TESTINSTRUMENTCODE");
      if (!(c instanceof String)) continue;
      String k = ci((String) c);
      List<Row> l = tiByCode.get(k);
      if (l == null) { l = new ArrayList<>(); tiByCode.put(k, l); }
      l.add(r);
    }

    // ---- CALTEST LEFT JOIN TESTINST: patrones por CalibrationID ----
    Map<Integer, List<String[]>> byCid = new HashMap<>();
    Map<Integer, List<Object[]>> byCidFull = new HashMap<>();
    for (Row r : leer(tTest, cols("CalibrationID", "TESTINSTRUMENTCODE", "LastCalibrationDate", "NextCalibrationDate"))) {
      Object tc = r.get("TESTINSTRUMENTCODE");
      List<Row> matches = (tc instanceof String) ? tiByCode.get(ci((String) tc)) : null;
      List<Row> joined = (matches == null || matches.isEmpty()) ? Collections.<Row>singletonList(null) : matches;
      for (Row ti : joined) {
        int cid = ((Number) r.get("CalibrationID")).intValue();
        if (!byCid.containsKey(cid)) { byCid.put(cid, new ArrayList<String[]>()); byCidFull.put(cid, new ArrayList<Object[]>()); }
        String tag = netTrim(raw(tc));
        String name = (ti == null) ? "" : str(ti.get("TESTINSTRUMENTNAME"));
        if (!tag.isEmpty()) {
          byCid.get(cid).add(new String[] {tag, name});
          byCidFull.get(cid).add(new Object[] {tag, name, ti == null ? "" : str(ti.get("MANUFACTURER")), ti == null ? "" : str(ti.get("MODELNUMBER")),
              ti == null ? "" : str(ti.get("SERIALNUMBER")), dateDMY(r.get("LastCalibrationDate")), dateDMY(r.get("NextCalibrationDate"))});
        }
      }
    }

    // ---- TAG_RANGES: técnico, fecha, indicación y patrones del reporte más reciente ----
    for (Map.Entry<String, Latest> en : latest.entrySet()) {
      String code = latestCode.get(en.getKey());
      Latest L = en.getValue();
      String k = normTag(code);
      Map<String, Object> e = mapa.get(ci(k));
      if (e == null) {
        e = new LinkedHashMap<>();
        e.put("r", ""); e.put("s", ""); e.put("p", new ArrayList<Object>()); e.put("_k", k);
        mapa.put(ci(k), e);
      }
      e.put("by", L.by);
      e.put("d", L.hasDate ? (L.date.getYear() + "-" + z2(L.date.getMonthValue()) + "-" + z2(L.date.getDayOfMonth())) : "");
      e.put("li", (L.note != null && notes.containsKey(L.note)) ? indicacion(notes.get(L.note)) : "");
      List<String[]> ps = byCid.get(L.cid);
      if (ps != null) {
        Map<String, Boolean> seen = new HashMap<>();
        List<Object> lst = new ArrayList<>();
        for (String[] pp : ps) {
          if (!seen.containsKey(ci(pp[0]))) { seen.put(ci(pp[0]), Boolean.TRUE); lst.add(Arrays.asList((Object) pp[0], pp[1])); }
        }
        if (!lst.isEmpty()) e.put("p", lst);
      }
    }
    Map<String, Object> tags = new LinkedHashMap<>();
    List<String> tagKeys = new ArrayList<>(mapa.keySet());
    Collections.sort(tagKeys);
    for (String ck : tagKeys) {
      Map<String, Object> e = mapa.get(ck);
      if (!e.containsKey("by")) e.put("by", "");
      if (!e.containsKey("d")) e.put("d", "");
      if (!e.containsKey("li")) e.put("li", "");
      if ("".equals(e.get("r")) && "".equals(e.get("s")) && ((List<?>) e.get("p")).isEmpty() && "".equals(e.get("by"))) continue;
      Map<String, Object> o = new LinkedHashMap<>();
      o.put("r", e.get("r")); o.put("s", e.get("s")); o.put("p", e.get("p"));
      o.put("by", e.get("by")); o.put("d", e.get("d")); o.put("li", e.get("li"));
      tags.put((String) e.get("_k"), o);
    }

    // ---- TAG_REPORT ----
    Map<String, Map<String, Object>> inst = new LinkedHashMap<>();
    for (Row r : leer(tInst, cols("INSTRUMENTCODE", "INSTRUMENTNAME", "COMPANYNAME", "MANUFACTURER", "MODELNUMBER", "SERIALNUMBER",
        "STATUS", "CLASSIFICATION", "LOCATION", "BUILDING", "DEPARTMENT", "EQUIPMENTCODE"))) {
      String code = str(r.get("INSTRUMENTCODE"));
      if (code.isEmpty()) continue;
      Map<String, Object> rec = new LinkedHashMap<>();
      rec.put("tag", code); rec.put("n", str(r.get("INSTRUMENTNAME"))); rec.put("co", str(r.get("COMPANYNAME")));
      rec.put("mf", str(r.get("MANUFACTURER"))); rec.put("mo", str(r.get("MODELNUMBER"))); rec.put("sr", str(r.get("SERIALNUMBER")));
      rec.put("st", str(r.get("STATUS"))); rec.put("cl", str(r.get("CLASSIFICATION"))); rec.put("lo", str(r.get("LOCATION")));
      rec.put("bu", str(r.get("BUILDING"))); rec.put("de", str(r.get("DEPARTMENT"))); rec.put("eq", str(r.get("EQUIPMENTCODE")));
      if (inst.containsKey(ci(code))) inst.remove(ci(code));
      inst.put(ci(code), rec);
    }
    // Especificaciones ORDER BY INSTRUMENTCODE, GroupNumber, Position.
    // (claves precalculadas una vez por fila: comparar dentro del sort es lento en JavaScript)
    final class SpecOrd {
      Row r; String code; double gn, pos; boolean hasCode, hasGn, hasPos; int idx;
    }
    List<SpecOrd> specKeys = new ArrayList<>(spec.size());
    for (int i = 0; i < spec.size(); i++) {
      Row r = spec.get(i);
      SpecOrd o = new SpecOrd();
      o.r = r; o.idx = i;
      Object c = r.get("INSTRUMENTCODE"), g = r.get("GroupNumber"), p = r.get("Position");
      o.hasCode = (c != null); o.code = (c == null) ? "" : ci(raw(c));
      o.hasGn = (g instanceof Number); o.gn = o.hasGn ? ((Number) g).doubleValue() : 0;
      o.hasPos = (p instanceof Number); o.pos = o.hasPos ? ((Number) p).doubleValue() : 0;
      specKeys.add(o);
    }
    Collections.sort(specKeys, new Comparator<SpecOrd>() {
      @Override public int compare(SpecOrd x, SpecOrd y) {
        if (x.hasCode != y.hasCode) return x.hasCode ? 1 : -1;
        int c = x.code.compareTo(y.code); if (c != 0) return c;
        if (x.hasGn != y.hasGn) return x.hasGn ? 1 : -1;
        c = Double.compare(x.gn, y.gn); if (c != 0) return c;
        if (x.hasPos != y.hasPos) return x.hasPos ? 1 : -1;
        return Double.compare(x.pos, y.pos);
      }
    });
    List<Row> specOrd = new ArrayList<>(specKeys.size());
    for (SpecOrd o : specKeys) specOrd.add(o.r);
    Map<String, Map<String, Map<String, Object>>> groups = new LinkedHashMap<>();
    for (Row r : specOrd) {
      String code = str(r.get("INSTRUMENTCODE"));
      if (code.isEmpty() || !inst.containsKey(ci(code))) continue;
      int gn = ((Number) r.get("GroupNumber")).intValue();
      Map<String, Map<String, Object>> gm = groups.get(ci(code));
      if (gm == null) { gm = new LinkedHashMap<>(); groups.put(ci(code), gm); }
      Map<String, Object> g = gm.get(String.valueOf(gn));
      if (g == null) {
        g = new LinkedHashMap<>();
        g.put("gn", gn); g.put("na", ""); g.put("sa", str(r.get("STATEDACCURACY")));
        g.put("ra", numInv(r.get("RangeAccuracyPct"))); g.put("rd", numInv(r.get("ReadingAccuracyPct"))); g.put("pm", numInv(r.get("PlusMinus")));
        g.put("it", str(r.get("INPUTSIGNALTYPE"))); g.put("ot", str(r.get("OUTPUTSIGNALTYPE"))); g.put("pts", new ArrayList<Object>());
        gm.put(String.valueOf(gn), g);
      }
      @SuppressWarnings("unchecked") List<Object> pts = (List<Object>) g.get("pts");
      pts.add(Arrays.asList((Object) numInv(r.get("InputSignal")), numInv(r.get("OutputSignal")), numInv(r.get("LowLimit")), numInv(r.get("HighLimit"))));
      if ("".equals(g.get("it"))) g.put("it", str(r.get("INPUTSIGNALTYPE")));
      if ("".equals(g.get("ot"))) g.put("ot", str(r.get("OUTPUTSIGNALTYPE")));
    }
    Map<String, Object> reportes = new LinkedHashMap<>();
    Map<String, String> repKeyOrig = new HashMap<>();
    List<String> instKeys = new ArrayList<>(inst.keySet());
    ordenarCultura(instKeys);   // Sort-Object: si dos TAG se normalizan igual, gana el último
    for (String ck : instKeys) {
      // TODOS los instrumentos del maestro: los que no tienen especificación van con g=[] y el dashboard
      // les arma una plantilla con valores por defecto (editable).
      Map<String, Object> rec = inst.get(ck);
      String code = (String) rec.get("tag");
      String k = normTag(code);
      if (k.isEmpty()) continue;
      List<Map<String, Object>> gl = groups.containsKey(ck) ? new ArrayList<>(groups.get(ck).values()) : new ArrayList<Map<String, Object>>();
      Collections.sort(gl, new Comparator<Map<String, Object>>() {
        @Override public int compare(Map<String, Object> a, Map<String, Object> b) { return Integer.compare((Integer) a.get("gn"), (Integer) b.get("gn")); }
      });
      rec.put("g", gl);
      Latest L = latest.get(ci(code));
      if (L != null) {
        rec.put("ct", L.ctype); rec.put("tp", L.temp); rec.put("hu", L.hum); rec.put("ce", L.cert); rec.put("by", L.by);
        rec.put("nt", (L.note != null && notes.containsKey(L.note)) ? netTrim(notes.get(L.note)) : "");
        List<Object[]> full = byCidFull.get(L.cid);
        List<Object> lst = new ArrayList<>();
        if (full != null) {
          Map<String, Boolean> seen = new HashMap<>();
          for (Object[] pp : full) {
            String t = (String) pp[0];
            if (!seen.containsKey(ci(t))) { seen.put(ci(t), Boolean.TRUE); lst.add(Arrays.asList(pp)); }
          }
        }
        rec.put("std", lst);
      } else {
        rec.put("ct", ""); rec.put("tp", ""); rec.put("hu", ""); rec.put("ce", ""); rec.put("by", ""); rec.put("nt", "");
        rec.put("std", new ArrayList<Object>());
      }
      String kk = ci(k);
      if (repKeyOrig.containsKey(kk)) reportes.put(repKeyOrig.get(kk), rec);
      else { repKeyOrig.put(kk, k); reportes.put(k, rec); }
    }

    // ---- TEST_INSTR ----
    Map<String, Object> patrones = new LinkedHashMap<>();
    Map<String, String> tiKeyOrig = new HashMap<>();
    for (Row r : tiRows) {
      String code = str(r.get("TESTINSTRUMENTCODE"));
      if (code.isEmpty()) continue;
      List<Object> v = Arrays.asList((Object) str(r.get("TESTINSTRUMENTNAME")), str(r.get("MANUFACTURER")), str(r.get("MODELNUMBER")),
          str(r.get("SERIALNUMBER")), dateDMY(r.get("LastCalibrationDate")), dateDMY(r.get("NextCalibrationDate")));
      String kk = ci(code);
      if (tiKeyOrig.containsKey(kk)) patrones.put(tiKeyOrig.get(kk), v);
      else { tiKeyOrig.put(kk, code); patrones.put(code, v); }
    }

    // ---- TECNICOS: WHOCALIBRATED con 2+ calibraciones de instrumentos, por frecuencia ----
    final Map<String, int[]> cnt = new LinkedHashMap<>();
    final Map<String, String> tecOrig = new LinkedHashMap<>();
    for (Row r : leer(tCal, cols("ITEMTYPE", "WHOCALIBRATED"))) {
      if (!GrabarMdb.eqi(r.get("ITEMTYPE"), "Instrument")) continue;
      Object w = r.get("WHOCALIBRATED");
      if (!(w instanceof String) || ((String) w).isEmpty()) continue;
      String kk = ci((String) w);
      int[] c = cnt.get(kk);
      if (c == null) { c = new int[] {0}; cnt.put(kk, c); tecOrig.put(kk, (String) w); }
      c[0]++;
    }
    List<String> tk = new ArrayList<>(cnt.keySet());
    Collections.sort(tk, new Comparator<String>() {
      @Override public int compare(String a, String b) {
        int c = Integer.compare(cnt.get(b)[0], cnt.get(a)[0]);
        return (c != 0) ? c : a.compareTo(b);
      }
    });
    List<Object> tecnicos = new ArrayList<>();
    for (String kk : tk) {
      String nm = netTrim(tecOrig.get(kk));
      if (!nm.isEmpty() && !nm.equalsIgnoreCase("Technician") && !nm.equalsIgnoreCase("User") && cnt.get(kk)[0] >= 2) tecnicos.add(nm);
    }

    Map<String, Object> base = new LinkedHashMap<>();
    base.put("nombre", nombreBase == null ? "" : nombreBase);
    base.put("ultimoId", ultimoId);
    base.put("ultimaFecha", ultimaFecha == null ? "" : (ultimaFecha.getYear() + "-" + z2(ultimaFecha.getMonthValue()) + "-" + z2(ultimaFecha.getDayOfMonth())));

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("version", 2);
    out.put("generado", generado);
    out.put("tags", tags);
    out.put("reportes", reportes);
    out.put("patrones", patrones);
    out.put("tecnicos", tecnicos);
    out.put("base", base);
    return out;
  }

  /**
   * Orden de Sort-Object (comparación de cultura de Windows, sin distinguir mayúsculas): el guion y el apóstrofo
   * se ignoran en la primera pasada y solo desempatan, ordenándose después de las letras y dígitos.
   */
  static final Comparator<String> CULTURA = new Comparator<String>() {
    @Override public int compare(String a, String b) {
      int c = culturaPrimaria(a).compareTo(culturaPrimaria(b));
      if (c != 0) return c;
      return culturaDesempate(a).compareTo(culturaDesempate(b));
    }
  };

  /** Texto sin guiones ni apóstrofos (sin String.replace de texto: en TeaVM es muy lento). */
  static String culturaPrimaria(String s) {
    StringBuilder sb = new StringBuilder(s.length());
    for (int i = 0; i < s.length(); i++) { char c = s.charAt(i); if (c != '-' && c != '\'') sb.append(c); }
    return sb.toString();
  }

  /** Desempate: el guion y el apóstrofo se ordenan después de letras y dígitos. */
  static String culturaDesempate(String s) {
    char[] out = s.toCharArray();
    for (int i = 0; i < out.length; i++) { if (out[i] == '-') out[i] = '\uFFFF'; else if (out[i] == '\'') out[i] = '\uFFFE'; }
    return new String(out);
  }

  /** Ordena aplicando CULTURA con las claves precalculadas una vez por texto. */
  static void ordenarCultura(List<String> l) {
    final Map<String, String[]> k = new HashMap<>();
    for (String s : l) k.put(s, new String[] {culturaPrimaria(s), culturaDesempate(s)});
    Collections.sort(l, new Comparator<String>() {
      @Override public int compare(String a, String b) {
        String[] x = k.get(a), y = k.get(b);
        int c = x[0].compareTo(y[0]);
        return (c != 0) ? c : x[1].compareTo(y[1]);
      }
    });
  }

  static int cmpNum(Object a, Object b) {
    if (!(a instanceof Number)) return (b instanceof Number) ? -1 : 0;
    if (!(b instanceof Number)) return 1;
    return Double.compare(((Number) a).doubleValue(), ((Number) b).doubleValue());
  }

  /** Abre la base del canal en SOLO LECTURA y devuelve el JSON de los datos de calibración. */
  public static String extraerJson(MemFileChannel ch, String generado, String nombreBase) throws Exception {
    Database db = new DatabaseBuilder().setChannel(ch).setReadOnly(true).open();
    try {
      db.setDateTimeType(DateTimeType.LOCAL_DATE_TIME);
      return GrabarMdb.toJson(extraer(db, generado, nombreBase));
    } finally {
      try { db.close(); } catch (Exception ignore) { }
    }
  }
}
