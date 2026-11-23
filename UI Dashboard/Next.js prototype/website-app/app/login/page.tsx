"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import Header from "./components/Header";
import { JSX, useEffect, useState } from "react";

export default function Home(): JSX.Element {
  const { data: session } = useSession();

  const [broker_status, set_broker_status] = useState("checking"); // Set initial broker_status

  useEffect (() => {
    if (!session?.user?.id) return; // Wait for session to load

    const check_broker = async () => {
      console.log("In check_broker function");
      try {
        // Fetch the endpoind
        const response = await fetch("http://18.119.9.9:4000/check_login", {
          method: "POST", 
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id : session.user.id }),
        });

        // Parse the response and set broker status 
        const returned_json = await response.json();

        console.log("Returned data:", returned_json); 

        if (returned_json.first_login){
          set_broker_status("first_login"); 
        }
        else {
          set_broker_status("connected");
        }

      } catch (err){
        set_broker_status("error");
        console.log("Error checking if user has previously connected to mqtt broker ")
      }
    };

    check_broker();
  }, [session]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 text-gray-900">
      <Header />
      <main className="flex flex-col items-center justify-center min-h-screen">
        {/* If not signed in, show sign in button. If signed in, show sign out button, go to dashboard, and broker status */}
        {!session ? (
          <div className="w-full max-w-sm flex flex-col items-center gap-6">
            <h2 className="text-2xl font-semibold">Welcome</h2>
            <button type="button" onClick={() => signIn("google")}
                className="rounded-md px-5 py-3 bg-black text-white hover:bg-gray-800 transition">
              Sign In with Google
            </button>
            </div>
        ) : (
            <div className="w-full max-w-md flex flex-col items-center gap-6">
            <h2 className="text-2xl font-semibold">You’re signed in</h2>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => signOut()}
                className="rounded-md px-5 py-3 bg-gray-200 hover:bg-gray-300 transition"
              >
                Sign Out
              </button>

              {/* Show broker status and appropriate button based on status */}
              { broker_status === "checking" && (
                <p className="text-grey-500">Checking MQTT Broker Connection...</p>
              )}

              { broker_status === "error" && (
                <p className="text-red-500">Error Checking MQTT Broker Connection</p>
              )}

              { broker_status === "first_login" && (
                <button
                  type="button"
                  onClick={() => (window.location.href = "/mqtt_broker")}
                  className="rounded-md px-5 py-3 bg-blue-600 text-white hover:bg-blue-700 transition"
                >
                  Connect MQTT Broker
                </button>
              )}

              { broker_status === "connected" && (
                <button
                  type="button"
                  onClick={() => (window.location.href = "/dashboard")}
                  className="rounded-md px-5 py-3 bg-blue-600 text-white hover:bg-blue-700 transition"
                >
                  Go to Dashboard
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}