"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function SetupWalletPage() {
  const params     = useSearchParams();
  const [status, setStatus]   = useState<"loading" | "ready" | "done" | "error">("loading");
  const [message, setMessage] = useState("Initialising Circle SDK…");

  useEffect(() => {
    const userId = params.get("userId");
    if (!userId) {
      setStatus("error");
      setMessage("Missing userId. Please restart from Telegram.");
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const appId  = "e88bd88e-6c02-5d2a-aa01-5e751f693e7f";

    setMessage("Fetching fresh credentials…");

    async function run() {
      try {
        const res  = await fetch(`${apiUrl}/circle/setup/${userId}`);
        const data = await res.json();
        if (data.error) { setStatus("error"); setMessage(`API error: ${data.error}`); return; }
        const { userToken, encryptionKey, challengeId } = data;

        const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");
        const sdk = new W3SSdk();
        sdk.setAppSettings({ appId });
        sdk.setAuthentication({ userToken, encryptionKey });

        setStatus("ready");
        setMessage("Complete wallet setup below.");

        sdk.execute(challengeId, (err: any, result: any) => {
          if (err) {
            console.error("[circle-sdk] error:", JSON.stringify(err));
            setStatus("error");
            setMessage(`Setup failed [${err.code ?? "?"}]: ${err.message ?? JSON.stringify(err)}`);
            return;
          }
          console.log("[circle-sdk] wallet created:", result);
          fetch(`${apiUrl}/circle/wallet-ready/${userId}`, { method: "POST" })
            .then((r) => r.json())
            .then((d) => console.log("[taxee] wallet stored:", d))
            .catch((e) => console.error("[taxee] wallet-ready failed:", e));
          setStatus("done");
          setMessage("✅ Wallet created! Your Circle MPC wallet is ready. Return to Telegram.");
        });
      } catch (err: any) {
        setStatus("error");
        setMessage(`Unexpected error: ${err.message}`);
      }
    }

    run();
  }, [params]);

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Set Up Your Taxee Wallet</h1>
          <p className="text-gray-400 text-sm">
            Circle MPC — your private key never exists as a single object.
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
          {status === "ready" && (
            <p>{message}</p>
          )}
          {status === "done" && (
            <p className="font-medium">{message}</p>
          )}
          {status === "error" && (
            <p className="font-medium">{message}</p>
          )}
        </div>

        {status === "done" && (
          <p className="text-center text-gray-500 text-xs">
            You can now approve tax opportunities from Telegram and they will execute on-chain with your PIN.
          </p>
        )}
      </div>
    </main>
  );
}
