import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bora Bora · Revenue Management",
  description:
    "Dashboard de Revenue Management para el Hotel Bora Bora. Pickup semanal, análisis de canales, comparativa STLY.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
