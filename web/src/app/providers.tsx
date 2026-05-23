"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppBrandingProvider } from "@/contexts/AppBrandingContext";
import { SchoolProvider } from "@/contexts/SchoolContext";
import ServerConnectionError from "@/components/ServerConnectionError";
import PushNotificationsBootstrap from "@/components/PushNotificationsBootstrap";
import ServiceWorkerDevCleanup from "@/components/ServiceWorkerDevCleanup";
import OfflineBanner from "@/components/OfflineBanner";
import OfflinePrefetch from "@/components/OfflinePrefetch";
import "@/utils/debug";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <AppBrandingProvider>
        <AuthProvider>
          <SchoolProvider>
          <ServiceWorkerDevCleanup />
          <OfflinePrefetch />
          <OfflineBanner />
          <PushNotificationsBootstrap />
          {children}
          <Toaster
          position="top-right"
          gutter={12}
          toastOptions={{
            duration: 4200,
            className:
              '!font-sans !bg-white/95 !backdrop-blur-xl !border !border-stone-200/85 !shadow-[0_24px_48px_-16px_rgba(12,10,9,0.14)] !rounded-2xl !text-stone-900 !px-4 !py-3.5 !ring-1 !ring-amber-900/8',
            success: {
              iconTheme: { primary: '#b45309', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#be123c', secondary: '#fff' },
            },
          }}
          />
          <ServerConnectionError />
          </SchoolProvider>
        </AuthProvider>
      </AppBrandingProvider>
    </QueryClientProvider>
  );
}
