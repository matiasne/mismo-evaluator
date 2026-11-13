import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MISMO file evaluator",
  description: "Upload a MISMO 3.4 loan application and have Jev check it before it is imported.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
