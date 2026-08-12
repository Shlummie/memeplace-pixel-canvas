"use client";

import styles from '../../app/page.module.css';

export function CommunityPanel() {
  return (
    <div className={styles.communityPanel}>
      <section className={styles.panelGroup}>
        <header className={styles.sectionTitle}>About</header>
        <p className={styles.aboutText}>
          Memeplace is an experimental collaborative pixel canvas. The public repository is a
          devnet-oriented reference implementation, not a live token or hosted community.
        </p>
      </section>

      <section className={styles.panelGroup}>
        <header className={styles.sectionTitle}>How It Works</header>
        <ol className={styles.howToList}>
          <li>Connect your wallet</li>
          <li>Pick a color from the palette</li>
          <li>Click pixels on the canvas to stage them</li>
          <li>Burn tokens to place your pixels</li>
        </ol>
      </section>
    </div>
  );
}
