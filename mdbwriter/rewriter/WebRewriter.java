import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.Opcodes;
import org.objectweb.asm.commons.ClassRemapper;
import org.objectweb.asm.commons.Remapper;
import org.objectweb.asm.tree.AbstractInsnNode;
import org.objectweb.asm.tree.ClassNode;
import org.objectweb.asm.tree.FieldInsnNode;
import org.objectweb.asm.tree.InsnList;
import org.objectweb.asm.tree.InsnNode;
import org.objectweb.asm.tree.JumpInsnNode;
import org.objectweb.asm.tree.LabelNode;
import org.objectweb.asm.tree.LdcInsnNode;
import org.objectweb.asm.tree.MethodInsnNode;
import org.objectweb.asm.tree.MethodNode;
import org.objectweb.asm.tree.TypeInsnNode;

/**
 * Reescribe el bytecode de Jackcess para compilarlo a JavaScript con TeaVM sin cambiar su comportamiento
 * cuando se usa con la evaluación de fórmulas de Access DESACTIVADA (la configuración que usamos):
 *
 * 1) Tipos del JDK que TeaVM no trae se renombran a sustitutos propios (paquete mdbshim).
 * 2) Métodos del JDK que TeaVM no trae se redirigen a mdbshim.Shims.
 * 3) isEvaluateExpressions() se fija en false en cada llamada y se pliega el salto siguiente; ASM elimina
 *    el código muerto resultante (así el motor de fórmulas deja de ser alcanzable).
 * 4) Los campos de validadores/valores por defecto por fórmula, que con fórmulas desactivadas siempre son
 *    null, se leen como null y se pliegan sus comprobaciones.
 * 5) Métodos que solo tienen sentido con fórmulas o columnas calculadas (inexistentes en Jet 4) se reducen.
 *
 * Uso: java WebRewriter jackcess.jar clasesShim/ salida.jar
 */
public class WebRewriter {
  static final String J = "com/healthmarketscience/jackcess/";

  static final Map<String, String> TYPES = new HashMap<>();
  static {
    TYPES.put("java/nio/channels/FileChannel", "mdbshim/FileChannel");
    TYPES.put("java/nio/channels/FileChannel$MapMode", "mdbshim/FileChannel$MapMode");
    TYPES.put("java/nio/channels/FileLock", "mdbshim/FileLock");
    TYPES.put("java/nio/MappedByteBuffer", "mdbshim/MappedByteBuffer");
    TYPES.put("java/nio/channels/Channels", "mdbshim/Channels");
    TYPES.put("java/lang/System$Logger", "mdbshim/SysLogger");
    TYPES.put("java/lang/System$Logger$Level", "mdbshim/SysLogger$Level");
    TYPES.put("java/io/ObjectOutputStream", "mdbshim/ObjectOutputStream");
    TYPES.put("java/text/BreakIterator", "mdbshim/BreakIterator");
    TYPES.put("javax/script/Bindings", "mdbshim/Bindings");
    TYPES.put("javax/script/SimpleBindings", "mdbshim/SimpleBindings");
  }

  static String mapType(String n) {
    if (n == null) return null;
    if (n.startsWith("java/time/")) return "mdbshim/time/" + n.substring("java/time/".length());
    String m = TYPES.get(n);
    return (m != null) ? m : n;
  }

  /** owner.name+desc (originales) -> {nuevoOwner, nuevoNombre, nuevoDesc (en tipos originales)}. */
  static final Map<String, String[]> REDIRECTS = new HashMap<>();
  static {
    REDIRECTS.put("java/lang/System.getLogger(Ljava/lang/String;)Ljava/lang/System$Logger;",
        new String[] {"mdbshim/Shims", "getLogger", "(Ljava/lang/String;)Ljava/lang/System$Logger;"});
    REDIRECTS.put("java/io/File.toPath()Ljava/nio/file/Path;",
        new String[] {"mdbshim/Shims", "fileToPath", "(Ljava/io/File;)Ljava/nio/file/Path;"});
    REDIRECTS.put("java/util/TimeZone.toZoneId()Ljava/time/ZoneId;",
        new String[] {"mdbshim/Shims", "tzToZoneId", "(Ljava/util/TimeZone;)Ljava/time/ZoneId;"});
    REDIRECTS.put("java/util/TimeZone.getTimeZone(Ljava/time/ZoneId;)Ljava/util/TimeZone;",
        new String[] {"mdbshim/Shims", "tzFromZoneId", "(Ljava/time/ZoneId;)Ljava/util/TimeZone;"});
    REDIRECTS.put("java/util/Locale.forLanguageTag(Ljava/lang/String;)Ljava/util/Locale;",
        new String[] {"mdbshim/Shims", "localeForTag", "(Ljava/lang/String;)Ljava/util/Locale;"});
  }

  /** Campos que con fórmulas desactivadas siempre valen null. */
  static final String[] NULL_FIELDS = {
    J + "impl/TableImpl._rowValidator",
    J + "impl/ColumnImpl._defValue",
  };

  static int folds, nulls, redirects, bodies;

  public static void main(String[] args) throws Exception {
    File inJar = new File(args[0]);
    File shimDir = new File(args[1]);
    File outJar = new File(args[2]);

    // Jerarquía de clases para calcular marcos (frames): Jackcess + shims + JDK.
    Map<String, byte[]> jarClasses = new HashMap<>();
    List<Object[]> resources = new ArrayList<>();
    try (ZipInputStream zin = new ZipInputStream(new FileInputStream(inJar))) {
      for (ZipEntry e; (e = zin.getNextEntry()) != null; ) {
        if (e.isDirectory()) continue;
        byte[] data = readAll(zin);
        if (e.getName().endsWith(".class")) jarClasses.put(e.getName().substring(0, e.getName().length() - 6), data);
        else if (!e.getName().startsWith("META-INF/")) resources.add(new Object[] {e.getName(), data});
      }
    }
    Map<String, byte[]> shimClasses = new HashMap<>();
    Path root = shimDir.toPath();
    try (Stream<Path> s = Files.walk(root)) {
      for (Path p : (Iterable<Path>) s::iterator) {
        if (p.toString().endsWith(".class")) {
          String rel = root.relativize(p).toString().replace('\\', '/');
          shimClasses.put(rel.substring(0, rel.length() - 6), Files.readAllBytes(p));
        }
      }
    }
    final Hierarchy hier = new Hierarchy(jarClasses, shimClasses);

    try (ZipOutputStream zout = new ZipOutputStream(new FileOutputStream(outJar))) {
      for (Map.Entry<String, byte[]> en : jarClasses.entrySet()) {
        byte[] out = rewrite(en.getValue(), hier);
        zout.putNextEntry(new ZipEntry(mapType(en.getKey()) + ".class"));
        zout.write(out);
        zout.closeEntry();
      }
      for (Object[] r : resources) {
        zout.putNextEntry(new ZipEntry((String) r[0]));
        zout.write((byte[]) r[1]);
        zout.closeEntry();
      }
    }
    System.out.println("Reescrito: " + jarClasses.size() + " clases, " + resources.size() + " recursos | "
        + "pliegues isEvaluateExpressions=" + folds + " campos->null=" + nulls
        + " redirecciones=" + redirects + " cuerpos reducidos=" + bodies);
  }

  static byte[] readAll(InputStream in) throws IOException {
    ByteArrayOutputStream bo = new ByteArrayOutputStream();
    byte[] b = new byte[65536];
    for (int n; (n = in.read(b)) > 0; ) bo.write(b, 0, n);
    return bo.toByteArray();
  }

  static byte[] rewrite(byte[] classBytes, Hierarchy hier) {
    ClassNode cn = new ClassNode();
    new ClassReader(classBytes).accept(cn, ClassReader.SKIP_FRAMES);
    for (MethodNode mn : cn.methods) transformMethod(cn.name, mn);

    ClassWriter cw = new ClassWriter(ClassWriter.COMPUTE_FRAMES | ClassWriter.COMPUTE_MAXS) {
      @Override protected String getCommonSuperClass(String a, String b) { return hier.commonSuper(a, b); }
    };
    Remapper remapper = new Remapper() {
      @Override public String map(String internalName) { return WebRewriter.mapType(internalName); }
    };
    cn.accept(new ClassRemapper(cw, remapper));
    return cw.toByteArray();
  }

  static void transformMethod(String owner, MethodNode mn) {
    String sig = owner + "." + mn.name + mn.desc;

    // --- 5) cuerpos reducidos (equivalentes con fórmulas desactivadas / Jet 4) ---
    if (sig.equals(J + "impl/TableImpl$CalcColEvaluator.calculate([Ljava/lang/Object;)V")) {
      // _calcColumns siempre vacía: add() retorna antes de agregar si no hay evaluación de fórmulas.
      replaceBody(mn, ret(Opcodes.RETURN));
      return;
    }
    if (sig.equals(J + "impl/DatabaseImpl.isEvaluateExpressions()Z")
        || sig.equals(J + "impl/DatabaseImpl.getDefaultEvaluateExpressions()Z")) {
      InsnList l = new InsnList();
      l.add(new InsnNode(Opcodes.ICONST_0));
      l.add(new InsnNode(Opcodes.IRETURN));
      replaceBody(mn, l);
      return;
    }
    if (sig.equals(J + "impl/ColumnImpl$SortOrder.toString()Ljava/lang/String;")) {
      InsnList l = new InsnList();
      l.add(new LdcInsnNode("SortOrder"));
      l.add(new InsnNode(Opcodes.ARETURN));
      replaceBody(mn, l);
      return;
    }
    if (sig.startsWith(J + "impl/DatabaseImpl.getEvalContext(")) {
      replaceBody(mn, throwUOE("getEvalContext: evaluación de fórmulas desactivada"));
      return;
    }

    InsnList insns = mn.instructions;
    for (AbstractInsnNode insn = insns.getFirst(); insn != null; insn = insn.getNext()) {
      if (insn instanceof MethodInsnNode) {
        MethodInsnNode mi = (MethodInsnNode) insn;
        String key = mi.owner + "." + mi.name + mi.desc;

        // --- 3) isEvaluateExpressions() -> false, con pliegue del salto ---
        if (mi.name.equals("isEvaluateExpressions") && mi.desc.equals("()Z")
            && (mi.owner.equals(J + "impl/DatabaseImpl") || mi.owner.equals(J + "Database"))) {
          AbstractInsnNode pop = new InsnNode(Opcodes.POP);
          insns.insertBefore(mi, pop);
          AbstractInsnNode next = nextReal(mi);
          if (next instanceof JumpInsnNode && next.getOpcode() == Opcodes.IFEQ) {
            insns.set(next, new JumpInsnNode(Opcodes.GOTO, ((JumpInsnNode) next).label));
            insns.remove(mi);
            insn = pop;
          } else if (next instanceof JumpInsnNode && next.getOpcode() == Opcodes.IFNE) {
            insns.remove(next);
            insns.remove(mi);
            insn = pop;
          } else {
            InsnNode c = new InsnNode(Opcodes.ICONST_0);
            insns.set(mi, c);
            insn = c;
          }
          folds++;
          continue;
        }

        // --- 2) redirecciones a mdbshim.Shims ---
        String[] red = REDIRECTS.get(key);
        if (red != null) {
          MethodInsnNode ni = new MethodInsnNode(Opcodes.INVOKESTATIC, red[0], red[1], red[2], false);
          insns.set(mi, ni);
          insn = ni;
          redirects++;
          continue;
        }
      }

      // --- 4) campos siempre null ---
      if (insn instanceof FieldInsnNode && insn.getOpcode() == Opcodes.GETFIELD) {
        FieldInsnNode fi = (FieldInsnNode) insn;
        String fkey = fi.owner + "." + fi.name;
        boolean isNull = false;
        for (String f : NULL_FIELDS) if (f.equals(fkey)) isNull = true;
        if (isNull) {
          AbstractInsnNode pop = new InsnNode(Opcodes.POP);
          insns.insertBefore(fi, pop);
          AbstractInsnNode next = nextReal(fi);
          if (next instanceof JumpInsnNode && next.getOpcode() == Opcodes.IFNULL) {
            insns.set(next, new JumpInsnNode(Opcodes.GOTO, ((JumpInsnNode) next).label));
            insns.remove(fi);
            insn = pop;
          } else if (next instanceof JumpInsnNode && next.getOpcode() == Opcodes.IFNONNULL) {
            insns.remove(next);
            insns.remove(fi);
            insn = pop;
          } else {
            InsnNode c = new InsnNode(Opcodes.ACONST_NULL);
            insns.set(fi, c);
            insn = c;
          }
          nulls++;
          continue;
        }
      }

      // NumberFormatter.ROUND_MODE (HALF_EVEN) sin inicializar la clase del motor de fórmulas.
      if (insn instanceof FieldInsnNode && insn.getOpcode() == Opcodes.GETSTATIC) {
        FieldInsnNode fi = (FieldInsnNode) insn;
        if (fi.owner.equals(J + "impl/expr/NumberFormatter") && fi.name.equals("ROUND_MODE")) {
          FieldInsnNode ni = new FieldInsnNode(Opcodes.GETSTATIC, "java/math/RoundingMode", "HALF_EVEN", "Ljava/math/RoundingMode;");
          insns.set(fi, ni);
          insn = ni;
          redirects++;
        }
      }
    }
  }

  /** Siguiente instrucción real; si aparece una etiqueta (destino de salto) no se pliega. */
  static AbstractInsnNode nextReal(AbstractInsnNode n) {
    AbstractInsnNode x = n.getNext();
    while (x != null && (x.getType() == AbstractInsnNode.LINE || x.getType() == AbstractInsnNode.FRAME)) x = x.getNext();
    if (x instanceof LabelNode) return null;
    return x;
  }

  static InsnList ret(int opcode) {
    InsnList l = new InsnList();
    l.add(new InsnNode(opcode));
    return l;
  }

  static InsnList throwUOE(String msg) {
    InsnList l = new InsnList();
    l.add(new TypeInsnNode(Opcodes.NEW, "java/lang/UnsupportedOperationException"));
    l.add(new InsnNode(Opcodes.DUP));
    l.add(new LdcInsnNode("mdbshim: " + msg));
    l.add(new MethodInsnNode(Opcodes.INVOKESPECIAL, "java/lang/UnsupportedOperationException", "<init>", "(Ljava/lang/String;)V", false));
    l.add(new InsnNode(Opcodes.ATHROW));
    return l;
  }

  static void replaceBody(MethodNode mn, InsnList body) {
    mn.instructions.clear();
    mn.tryCatchBlocks.clear();
    if (mn.localVariables != null) mn.localVariables.clear();
    mn.instructions.add(body);
    bodies++;
  }

  /** Resuelve superclases/interfaces a partir de Jackcess, los shims y el JDK (nombres ya remapeados). */
  static final class Hierarchy {
    final Map<String, byte[]> jar;
    final Map<String, byte[]> shims;
    final Map<String, String[]> cache = new HashMap<>();   // name -> [super, isInterface(0/1), ifaces...]

    Hierarchy(Map<String, byte[]> jar, Map<String, byte[]> shims) {
      this.jar = new HashMap<>();
      for (Map.Entry<String, byte[]> e : jar.entrySet()) this.jar.put(mapType(e.getKey()), e.getValue());
      this.shims = shims;
    }

    String[] info(String name) {
      String[] c = cache.get(name);
      if (c != null) return c;
      byte[] b = jar.get(name);
      if (b == null) b = shims.get(name);
      if (b == null) {
        try (InputStream in = ClassLoader.getSystemResourceAsStream(name + ".class")) {
          if (in != null) b = readAll(in);
        } catch (IOException e) {
          throw new RuntimeException(e);
        }
      }
      if (b == null) throw new IllegalStateException("Clase no encontrada para calcular marcos: " + name);
      ClassReader cr = new ClassReader(b);
      // Los bytes de Jackcess aún tienen nombres originales en super/interfaces: se remapean aquí.
      String sup = mapType(cr.getSuperName());
      String[] ifs = cr.getInterfaces();
      String[] r = new String[2 + ifs.length];
      r[0] = sup;
      r[1] = ((cr.getAccess() & Opcodes.ACC_INTERFACE) != 0) ? "1" : "0";
      for (int i = 0; i < ifs.length; i++) r[2 + i] = mapType(ifs[i]);
      cache.put(name, r);
      return r;
    }

    boolean assignable(String to, String from) {
      if (to.equals(from)) return true;
      String[] fi = info(from);
      for (int i = 2; i < fi.length; i++) if (assignable(to, fi[i])) return true;
      return fi[0] != null && assignable(to, fi[0]);
    }

    String commonSuper(String a, String b) {
      if (assignable(a, b)) return a;
      if (assignable(b, a)) return b;
      if ("1".equals(info(a)[1]) || "1".equals(info(b)[1])) return "java/lang/Object";
      String x = a;
      do {
        x = info(x)[0];
        if (x == null) return "java/lang/Object";
      } while (!assignable(x, b));
      return x;
    }
  }
}
