export const lightColors = {
  accent: "#6355D9",
  primary: "#6355D9",
  onPrimary: "#FFFFFF",
  ink: "#24252A",
  muted: "#747982",
  line: "#E7E9EE",
  bg: "#F7F8FA",
  surface: "#FFFFFF",
  soft: "#F1EFFF",
  selectedBorder: "#D5CEF7",
  green: "#38846A",
  red: "#B04444",
  errorBg: "#FFF0F0",
  toastBg: "#24252A",
  toastInk: "#FFFFFF",
};

export type ThemeColors = { [Key in keyof typeof lightColors]: string };

export const darkColors: ThemeColors = {
  accent: "#B5ABFF",
  primary: "#6355D9",
  onPrimary: "#FFFFFF",
  ink: "#F2F3F7",
  muted: "#A2A8B4",
  line: "#343946",
  bg: "#121419",
  surface: "#1C1F26",
  soft: "#2B2547",
  selectedBorder: "#5B4D87",
  green: "#78C8AA",
  red: "#FF9D9D",
  errorBg: "#331F25",
  toastBg: "#F2F3F7",
  toastInk: "#121419",
};
