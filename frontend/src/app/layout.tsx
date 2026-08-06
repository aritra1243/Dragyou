import type { Metadata } from "next";
import "@/styles/globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Dragyou VCS — High Performance Monorepo Version Control",
  description: "Enterprise-grade distributed version control system with C++ engine, virtual clones, and Go platform backend.",
  icons: {
    icon: [
      { url: '/logo.png' },
      { url: '/icon.png' },
    ],
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-[#0b0f19] text-gray-100 antialiased selection:bg-blue-600 selection:text-white">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        <footer className="border-t border-gray-800/80 py-8 text-center text-xs text-gray-500 font-mono">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              Dragyou VCS v0.1.0 • Built with <span className="text-blue-400 font-semibold">C++20</span>, <span className="text-cyan-400 font-semibold">Go</span>, <span className="text-indigo-400 font-semibold">Next.js</span>
            </div>
            <div className="flex items-center gap-4 text-gray-400">
              <a href="http://localhost:8080/api/v1" target="_blank" rel="noreferrer" className="hover:text-white transition-colors border border-gray-700 px-2 py-0.5 rounded-md hover:border-blue-500">REST API</a>
              <span>•</span>
              <a href="/docs" className="hover:text-white transition-colors">Documentation</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
