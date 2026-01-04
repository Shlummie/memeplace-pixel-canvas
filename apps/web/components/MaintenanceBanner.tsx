"use client";

/**
 * MaintenanceBanner - Shows when NEXT_PUBLIC_MAINTENANCE_MODE=true
 * Used during token launches to prevent users from attempting burns
 * with stale configuration.
 */
export function MaintenanceBanner() {
  const isMaintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true';

  if (!isMaintenanceMode) {
    return null;
  }

  return (
    <div className="maintenanceBanner">
      <div className="maintenanceContent">
        <div className="maintenanceIcon">🚀</div>
        <div className="maintenanceText">
          <strong>Launching New Token</strong>
          <span>We&apos;re switching to the mainnet token. Back in a few minutes!</span>
        </div>
      </div>
      <style jsx>{`
        .maintenanceBanner {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(10, 10, 10, 0.95);
          backdrop-filter: blur(12px);
        }

        .maintenanceContent {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
          padding: 3rem;
          max-width: 420px;
          text-align: center;
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.04) 0%,
            rgba(255, 255, 255, 0.02) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.4),
            0 0 120px rgba(255, 69, 0, 0.15);
        }

        .maintenanceIcon {
          font-size: 4rem;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
        }

        .maintenanceText {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .maintenanceText strong {
          font-size: 1.5rem;
          font-weight: 700;
          background: linear-gradient(
            135deg,
            #FF4500 0%,
            #FF6B35 50%,
            #FFD635 100%
          );
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .maintenanceText span {
          font-size: 1rem;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}

