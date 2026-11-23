import "./globals.css";
import { ReactNode } from "react";
import Provider from "./provider";

export const metadata = {
  title: "Machine Dashboard",
  description: "Monitoring system built with Next.js",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-100 text-gray-900">
        <Provider>
          {children}
        </Provider>
        </body>
    </html>
  );
}
