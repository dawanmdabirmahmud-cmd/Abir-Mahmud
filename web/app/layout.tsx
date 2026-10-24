import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Voter Agent · Abir',description:'A private workspace to test elections, validate votes and review the audit trail.'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>;}
