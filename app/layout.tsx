import type { ReactNode } from 'react';
import './style.css';
export const metadata = { title: 'The Fruit Stand | Album Journeys Admin', description: 'Private Album Journeys administration' };
export default function RootLayout({children}:{children:ReactNode}) { return <html lang="en"><body>{children}</body></html> }

