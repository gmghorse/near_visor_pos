import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark";

type UiState = {
    theme: Theme;
    sidebarCollapsed: boolean;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
    toggleSidebar: () => void;
};

export const useUiStore = create<UiState>()(
    persist(
        (set) => ({
            theme: "light",
            sidebarCollapsed: false,
            setTheme: (theme) => set({ theme }),
            toggleTheme: () => set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),
            toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
        }),
        { name: "near-visor-ui" },
    ),
);
