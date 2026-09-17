package mdbshim;

import java.util.HashMap;

/** Solo firma (javax.script.SimpleBindings): lo usa el motor de fórmulas, que está desactivado. */
public class SimpleBindings extends HashMap<String, Object> implements Bindings {
  public SimpleBindings() {}
}
