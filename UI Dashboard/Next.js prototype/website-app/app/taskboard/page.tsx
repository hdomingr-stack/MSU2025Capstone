"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import Settings from "../components/settings";
import Header from "../components/Header";

import { useRouter } from 'next/navigation';

// === Types ===
type Machine = { name: string; failure: boolean };
type LineData = Record<string, FullMachine[]>;
type DivisionData = { lines: LineData };

// Notification item returned from the notifications endpoint
type Notification = {
  email: string;
  division: string;
  line: string;
  machine: string;
};

export type FullMachine = {
  name: string;
  failure: boolean;
  division: string;
  plant: string;
  area: string;
  subarea: string;
  line: string;
  station: string;
  machine_type: string;
}

export default function Taskboard() {

  const router = useRouter();

  const goToDashboard = (machine: FullMachine) => {
    const queryParams = new URLSearchParams({
      name: machine.name,
      division: machine.division,
      plant: machine.plant,
      area: machine.area,
      subarea: machine.subarea,
      line: machine.line,
      station: machine.station,
      machine_type: machine.machine_type,
    }).toString();
    router.push(`/dashboard?${queryParams}`)
  };


  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const sendEmail = async (
    {to, match, email, anomaly} : {
      to?: string;
      match?: {
        division: string;
        line: string;
        machine: string;
        plant: string;
        area: string;
        subarea: string;
        station: string;
        machine_type: string;
      };
      email?: {
        division: string;
        line: string;
        machine: string;
        plant: string;
        area: string;
        subarea: string;
        station: string;
        machine_type: string;
      };
      anomaly?: boolean
    } = {}
  ) => {
    setIsSending(true);
    setStatus(null);
    try {
      const res = await fetch("/api/send", { method: "POST" ,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          to,
          match,
          email,
          anomaly
        }),
      }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to send");
      setStatus("Email sent!");
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const [taskboardData, setTaskboardData] = useState<Record<string, DivisionData>>({});
  const [division, setDivision] = useState<string>("all");
  const [buttonPopup, setButtonPopup] = useState(false);

  const getCondition = (failure: boolean) => {
    if (failure) return "Risky";
    return "Healthy";
  };

  const divisionFilter = Object.entries(taskboardData).filter(
    ([divisionKey]) => division === "all" || divisionKey === division
  );
  console.log("working!")

  // === Fetch data from backend ===
    useEffect(() => {
      let cancelled = false;

      const fetchData = async () => {
        if (cancelled) return;

        {/* Fetch notification list first to determine who to email on anomalies */}
        const res = await fetch(
          `http://18.119.9.9:3000/data/read_from_notification_list`
        );
        if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
        const notifcationsList: Notification[] = await res.json();
        console.log("Fetched notitication data:", notifcationsList);
  
        notifcationsList.forEach((n) => {
          console.log(`Notification - Email: ${n.email}, Division: ${n.division}, Line: ${n.line}, Machine: ${n.machine}`);
        });

        const newTaskboardData: Record<string, DivisionData> = {};

        {/* Fetch hierarchical data: divisions -> plants -> areas -> subareas -> lines -> stations -> machine types -> machines */}
        try {
          const res = await fetch(
            `http://18.119.9.9:3000/data/divisions`
          );
          if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
          const divjson = await res.json();
          console.log("Fetched division data:", divjson);

          for (const divObj of divjson) {
            const division_key = divObj.division_id;
            newTaskboardData[division_key] = { lines: {}};


            const res = await fetch(
              `http://18.119.9.9:3000/data/plants?division=${divObj.division_id}`
            );
            if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
            const plantjson = await res.json();
            console.log("Fetched plant data:", plantjson);

            for (const plantObj of plantjson) {

              const res = await fetch(
                `http://18.119.9.9:3000/data/areas?division=${divObj.division_id}&plant=${plantObj.plant_id}`
              );
              if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
              const areajson = await res.json();
              console.log("Fetched area data:", areajson);

              for (const areasObj of areajson) {

                const res = await fetch(
                  `http://18.119.9.9:3000/data/subareas?division=${divObj.division_id}&plant=${plantObj.plant_id}&area=${areasObj.area_id}`
                );
                if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
                const subareajson = await res.json();
                console.log("Fetched subarea data:", subareajson);

                for (const subareaObj of subareajson) {
                  newTaskboardData[divObj.division_id] = { lines: {}};
                  const res = await fetch(
                    `http://18.119.9.9:3000/data/lines?division=${divObj.division_id}&plant=${plantObj.plant_id}&area=${areasObj.area_id}&subarea=${subareaObj.subarea_id}`
                  );
                  if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
                  const linejson = await res.json();
                  console.log("Fetched line data:", linejson);
                  for (const lineObj of linejson) {
                    newTaskboardData[divObj.division_id].lines[lineObj.line_id] = [];

                    const res = await fetch(
                      `http://18.119.9.9:3000/data/stations?division=${divObj.division_id}&plant=${plantObj.plant_id}&area=${areasObj.area_id}&subarea=${subareaObj.subarea_id}&line=${lineObj.line_id}`
                    );
                    if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
                    const stationsjson = await res.json();

                    for( const stationObj of stationsjson){

                      const res = await fetch(
                        `http://18.119.9.9:3000/data/machine_types?division=${divObj.division_id}&plant=${plantObj.plant_id}&area=${areasObj.area_id}&subarea=${subareaObj.subarea_id}&line=${lineObj.line_id}&station=${stationObj.station_id}`
                      );
                      if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
                      const machinetypejson = await res.json();

                      for (const machineTypeObj of machinetypejson){

                        const res = await fetch(
                          `http://18.119.9.9:3000/data/machines?division=${divObj.division_id}&plant=${plantObj.plant_id}&area=${areasObj.area_id}&subarea=${subareaObj.subarea_id}&line=${lineObj.line_id}&station=${stationObj.station_id}&machine_type=${machineTypeObj.machine_type_id}`
                        );
                        if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
                        const machinejson = await res.json();
                        for (const machineObj of machinejson) {

                          {/* For each machine, fetch its latest model output to determine anomaly status */}
                          const modelOutputRes = await fetch(`http://18.119.9.9:3000/data/model_output?division=${divObj.division_id}&line=${lineObj.line_id}&machine=${machineObj.machine_id}`);
                          if (!modelOutputRes.ok) throw new Error(`HTTP error: ${modelOutputRes.status}`);
                          const modelOutputJson = await modelOutputRes.json();

                          const modelOutput = modelOutputJson[0];

                          const isAnomaly = modelOutput ? Number(modelOutput.model_output_value) === 1 : false;

                          const newMachine: FullMachine = {
                            name: machineObj.machine_id,
                            failure: isAnomaly,
                            division: divObj.division_id,
                            plant: plantObj.plant_id,
                            area: areasObj.area_id,
                            subarea: subareaObj.subarea_id,
                            line: lineObj.line_id,
                            station: stationObj.station_id,
                            machine_type: machineTypeObj.machine_type_id,
                          }
                          
                          newTaskboardData[divObj.division_id].lines[lineObj.line_id].push(newMachine);
              
                          

                          notifcationsList.forEach((n) => {
                            const found = 
                              (n.division === divObj.division_id || n.division === 'ALL') &&
                              (n.line === lineObj.line_id || n.line === 'ALL')&&
                              (n.machine === machineObj.machine_id || n.machine === 'ALL');
                            if (found) {
                              if ( machineObj.model_output_value === true ){
                                sendEmail(
                                  {to: n.email,
                                  match:
                                  {
                                    division: n.division,
                                    line: n.line,
                                    machine: n.machine,
                                    plant: plantObj.plant_id,
                                    area: areasObj.area_id,
                                    subarea: subareaObj.subarea_id,
                                    station: stationObj.station_id,
                                    machine_type: machineTypeObj.machine_type_id,
                                  },
                                  email:
                                  {
                                    division: divObj.division_id,
                                    line: lineObj.line_id,
                                    machine: machineObj.machine_id,
                                    plant: plantObj.plant_id,
                                    area: areasObj.area_id,
                                    subarea: subareaObj.subarea_id,
                                    station: stationObj.station_id,
                                    machine_type: machineTypeObj.machine_type_id,
                                  },
                                  anomaly: isAnomaly}
                                );
                                console.log("Sent Email")
                              }
                            }

                          });
                        }
                      }
                    }
                  }
                }
              }
            }
        }
          setTaskboardData(newTaskboardData)
  
        } catch (err) {
          console.error("Error fetching sensor data:", err);
        }
      };
  
      fetchData();
      const interval = setInterval(fetchData, 20000);
      return () => { cancelled = true; clearInterval(interval); }
    }, []);

    console.log(taskboardData)
    
  return (
    <div>
      {/* === HEADER === */}
      <Header pageName="Taskboard" />

      

      {/* === TASKBOARD CONTENT === */}
      <main className="max-w-[95%] mx-auto mt-6 bg-white p-6 rounded shadow">
        {/* Dropdown */}
        <div className="flex gap-4">
          <select
            className="border border-black p-2 rounded"
            value={division}
            onChange={(e) => {
              setDivision(e.target.value as "all" | keyof typeof taskboardData);
            }}
          >
            <option value="all">All Divisions</option>
            {Object.keys(taskboardData).map((d) => (
              <option key={d} value={d}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Divisions side-by-side */}
        <div
          className={
            division === "all"
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              : "grid grid-cols-1 md:grid-cols-2 gap-6"
          }
        >
          {divisionFilter.map(([divisionKey, divisionObj]) => (
            <div key={divisionKey} className="border rounded p-4 bg-gray-50">
              <h2 className="font-bold text-lg mb-4">
                {divisionKey.charAt(0).toUpperCase() + divisionKey.slice(1)}
              </h2>
              {Object.entries(divisionObj.lines).map(([lineKey, machines]) => (
                <div key={lineKey} className="mb-6">
                  <h3 className="font-semibold mb-3">
                    {lineKey.charAt(0).toUpperCase() + lineKey.slice(1)}
                  </h3>
                  {/* Machines displayed left-to-right */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {machines.map((m, idx) => (
                      <button
                        key={m.name}
                        onClick={() => goToDashboard(m as FullMachine)}
                        className={`p-4 rounded text-white shadow 
                          ${m.failure ? "bg-red-500" : "bg-green-600"
                        }`}
                      >
                        <p className="font-bold">{m.name}</p>
                        <p className="text-xs">P: {m.plant} A: {m.area} S: {m.subarea}</p>
                        <p className="text-xs">L: {m.line} St: {m.station} T: {m.machine_type}</p>
                        {/* <p>{getCondition(m.failure)}</p> */}
                        <p>Anomaly: {String(m.failure)}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </main>

      <Settings trigger={buttonPopup} setTrigger={setButtonPopup}> 
      </Settings>
    </div>

    
  );
}
