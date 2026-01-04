import React from 'react';

import styles from '../../app/page.module.css';

interface CoordinateOverlayProps {
  info: {
    canvasX: number;
    canvasY: number;
    clientX: number;
    clientY: number;
  };
}

export function CoordinateOverlay({ info }: CoordinateOverlayProps) {
  const style: React.CSSProperties = {
    position: 'fixed',
    top: info.clientY + 12,
    left: info.clientX + 12,
    pointerEvents: 'none',
    zIndex: 10,
  };

  return (
    <div style={style} className={styles.coordinateOverlay}>
      ({info.canvasX}, {info.canvasY})
    </div>
  );
}
