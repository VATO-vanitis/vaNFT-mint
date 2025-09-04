"use client";

import React, { useMemo } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";

const CONFIG = {
  network: {
    chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 97),
    explorer: process.env.NEXT_PUBLIC_EXPLORER || "https://testnet.bscscan.com",
  },
  copy: {
    subhead: "Choose quantity and collect. Simple, transparent, and fast.",
    disclaimer: "Using this page means you accept our terms.",
  },
  // Optional: let each page control widget media size & fit via env (falls back to widget defaults)
  mediaPx: Number(process.env.NEXT_PUBLIC_WIDGET_MEDIA_PX || 0), // 0 = let widget decide
  mediaFit: (process.env.NEXT_PUBLIC_WIDGET_MEDIA_FIT || "").toLowerCase(), // "contain" | "cover" | ""
};

// Set this per page
const DESIGN_SLUG = "t2-design-06";

// Pretty title from slug
function titleFromSlug(slug: string) {
  const m = slug.match(/^t(\d+)-design-(\d+)$/i);
  return m ? `Tier ${Number(m[1])} – Design ${Number(m[2])}` : "Design";
}

export default function Page() {
  const { isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const onWrongChain = isConnected && chainId !== CONFIG.network.chainId;

  // Build iframe query (adds media controls if provided)
  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams({ design: DESIGN_SLUG });
    if (CONFIG.mediaPx > 0) params.set("media", String(CONFIG.mediaPx));
    if (CONFIG.mediaFit === "contain" || CONFIG.mediaFit === "cover") params.set("fit", CONFIG.mediaFit);
    // You can append "&debug=1" temporarily while testing:
    // params.set("debug", "1");
    return `/widget?${params.toString()}`;
  }, []);

  const pageTitle = useMemo(() => titleFromSlug(DESIGN_SLUG), []);

  return (
    <div className="mx-auto w-full max-w-5xl px-1 py-12">
      {/* Hero (kept minimal; widget already has its own UX) */}
      <div className="flex flex-col items-center justify-center mb-8 text-center">
        <a href="https://vato.international/nft">
          <img
            src="https://www.vato.international/wp-content/uploads/2024/12/2dc3a448-3694-4533-9d65-1dab6e6cc49a.png"
            alt="Vanitis Logo"
            className="h-14 w-auto mb-4 md:h-20"
          />
        </a>
        <h1 className="font-display drop-shadow-dsq text-5xl md:text-2xl xl:text-5xl">
          <span className="text-gold">Collect</span>{" "}
          <span className="text-white">{pageTitle}</span>
        </h1>
        <p className="mt-3 text-white max-w-xl">{CONFIG.copy.subhead}</p>
        {/* If you want to avoid a second Connect inside the widget, you can keep this.
            Otherwise feel free to remove it — the widget has its own ConnectButton. */}
        <div className="mt-6"><ConnectButton /></div>
      </div>

      {/* Optional outer network warning (the widget also shows its own).
          If you want only one place showing this, remove this block. */}
      {onWrongChain && (
        <div className="mb-4 p-3 rounded-xl bg-black border border-gold text-sm flex flex-col sm:flex-row sm:items-center sm:justify-center gap-2">
          <span>Please switch to the correct network.</span>
          <button
            className="btn-secondary"
            onClick={() => switchChain({ chainId: CONFIG.network.chainId })}
          >
            Switch
          </button>
        </div>
      )}

      {/* Widget embed */}
      <div className="rounded-2xl border border-gold p-3">
        <iframe
          title={`Mint ${pageTitle}`}
          src={iframeSrc}
          className="w-full"
          // 560px is too short once media/cards/CTA render; use a safer height.
          // If you later add postMessage auto-resize, you can drop this static height.
          height={1080}
          loading="lazy"
          style={{ border: 0, borderRadius: 16, overflow: "hidden" as const }}
        />
      </div>

      {/* Footer */}
      <div className="mt-8 text-xs opacity-70">{CONFIG.copy.disclaimer}</div>
    </div>
  );
}
