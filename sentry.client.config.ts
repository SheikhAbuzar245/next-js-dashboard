import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Capture 100% of transactions in dev, 20% in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

  // Capture 10% of replays in production, 100% on error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: false,
    }),
  ],

  // Don't send errors in development unless you want to test
  enabled: process.env.NODE_ENV === "production",
});
