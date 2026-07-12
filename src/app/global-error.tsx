"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[global error]", error);
    }
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            fontFamily: "system-ui, sans-serif",
            maxWidth: 420,
            margin: "80px auto",
            padding: "0 20px",
            textAlign: "center",
            color: "#18181b",
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.2 }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#71717a" }}>
            An unexpected error occurred. Please try again.
          </p>
          {error.digest && (
            <p
              style={{
                marginTop: 12,
                fontSize: 12,
                color: "#a1a1aa",
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
              }}
            >
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              padding: "8px 14px",
              fontSize: 14,
              fontWeight: 500,
              background: "#18181b",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
