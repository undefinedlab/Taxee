"use client";

import { useEffect, useState, Suspense } from "react";
import Script from "next/script";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import {
  finishTelegramWebApp,
  initTelegramWebApp,
  isTelegramWebApp,
} from "@/lib/telegram-webapp";

function ExecuteContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus]   = useState<"loading" | "ready" | "done" | "error">("loading");
  const [message, setMessage] = useState("Preparing transaction…");
  const [txHash, setTxHash]   = useState<string | null>(null);

  useEffect(() => {
    initTelegramWebApp();
    const oppId = params.get("oppId");
    if (!oppId) {
      setStatus("error");
      setMessage("Missing oppId. Please tap Approve again in Telegram.");
      return;
    }

    const apiUrl = API_BASE_URL;
    const appId  = "e88bd88e-6c02-5d2a-aa01-5e751f693e7f";

    setMessage("Fetching fresh credentials…");

    async function run() {
      try {
        const res  = await fetch(`${apiUrl}/circle/challenge/${oppId}`, { method: "POST" });
        let data: Record<string, unknown> = {};
        try {
          data = (await res.json()) as Record<string, unknown>;
        } catch {
          data = {};
        }
        if (!res.ok) {
          setStatus("error");
          const err = String(data.error ?? data.message ?? `HTTP ${res.status}`);
          if (res.status === 404) {
            setMessage(
              `${err}\n\nThis opportunity is not on the server. Open Dashboard → Settings (gear) → Sync Circle agent, or reset and onboard again.`,
            );
          } else if (res.status === 400 && err.includes("Circle wallet")) {
            setMessage(
              `${err}\n\nYour agent is not linked to Circle. Dashboard → Settings → Sync Circle agent to server.`,
            );
          } else {
            setMessage(err);
          }
          return;
        }
        if (data.error) {
          setStatus("error");
          setMessage(String(data.error));
          return;
        }
        const { userToken, encryptionKey, challengeId } = data;

        const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");
        const sdk = new W3SSdk();
        sdk.setAppSettings({ appId });
        sdk.setAuthentication({ userToken, encryptionKey });

        setStatus("ready");
        setMessage("Confirm with your PIN to execute the tax action.");

        sdk.execute(challengeId, async (err: unknown, result: unknown) => {
          if (err) {
            console.error("[circle-sdk]", err);
            setStatus("error");
            const errorObj = err as { code?: string; message?: string };
            setMessage(`Execution failed [${errorObj.code ?? "?"}]: ${errorObj.message ?? JSON.stringify(err)}`);
            return;
          }
          console.log("[circle-sdk] execution confirmed:", result);
          const resultObj   = result as { data?: { transaction?: { txHash?: string } } };
          const circleTxHash = resultObj?.data?.transaction?.txHash ?? null;
          setTxHash(circleTxHash);

          // Persist + trigger the Telegram receipt on the backend.
          // The /circle/executed endpoint records executedAt + tx_hash and sends
          // a Telegram message with a BaseScan link to the wallet's chat.
          try {
            const persistRes = await fetch(`${apiUrl}/circle/executed/${oppId}`, {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({ txHash: circleTxHash }),
            });
            if (!persistRes.ok) {
              const errBody = await persistRes.json().catch(() => ({}));
              setStatus("error");
              setMessage(`Circle signed the transaction, but the server failed to record it: ${errBody?.error ?? `HTTP ${persistRes.status}`}.`);
              return;
            }
          } catch (err) {
            setStatus("error");
            const eMsg = err instanceof Error ? err.message : String(err);
            setMessage(`Circle signed the transaction, but the server is unreachable: ${eMsg}.`);
            return;
          }
          setStatus("done");
          setMessage("✅ Transaction submitted! Circle's MPC nodes co-signed and the transaction is on its way to the chain.");
          if (isTelegramWebApp()) {
            finishTelegramWebApp({
              type: "circle_execute_complete",
              oppId: oppId ?? undefined,
            });
          }
        });
      } catch (err: unknown) {
        setStatus("error");
        const errorObj = err as { message?: string };
        setMessage(`Unexpected error: ${errorObj.message ?? String(err)}`);
      }
    }

    run();
  }, [params]);

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Confirm Tax Action</h1>
          <p className="text-gray-400 text-sm">
            Enter your Circle PIN to authorise this transaction. Your key never leaves your device.
          </p>
        </div>

        <div className={`rounded-xl p-6 border text-sm ${
          status === "error"   ? "bg-red-950 border-red-800 text-red-300" :
          status === "done"    ? "bg-green-950 border-green-800 text-green-300" :
          "bg-gray-900 border-gray-800 text-gray-300"
        }`}>
          {status === "loading" && (
            <div className="flex items-center gap-3">
              <span className="animate-spin">⟳</span>
              <span>{message}</span>
            </div>
          )}
          {(status === "ready" || status === "done" || status === "error") && (
            <p className={status === "done" ? "font-medium" : ""}>{message}</p>
          )}
        </div>

        {status === "done" && txHash && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 px-4 py-3 text-xs space-y-1.5">
            <div className="text-gray-500">Transaction hash</div>
            <a
              href={`https://sepolia.basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-blue-400 hover:text-blue-300 break-all underline-offset-2 hover:underline"
            >
              {txHash}
            </a>
            <div className="text-gray-500 pt-1">
              ↗ View on BaseScan
            </div>
          </div>
        )}

        {status === "done" && (
          <p className="text-center text-gray-500 text-xs">
            The Arc ledger record has been written. You can close this tab and return to Telegram.
          </p>
        )}

        {(status === "done" || status === "error") && (
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="w-full rounded-xl border border-gray-700 bg-gray-900 hover:bg-gray-800 transition px-4 py-3 text-sm font-medium text-gray-200"
          >
            ← Take me back to dashboard
          </button>
        )}
      </div>
    </main>
    </>
  );
}

export default function ExecutePage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
        <div className="flex items-center gap-3">
          <span className="animate-spin">⟳</span>
          <span>Loading...</span>
        </div>
      </main>
    }>
      <ExecuteContent />
    </Suspense>
  );
}
