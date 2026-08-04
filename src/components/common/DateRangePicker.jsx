import { useState, useRef, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import { Calendar } from "lucide-react";
import "react-day-picker/style.css";

function formatRangeLabel(range) {
  if (!range?.from) return "All dates";
  const opts = { month: "short", day: "numeric", year: "numeric" };
  if (!range.to || range.to.getTime() === range.from.getTime()) {
    return range.from.toLocaleDateString("en-US", opts);
  }
  return `${range.from.toLocaleDateString("en-US", opts)} – ${range.to.toLocaleDateString("en-US", opts)}`;
}

// Single trigger that opens a calendar where clicking a day and dragging to
// another selects the whole span as one from/to range, instead of two
// separate date inputs staff have to keep in sync by hand. Shared across
// every list page in the app that filters by a date range.
function DateRangePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 pl-8 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500 relative"
      >
        <Calendar size={14} className="absolute left-3 text-gray-400" />
        <span className={value?.from ? "text-gray-700" : "text-gray-400"}>{formatRangeLabel(value)}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-md z-20 p-2">
          <DayPicker
            mode="range"
            selected={value}
            onSelect={onChange}
            numberOfMonths={1}
          />
          {value?.from && (
            <div className="flex justify-end px-2 pb-1">
              <button
                type="button"
                onClick={() => onChange(undefined)}
                className="text-xs text-blue-600 hover:underline"
              >
                Clear dates
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DateRangePicker;
