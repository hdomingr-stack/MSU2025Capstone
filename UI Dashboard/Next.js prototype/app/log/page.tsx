"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import Table from "./components/Table";

// === Types ===
type Sensor = { name: string; temp: string; vib: string; cur: string };
type Machine = { name: string; failure: number; sensors: Sensor[] };
type DepartmentData = { lines: Record<string, Machine[]> };

type Row = {
  timestamp: string;
  temperature: string | number;
  vibration: string | number;
  machine_id: string;
  rul_cycles: number | string;
  confidence: number | string;
};

// === Initial Dummy Structure ===
const initialData: Record<string, DepartmentData> = {
  dept1: {
    lines: {
      line1: [
        {
          name: "Machine 1",
          failure: 79,
          sensors: [
            { name: "Sensor 1", temp: "Bad", vib: "Ok", cur: "Good" },
          ],
        },
        {
          name: "Machine 2",
          failure: 42,
          sensors: [
            { name: "Sensor 1", temp: "Good", vib: "Good", cur: "Ok" },
          ],
        },
      ],
    },
  },
  dept2: {
    lines: {
      line1: [
        {
          name: "Machine 3",
          failure: 64,
          sensors: [
            { name: "Sensor 1", temp: "Ok", vib: "Ok", cur: "Good" },
          ],
        },
      ],
    },
  },
  dept3: { lines: {} },
};

export default function Log() {
    const [data, setData] = useState<Record<string, DepartmentData>>(initialData);
    const [dept, setDept] = useState<string>("");
    const [line, setLine] = useState<string>("");
    const [machineIndex, setMachineIndex] = useState<number | null>(null);


    const selectedMachine: Machine | null =
    dept && line && machineIndex !== null
      ? data[dept]?.lines[line]?.[machineIndex] ?? null
      : null;


    const columns = [
        { key: 'timestamp', label: 'Timestamp' },
        { key: 'temperature', label: 'Temperature' },
        { key: 'vibration', label: 'Vibration' },
        { key: 'machine_id', label: 'Machine ID' },
        { key: 'rul_cycles', label: 'RUL Cycles' },
        { key: 'confidence', label: 'Confidence' },
    ];

    const [rows, setRows] = useState<Row[]>([
    {
      timestamp: "—",
      temperature: "—",
      vibration: "—",
      machine_id: "—",
      rul_cycles: "—",
      confidence: "—",
    },
    ]);

     // === Fetch data from backend ===
      useEffect(() => {
        const fetchData = async () => {
          if(!selectedMachine) {
            return;
          }
    
          const MACHINE_ID = selectedMachine.name;
    
          try {
            // const res = await fetch('http://18.119.9.9:3000/data/sensor_data')
            const res = await fetch(`http://18.119.9.9:3000/data/sensor_data_2?machine_id=${MACHINE_ID}`);
            if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
            const json = await res.json();
            setRows(json);
            console.log("Fetched sensor data:", json);
            } catch (err) {
            console.error("Error fetching sensor data:", err);
            }
        };
    
        fetchData();
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, []);

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
            href="/taskboard"
            className="bg-blue-500 px-3 py-1 rounded hover:bg-blue-600"
            >
            Taskboard
            </Link>
        </div>
      </header>

        {/* === BODY === */}
        {/* Dropdowns */}
        <div className="flex gap-4">
          <select
            className="border border-black p-2 rounded"
            value={dept}
            onChange={(e) => {
              setDept(e.target.value);
              setLine("");
              setMachineIndex(null);
            }}
          >
            <option value="">-- Choose Department --</option>
            {Object.keys(data).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {dept && (
            <select
              className="border border-black p-2 rounded"
              value={line}
              onChange={(e) => {
                setLine(e.target.value);
                setMachineIndex(null);
              }}
            >
              <option value="">-- Choose Line --</option>
              {Object.keys(data[dept].lines).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          )}

          {line && (
            <select
              className="border border-black p-2 rounded"
              value={machineIndex ?? ""}
              onChange={(e) => setMachineIndex(Number(e.target.value))}
            >
              <option value="">-- Choose Machine --</option>
              {data[dept].lines[line].map((m: Machine, i: number) => (
                <option key={i} value={i}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="table-container">
            <table>
                <Table columns= {columns} rows={rows} />
                
            </table>
        </div>
    </div>
  );
}
