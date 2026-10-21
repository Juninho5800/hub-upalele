import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Clan Hub • UPALELE", description: "Central do clã UPALELE de Clash of Clans" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
