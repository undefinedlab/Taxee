"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

function WatchContent() {
  const params = useSearchParams();
  const oppId = params.get("oppId") ?? "";
  const wallet = params.get("wallet") ?? "";

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-6">
        <h1 className="text-2xl font-bold text-center">Execute in your wallet</h1>
        <p className="text-gray-400 text-sm text-center">
          Watch mode — taxee suggested transaction steps in Telegram. Connect the same wallet
          here to confirm the address, then complete the steps in MetaMask or Rabby.
        </p>
        {wallet && (
          <p className="text-center font-mono text-sm text-gray-300">
            Target: {wallet.slice(0, 8)}…{wallet.slice(-6)}
          </p>
        )}
        {oppId && (
          <p className="text-center text-xs text-gray-500">Opportunity: {oppId.slice(0, 8)}…</p>
        )}
        <div className="flex justify-center">
          <ConnectButton />
        </div>
        <p className="text-sm text-gray-500 text-center">
          Full prefilled amounts are in your Telegram chat. On-chain swaps are not auto-submitted
          by taxee in watch mode.
        </p>
      </div>
    </main>
  );
}

export default function WatchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <WatchContent />
    </Suspense>
  );
}
