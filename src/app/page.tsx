'use client';

import dynamic from 'next/dynamic';

const Workspace = dynamic(
  () => import('../components/Workspace').then((mod) => mod.Workspace),
  { ssr: false }
);

export default function Home() {
  return (
    <main className="app-shell">
      <Workspace />
    </main>
  );
}
