"use client";

import Image from "next/image";
import Link from "next/link";

// === Expanded Dataset (filled out for prettier layout) ===
const initialData = {
  dept1: {
    lines: {
      line1: [
        { name: "Machine 1", failure: 79 },
        { name: "Machine 2", failure: 42 },
        { name: "Machine 3", failure: 55 },
        { name: "Machine 4", failure: 23 },
      ],
      line2: [
        { name: "Machine 5", failure: 68 },
        { name: "Machine 6", failure: 37 },
        { name: "Machine 7", failure: 49 },
        { name: "Machine 8", failure: 15 },
      ],
    },
  },
  dept2: {
    lines: {
      line1: [
        { name: "Machine 9", failure: 64 },
        { name: "Machine 10", failure: 30 },
        { name: "Machine 11", failure: 45 },
        { name: "Machine 12", failure: 70 },
      ],
      line2: [
        { name: "Machine 13", failure: 85 },
        { name: "Machine 14", failure: 33 },
        { name: "Machine 15", failure: 60 },
        { name: "Machine 16", failure: 28 },
      ],
    },
  },
  dept3: {
    lines: {
      line1: [
        { name: "Machine 17", failure: 20 },
        { name: "Machine 18", failure: 74 },
        { name: "Machine 19", failure: 52 },
        { name: "Machine 20", failure: 41 },
      ],
      line2: [
        { name: "Machine 21", failure: 65 },
        { name: "Machine 22", failure: 39 },
        { name: "Machine 23", failure: 80 },
        { name: "Machine 24", failure: 47 },
      ],
    },
  },
};

export default function Taskboard() {
  const getCondition = (failure: number) => {
    if (failure >= 75) return "Critical";
    if (failure >= 50) return "Risky";
    return "Good";
  };

  return (
    <div>
      {/* === HEADER === */}
      <header className="flex items-center justify-between bg-slate-900 text-white p-4">
        <div className="flex items-center gap-2">
          <Link href="/dashboard">
            <Image src="/logo.png" alt="Company Logo" width={40} height={40} />
          </Link>
          <h1 className="text-xl font-bold">Machine Taskboard</h1>
        </div>
        <Link
          href="/dashboard"
          className="bg-blue-500 px-3 py-1 rounded hover:bg-blue-600"
        >
          Dashboard
        </Link>
      </header>

      {/* === TASKBOARD CONTENT === */}
      <main className="max-w-[95%] mx-auto mt-6 bg-white p-6 rounded shadow">
        {/* Departments side-by-side */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(initialData).map(([dept, deptData]) => (
            <div key={dept} className="border rounded p-4 bg-gray-50">
              <h2 className="font-bold text-lg mb-4">{dept}</h2>
              {Object.entries(deptData.lines).map(([line, machines]) => (
                <div key={line} className="mb-6">
                  <h3 className="font-semibold mb-3">{line}</h3>
                  {/* Machines displayed left-to-right inside each dept */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {machines.map((m, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded text-white shadow ${
                          m.failure >= 75
                            ? "bg-red-600"
                            : m.failure >= 50
                            ? "bg-yellow-500"
                            : "bg-green-600"
                        }`}
                      >
                        <p className="font-bold">{m.name}</p>
                        <p>{getCondition(m.failure)}</p>
                        <p>Failure: {m.failure}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
