import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {
    default: "UptimeBoard — Website & API monitoring",
    template: "%s | UptimeBoard",
  },
  description: "Simple, dependable website and API monitoring with clear alerts and uptime history.",
  keywords: ["uptime monitoring", "website monitor", "API monitoring", "downtime alerts", "status monitoring"],
  openGraph: {
    type: "website",
    siteName: "UptimeBoard",
    title: "UptimeBoard — Know before your customers do",
    description: "Simple, dependable website and API monitoring for independent developers and small teams.",
  },
  icons: {
    icon: "/icon-512.png",
    shortcut: "/icon-512.png",
    apple: "/icon-512.png",
  },
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
