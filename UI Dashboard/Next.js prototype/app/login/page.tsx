"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import Header from "./components/Header";
import { JSX } from "react";

export default function Home(): JSX.Element {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 text-gray-900">
      <Header />
      <main className="flex flex-col items-center justify-center min-h-screen">
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
              <button
                type="button"
                onClick={() => (window.location.href = "/dashboard")}
                className="rounded-md px-5 py-3 bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}