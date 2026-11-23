"use client";

import Header from "../components/Header";
import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import Chart from "chart.js/auto";
import Image from "next/image";
import Link from "next/link";
import { NotificationChecker } from "../components/notification-checker"

import { useSearchParams } from "next/navigation";
import { render } from "@react-email/render";

type Division = { division_id: string };
type Plant = { plant_id: string };
type Area = { area_id: string };
type Subarea = { subarea_id: string };
type Line = { line_id: string };
type Station = { station_id: string };
type MachineType = { machine_type_id: string };
type Machine = { machine_id: string };

type MachineFeature = {
  time_stamp: string;
  machine_feature: string;
  value: string | number;
};

type ModelOutput = {
  time_stamp: string;
  machine_features: string | string[];
  model_output_value: number;
};

interface FeatureStatistics {
  machine_feature: string;
  mean: number;
  std_dev: number;
  upper_bound: number;
  lower_bound: number;
  sample_count: number;
}

type RangeKey = "default" | "one_day" | "three_days" | "week" | "extended";

const API_BASE = "http://18.119.9.9:3000/data";
const baseRoot2 = "http://18.119.9.9:4000";

export default function Dashboard() {

  const searchParams = useSearchParams();

  const initialDivision = searchParams.get('division') || "";
  const initialPlant = searchParams.get('plant') || "";
  const initialArea = searchParams.get('area') || "";
  const initialSubarea = searchParams.get('subarea') || "";
  const initialLine = searchParams.get('line') || "";
  const initialStation = searchParams.get('station') || "";
  const initialMachineType = searchParams.get('machine_type') || "";
  const initialMachine = searchParams.get('name') || "";

  const { data: session } = useSession();
  const loggedInUser = session?.user?.email || "";
  const [isAdmin, setIsAdmin] = useState(false);

  const [division, setDivision] = useState("");
  const [plant, setPlant] = useState("");
  const [area, setArea] = useState("");
  const [subarea, setSubarea] = useState("");
  const [line, setLine] = useState("");
  const [station, setStation] = useState("");
  const [machineType, setMachineType] = useState("");
  const [machine, setMachine] = useState("");

  useEffect(() => {
    if (
      initialDivision &&
      initialPlant &&
      initialArea &&
      initialSubarea &&
      initialLine &&
      initialStation &&
      initialMachineType &&
      initialMachine
    ) {
      setDivision(initialDivision);
      setPlant(initialPlant);
      setArea(initialArea);
      setSubarea(initialSubarea);
      setLine(initialLine);
      setStation(initialStation);
      setMachineType(initialMachineType);
      setMachine(initialMachine);
    }
  }, [initialDivision, initialPlant, initialArea, initialSubarea, initialLine, initialStation, initialMachineType, initialMachine]);

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [subareas, setSubareas] = useState<Subarea[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [machineTypes, setMachineTypes] = useState<MachineType[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);

  const [features, setFeatures] = useState<string[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [range, setRange] = useState<RangeKey>("default");
  const [modelOutput, setModelOutput] = useState<ModelOutput | null>(null);

  const [featureStatistics, setStatistics] = useState<Record<string, FeatureStatistics>>({});
  const [rul, setRul] = useState<number | null>(null);

  const chartRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const chartInstances = useRef<Record<string, Chart | null>>({});
  const historyRefs = useRef<Record<string, { timestamps: string[]; values: number[] }>>({});

  const storageKey =
    `selectedFeatures_${division}_${plant}_${area}_${subarea}_${line}_${station}_${machineType}_${machine}`;

  useEffect(() => {
    if (!loggedInUser) {
      setIsAdmin(false);
      return;
    }

    const fetchAdminList = async () => {
      try {
        const res = await fetch(`${API_BASE}/read_from_admin_list`);
        if (!res.ok) {
          console.error("Failed to fetch admin list");
          setIsAdmin(false);
          return;
        }

        const data = await res.json();
        const emails = (data || []).map(
          (row: { email?: string }) => (row.email || "").toLowerCase()
        );

        setIsAdmin(emails.includes(loggedInUser.toLowerCase()));
      } catch (err) {
        console.error("Error fetching admin list:", err);
        setIsAdmin(false);
      }
    };

    fetchAdminList();
  }, [loggedInUser]);

  useEffect(() => {
    if (!machine) return;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setSelectedFeatures(JSON.parse(saved));
      } catch {}
    }
  }, [storageKey, machine]);

  useEffect(() => {
    if (!machine) return;
    localStorage.setItem(storageKey, JSON.stringify(selectedFeatures));
  }, [selectedFeatures, storageKey, machine]);

  const hardResetBelow = () => {
    setPlant("");
    setArea("");
    setSubarea("");
    setLine("");
    setStation("");
    setMachineType("");
    if (machine) localStorage.removeItem(storageKey);
    setMachine("");
    setFeatures([]);
    setSelectedFeatures([]);
    setModelOutput(null);
    setRul(null);
    setStatistics({});
  };

  useEffect(() => {
    fetch(`${API_BASE}/divisions`).then(r => r.json()).then(setDivisions).catch(console.error);
  }, []);

  useEffect(() => {
    if (!division) return;
    fetch(`${API_BASE}/plants?division=${division}`).then(r => r.json()).then(setPlants);
  }, [division]);

  useEffect(() => {
    if (!division || !plant) return;
    fetch(`${API_BASE}/areas?division=${division}&plant=${plant}`).then(r => r.json()).then(setAreas);
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

  useEffect(() => {
    if (!division || !line || !machine) return;

    const endpointMap: Record<RangeKey, string> = {
      default: "graph_data_one_day",
      one_day: "graph_data_one_day",
      three_days: "graph_data_three_days",
      week: "graph_data_week",
      extended: "graph_data_extended",
    };

    const fetchData = async () => {
      const endpoint = endpointMap[range];
      const res = await fetch(`${API_BASE}/${endpoint}?division_id=${division}&line_id=${line}&machine_id=${machine}`);
      const json: MachineFeature[] = await res.json();

      const grouped: Record<string, MachineFeature[]> = {};
      json.forEach(row => {
        (grouped[row.machine_feature] ||= []).push(row);
      });

      const featureNames = Object.keys(grouped);
      setFeatures(featureNames);

      featureNames.forEach(f => {
        const readings = grouped[f].slice().reverse();
        historyRefs.current[f] = {
          timestamps: readings.map(r =>
            new Date(new Date(r.time_stamp).getTime() + 5 * 60 * 60 * 1000).toLocaleTimeString()
          ),
          values: readings.map(r => Number(r.value)),
        };
      });

      // featureNames.forEach((f, idx) => setTimeout(() => renderChart(f, idx), 0));
    };

    fetchData();
    const interval = setInterval(fetchData, 20000);
    return () => clearInterval(interval);
  }, [division, line, machine, range]);

  // Fetch Statistics of machine
  useEffect(() => {
    if (!division || !plant || !area || !subarea || !line || !station || !machineType || !machine) return;

    const fetchStatistics = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/feature_statistics?division=${division}&plant=${plant}&area=${area}&subarea=${subarea}&line=${line}&station=${station}&machine_type=${machineType}&machine_id=${machine}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const stats = await res.json();

        // Convert array to lookup object keyed by machine_feature
        const statsMap = stats.reduce((acc: any, stat: any) => {
          acc[stat.machine_feature] = {
            ...stat,
            mean: Number(stat.mean),
            std_dev: Number(stat.std_dev),
            upper_bound: Number(stat.upper_bound),
            lower_bound: Number(stat.lower_bound),
            sample_count: Number(stat.sample_count),
          } as FeatureStatistics;
          return acc;
        }, {} as Record<string, FeatureStatistics>);

        setStatistics(statsMap);
      } catch (err) {
        console.error("Error fetching statistics:", err);
        setStatistics({});
      }
    };

    fetchStatistics();
  }, [division, plant, area, subarea, line, station, machineType, machine]);

  // useEffect(() => {
  //   Object.keys(featureStatistics).forEach((feature, idx) => {
  //     setTimeout(() => renderChart(feature, idx), 0);
  //   });
  // }, [featureStatistics]);

  useEffect(() => {
    if (features.length === 0) return;

    features.forEach((f, idx) => {
      setTimeout(() => renderChart(f, idx), 0);
    });
  }), [features, featureStatistics, range];

  useEffect(() => {
    if (!division || !line || !machine) return;
    const fetchMO = async () => {
      const res = await fetch(
        `${API_BASE}/model_output?division=${division}&line=${line}&machine=${machine}`
      );
      const json = await res.json();
      if (json.length > 0) setModelOutput(json[0]);
    };
    fetchMO();
    const i = setInterval(fetchMO, 20000);
    return () => clearInterval(i);
  }, [division, line, machine]);

  useEffect(() => {
    if (!division || !plant || !area || !subarea || !line || !station || !machineType || !machine) return;

    const fetchRUL = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/rul?division=${division}&plant=${plant}&area=${area}&subarea=${subarea}&line=${line}&station=${station}&machine_type=${machineType}&machine=${machine}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (Array.isArray(json) && json.length > 0 && json[0]?.rul != null) {
          setRul(Number(json[0].rul));
        } else {
          setRul(null);
        }
      } catch (e) {
        console.error("Error fetching RUL:", e);
        setRul(null);
      }
    };

    fetchRUL();
    const i = setInterval(fetchRUL, 20000);
    return () => clearInterval(i);
  }, [division, plant, area, subarea, line, station, machineType, machine]);

  const renderChart = (feature: string, index: number) => {
    const ref = chartRefs.current[feature];
    if (!ref) return;

    if (chartInstances.current[feature]) {
      chartInstances.current[feature]!.destroy();
    }

    const hist = historyRefs.current[feature];
    if (!hist) return;

    const stats = featureStatistics[feature];

    const ub = stats?.upper_bound;
    const lb = stats?.lower_bound;

    const values = hist.values;
    const minY = Math.min(...values, lb ?? Infinity);
    const maxY = Math.max(...values, ub ?? -Infinity);
    const buffer = (maxY - minY) * 0.1 || 1;

    const datasets: any[] = [];

    if (Number.isFinite(ub)) {
      datasets.push({
        label: "Upper Bound",
        data: Array(hist.timestamps.length).fill(ub),
        borderColor: "#3b3a3a",
        borderDash: [10, 5],
        pointRadius: 0,
        fill: false,
      });
    }

    if (Number.isFinite(lb)) {
      datasets.push({
        label: "Lower Bound",
        data: Array(hist.timestamps.length).fill(lb),
        borderColor: "#3b3a3a",
        borderDash: [10, 5],
        pointRadius: 0,
        fill: false,
      });
    }

    datasets.push({
      label: feature,
      data: values,
      borderColor: ["#ef4444", "#22c55e", "#3b82f6", "#facc15"][index % 4],
      borderWidth: 2,
      pointRadius: 2,
      tension: 0.3,
    });

    chartInstances.current[feature] = new Chart(ref, {
      type: "line",
      data: {
        labels: hist.timestamps,
        datasets,
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            suggestedMin: minY - buffer,
            suggestedMax: maxY + buffer,
          },
        },
      },
    });
  };

  const toggleFeatureSelection = (feature: string) => {
    setSelectedFeatures(prev =>
      prev.includes(feature) ? prev.filter(f => f !== feature) : [...prev, feature]
    );
  };

  const sendSelectedFeatures = async () => {
    if (!session || selectedFeatures.length === 0 || !isAdmin) return;
    const user_id = (session as any)?.user?.id;
    if (!user_id) return;

    const baseRoot2 = "http://18.119.9.9:4000";

    await fetch(`${baseRoot2}/send_machine_features`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: user_id,
        division: division,
        plant: plant,
        area: area,
        subarea: subarea,
        line: line,
        station: station,
        machine_type: machineType,
        machine: machine,
        selected_features: selectedFeatures,
      }),
    })
      .then((response) => {
        try {
          return response.json();
        } catch {
          return {};
        }
      })
      .then((data) => console.log(data))
      .catch((error) => console.error("Error:", error));
  };

  const formatFeatures = (f: any) => (Array.isArray(f) ? f.join(" ") : f);

  return (
    <div>

      {/* === NOTIFICATION CHECKER === */}
      <NotificationChecker />

      {/* HEADER */}
      <Header isAdmin={isAdmin} pageName="Dashboard" />

      {/* MAIN */}
      <main className="w-[95%] mx-auto mt-6 bg-white p-8 rounded shadow space-y-6">

        {/* DROPDOWNS */}
        <div className="flex flex-wrap gap-3 items-center">

          <label className="text-sm">
            Division:
            <select
              className="ml-2 border border-black p-2 rounded"
              value={division}
              onChange={(e) => {
                setDivision(e.target.value);
                hardResetBelow();
              }}
            >
              <option value="">-- Choose Division --</option>
              {divisions.map((d) => (
                <option key={d.division_id} value={d.division_id}>
                  {d.division_id}
                </option>
              ))}
            </select>
          </label>

          {division && (
            <label className="text-sm">
              Plant:
              <select
                className="ml-2 border border-black p-2 rounded"
                value={plant}
                onChange={(e) => {
                  setPlant(e.target.value);
                  setArea("");
                  setSubarea("");
                  setLine("");
                  setStation("");
                  setMachineType("");
                  if (machine) localStorage.removeItem(storageKey);
                  setMachine("");
                  setFeatures([]);
                  setSelectedFeatures([]);
                  setModelOutput(null);
                  setRul(null);
                  setStatistics({});
                }}
              >
                <option value="">-- Choose Plant --</option>
                {plants.map((p) => (
                  <option key={p.plant_id} value={p.plant_id}>
                    {p.plant_id}
                  </option>
                ))}
              </select>
            </label>
          )}

          {plant && (
            <label className="text-sm">
              Area:
              <select
                className="ml-2 border border-black p-2 rounded"
                value={area}
                onChange={(e) => {
                  setArea(e.target.value);
                  setSubarea("");
                  setLine("");
                  setStation("");
                  setMachineType("");
                  if (machine) localStorage.removeItem(storageKey);
                  setMachine("");
                  setFeatures([]);
                  setSelectedFeatures([]);
                  setModelOutput(null);
                  setRul(null);
                  setStatistics({});
                }}
              >
                <option value="">-- Choose Area --</option>
                {areas.map((a) => (
                  <option key={a.area_id} value={a.area_id}>
                    {a.area_id}
                  </option>
                ))}
              </select>
            </label>
          )}

          {area && (
            <label className="text-sm">
              Subarea:
              <select
                className="ml-2 border border-black p-2 rounded"
                value={subarea}
                onChange={(e) => {
                  setSubarea(e.target.value);
                  setLine("");
                  setStation("");
                  setMachineType("");
                  if (machine) localStorage.removeItem(storageKey);
                  setMachine("");
                  setFeatures([]);
                  setSelectedFeatures([]);
                  setModelOutput(null);
                  setRul(null);
                  setStatistics({});
                }}
              >
                <option value="">-- Choose Subarea --</option>
                {subareas.map((s) => (
                  <option key={s.subarea_id} value={s.subarea_id}>
                    {s.subarea_id}
                  </option>
                ))}
              </select>
            </label>
          )}

          {subarea && (
            <label className="text-sm">
              Line:
              <select
                className="ml-2 border border-black p-2 rounded"
                value={line}
                onChange={(e) => {
                  setLine(e.target.value);
                  setStation("");
                  setMachineType("");
                  if (machine) localStorage.removeItem(storageKey);
                  setMachine("");
                  setFeatures([]);
                  setSelectedFeatures([]);
                  setModelOutput(null);
                  setRul(null);
                  setStatistics({});
                }}
              >
                <option value="">-- Choose Line --</option>
                {lines.map((l) => (
                  <option key={l.line_id} value={l.line_id}>
                    {l.line_id}
                  </option>
                ))}
              </select>
            </label>
          )}

          {line && (
            <label className="text-sm">
              Station:
              <select
                className="ml-2 border border-black p-2 rounded"
                value={station}
                onChange={(e) => {
                  setStation(e.target.value);
                  setMachineType("");
                  if (machine) localStorage.removeItem(storageKey);
                  setMachine("");
                  setFeatures([]);
                  setSelectedFeatures([]);
                  setModelOutput(null);
                  setRul(null);
                  setStatistics({});
                }}
              >
                <option value="">-- Choose Station --</option>
                {stations.map((s) => (
                  <option key={s.station_id} value={s.station_id}>
                    {s.station_id}
                  </option>
                ))}
              </select>
            </label>
          )}

          {station && (
            <label className="text-sm">
              Machine Type:
              <select
                className="ml-2 border border-black p-2 rounded"
                value={machineType}
                onChange={(e) => {
                  setMachineType(e.target.value);
                  if (machine) localStorage.removeItem(storageKey);
                  setMachine("");
                  setFeatures([]);
                  setSelectedFeatures([]);
                  setModelOutput(null);
                  setRul(null);
                  setStatistics({});
                }}
              >
                <option value="">-- Choose Machine Type --</option>
                {machineTypes.map((mt) => (
                  <option key={mt.machine_type_id} value={mt.machine_type_id}>
                    {mt.machine_type_id}
                  </option>
                ))}
              </select>
            </label>
          )}

          {machineType && (
            <label className="text-sm">
              Machine:
              <select
                className="ml-2 border border-black p-2 rounded"
                value={machine}
                onChange={(e) => {
                  if (machine) localStorage.removeItem(storageKey);
                  setMachine(e.target.value);
                  setFeatures([]);
                  setSelectedFeatures([]);
                  setModelOutput(null);
                  setRul(null);
                  setStatistics({});
                }}
              >
                <option value="">-- Choose Machine --</option>
                {machines.map((m) => (
                  <option key={m.machine_id} value={m.machine_id}>
                    {m.machine_id}
                  </option>
                ))}
              </select>
            </label>
          )}

          {machine && (
            <label className="text-sm ml-auto">
              Range:
              <select
                className="ml-2 border border-black p-2 rounded"
                value={range}
                onChange={(e) => setRange(e.target.value as RangeKey)}
              >
                <option value="default">Default</option>
                <option value="one_day">24 hours</option>
                <option value="three_days">72 hours</option>
                <option value="week">1 week</option>
                <option value="extended">All</option>
              </select>
            </label>
          )}
        </div>

        {machine && features.length > 0 && (
          <div className="mt-6 space-y-6">
            {features.map((f, idx) => (
              <div key={f} className="border rounded p-4">
                <div className="flex items-center gap-2 mb-2">
                  {isAdmin && (
                      <input
                          type="checkbox"
                          checked={selectedFeatures.includes(f)}
                          onChange={() => toggleFeatureSelection(f)}
                      />
                  )}
                  <h3 className="font-semibold text-lg">{f}</h3>
                </div>

                <div className="bg-white p-3 rounded shadow h-64">
                  <canvas
                    ref={(el) => {
                      chartRefs.current[f] = el;
                    }}
                    className="w-full h-full"
                  />
                </div>
              </div>
            ))}

            {/* Buttons under the graph, above the model output stuff */}
            <div className="flex flex-wrap mt-2 items-center justify-center">
              <button className="button-class hover:underline"
                onClick ={() => 
                {
                alert(`Subscribed to alerts`);
                console.log(`User subscribed to alerts for feature`);
                const email = session?.user?.email;
                // const division1 = "division1"
                // const line1 = "line1"
                // const machine1 = "machine1"
                const notificationInsert = async () => {
                  await fetch(`http://18.119.9.9:3000/data/add_to_notification_list?email=${email}&division=${division}&line=${line}&machine=${machine}&plant=${plant}&area=${area}&subarea=${subarea}&station=${station}&machine_type=${machineType}`);
                };
                notificationInsert();
                }}>
                Sign up for alerts
              </button>
              {isAdmin && (
                  <button
                      className="button-class hover:underline"
                      onClick={() => {
                        console.log("Resetting data for:", division, line, machine);
                        alert(`Reset data for division: ${division}, line: ${line}, machine: ${machine}`);

                        if (!session || !isAdmin) return;
                        const user_id = (session as any)?.user?.id;
                        if (!user_id) return;

                        const clearData = async () => {
                          await fetch(`http://18.119.9.9:3000/data/clear_from_raw_sensor_readings?division=${division}&plant=${plant}&area=${area}&subarea=${subarea}&line=${line}&station=${station}&machine_type=${machineType}&machine=${machine}`);
                          await fetch(`http://18.119.9.9:3000/data/clear_from_model_output?division=${division}&plant=${plant}&area=${area}&subarea=${subarea}&line=${line}&station=${station}&machine_type=${machineType}&machine=${machine}`);
                          await fetch("http://18.119.9.9:4000/reset_baseline", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              user_id,
                              division,
                              plant,
                              area,
                              subarea,
                              line,
                              station,
                              machine_type: machineType,
                              machine,
                            }),
                          });
                        };
                        clearData();
                      }}
                  >
                    Reset Data/Baseline
                  </button>
              )}
            </div>

            <div className="flex items-start gap-4 mt-4">
              {isAdmin && (
                  <button
                      disabled={selectedFeatures.length === 0 || !session}
                      onClick={sendSelectedFeatures}
                      className={`px-4 py-2 rounded text-white font-semibold ${
                          selectedFeatures.length === 0 || !session
                              ? "bg-gray-400 cursor-not-allowed"
                              : "bg-blue-500 hover:bg-blue-600"
                      }`}
                  >
                    Select
                  </button>
              )}

              {modelOutput && (
                <div className="bg-gray-100 border rounded p-4 w-72 shadow-md">
                  <h3 className="text-md font-semibold mb-2 text-center">Model Output</h3>
                  <p className="text-sm">
                    <span className="font-semibold">Time:</span>{" "}
                    {new Date(new Date(modelOutput.time_stamp).getTime() + 5 * 60 * 60 * 1000).toLocaleTimeString()}
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">Feature(s):</span>{" "}
                    {formatFeatures(modelOutput.machine_features)}
                  </p>
                  <p
                    className={`mt-2 font-semibold ${
                      Number(modelOutput.model_output_value) === 1 ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {Number(modelOutput.model_output_value) === 1 ? "Anomaly Detected" : "No Anomaly"}
                  </p>

                  <hr className="my-3" />
                  <p className="text-sm text-center">
                    <span className="font-semibold">RUL:</span>{" "}
                    {rul === null ? "—" : (rul > 100 ? ">100" : rul.toFixed(2))}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
