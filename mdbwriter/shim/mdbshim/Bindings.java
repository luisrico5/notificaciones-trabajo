package mdbshim;

import java.util.Map;

/** Solo firma (javax.script.Bindings): lo usa el motor de fórmulas, que está desactivado. */
public interface Bindings extends Map<String, Object> {
  Object put(String name, Object value);

  Object get(Object key);
}
