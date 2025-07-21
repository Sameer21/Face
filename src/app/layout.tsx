import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css'; // Import your global CSS file

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Face Tracking App',
  description: 'A Next.js application for face tracking and video recording.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Viewport meta tag for responsive design */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
