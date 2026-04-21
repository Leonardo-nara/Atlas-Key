export const mobileTheme = {
  colors: {
    background: "#eef6ff",
    backgroundAccent: "#d8ecff",
    surface: "#ffffff",
    surfaceMuted: "#f4f9ff",
    surfaceStrong: "#e7f2ff",
    border: "#d4e3f6",
    borderStrong: "#bdd5ee",
    text: "#12324d",
    textMuted: "#5f7791",
    textSoft: "#7891ab",
    primary: "#3ea2ff",
    primaryStrong: "#1677d8",
    primarySoft: "#dff0ff",
    success: "#1f9d68",
    successSoft: "#e7f8f0",
    danger: "#d94f5c",
    dangerSoft: "#ffedf0",
    warning: "#c4831c",
    warningSoft: "#fff4dc",
    shadow: "rgba(22, 64, 102, 0.12)"
  },
  radii: {
    xs: 12,
    sm: 16,
    md: 20,
    lg: 28,
    pill: 999
  },
  spacing: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32
  }
} as const;

export const mobileShadow = {
  shadowColor: "#164066",
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.08,
  shadowRadius: 24,
  elevation: 6
} as const;
