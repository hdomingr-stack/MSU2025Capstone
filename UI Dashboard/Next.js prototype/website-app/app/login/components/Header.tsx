import React from "react";
import Image from "next/image";
import Link from "next/link";
import { JSX } from "react";

export default function Header(): JSX.Element {
  return (
    <header className="flex items-center justify-between bg-slate-900 text-white p-4">
      <div className="flex items-center gap-2">
        <Link href="/dashboard">
          <Image
            src="/logo.png"
            alt="Company Logo"
            width={80}
            height={80}
            priority
          />
        </Link>
        <h1 className="text-xl font-bold">Machine Dashboard</h1>
      </div>
    </header>
  );
}
