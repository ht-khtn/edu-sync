'use client';

import { ReactNode } from "react";

export default function OfflinePage(): ReactNode {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      backgroundColor: "#f5f5f5",
      padding: "1rem",
      textAlign: "center",
    }}>
      <div style={{
        maxWidth: "500px",
      }}>
        <div style={{
          fontSize: "3rem",
          marginBottom: "1rem",
        }}>
          📡
        </div>
        
        <h1 style={{
          fontSize: "1.875rem",
          fontWeight: 600,
          marginBottom: "0.5rem",
        }}>
          No Internet Connection
        </h1>
        
        <p style={{
          fontSize: "1rem",
          color: "#666",
          marginBottom: "1.5rem",
          lineHeight: "1.5",
        }}>
          You appear to be offline. Some features may be unavailable.
          Try to reconnect or use cached content.
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}>
          <div style={{
            padding: "1rem",
            backgroundColor: "#fff",
            borderRadius: "0.5rem",
            border: "1px solid #e5e7eb",
          }}>
            <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>✓ Available</div>
            <ul style={{
              fontSize: "0.875rem",
              color: "#666",
              listStyle: "none",
              padding: 0,
            }}>
              <li>• Cached pages</li>
              <li>• Stored data</li>
              <li>• Previous visits</li>
            </ul>
          </div>

          <div style={{
            padding: "1rem",
            backgroundColor: "#fff",
            borderRadius: "0.5rem",
            border: "1px solid #e5e7eb",
          }}>
            <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>✗ Unavailable</div>
            <ul style={{
              fontSize: "0.875rem",
              color: "#666",
              listStyle: "none",
              padding: 0,
            }}>
              <li>• Real-time updates</li>
              <li>• New content</li>
              <li>• Live features</li>
            </ul>
          </div>
        </div>

        <div style={{
          padding: "1rem",
          backgroundColor: "#fef3c7",
          borderRadius: "0.5rem",
          border: "1px solid #fcd34d",
          marginBottom: "1.5rem",
          fontSize: "0.875rem",
          color: "#78350f",
        }}>
          💡 <strong>Tip:</strong> Your changes will be synced once you&apos;re back online.
        </div>

        <div style={{
          display: "flex",
          gap: "1rem",
          flexDirection: "column",
        }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: "0.5rem",
              fontSize: "1rem",
              fontWeight: 500,
              cursor: "pointer",
              transition: "background-color 0.3s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#2563eb";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#3b82f6";
            }}
          >
            Retry Connection
          </button>

          <button
            onClick={() => window.history.back()}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#fff",
              color: "#3b82f6",
              border: "1px solid #3b82f6",
              borderRadius: "0.5rem",
              fontSize: "1rem",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.3s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#f0f9ff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#fff";
            }}
          >
            Go Back
          </button>
        </div>

        <div style={{
          marginTop: "2rem",
          padding: "1rem",
          backgroundColor: "#f3f4f6",
          borderRadius: "0.5rem",
          fontSize: "0.875rem",
          color: "#666",
        }}>
          <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Having trouble?</div>
          <p>Check your internet connection or try again in a few moments.</p>
        </div>
      </div>
    </div>
  );
}
