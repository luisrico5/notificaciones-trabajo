package grabarmdb;

import com.healthmarketscience.jackcess.CursorBuilder;
import com.healthmarketscience.jackcess.Database;
import com.healthmarketscience.jackcess.DatabaseBuilder;
import com.healthmarketscience.jackcess.Index;
import com.healthmarketscience.jackcess.IndexCursor;
import com.healthmarketscience.jackcess.Row;
import com.healthmarketscience.jackcess.Table;
import com.healthmarketscience.jackcess.util.MemFileChannel;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Autoverificación de la base YA grabada, antes de ofrecerla para descargar. Reabre la base desde los bytes
 * resultantes (solo lectura) y comprueba:
 *  1) conteo de filas de cada tabla tocada = conteo previo + lo insertado (y - lo borrado en INSTSPEC);
 *  2) cada índice de esas tablas se recorre completo y tiene tantas entradas como filas la tabla;
 *  3) cada fila de INSTSPEC, InstSpecGroup, CALIBRAT e IDs se encuentra buscando su clave primaria en el índice;
 *  4) cada calibración nueva está completa (CALIBRAT, PCNotes, CalGroups, CALDET, CALTEST) buscándola por índice,
 *     y la especificación de cada grupo actualizado tiene exactamente los puntos del reporte.
 * Si algo no cuadra se lanza IllegalStateException y la página NO ofrece la descarga.
 */
public final class Verificador {
  private Verificador() { }

  public static Map<String, Object> verificar(MemFileChannel ch, GrabarMdb.Resultado res) throws Exception {
    List<String> fallos = new ArrayList<>();
    int indices = 0;
    int claves = 0;
    Database db = new DatabaseBuilder().setChannel(ch).setReadOnly(true).open();
    try {
      // 1) conteos
      Map<String, Integer> delta = new HashMap<>();
      for (String t : GrabarMdb.TABLAS) delta.put(t, 0);
      for (GrabarMdb.Esperado e : res.esperados) {
        delta.put("CALIBRAT", delta.get("CALIBRAT") + 1);
        delta.put("PCNotes", delta.get("PCNotes") + 1);
        delta.put("CalGroups", delta.get("CalGroups") + e.grpRows);
        delta.put("CALDET", delta.get("CALDET") + e.detRows);
        delta.put("CALTEST", delta.get("CALTEST") + e.tstRows);
      }
      delta.put("INSTSPEC", res.specDelta);
      for (String t : GrabarMdb.TABLAS) {
        Table tb = db.getTable(t);
        int esperado = res.conteosAntes.get(t) + delta.get(t);
        int enCabecera = tb.getRowCount();
        int recorridas = 0;
        com.healthmarketscience.jackcess.Cursor c = CursorBuilder.createCursor(tb);
        while (c.moveToNextRow()) recorridas++;
        if (enCabecera != esperado || recorridas != esperado) {
          fallos.add(t + ": filas esperadas " + esperado + ", cabecera " + enCabecera + ", recorridas " + recorridas);
        }
        // 2) cada índice completo
        for (Index ix : tb.getIndexes()) {
          if (ix.shouldIgnoreNulls()) continue;
          IndexCursor ic = CursorBuilder.createCursor(ix);
          int n = 0;
          while (ic.moveToNextRow()) n++;
          indices++;
          if (n != recorridas) fallos.add(t + " índice " + ix.getName() + ": " + n + " entradas de " + recorridas + " filas");
        }
      }

      // 3) búsqueda por clave primaria de todas las filas de las tablas maestras
      for (String t : new String[] {"INSTSPEC", "InstSpecGroup", "CALIBRAT", "IDs"}) {
        Table tb = db.getTable(t);
        Index pk = tb.getPrimaryKeyIndex();
        List<String> cols = new ArrayList<>();
        for (Index.Column col : pk.getColumns()) cols.add(col.getName());
        IndexCursor seek = CursorBuilder.createCursor(pk);
        com.healthmarketscience.jackcess.Cursor c = CursorBuilder.createCursor(tb);
        int miss = 0;
        for (Row r = c.getNextRow(cols); r != null; r = c.getNextRow(cols)) {
          Object[] k = new Object[cols.size()];
          for (int i = 0; i < k.length; i++) k[i] = r.get(cols.get(i));
          claves++;
          if (!seek.findFirstRowByEntry(k)) miss++;
        }
        if (miss > 0) fallos.add(t + ": " + miss + " filas no se encuentran por su clave primaria");
      }

      // 4) calibraciones nuevas completas
      Table cal = db.getTable("CALIBRAT");
      Table notes = db.getTable("PCNotes");
      Index noteIx = indexPorPrimeraColumna(notes, "NoteID");
      for (GrabarMdb.Esperado e : res.esperados) {
        Row r = CursorBuilder.findRowByPrimaryKey(cal, e.cid);
        if (r == null || !GrabarMdb.eqi(r.get("ITEMCODE"), e.tag)) fallos.add(e.tag + ": no se encuentra CALIBRAT " + e.cid);
        if (noteIx != null) {
          if (!CursorBuilder.createCursor(noteIx).findFirstRowByEntry(e.note)) fallos.add(e.tag + ": no se encuentra la nota " + e.note);
        } else if (!existe(notes, "NoteID", e.note)) {
          fallos.add(e.tag + ": no se encuentra la nota " + e.note);
        }
        contarPrefijo(db, "CalGroups", e.cid, e.grpRows, e.tag, fallos);
        contarPrefijo(db, "CALDET", e.cid, e.detRows, e.tag, fallos);
        contarPrefijo(db, "CALTEST", e.cid, e.tstRows, e.tag, fallos);
      }
      if (!res.specFinal.isEmpty()) {
        Map<String, Integer> vistos = new HashMap<>();
        Table spec = db.getTable("INSTSPEC");
        Collection<String> cols = java.util.Arrays.asList("INSTRUMENTCODE", "GroupNumber");
        com.healthmarketscience.jackcess.Cursor c = CursorBuilder.createCursor(spec);
        for (Row r = c.getNextRow(cols); r != null; r = c.getNextRow(cols)) {
          Object code = r.get("INSTRUMENTCODE");
          if (!(code instanceof String)) continue;
          String k = ((String) code).toLowerCase(Locale.ROOT) + "|" + GrabarMdb.intOf(r.get("GroupNumber"));
          if (res.specFinal.containsKey(k)) vistos.put(k, (vistos.containsKey(k) ? vistos.get(k) : 0) + 1);
        }
        for (Map.Entry<String, Integer> en : res.specFinal.entrySet()) {
          int n = vistos.containsKey(en.getKey()) ? vistos.get(en.getKey()) : 0;
          if (n != en.getValue()) fallos.add("INSTSPEC " + en.getKey() + ": " + n + " puntos, se esperaban " + en.getValue());
        }
      }
    } finally {
      try { db.close(); } catch (Exception ignore) { }
    }
    if (!fallos.isEmpty()) {
      throw new IllegalStateException("La verificación de la base grabada falló: " + String.join(" | ", fallos));
    }
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("ok", Boolean.TRUE);
    m.put("tablas", GrabarMdb.TABLAS.length);
    m.put("indices", indices);
    m.put("clavesBuscadas", claves);
    return m;
  }

  static Index indexPorPrimeraColumna(Table t, String col) {
    for (Index ix : t.getIndexes()) {
      List<? extends Index.Column> cs = ix.getColumns();
      if (!cs.isEmpty() && cs.get(0).getName().equalsIgnoreCase(col) && !ix.shouldIgnoreNulls()) return ix;
    }
    return null;
  }

  static boolean existe(Table t, String col, int v) throws java.io.IOException {
    for (Row r : t) { if (GrabarMdb.intOf(r.get(col)) == v) return true; }
    return false;
  }

  static void contarPrefijo(Database db, String t, int cid, int esperado, String tag, List<String> fallos) throws java.io.IOException {
    IndexCursor ic = CursorBuilder.createPrimaryKeyCursor(db.getTable(t));
    int n = 0;
    for (Row r : ic.newEntryIterable(cid)) n++;
    if (n != esperado) fallos.add(tag + ": " + t + " tiene " + n + " filas de la calibración " + cid + ", se esperaban " + esperado);
  }
}
