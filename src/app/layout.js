import { Inter } from "next/font/google";
import "./globals.css";
import dynamic from "next/dynamic";

// Dynamically import PWA components (client-side only)
const PWAInstallPrompt = dynamic(() => import("../components/PWAInstallPrompt"), {
  loading: () => null
});


const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata = {
  title: "HRGLSS - Focus Area Tracker",
  description: "Track your daily focus areas and productivity goals with AI-powered insights",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HRGLSS",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // Allow zooming on iOS PWA to avoid focus issues
  maximumScale: 5,
  userScalable: true,
  themeColor: "#F9FAFB",
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <title>HRGLSS</title>
        <meta name="apple-mobile-web-app-title" content="HRGLSS" />
        <meta name="application-name" content="HRGLSS" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#F9FAFB" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  try {
                    navigator.serviceWorker.register('/sw.js')
                      .then(function(registration) {
                        console.log('SW registered: ', registration);
                      })
                      .catch(function(registrationError) {
                        console.log('SW registration failed: ', registrationError);
                      });
                  } catch (error) {
                    console.log('SW registration error: ', error);
                  }
                });
              }
            `,
          }}
        />
      </head>
      <body
        className={`${inter.variable} antialiased`}
      >
        {children}
        <PWAInstallPrompt />
      </body>
    </html>
  );
}
