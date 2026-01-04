export interface CreditMultiplierEvent {
  name: string;
  startsAt: Date;
  endsAt: Date;
  multiplier: number;
}

export interface EventManager {
  getCurrentMultiplier(now?: Date): number;
  getActiveEvent(now?: Date): CreditMultiplierEvent | undefined;
}

export function createEventManager(): EventManager {
  const events: CreditMultiplierEvent[] = loadEvents();

  function getCurrentMultiplier(now: Date = new Date()): number {
    const active = getActiveEvent(now);
    return active?.multiplier ?? 1;
  }

  function getActiveEvent(now: Date = new Date()): CreditMultiplierEvent | undefined {
    return events.find((event) => now >= event.startsAt && now <= event.endsAt);
  }

  return {
    getCurrentMultiplier,
    getActiveEvent,
  };
}

function loadEvents(): CreditMultiplierEvent[] {
  // Placeholder for future event configuration. Disabled by default.
  // Example:
  // return [
  //   {
  //     name: 'Season 1 Launch Boost',
  //     startsAt: new Date('2025-10-01T00:00:00Z'),
  //     endsAt: new Date('2025-10-03T00:00:00Z'),
  //     multiplier: 2,
  //   },
  // ];
  return [];
}


