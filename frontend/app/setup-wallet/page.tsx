"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function SetupWalletPage() {
  const params     = useSearchParams();
  const [status, setStatus]   = useState<"loading" | "ready" | "done" | "error">("loading");
  const [message, setMessage] = useState("Initialising Circle SDK…");

  useEffect(() => {
    const userToken     = params.get("userToken");
    const encryptionKey = params.get("encryptionKey");
    const challengeId   = params.get("challengeId");

    if (!userToken || !encryptionKey || !challengeId) {
      setStatus("error");
      setMessage("Missing parameters. Please restart the setup from Telegram.");
      return;
    }

    let sdk: any;

    import("@circle-fin/w3s-pw-web-sdk").then(({ W3SSdk }) => {
      sdk = new W3SSdk();
      sdk.setAppSettings({ appId: process.env["NEXT_PUBLIC_CIRCLE_APP_ID"] ?? "" });
      sdk.setAuthentication({ userToken, encryptionKey });

      setStatus("ready");
      setMessage("Complete wallet setup below.");

      sdk.execute(challengeId, (err: any, result: any) => {
        if (err) {
          console.error("[circle-sdk]", err);
          setStatus("error");
          setMessage(`Setup failed: ${err.message ?? "unknown error"}`);
          return;
        }
        console.log("[circle-sdk] wallet created:", result);
        setStatus("done");
        setMessage("✅ Wallet created! Your Circle MPC wallet is ready. You can close this tab and return to Telegram.");
      });
    }).catch((err) => {
      setStatus("error");
      setMessage(`Failed to load Circle SDK: ${err.message}`);
    });
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
