import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RiskRail',
  description: 'Risk intelligence for Bitcoin capital on Stacks',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
