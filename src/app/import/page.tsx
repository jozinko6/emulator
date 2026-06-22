/**
 * Import wizard page — renderuje `<ImportWizard />`.
 *
 * Per prompt sekcia ETAPA 3. Route: `/import`.
 *
 * Komentáre v slovenčine.
 */
import { ImportWizard } from "@/components/import/import-wizard";

export default function ImportPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:py-10">
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Importovať hru
        </h1>
        <p className="text-sm text-muted-foreground">
          Pridajte vlastnú záložnú kópiu hry do knižnice. Hry sa ukladajú lokálne
          do OPFS a nikdy sa neodosielajú na server.
        </p>
      </header>
      <ImportWizard />
    </div>
  );
}
