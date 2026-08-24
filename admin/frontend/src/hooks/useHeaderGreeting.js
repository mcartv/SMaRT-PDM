import { useEffect, useState } from 'react';

function getGreetingPeriod(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function millisecondsUntilNextPeriod(date = new Date()) {
  const nextBoundary = new Date(date);
  if (date.getHours() < 12) nextBoundary.setHours(12, 0, 0, 0);
  else if (date.getHours() < 18) nextBoundary.setHours(18, 0, 0, 0);
  else {
    nextBoundary.setDate(nextBoundary.getDate() + 1);
    nextBoundary.setHours(0, 0, 0, 0);
  }
  return Math.max(nextBoundary.getTime() - date.getTime(), 1_000);
}

export default function useHeaderGreeting(profile, fallbackName = 'there') {
  const [greeting, setGreeting] = useState(() => getGreetingPeriod());

  useEffect(() => {
    let timeoutId;
    const scheduleUpdate = () => {
      const now = new Date();
      setGreeting(getGreetingPeriod(now));
      timeoutId = window.setTimeout(scheduleUpdate, millisecondsUntilNextPeriod(now) + 250);
    };
    scheduleUpdate();
    return () => window.clearTimeout(timeoutId);
  }, []);

  const firstName = String(
    profile?.first_name || profile?.name || profile?.full_name || ''
  ).trim().split(/\s+/)[0];

  return `${greeting}, ${firstName || fallbackName} 👋`;
}
