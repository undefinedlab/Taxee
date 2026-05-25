"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";

function ExecuteContent() {
  const params = useSearchParams();
  const [status, setStatus]   = useState<"loading" | "ready" | "done" | "error">("loading");
  const [message, setMessage] = useState("Preparing transaction…");

  useEffect(() => {
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
        const data = await res.json();
        if (data.error) { setStatus("error"); setMessage(`API error: ${data.error}`); return; }
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
          const resultObj = result as { data?: { transaction?: { txHash?: string } } };
          try {
            await fetch(`${apiUrl}/actions/${oppId}/executed`, {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({ txHash: resultObj?.data?.transaction?.txHash }),
            });
          } catch { /* ignore */ }
          setStatus("done");
          setMessage("✅ Transaction submitted! Circle's MPC nodes co-signed and the transaction is on its way to the chain.");
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

        {status === "done" && (
          <p className="text-center text-gray-500 text-xs">
            The Arc ledger record has been written. You can close this tab and return to Telegram.
          </p>
        )}
      </div>
    </main>
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
