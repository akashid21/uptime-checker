import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PulseCheck — Modern Uptime Tracker",
  description: "Zero-config website and API uptime tracking with instant alerts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#090d16] text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}

