import "./Table.css";

interface Column {
  key: string;
  label: string;
}

// Allow flexible dynamic access
interface Row {
  id?: number;
  timestamp?: string;
  temperature?: string | number;
  vibration?: string | number;
  machine_id?: string;
  rul_cycles?: number | string;
  confidence?: number | string;
  [key: string]: string | number | undefined;
}

interface TableProps {
  columns: Column[];
  rows: Row[];
}

const Table: React.FC<TableProps> = ({ columns, rows }) => {
  const getRulClass = (rul: string | number | undefined) => {
    const val = Number(rul);
    if (isNaN(val)) return "";
    if (val <= 4.5) return "bg-red-600 text-white font-semibold";
    if (val <= 4.75) return "bg-yellow-400 text-black font-semibold";
    return "bg-green-600 text-white font-semibold";
  };

  return (
    <table className="w-full border-collapse border border-gray-400 text-center">
      <thead className="bg-slate-200">
        <tr>
          {columns.map((col) => (
            <th key={col.key} className="border border-gray-400 p-2">
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, idx) => (
          <tr key={idx} className="hover:bg-gray-100">
            {columns.map((col) => {
              const value = r[col.key] ?? "—";
              return (
                <td
                  key={col.key}
                  className={`border border-gray-300 p-2 ${
                    col.key === "rul_cycles" ? getRulClass(value) : ""
                  }`}
                >
                  {value}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default Table;
