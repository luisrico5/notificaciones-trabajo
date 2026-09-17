import com.healthmarketscience.jackcess.Database;
import com.healthmarketscience.jackcess.DatabaseBuilder;
import com.healthmarketscience.jackcess.Row;
import com.healthmarketscience.jackcess.Table;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.lang.reflect.Method;
import java.nio.ByteBuffer;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Mismo escenario de escritura para comparar Jackcess ORIGINAL (parcheado) vs REESCRITO para el navegador (byte a byte).
 * Compilar: javac --release 11 -cp work/lib/jackcess-5.0.0-patched.jar -d work/test test/EquivTest.java
 * Original:  java -Dcom.healthmarketscience.jackcess.enableExpressionEvaluation=false
 *              -cp work/lib/jackcess-5.0.0-patched.jar;work/test EquivTest base.mdb salida_original.mdb TAG
 * Reescrito: java -cp work/lib/jackcess-web.jar;work/lib/mdbshim.jar;work/test EquivTest base.mdb salida_web.mdb TAG
 * Las dos salidas deben ser idénticas byte a byte (cmp). Usar siempre una COPIA editable, nunca la _backup.
 * Canal en memoria y LocalDateTime por reflexión (el tipo difiere entre ambas variantes).
 */
public class EquivTest {
  static Class<?> ldtClass;

  static Object ldt(int y, int m, int d, int h, int mi, int s) throws Exception {
    return ldtClass.getMethod("of", int.class, int.class, int.class, int.class, int.class, int.class).invoke(null, y, m, d, h, mi, s);
  }

  static int maxOf(Table t, String col) {
    int m = 0;
    for (Row r : t) { Object v = r.get(col); if (v instanceof Number) m = Math.max(m, ((Number) v).intValue()); }
    return m;
  }

  public static void main(String[] a) throws Exception {
    try { ldtClass = Class.forName("mdbshim.time.LocalDateTime"); } catch (ClassNotFoundException e) { ldtClass = Class.forName("java.time.LocalDateTime"); }
    System.out.println("variante: " + (ldtClass.getName().startsWith("mdbshim") ? "REESCRITO" : "ORIGINAL"));
    byte[] data = Files.readAllBytes(new File(a[0]).toPath());
    String tag = a[2];

    Class<?> mfc = Class.forName("com.healthmarketscience.jackcess.util.MemFileChannel");
    Object ch = mfc.getMethod("newChannel").invoke(null);
    mfc.getMethod("write", ByteBuffer.class, long.class).invoke(ch, ByteBuffer.wrap(data), 0L);
    DatabaseBuilder b = new DatabaseBuilder();
    for (Method m : DatabaseBuilder.class.getMethods()) if (m.getName().equals("setChannel")) m.invoke(b, ch);
    Database db = b.setReadOnly(false).setAutoSync(false).open();
    System.out.println("evaluateExpressions=" + db.isEvaluateExpressions());

    Table cal = db.getTable("CALIBRAT"), grp = db.getTable("CalGroups"), det = db.getTable("CALDET"), tst = db.getTable("CALTEST"),
        notes = db.getTable("PCNotes"), spec = db.getTable("INSTSPEC"), sgrp = db.getTable("InstSpecGroup"), ids = db.getTable("IDs");

    Row tpl = null;
    for (Row r : cal) {
      if ("Instrument".equalsIgnoreCase((String) r.get("ITEMTYPE")) && tag.equalsIgnoreCase((String) r.get("ITEMCODE"))) {
        if (tpl == null || ((Integer) r.get("CalibrationID")) > ((Integer) tpl.get("CalibrationID"))) tpl = r;
      }
    }
    int tplId = (Integer) tpl.get("CalibrationID");
    int cid = maxOf(cal, "CalibrationID") + 1, note = maxOf(notes, "NoteID") + 1;
    Object when = ldt(2026, 9, 16, 14, 30, 5);
    Object fecha = ldt(2026, 9, 3, 0, 0, 0);

    StringBuilder longNote = new StringBuilder();
    for (int i = 0; i < 120; i++) longNote.append("Línea ").append(i).append(": nota LARGA con acentos áéíóú ñ y °C.\r\n");
    Map<String, Object> n = new HashMap<>();
    n.put("NoteID", note); n.put("DateEntered", when); n.put("WHOENTERED", "User"); n.put("Note", longNote.toString());
    notes.addRowFromMap(n);

    Map<String, Object> c = new HashMap<>(tpl);
    c.put("CalibrationID", cid); c.put("STRINGID", String.valueOf(cid)); c.put("NoteID", note);
    c.put("CalibrationDate", fecha); c.put("DateEntered", when); c.put("LastModified", when); c.put("DateFinalized", when);
    c.put("WHOCALIBRATED", "PRUEBA EQUIVALENCIA"); c.put("CALIBRATIONCERTIFICATENUMBER", "EQ-" + cid); c.put("TEMPERATURE", "25"); c.put("HUMIDITY", "50");
    c.put("Failed", Boolean.FALSE); c.put("DateExported", null);
    cal.addRowFromMap(c);

    for (Row r : grp) {
      if (((Integer) r.get("CalibrationID")) == tplId) {
        Map<String, Object> m = new HashMap<>(r); m.put("CalibrationID", cid); m.put("Divisions", 5); m.put("OutputHighRange", 20.0d);
        grp.addRowFromMap(m);
      }
    }
    List<Map<String, Object>> ds = new ArrayList<>();
    for (Row r : det) if (((Integer) r.get("CalibrationID")) == tplId) { Map<String, Object> m = new HashMap<>(r); m.put("CalibrationID", cid); ds.add(m); }
    Map<String, Object> tplDet = ds.get(0);
    for (int p = 1; p <= 5; p++) {
      for (String rt : new String[] {"FoundAs", "LeftAs"}) {
        Map<String, Object> m = new HashMap<>(tplDet);
        double inNom = (p - 1) * 25.0, outNom = 4.0 + (p - 1) * 4.0;
        m.put("GroupNumber", 1); m.put("Position", p); m.put("READINGTYPE", rt);
        m.put("InputSignal", inNom); m.put("OutputSignal", outNom); m.put("NominalInputSignal", inNom);
        m.put("LowLimit", outNom - 0.16); m.put("HighLimit", outNom + 0.16); m.put("Reading", outNom + 0.001 * p);
        m.put("ReadingEntered", Boolean.TRUE); m.put("RESULTSTATUS", "Pass");
        det.addRowFromMap(m);
      }
    }
    for (Row r : tst) {
      if (((Integer) r.get("CalibrationID")) == tplId) {
        Map<String, Object> m = new HashMap<>(r); m.put("CalibrationID", cid); m.put("DateEntered", when); m.put("LastCalibrationDate", fecha);
        tst.addRowFromMap(m);
      }
    }
    List<Row> del = new ArrayList<>(); List<Map<String, Object>> keep = new ArrayList<>();
    for (Row r : spec) if (tag.equalsIgnoreCase((String) r.get("INSTRUMENTCODE"))) { keep.add(new HashMap<>(r)); del.add(r); }
    for (Row r : del) spec.deleteRow(r);
    Map<String, Object> tplSpec = keep.get(0);
    for (int p = 1; p <= 5; p++) {
      Map<String, Object> m = new HashMap<>(tplSpec);
      double inNom = (p - 1) * 25.0, outNom = 4.0 + (p - 1) * 4.0;
      m.put("Position", p); m.put("InputSignal", inNom); m.put("OutputSignal", outNom); m.put("LowLimit", outNom - 0.16); m.put("HighLimit", outNom + 0.16);
      spec.addRowFromMap(m);
    }
    for (Row r : sgrp) if (tag.equalsIgnoreCase((String) r.get("INSTRUMENTCODE"))) { r.put("Divisions", 5); r.put("OutputHighRange", 20.0d); sgrp.updateRow(r); }
    for (Row r : ids) {
      if ("CALIBRAT".equals(r.get("TABLENAME"))) { r.put("LastID", cid); ids.updateRow(r); }
      if ("PCNOTES".equals(r.get("TABLENAME"))) { r.put("LastID", note); ids.updateRow(r); }
    }
    db.flush();

    long size = (Long) mfc.getMethod("size").invoke(ch);
    byte[] out = new byte[(int) size];
    ByteBuffer bb = ByteBuffer.wrap(out);
    long pos = 0;
    Method rd = mfc.getMethod("read", ByteBuffer.class, long.class);
    while (bb.hasRemaining()) { int k = (Integer) rd.invoke(ch, bb, pos); if (k <= 0) break; pos += k; }
    Files.write(new File(a[1]).toPath(), out);
    System.out.println("OK plantilla=" + tplId + " CalibrationID=" + cid + " NoteID=" + note + " caldet=10 spec=5 bytes=" + out.length);
    db.close();
  }
}
