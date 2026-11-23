"use client";

import { useState, useEffect } from "react";
import Table from "./components/Table";
import Header from "../components/Header";
import { NotificationChecker } from "../components/notification-checker"

type Division = { division_id: string };
type Plant = { plant_id: string };
type Area = { area_id: string };
type Subarea = { subarea_id: string };
type Line = { line_id: string };
type Station = { station_id: string };
type MachineType = { machine_type_id: string };
type Machine = { machine_id: string };
type MachineFeature = { machine_feature: string };

type Row = {
  time_stamp: string;
  machine_feature: string;
  value: number | string;
};

const API_BASE = "http://18.119.9.9:3000/data";

export default function Log() {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [subareas, setSubareas] = useState<Subarea[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [machineTypes, setMachineTypes] = useState<MachineType[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [features, setFeatures] = useState<MachineFeature[]>([]);
  const [rows, setRows] = useState<Row[]>([]);

  const [division, setDivision] = useState("");
  const [plant, setPlant] = useState("");
  const [area, setArea] = useState("");
  const [subarea, setSubarea] = useState("");
  const [line, setLine] = useState("");
  const [station, setStation] = useState("");
  const [machineType, setMachineType] = useState("");
  const [machine, setMachine] = useState("");
  const [feature, setFeature] = useState("ALL");

  // --- Reset helper ---
  const resetBelow = (...states: any[]) => {
    states.forEach(fn => fn(""));
    setRows([]);
    setFeatures([]);
    setFeature("ALL");
  };

  // === Fetch Divisions ===
  useEffect(() => {
    fetch(`${API_BASE}/divisions`).then(r => r.json()).then(setDivisions);
  }, []);

  useEffect(() => {
    if (!division) return;
    fetch(`${API_BASE}/plants?division=${division}`).then(r => r.json()).then(setPlants);
  }, [division]);

  useEffect(() => {
    if (!division || !plant) return;
    fetch(`${API_BASE}/areas?division=${division}&plant=${plant}`)
      .then(r => r.json())
      .then(setAreas);
  }, [division, plant]);

  useEffect(() => {
    if (!division || !plant || !area) return;
    fetch(`${API_BASE}/subareas?division=${division}&plant=${plant}&area=${area}`)
      .then(r => r.json())
      .then(setSubareas);
  }, [division, plant, area]);

  useEffect(() => {
    if (!division || !plant || !area || !subarea) return;
    fetch(`${API_BASE}/lines?division=${division}&plant=${plant}&area=${area}&subarea=${subarea}`)
      .then(r => r.json())
      .then(setLines);
  }, [division, plant, area, subarea]);

  useEffect(() => {
    if (!division || !plant || !area || !subarea || !line) return;
    fetch(`${API_BASE}/stations?division=${division}&plant=${plant}&area=${area}&subarea=${subarea}&line=${line}`)
      .then(r => r.json())
      .then(setStations);
  }, [division, plant, area, subarea, line]);

  useEffect(() => {
    if (!division || !plant || !area || !subarea || !line || !station) return;
    fetch(`${API_BASE}/machine_types?division=${division}&plant=${plant}&area=${area}&subarea=${subarea}&line=${line}&station=${station}`)
      .then(r => r.json())
      .then(setMachineTypes);
  }, [division, plant, area, subarea, line, station]);

  useEffect(() => {
    if (!division || !plant || !area || !subarea || !line || !station || !machineType) return;
    fetch(`${API_BASE}/machines?division=${division}&plant=${plant}&area=${area}&subarea=${subarea}&line=${line}&station=${station}&machine_type=${machineType}`)
      .then(r => r.json())
      .then(setMachines);
  }, [division, plant, area, subarea, line, station, machineType]);

  // === Get machine features (backend only expects division, line, machine) ===
  useEffect(() => {
    if (!division || !line || !machine) return;
    fetch(`${API_BASE}/machine_features?division=${division}&line=${line}&machine=${machine}`)
      .then(r => r.json())
      .then(setFeatures);
  }, [division, line, machine]);

  // === Fetch Log Data ===
  useEffect(() => {
    if (!division || !line || !machine) return;

    const fetchData = async () => {
      let url =
        feature === "ALL"
          ? `${API_BASE}/graph_data?division_id=${division}&line_id=${line}&machine_id=${machine}`
          : `${API_BASE}/log_data?division=${division}&line=${line}&machine=${machine}&machine_feature=${feature}`;

      const res = await fetch(url);
      const json = await res.json();

      setRows(
        json.map((r: any) => ({
          time_stamp: new Date(new Date(r.time_stamp).getTime() + 5 * 3600 * 1000).toLocaleTimeString(),
          machine_feature: r.machine_feature ?? feature,
          value: r.value ?? "—"
        }))
      );
    };

    fetchData();
    const i = setInterval(fetchData, 20000);
    return () => clearInterval(i);
  }, [division, line, machine, feature]);

  const columns = [
    { key: "time_stamp", label: "Timestamp" },
    { key: "machine_feature", label: "Feature" },
    { key: "value", label: "Value" }
  ];

  return (
    <div>
      {/* === NOTIFICATION CHECKER === */}
      <NotificationChecker />

      <Header pageName="Log"/>
      <main className="w-[95%] mx-auto mt-6 bg-white p-8 rounded shadow space-y-6">

        <div className="flex flex-wrap gap-4 items-center">

          <select className="border p-2 rounded" value={division}
            onChange={e => { setDivision(e.target.value); resetBelow(setPlant, setArea, setSubarea, setLine, setStation, setMachineType, setMachine); }}>
            <option value="">-- Division --</option>
            {divisions.map(d => <option key={d.division_id}>{d.division_id}</option>)}
          </select>

          {division && (
            <select className="border p-2 rounded" value={plant}
              onChange={e => { setPlant(e.target.value); resetBelow(setArea, setSubarea, setLine, setStation, setMachineType, setMachine); }}>
              <option value="">-- Plant --</option>
              {plants.map(p => <option key={p.plant_id}>{p.plant_id}</option>)}
            </select>
          )}

          {plant && (
            <select className="border p-2 rounded" value={area}
              onChange={e => { setArea(e.target.value); resetBelow(setSubarea, setLine, setStation, setMachineType, setMachine); }}>
              <option value="">-- Area --</option>
              {areas.map(a => <option key={a.area_id}>{a.area_id}</option>)}
            </select>
          )}

          {area && (
            <select className="border p-2 rounded" value={subarea}
              onChange={e => { setSubarea(e.target.value); resetBelow(setLine, setStation, setMachineType, setMachine); }}>
              <option value="">-- Subarea --</option>
              {subareas.map(s => <option key={s.subarea_id}>{s.subarea_id}</option>)}
            </select>
          )}

          {subarea && (
            <select className="border p-2 rounded" value={line}
              onChange={e => { setLine(e.target.value); resetBelow(setStation, setMachineType, setMachine); }}>
              <option value="">-- Line --</option>
              {lines.map(l => <option key={l.line_id}>{l.line_id}</option>)}
            </select>
          )}

          {line && (
            <select className="border p-2 rounded" value={station}
              onChange={e => { setStation(e.target.value); resetBelow(setMachineType, setMachine); }}>
              <option value="">-- Station --</option>
              {stations.map(s => <option key={s.station_id}>{s.station_id}</option>)}
            </select>
          )}

          {station && (
            <select className="border p-2 rounded" value={machineType}
              onChange={e => { setMachineType(e.target.value); resetBelow(setMachine); }}>
              <option value="">-- Machine Type --</option>
              {machineTypes.map(mt => <option key={mt.machine_type_id}>{mt.machine_type_id}</option>)}
            </select>
          )}

          {machineType && (
            <select className="border p-2 rounded" value={machine}
              onChange={e => { setMachine(e.target.value); setFeature("ALL"); }}>
              <option value="">-- Machine --</option>
              {machines.map(m => <option key={m.machine_id}>{m.machine_id}</option>)}
            </select>
          )}

          {machine && (
            <select className="border p-2 rounded" value={feature} onChange={e => setFeature(e.target.value)}>
              <option value="ALL">-- All Sensors --</option>
              {features.map(f => <option key={f.machine_feature}>{f.machine_feature}</option>)}
            </select>
          )}
        </div>

        {rows.length > 0 ? <Table columns={columns} rows={rows} /> :
          <p className="text-center text-gray-500 mt-6">Select a machine or sensor to view log data.</p>}
      </main>
    </div>
  );
}
