import type { ReactNode } from "react";

export default function GameLayout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-slate-800 text-white">
            {children}
        </div>
    );
}
