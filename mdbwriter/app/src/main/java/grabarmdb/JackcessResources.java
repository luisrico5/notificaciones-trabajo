package grabarmdb;

import org.teavm.classlib.ResourceSupplier;
import org.teavm.classlib.ResourceSupplierContext;

/** Empaqueta en el JavaScript las tablas de ordenación de texto que Jackcess usa para los índices de Jet 4. */
public class JackcessResources implements ResourceSupplier {
  @Override
  public String[] supplyResources(ResourceSupplierContext context) {
    return new String[] {
      "com/healthmarketscience/jackcess/index_codes_genleg.txt",
      "com/healthmarketscience/jackcess/index_codes_ext_genleg.txt"
    };
  }
}
