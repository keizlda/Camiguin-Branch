import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

function InventoryDonut({ data }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex-1">
      <p className="text-sm text-gray-500 mb-4">Inventory by Category</p>

      <div className="flex items-center gap-6">
        <div className="relative w-40 h-40 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={2}
              >
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.color} stroke="none" />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-xl font-bold text-gray-800">{total}</p>
            <p className="text-xs text-gray-400">Total Units</p>
          </div>
        </div>

        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-gray-700">{item.name}</span>
              <span className="text-gray-400 text-xs">
                {item.value} ({item.percent}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default InventoryDonut;