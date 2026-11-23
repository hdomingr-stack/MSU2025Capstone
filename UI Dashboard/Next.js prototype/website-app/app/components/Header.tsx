import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { JSX } from "react";
import Settings from "../components/settings";

type HeaderProps = {
  isAdmin?: boolean;
  pageName: string;
};

export default function Header({ isAdmin, pageName }: HeaderProps): JSX.Element {

  const [buttonPopup, setButtonPopup] = useState(false);

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
          <h1 className="text-xl font-bold">
              {pageName}{isAdmin ? " - Administrator" : ""}
          </h1>
      </div>
      <button
        onClick={() => setButtonPopup(true)}
        className="!bg-gray-600 !px-3 !py-1 !rounded !hover:bg-gray-600"
      >
        Menu
      </button>

      <Settings trigger={buttonPopup} setTrigger={setButtonPopup}></Settings>
    </header>
  );
}
