import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Conditions Translator",
  description:
    "Understand your supervision documents in plain language, grounded only in what you upload.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
