"use client";

import { useState, useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import Image from "next/image";
import Link from "next/link";

// === Types ===
type Sensor = { name: string; temp: string; vib: string };
type Machine = { name: string; sensors: Sensor[] };
type DivisionData = { lines: Record<string, Machine[]> };

// === Initial Dummy Structure ===
const initialData: Record<string, DivisionData> = {
  division1: {
    lines: {
      line1: [
        {
          name: "Machine1",
          sensors: [{ name: "Sensor 1", temp: "Bad", vib: "Ok" }],
        },
        {
          name: "Machine2",
          sensors: [{ name: "Sensor 1", temp: "Good", vib: "Good" }],
        },
      ],
    },
  },
  division2: {
    lines: {
      line1: [
        {
          name: "Machine3",
          sensors: [{ name: "Sensor 1", temp: "Ok", vib: "Ok" }],
        },
      ],
    },
  },
  division3: { lines: {} },
};

export default function Dashboard() {
  const [division, setDivision] = useState<string>("");
  const [line, setLine] = useState<string>("");
  const [machineIndex, setMachineIndex] = useState<number | null>(null);
  const [expandedSensor, setExpandedSensor] = useState<string | null>(null);

  // Chart Refs
  const tempRef = useRef<HTMLCanvasElement | null>(null);
  const vibRef = useRef<HTMLCanvasElement | null>(null);

  const tempChartRef = useRef<Chart | null>(null);
  const vibChartRef = useRef<Chart | null>(null);

  // Rolling history for plots
  const historyRef = useRef({
    temp: [] as number[],
    vib: [] as number[],
  });
  const timestampsRef = useRef<string[]>([]);

  const selectedMachine: Machine | null =
    division && line && machineIndex !== null
      ? initialData[division]?.lines[line]?.[machineIndex] ?? null
      : null;

  // === Reset chart data when switching machines ===
  useEffect(() => {
    historyRef.current.temp = [];
    historyRef.current.vib = [];
    timestampsRef.current = [];

    // Destroy existing charts (avoid data overlap)
    if (tempChartRef.current) {
      tempChartRef.current.destroy();
      tempChartRef.current = null;
    }
    if (vibChartRef.current) {
      vibChartRef.current.destroy();
      vibChartRef.current = null;
    }
  }, [selectedMachine]);

  // === Fetch data from backend ===
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedMachine) return;

      const MACHINE_ID = selectedMachine.name.replace(/\s+/g, "");

      try {
        const res = await fetch(
          `http://18.119.9.9:3000/data/sensor_data_2?machine_id=${MACHINE_ID}`
        );
        if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
        const json = await res.json();
        if (!Array.isArray(json) || json.length === 0) return;

        // Get latest sensor values
        const latest = json[json.length - 1];
        const temperature = Number(latest.temperature);
        const vibration = Number(latest.vibration);
        const rawTimestamp = latest.timestamp;
        const now = new Date(rawTimestamp).toLocaleTimeString();

        // Update rolling history (max 20 points)
        historyRef.current.temp = [...historyRef.current.temp, temperature].slice(-20);
        historyRef.current.vib = [...historyRef.current.vib, vibration].slice(-20);
        timestampsRef.current = [...timestampsRef.current, now].slice(-20);

        renderCharts();
      } catch (err) {
        console.error("Error fetching sensor data:", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [selectedMachine]);

  // === Chart rendering ===
  const renderCharts = () => {
    const renderChart = (
      ref: React.RefObject<HTMLCanvasElement | null>,
      chartRef: React.MutableRefObject<Chart | null>,
      label: string,
      values: number[],
      timestamps: string[],
      color: string
    ) => {
      if (!ref.current) return;
      if (chartRef.current) chartRef.current.destroy();

      chartRef.current = new Chart(ref.current, {
        type: "line",
        data: {
          labels: timestamps,
          datasets: [
            {
              label,
              data: values,
              borderWidth: 2,
              borderColor: color,
              pointRadius: 3,
            },
          ],
        },
        options: {
          responsive: true,
          animation: false, // disables sliding/vibrating transitions
          transitions: { active: { animation: { duration: 0 } } }, // just in case
          plugins: { legend: { display: true } },
          scales: {
            x: { title: { display: true, text: "Time" } },
            y: { title: { display: true, text: label } },
          },
        },
      });
    };

    renderChart(
      tempRef,
      tempChartRef,
      "Temperature (°C)",
      historyRef.current.temp,
      timestampsRef.current,
      "red"
    );
    renderChart(
      vibRef,
      vibChartRef,
      "Vibration (Hz)",
      historyRef.current.vib,
      timestampsRef.current,
      "green"
    );
  };

  return (
    <div>
      {/* Header */}
      <header className="flex items-center justify-between bg-slate-900 text-white p-4">
        <div className="flex items-center gap-2">
          <Link href="/dashboard">
            <Image src="/logo.png" alt="Company Logo" width={80} height={80} />
          </Link>
          <h1 className="text-xl font-bold">Machine Dashboard</h1>
        </div>
        <Link
          href="/taskboard"
          className="bg-blue-500 px-3 py-1 rounded hover:bg-blue-600"
        >
          Taskboard
        </Link>
      </header>

      {/* Main Section */}
      <main className="w-[95%] mx-auto mt-6 bg-white p-8 rounded shadow space-y-6">
        {/* Dropdowns */}
        <div className="flex gap-4">
          <select
            className="border border-black p-2 rounded"
            value={division}
            onChange={(e) => {
              setDivision(e.target.value);
              setLine("");
              setMachineIndex(null);
              setExpandedSensor(null);
            }}
          >
            <option value="">-- Choose Division --</option>
            {Object.keys(initialData).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {division && (
            <select
              className="border border-black p-2 rounded"
              value={line}
              onChange={(e) => {
                setLine(e.target.value);
                setMachineIndex(null);
                setExpandedSensor(null);
              }}
            >
              <option value="">-- Choose Line --</option>
              {Object.keys(initialData[division].lines).map((l) => (
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
              onChange={(e) => {
                setMachineIndex(Number(e.target.value));
                setExpandedSensor(null);
              }}
            >
              <option value="">-- Choose Machine --</option>
              {initialData[division].lines[line].map((m: Machine, i: number) => (
                <option key={i} value={i}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Machine & Sensor Accordion */}
        {selectedMachine && (
          <div className="mt-4 p-6 border rounded bg-gray-50 shadow">
            <h2 className="text-lg font-semibold mb-4">
              {selectedMachine.name}
            </h2>

            {selectedMachine.sensors.map((s, i) => (
              <div key={i} className="border rounded mb-4">
                <button
                  className="w-full flex justify-between items-center bg-slate-200 p-3 font-medium"
                  onClick={() =>
                    setExpandedSensor(expandedSensor === s.name ? null : s.name)
                  }
                >
                  <span>{s.name}</span>
                  <span>{expandedSensor === s.name ? "▲" : "▼"}</span>
                </button>

                {expandedSensor === s.name && (
                  <div className="p-4 bg-white border-t">
                    {/* Conditions */}
                    <div className="grid grid-cols-2 gap-6 mb-6">
                      <div>
                        <p className="font-bold">Temperature Condition:</p>
                        <span
                          className={
                            s.temp === "Good"
                              ? "text-green-600 font-semibold"
                              : s.temp === "Ok"
                              ? "text-yellow-600 font-semibold"
                              : "text-red-600 font-semibold"
                          }
                        >
                          {s.temp}
                        </span>
                      </div>
                      <div>
                        <p className="font-bold">Vibration Condition:</p>
                        <span
                          className={
                            s.vib === "Good"
                              ? "text-green-600 font-semibold"
                              : s.vib === "Ok"
                              ? "text-yellow-600 font-semibold"
                              : "text-red-600 font-semibold"
                          }
                        >
                          {s.vib}
                        </span>
                      </div>
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-2 gap-6">
                      <div className="bg-white p-4 rounded shadow">
                        <canvas ref={tempRef}></canvas>
                      </div>
                      <div className="bg-white p-4 rounded shadow">
                        <canvas ref={vibRef}></canvas>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}