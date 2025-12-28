import type { Metadata } from "next";
import './globals.css';
import ContextProvider from '@/context';
import { ApolloProvider } from '@/providers/ApolloProvider';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
  title: "mUSD Protocol",
  description: "Mantle USD Protocol Dashboard",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ContextProvider>
          <ApolloProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </ApolloProvider>
        </ContextProvider>
      </body>
    </html>
  );
}
