// Pure ordering logic for the migration runner (scripts/migrate.ts), split out
// so it can be unit-tested without a database connection.

/** Keep only .sql files, in lexical (numeric-prefix) order: 001, 002, 003… */
export function orderMigrations(files: string[]): string[] {
  return files.filter((f) => f.endsWith(".sql")).sort((a, b) => a.localeCompare(b));
}

/** The ordered migrations not yet recorded in schema_migrations. */
export function pendingMigrations(files: string[], applied: Iterable<string>): string[] {
  const done = new Set(applied);
  return orderMigrations(files).filter((f) => !done.has(f));
}
