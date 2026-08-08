// Bulk-identical devices/accessories share one batch_code across every
// unit in the batch (see add_device's p_quantity in schema.sql) — printing
// one row per physical unit would repeat the same code N times for a
// batch of N. Collapsing here means serialized devices (always a unique
// code per row) are unaffected, while a shared-code batch — whatever its
// size — collapses to a single row, with `count` carrying how many units
// it actually represents.
export function dedupeByBatchCode(devices) {
  const map = new Map();
  for (const d of devices) {
    const existing = map.get(d.batchCode);
    if (existing) existing.count += 1;
    else map.set(d.batchCode, { ...d, count: 1 });
  }
  return [...map.values()];
}
