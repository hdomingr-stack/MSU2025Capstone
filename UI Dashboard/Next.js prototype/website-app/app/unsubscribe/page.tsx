"use client";

import {useEffect, useState } from "react";
import Header from "../components/Header";
import { useSession } from "next-auth/react";
import { NotificationChecker } from "../components/notification-checker"

//type Division = { division_id: string; name?: string };

// Notification item returned from the notifications endpoint
type Notification = {
  email: string;
  division: string;
  line: string;
  machine: string;
  plant: string;
  area: string;
  subarea: string;
  station: string;
  machine_type: string;
};

export default function Unsubscribe() {
  //const [deleteNotification, setDeleteNotification] = useState(false);  
  const [divisions, setDivisions] = useState<Notification[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<string | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [selectedSubarea, setSelectedSubarea] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [selectedMachineType, setSelectedMachineType] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<Notification>({
    email: "",
    division: "",
    line: "",
    machine: "",
    plant: "",
    area: "",
    subarea: "",
    station: "",
    machine_type: "",
  });

  const { data: session} = useSession();

  console.log("Session data in unsubscribe page:", session?.user.email);

  useEffect(() => {

    const readNotifications = async () => {
      const res = await fetch("http://18.119.9.9:3000/data/read_from_notification_list");
      const json = await res.json();

      const userEmail = session?.user?.email;
      const filteredNotifications = json.filter((n: Notification) => n.email === userEmail);

      setDivisions(filteredNotifications);

      setAddForm((prev) => ({ ...prev, email: session?.user?.email! }));
    };
    readNotifications();
   
  }, [session?.user?.email]);

  const hasSelection =
    !!(selectedEmail &&
    selectedDivision &&
    selectedLine &&
    selectedMachine &&
    selectedPlant &&
    selectedArea &&
    selectedSubarea &&
    selectedStation &&
    selectedMachineType);

  const actionLabel = hasSelection ? "Unsubscribe" : "Add";

  // Function to handle unsubscribe button logic
  const unsubscribeButton = async () => {
    if (
      !selectedEmail || !selectedDivision || !selectedLine || !selectedMachine ||
      !selectedPlant || !selectedArea || !selectedSubarea || !selectedStation || !selectedMachineType
    ) return;
      alert(`Unsubscribed from division: ${selectedDivision}`);
      console.log("Unsubscribing from:", selectedEmail, selectedDivision, selectedLine, selectedMachine); 
      
      const oDeleteNotifications = async () => {
        await fetch(
          `http://18.119.9.9:3000/data/deleting_from_notification_list?email=${selectedEmail}` +
          `&division=${selectedDivision}&line=${selectedLine}&machine=${selectedMachine}` +
          `&plant=${selectedPlant}&area=${selectedArea}&subarea=${selectedSubarea}` +
          `&station=${selectedStation}&machine_type=${selectedMachineType}`);
      };
      oDeleteNotifications();
    

      // remove from local table
      setDivisions(prev =>
        prev.filter(n =>
          !(
            n.email === selectedEmail &&
            n.division === selectedDivision &&
            n.line === selectedLine &&
            n.machine === selectedMachine &&
            n.plant === selectedPlant &&
            n.area === selectedArea &&
            n.subarea === selectedSubarea &&
            n.station === selectedStation &&
            n.machine_type === selectedMachineType
          )
        )
      );

      // clear selection
      setSelectedEmail(null);
      setSelectedDivision(null);
      setSelectedLine(null);
      setSelectedMachine(null);
      setSelectedPlant(null);
      setSelectedArea(null);
      setSelectedSubarea(null);
      setSelectedStation(null);
      setSelectedMachineType(null);
      //setDeleteNotification(false);
  }

  const onChangeField = (k: keyof Notification, v: string) => {
    setAddForm((prev) => ({ ...prev, [k]: v }));
  };

  const toggleAddPanel = () => {
    // Close if already open, open if closed
    setShowAdd((s) => !s);
  };

  const addButton = async () => {
    const required: (keyof Notification)[] = [
      "email",
      "division",
      "line",
      "machine",
      "plant",
      "area",
      "subarea",
      "station",
      "machine_type",
    ];
    const missing = required.filter((k) => !addForm[k]);

    if (missing.length) {
      alert(`Please fill: ${missing.join(", ")}`);
      return;
    }

    await fetch(`http://18.119.9.9:3000/data/add_to_notification_list` +
      `?email=${addForm.email}&division=${addForm.division}&line=${addForm.line}&machine=${addForm.machine}` +
      `&plant=${addForm.plant}&area=${addForm.area}&subarea=${addForm.subarea}&station=${addForm.station}` +
      `&machine_type=${addForm.machine_type}`);
    

    setDivisions((prev) => [addForm, ...prev]);

    setShowAdd(false);
    setAddForm((prev) => ({
      ...prev,
      division: "",
      line: "",
      machine: "",
      plant: "",
      area: "",
      subarea: "",
      station: "",
      machine_type: "",
    }));
  };


  return (
    <div className="min-h-screen flex flex-col bg-gray-100 text-gray-900">
      {/* === NOTIFICATION CHECKER === */}
      <NotificationChecker />

      <Header pageName="Manage Notifications"/>
      <div className="p-6 flex flex-col items-center">
        <h1 className="text-3xl font-bold mb-4">Manage Notifications</h1>

        <table className="border-collapse border border-gray-400 w-full max-w-md bg-white">
          <thead>
            <tr className="bg-gray-100">
              <th>Pick</th>
              <th>Email</th>
              <th>Division</th>
              <th>Line</th>
              <th>Machine</th>
              <th>Plant</th>
              <th>Area</th>
              <th>Subarea</th>
              <th>Station</th>
              <th>Machine Type</th>
            </tr>
          </thead>
          <tbody>
            {divisions.map((d) => {

              const rowKey = `${d.email}|${d.division}|${d.plant}|${d.area}|${d.subarea}|${d.station}|${d.line}|${d.machine}|${d.machine_type}`;

              const radioId = `pick-${rowKey}`
              return(
              <tr key={rowKey}>
                <td className="border border-gray-300 p-2 text-center">
                  <input
                    id={radioId}
                    type="radio"
                    name="notification"
                    value={rowKey}
                    checked={
                      selectedEmail === d.email &&
                      selectedDivision === d.division &&
                      selectedLine === d.line &&
                      selectedMachine === d.machine &&
                      selectedPlant === d.plant &&
                      selectedArea === d.area &&
                      selectedSubarea === d.subarea &&
                      selectedStation === d.station &&
                      selectedMachineType === d.machine_type
                    }
                    readOnly
                    onClick={() => {
                      const isAlreadySelected =
                      selectedEmail === d.email &&
                      selectedDivision === d.division &&
                      selectedLine === d.line &&
                      selectedMachine === d.machine &&
                      selectedPlant === d.plant &&
                      selectedArea === d.area &&
                      selectedSubarea === d.subarea &&
                      selectedStation === d.station &&
                      selectedMachineType === d.machine_type;

                    if (isAlreadySelected) {
                      // Deselect everything if clicking the same row again
                      setSelectedEmail(null);
                      setSelectedDivision(null);
                      setSelectedLine(null);
                      setSelectedMachine(null);
                      setSelectedPlant(null);
                      setSelectedArea(null);
                      setSelectedSubarea(null);
                      setSelectedStation(null);
                      setSelectedMachineType(null);
                    } else {
                      // Normal select behavior
                      setSelectedEmail(d.email);
                      setSelectedDivision(d.division);
                      setSelectedLine(d.line);
                      setSelectedMachine(d.machine);
                      setSelectedPlant(d.plant);
                      setSelectedArea(d.area);
                      setSelectedSubarea(d.subarea);
                      setSelectedStation(d.station);
                      setSelectedMachineType(d.machine_type);
                    }

                    // Always close the Add panel if it’s open
                    setShowAdd(false);
                    }}
                  />
                </td>
                <td className="border p-2">{d.email}</td>
                <td className="border p-2">{d.division}</td>
                <td className="border p-2">{d.line}</td>
                <td className="border p-2">{d.machine}</td>
                <td className="border p-2">{d.plant}</td>
                <td className="border p-2">{d.area}</td>
                <td className="border p-2">{d.subarea}</td>
                <td className="border p-2">{d.station}</td>
                <td className="border p-2">{d.machine_type}</td>
              </tr>
            );
          })}
          </tbody>
        </table>
        <button
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
          onClick={() => (hasSelection ? unsubscribeButton() : toggleAddPanel())}
        >
          {actionLabel}
        </button>

        {/* Add Panel only shows when nothing is selected */}
        {!hasSelection && showAdd && (
          <div className="mt-3 w-full max-w-3xl rounded-xl border border-gray-300 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold mb-3">Add Notification</h2>
            <p>Write "ALL" in all caps if you want any from that category</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                className="border rounded p-2"
                placeholder="Email"
                value={addForm.email}
                readOnly
              />
              <input
                className="border rounded p-2"
                placeholder="Division"
                value={addForm.division}
                onChange={(e) => onChangeField("division", e.target.value)}
              />
              <input
                className="border rounded p-2"
                placeholder="Line"
                value={addForm.line}
                onChange={(e) => onChangeField("line", e.target.value)}
              />
              <input
                className="border rounded p-2"
                placeholder="Machine"
                value={addForm.machine}
                onChange={(e) => onChangeField("machine", e.target.value)}
              />
              <input
                className="border rounded p-2"
                placeholder="Plant"
                value={addForm.plant}
                onChange={(e) => onChangeField("plant", e.target.value)}
              />
              <input
                className="border rounded p-2"
                placeholder="Area"
                value={addForm.area}
                onChange={(e) => onChangeField("area", e.target.value)}
              />
              <input
                className="border rounded p-2"
                placeholder="Subarea"
                value={addForm.subarea}
                onChange={(e) => onChangeField("subarea", e.target.value)}
              />
              <input
                className="border rounded p-2"
                placeholder="Station"
                value={addForm.station}
                onChange={(e) => onChangeField("station", e.target.value)}
              />
              <input
                className="border rounded p-2 md:col-span-2"
                placeholder="Machine Type"
                value={addForm.machine_type}
                onChange={(e) => onChangeField("machine_type", e.target.value)}
              />
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={addButton}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Save
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
