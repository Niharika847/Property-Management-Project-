import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Roost", template: "%s · Roost" },
  description: "AI-powered property & expense management.",
};

/* Sets the theme before first paint so there is no light/dark flash.
   Stored preference wins; otherwise follow the OS. */
const themeScript = `
try {
  var t = localStorage.getItem("roost-theme");
  if (!t) t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = t;
} catch (_) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
