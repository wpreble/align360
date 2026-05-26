import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Align360 — AI Companion',
  description: 'A personal and professional development companion. Powered by Align360.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
