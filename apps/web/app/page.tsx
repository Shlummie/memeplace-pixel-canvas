"use client";

import { CanvasPanel } from '../components/canvas/CanvasPanel';
import { CommunityPanel } from '../components/community/CommunityPanel';
import { MaintenanceBanner } from '../components/MaintenanceBanner';
import { Toolbar } from '../components/toolbar/Toolbar';

import styles from './page.module.css';

export default function Home() {
  return (
    <div className={styles.pageWrapper}>
      <MaintenanceBanner />
      <header className={styles.appHeader}>
        <h1 className={styles.logo}>
          <span className={styles.logoPump}>Pump</span>
          <span className={styles.logoPlace}>Place</span>
        </h1>
        <p className={styles.tagline}>Burn tokens. Place pixels. Make history.</p>
      </header>
      <main className={styles.main}>
        <aside className={styles.sidebar}>
          <Toolbar />
        </aside>
        <section className={styles.canvasSection}>
          <CanvasPanel />
        </section>
        <aside className={styles.sidebarRight}>
          <CommunityPanel />
        </aside>
      </main>
    </div>
  );
}

