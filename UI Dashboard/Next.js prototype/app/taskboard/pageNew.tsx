"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

// === Types ===
type Sensor = { name: string; temp: string; vib: string; cur: string };
type Machine = { name: string; failure: number; sensors: Sensor[] };
type DepartmentData = { lines: Record<string, Machine[]> };

// === Expanded Dataset (filled out for prettier layout) ===
const initialData = {
  division1: {
    lines: {
      line1: [
        { name: "Machine 1", failure: 4 },
        { name: "Machine 2", failure: 5 },
        { name: "Machine 3", failure: 5 },
        { name: "Machine 4", failure: 2 },
      ],
      line2: [
        { name: "Machine 5", failure: 1 },
        { name: "Machine 6", failure: 0 },
        { name: "Machine 7", failure: 2 },
        { name: "Machine 8", failure: 3 },
      ],
    },
  },
  division2: {
    lines: {
      line1: [
        { name: "Machine 9", failure: 4 },
        { name: "Machine 10", failure: 7 },
        { name: "Machine 11", failure: 6 },
        { name: "Machine 12", failure: 5 },
      ],
      line2: [
        { name: "Machine 13", failure: 1 },
        { name: "Machine 14", failure: 4 },
        { name: "Machine 15", failure: 3 },
        { name: "Machine 16", failure: 5 },
      ],
    },
  },
  division3: {
    lines: {
      line1: [
        { name: "Machine 17", failure: 2 },
        { name: "Machine 18", failure: 4 },
        { name: "Machine 19", failure: 5 },
        { name: "Machine 20", failure: 4 },
      ],
      line2: [
        { name: "Machine 21", failure: 5 },
        { name: "Machine 22", failure: 3 },
        { name: "Machine 23", failure: 0 },
        { name: "Machine 24", failure: 4 },
      ],
    },
  },
};

export default function Taskboard() {

  const [dept, setDept] = useState<"all" | keyof typeof initialData>("all");

  const getCondition = (failure: number) => {
    if (failure <= 2) return "Critical";
    if (failure <= 4) return "Risky";
    return "Good";
  };

  const departmentFilter = Object.entries(initialData).filter(
    ([deptKey]) => dept === "all" || deptKey === dept
  );

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
        <div className="flex items-center gap-3">
            <Link
            href="/dashboard"
            className="bg-blue-500 px-3 py-1 rounded hover:bg-blue-600"
            >
            Dashboard
            </Link>
            <Link
            href="/log"
            className="bg-blue-500 px-3 py-1 rounded hover:bg-blue-600"
            >
            Log
            </Link>
        </div>
      </header>

      {/* === TASKBOARD CONTENT === */}
      <main className="max-w-[95%] mx-auto mt-6 bg-white p-6 rounded shadow">
        {/* Dropdown */}
        <div className="flex gap-4">
          <select
            className="border border-black p-2 rounded"
            value={dept}
            onChange={(e) => {
              setDept(e.target.value as "all" | keyof typeof initialData);
            }}
          >
            <option value="all">All</option>
            {Object.keys(initialData).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          </div>
        {/* Departments side-by-side */}
        <div className={
            dept === "all"
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              : "grid grid-cols-1 md:grid-cols-2 gap-6"
          }
          >
          {departmentFilter.map(([deptKey, deptObj]) => (
            <div key={deptKey} className="border rounded p-4 bg-gray-50">
              <h2 className="font-bold text-lg mb-4">{deptKey}</h2>
              {Object.entries(deptObj.lines).map(([line, machines]) => (
                <div key={line} className="mb-6">
                  <h3 className="font-semibold mb-3">{line}</h3>
                  {/* Machines displayed left-to-right inside each dept */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {machines.map((m, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded text-white shadow ${
                          m.failure <= 2
                            ? "bg-red-600"
                            : m.failure <= 4
                            ? "bg-yellow-500"
                            : "bg-green-600"
                        }`}
                      >
                        <p className="font-bold">{m.name}</p>
                        <p>{getCondition(m.failure)}</p>
                        <p>RUL: {m.failure}</p>
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
