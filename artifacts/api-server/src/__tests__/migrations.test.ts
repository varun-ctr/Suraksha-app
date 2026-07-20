import { test } from "node:test";
import assert from "node:assert/strict";

import { orderMigrations, pendingMigrations } from "../lib/migrations.ts";

test("orderMigrations keeps only .sql files in numeric-prefix order", () => {
  const files = ["003_cleanup_jobs.sql", "001_a.sql", "README.md", "002_b.sql", ".DS_Store"];
  assert.deepEqual(orderMigrations(files), ["001_a.sql", "002_b.sql", "003_cleanup_jobs.sql"]);
});

test("pendingMigrations excludes already-applied files, preserving order", () => {
  const files = ["001_a.sql", "002_b.sql", "003_c.sql"];
  assert.deepEqual(pendingMigrations(files, ["001_a.sql"]), ["002_b.sql", "003_c.sql"]);
  assert.deepEqual(pendingMigrations(files, ["001_a.sql", "002_b.sql", "003_c.sql"]), []);
});

test("pendingMigrations returns all when nothing is applied", () => {
  const files = ["002_b.sql", "001_a.sql"];
  assert.deepEqual(pendingMigrations(files, []), ["001_a.sql", "002_b.sql"]);
});

test("applied names not present on disk are ignored (no crash)", () => {
  assert.deepEqual(pendingMigrations(["001_a.sql"], ["000_gone.sql"]), ["001_a.sql"]);
});
