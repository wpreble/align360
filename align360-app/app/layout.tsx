import type { Metadata } from 'next';
import './globals.css';
import Nav from './_components/Nav';

export const metadata: Metadata = {
  title: 'Align360',
  description: 'Discover how you are wired, navigate your path, and grow with clarity. Powered by Align360.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const year = new Date().getFullYear();
  return (
    <html lang="en" data-theme="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Cinzel:wght@400;500;600&family=Crimson+Pro:ital,wght@0,400;0,500;1,400&display=swap"
        />
      </head>
      <body>
        <Nav />
        <div className="app-main">{children}</div>
        <div className="ip-notice">
          © {year} Align360. All rights reserved. Reproduction or use of these assessments without
          written permission is prohibited.
        </div>
      </body>
    </html>
  );
}
