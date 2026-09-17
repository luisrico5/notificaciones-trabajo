package grabarmdb;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Lector JSON mínimo (RFC 8259). Objetos -> LinkedHashMap, arreglos -> ArrayList, cadenas -> String,
 * true/false -> Boolean, null -> null, números -> Json.Num (conserva el texto literal para replicar las
 * conversiones [string]/[double]/[int] que hace PowerShell sobre los valores de ConvertFrom-Json).
 */
public final class Json {
  /** Número JSON con su texto literal. */
  public static final class Num {
    public final String text;
    Num(String text) { this.text = text; }
    public double doubleValue() { return Double.parseDouble(text); }
    @Override public String toString() { return text; }
  }

  private final String s;
  private int i;

  private Json(String s) { this.s = s; }

  public static Object parse(String text) {
    Json p = new Json(text);
    p.ws();
    // BOM UTF-8 al inicio (Get-Content lo quita; aquí también se tolera)
    if (p.i < p.s.length() && p.s.charAt(p.i) == '﻿') { p.i++; p.ws(); }
    Object v = p.value();
    p.ws();
    if (p.i != p.s.length()) throw p.err("Contenido extra después del JSON");
    return v;
  }

  private IllegalArgumentException err(String msg) {
    return new IllegalArgumentException("JSON inválido (posición " + i + "): " + msg);
  }

  private void ws() {
    while (i < s.length()) {
      char c = s.charAt(i);
      if (c == ' ' || c == '\t' || c == '\n' || c == '\r') i++; else break;
    }
  }

  private Object value() {
    if (i >= s.length()) throw err("Fin inesperado");
    char c = s.charAt(i);
    switch (c) {
      case '{': return object();
      case '[': return array();
      case '"': return string();
      case 't': lit("true"); return Boolean.TRUE;
      case 'f': lit("false"); return Boolean.FALSE;
      case 'n': lit("null"); return null;
      default:
        if (c == '-' || (c >= '0' && c <= '9')) return number();
        throw err("Carácter inesperado '" + c + "'");
    }
  }

  private void lit(String w) {
    if (!s.startsWith(w, i)) throw err("Se esperaba " + w);
    i += w.length();
  }

  private Map<String, Object> object() {
    Map<String, Object> m = new LinkedHashMap<>();
    i++; ws();
    if (i < s.length() && s.charAt(i) == '}') { i++; return m; }
    while (true) {
      ws();
      if (i >= s.length() || s.charAt(i) != '"') throw err("Se esperaba nombre de propiedad");
      String k = string();
      ws();
      if (i >= s.length() || s.charAt(i) != ':') throw err("Se esperaba ':'");
      i++; ws();
      m.put(k, value());
      ws();
      if (i >= s.length()) throw err("Fin inesperado en objeto");
      char c = s.charAt(i++);
      if (c == '}') return m;
      if (c != ',') throw err("Se esperaba ',' o '}'");
    }
  }

  private List<Object> array() {
    List<Object> l = new ArrayList<>();
    i++; ws();
    if (i < s.length() && s.charAt(i) == ']') { i++; return l; }
    while (true) {
      ws();
      l.add(value());
      ws();
      if (i >= s.length()) throw err("Fin inesperado en arreglo");
      char c = s.charAt(i++);
      if (c == ']') return l;
      if (c != ',') throw err("Se esperaba ',' o ']'");
    }
  }

  private String string() {
    StringBuilder sb = new StringBuilder();
    i++;
    while (true) {
      if (i >= s.length()) throw err("Cadena sin cerrar");
      char c = s.charAt(i++);
      if (c == '"') return sb.toString();
      if (c == '\\') {
        if (i >= s.length()) throw err("Escape incompleto");
        char e = s.charAt(i++);
        switch (e) {
          case '"': sb.append('"'); break;
          case '\\': sb.append('\\'); break;
          case '/': sb.append('/'); break;
          case 'b': sb.append('\b'); break;
          case 'f': sb.append('\f'); break;
          case 'n': sb.append('\n'); break;
          case 'r': sb.append('\r'); break;
          case 't': sb.append('\t'); break;
          case 'u':
            if (i + 4 > s.length()) throw err("Escape \\u incompleto");
            sb.append((char) Integer.parseInt(s.substring(i, i + 4), 16));
            i += 4;
            break;
          default: throw err("Escape inválido \\" + e);
        }
      } else {
        sb.append(c);
      }
    }
  }

  private Num number() {
    int st = i;
    if (s.charAt(i) == '-') i++;
    while (i < s.length()) {
      char c = s.charAt(i);
      if ((c >= '0' && c <= '9') || c == '.' || c == 'e' || c == 'E' || c == '+' || c == '-') i++; else break;
    }
    String t = s.substring(st, i);
    try {
      Double.parseDouble(t);
    } catch (NumberFormatException e) {
      throw err("Número inválido " + t);
    }
    return new Num(t);
  }
}
