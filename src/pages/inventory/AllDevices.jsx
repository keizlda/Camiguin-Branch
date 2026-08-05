import { useState, useEffect, useCallback, useMemo } from "react";
import { PackagePlus, Printer } from "lucide-react";
import InventoryStats from "../../components/inventory/InventoryStats";
import FilterBar from "../../components/inventory/FilterBar";
import DeviceTable from "../../components/inventory/DeviceTable";
import BulkOrderShipmentTable from "../../components/inventory/BulkOrderShipmentTable";
import ShipmentUnitsModal from "../../components/inventory/ShipmentUnitsModal";
import DeviceDetailsModal from "../../components/inventory/DeviceDetailsModal";
import EditDeviceModal from "../../components/inventory/EditDeviceModal";
import LogShipmentArrivalModal from "../../components/inventory/LogShipmentArrivalModal";
import PendingShipmentsCard from "../../components/inventory/PendingShipmentsCard";
import PrintLabelsModal from "../../components/inventory/PrintLabelsModal";
import { getDeviceKind } from "../../utils/deviceKind";
import { useServiceData } from "../../hooks/useServiceData";
import { getAllDevices, getLowStockItems, deleteDevice } from "../../services/inventoryService";
import { getPendingShellsWithProgress, getAllShellsWithProgress } from "../../services/bulkOrderShellsService";
import { useToast } from "../../hooks/useToast";

function AllDevices() {
  const showToast = useToast();
  const lowStockItems = useServiceData(getLowStockItems, []);

  const [allDevices, setAllDevices] = useState([]);
  const loadDevices = useCallback(() => {
    getAllDevices().then(setAllDevices);
  }, []);
  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const [filters, setFilters] = useState({
    search: "",
    category: "All",
    status: "All",
    storage: "All",
    kind: "All",
    supplier: "All",
    condition: "All",
    bulkShipmentOnly: false,
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [viewDevice, setViewDevice] = useState(null);
  const [editDevice, setEditDevice] = useState(null);
  const [showLogShipment, setShowLogShipment] = useState(false);

  const [pendingShells, setPendingShells] = useState([]);
  const loadPendingShells = useCallback(() => {
    getPendingShellsWithProgress().then(setPendingShells);
  }, []);
  useEffect(() => {
    loadPendingShells();
  }, [loadPendingShells]);

  const [allShells, setAllShells] = useState([]);
  const loadAllShells = useCallback(() => {
    getAllShellsWithProgress().then(setAllShells);
  }, []);
  useEffect(() => {
    loadAllShells();
  }, [loadAllShells]);

  const [shipmentGroup, setShipmentGroup] = useState(null);

  // Batch label printing — checked rows survive filter changes (a filter
  // narrows what's shown, not what's still selected), so filtering down to
  // "today" then selecting all doesn't lose earlier picks if the filter
  // changes again before printing.
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [printDevices, setPrintDevices] = useState(null);

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = (visibleDevices) => {
    setSelectedIds((prev) => {
      const allSelected = visibleDevices.every((d) => prev.has(d.id));
      const next = new Set(prev);
      for (const d of visibleDevices) {
        if (allSelected) next.delete(d.id);
        else next.add(d.id);
      }
      return next;
    });
  };

  const handlePrintSelected = () => {
    setPrintDevices(allDevices.filter((d) => selectedIds.has(d.id)));
  };

  const handleShipmentLogged = () => {
    setShowLogShipment(false);
    loadPendingShells();
    loadAllShells();
    showToast("Shipment logged. Link each unit to it from Add Device as they're entered.");
  };

  const handleEditSaved = () => {
    setEditDevice(null);
    loadDevices();
    loadPendingShells();
    loadAllShells();
  };

  const handleDelete = async (device) => {
    const warning =
      device.status === "Sold"
        ? `Delete ${device.batchCode} — ${device.device}? This unit is Sold — its sale record will be removed too. This cannot be undone.`
        : `Delete ${device.batchCode} — ${device.device}? This cannot be undone.`;
    if (!window.confirm(warning)) return;
    try {
      await deleteDevice(device.id);
      loadDevices();
      loadPendingShells();
      loadAllShells();
    } catch (err) {
      showToast(err.message || "Failed to delete device. Please try again.", "error");
    }
  };

  const handleClear = () => {
    const cleared = {
      search: "",
      category: "All",
      status: "All",
      storage: "All",
      kind: "All",
      supplier: "All",
      condition: "All",
      bulkShipmentOnly: false,
    };
    setFilters(cleared);
    setAppliedFilters(cleared);
  };

  const kinds = useMemo(() => {
    return [...new Set(allDevices.map((d) => getDeviceKind(d.device)))].sort();
  }, [allDevices]);

  const filtered = useMemo(() => {
    return allDevices.filter((d) => {
      const f = appliedFilters;
      const matchesSearch =
        !f.search ||
        d.batchCode.toLowerCase().includes(f.search.toLowerCase()) ||
        d.device.toLowerCase().includes(f.search.toLowerCase());
      return (
        matchesSearch &&
        (f.category === "All" || d.category === f.category) &&
        (f.status === "All" || d.status === f.status) &&
        (f.storage === "All" || d.storage === f.storage) &&
        (f.kind === "All" || getDeviceKind(d.device) === f.kind) &&
        (f.supplier === "All" || d.supplier === f.supplier) &&
        (f.condition === "All" || d.condition === f.condition) &&
        (!f.bulkShipmentOnly || !!d.bulkOrderShellId)
      );
    });
  }, [appliedFilters, allDevices]);

  // One group per bulk_order_shell_id (a shell already represents one
  // supplier's shipment on one day) — only meaningful once the "Bulk
  // shipment units only" filter has narrowed the list down to linked units.
  const shellsById = useMemo(() => new Map(allShells.map((s) => [s.id, s])), [allShells]);
  const shipmentGroups = useMemo(() => {
    const byShell = new Map();
    for (const d of filtered) {
      if (!d.bulkOrderShellId) continue;
      if (!byShell.has(d.bulkOrderShellId)) byShell.set(d.bulkOrderShellId, []);
      byShell.get(d.bulkOrderShellId).push(d);
    }
    return Array.from(byShell.entries())
      .map(([shellId, units]) => {
        const shell = shellsById.get(shellId);
        return {
          shellId,
          supplierName: shell?.supplierName || units[0].supplier,
          deviceName: shell?.deviceName || units[0].device,
          storage: shell?.storage || units[0].storage,
          color: shell?.color,
          dateArrived: shell?.dateArrived ? shell.dateArrived.slice(0, 10) : units[0].dateAdded,
          quantityExpected: shell?.quantityExpected,
          status: shell?.status,
          units,
        };
      })
      .sort((a, b) => new Date(b.dateArrived) - new Date(a.dateArrived));
  }, [filtered, shellsById]);

  const stats = {
    total: allDevices.length,
    available: allDevices.filter((d) => d.status === "Available").length,
    reserved: allDevices.filter((d) => d.status === "Reserved").length,
    defective: allDevices.filter((d) => d.status === "Supplier Defective").length,
    returned: allDevices.filter((d) => d.status === "Returned" || d.status === "Customer Returned").length,
    lowStock: lowStockItems.length,
  };

  return (
    <>
    {/* print:hidden on this wrapper (not further out) keeps PrintLabelsModal's
        own print-only label sheet — rendered as a true sibling below, outside
        this div — from being hidden by an ancestor's display:none. Without
        this, the whole page would print alongside the labels instead of
        being suppressed. */}
    <div className="space-y-4 print:hidden">
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        onApply={() => setAppliedFilters(filters)}
        onClear={handleClear}
        kinds={kinds}
      />

      <InventoryStats {...stats} />

      <PendingShipmentsCard shells={pendingShells} />

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="font-medium text-gray-800">Devices List</p>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <button
                onClick={handlePrintSelected}
                className="flex items-center gap-2 text-sm text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50"
              >
                <Printer size={14} />
                Print Labels ({selectedIds.size})
              </button>
            )}
            <button
              onClick={() => setShowLogShipment(true)}
              className="flex items-center gap-2 text-sm text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
            >
              <PackagePlus size={14} />
              Log Shipment Arrival
            </button>
          </div>
        </div>

        {appliedFilters.bulkShipmentOnly ? (
          <BulkOrderShipmentTable groups={shipmentGroups} onViewUnits={setShipmentGroup} />
        ) : (
          <DeviceTable
            devices={filtered}
            onView={setViewDevice}
            onEdit={setEditDevice}
            onDelete={handleDelete}
            onPrintLabel={(device) => setPrintDevices([device])}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
          />
        )}
      </div>

      {shipmentGroup && (
        <ShipmentUnitsModal
          group={shipmentGroup}
          onClose={() => setShipmentGroup(null)}
          onView={(unit) => {
            setShipmentGroup(null);
            setViewDevice(unit);
          }}
        />
      )}

      {viewDevice && <DeviceDetailsModal device={viewDevice} onClose={() => setViewDevice(null)} />}

      {editDevice && (
        <EditDeviceModal device={editDevice} onClose={() => setEditDevice(null)} onSaved={handleEditSaved} />
      )}

      {showLogShipment && (
        <LogShipmentArrivalModal onClose={() => setShowLogShipment(false)} onCreated={handleShipmentLogged} />
      )}
    </div>

    {printDevices && (
      <PrintLabelsModal devices={printDevices} onClose={() => setPrintDevices(null)} />
    )}
    </>
  );
}

export default AllDevices;