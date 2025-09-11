// app/nft/<slug>/page.tsx
"use client";

import React, { useMemo } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { bsc } from "wagmi/chains";

/**
 * ──────────────────────────────────────────────────────────────
 *  Set this per page (the only line you need to edit per design)
 * ──────────────────────────────────────────────────────────────
 */
const DESIGN_SLUG = "t2-design-05";

/* --------------------------------------------------------------
 * Safe mainnet-first config (falls back to wagmi bsc defaults)
 * ------------------------------------------------------------*/
const CONFIG = {
  network: {
    chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? bsc.id), // 56 fallback
    explorer: process.env.NEXT_PUBLIC_EXPLORER ?? bsc.blockExplorers.default.url, // https://bscscan.com
  },
  copy: {
    subhead: "Choose quantity and collect. Simple, transparent, and fast.",
    disclaimer: "Using this page means you accept our terms.",
  },
  // Optional: let each page tweak widget media size/fit; otherwise widget decides
  mediaPx: Number(process.env.NEXT_PUBLIC_WIDGET_MEDIA_PX ?? 0), // 0 = let widget decide
  mediaFit: (process.env.NEXT_PUBLIC_WIDGET_MEDIA_FIT ?? "").toLowerCase(), // "contain" | "cover" | ""
};

/* Pretty title from slug */
function titleFromSlug(slug: string) {
  const m = slug.match(/^t(\d+)-design-(\d+)$/i);
  return m ? `Tier ${Number(m[1])} – Design ${Number(m[2])}` : "Design";
}

export default function Page() {
  const { isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const onWrongChain = isConnected && chainId !== CONFIG.network.chainId;

  // Build iframe src for the widget (adds optional media controls)
  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams({ design: DESIGN_SLUG });
    if (CONFIG.mediaPx > 0) params.set("media", String(CONFIG.mediaPx));
    if (CONFIG.mediaFit === "contain" || CONFIG.mediaFit === "cover")
      params.set("fit", CONFIG.mediaFit);
    // For debugging, temporarily: params.set("debug", "1");
    return `/widget?${params.toString()}`;
  }, []);

  const pageTitle = useMemo(() => titleFromSlug(DESIGN_SLUG), []);

  return (
    <div className="mx-auto w-full max-w-5xl px-1 py-12">
      {/* Hero */}
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

        {/* Top-level connect (the widget also has its own ConnectButton) */}
        <div className="mt-6">
          <ConnectButton />
        </div>
      </div>

      {/* Optional outer network warning (widget also handles this) */}
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
          // Static height that fits media + cards + CTA in most cases.
          // If you add postMessage auto-resize later, you can remove this.
          height={1080}
          loading="lazy"
          style={{ border: 0, borderRadius: 16, overflow: "hidden" as const }}
        />
      </div>

      {/* Mobile tip (optional, helps if some mobile browsers block popups) */}
      <div className="mt-3 text-xs text-center opacity-80">
        Having trouble on mobile? Open this page inside your wallet app’s
        built-in browser (e.g., Trust, MetaMask, Rainbow) or long-press the
        connect button to pick your wallet.
      </div>

      {/* Footer */}
      <div className="mt-8 text-xs opacity-100 text-center">
        {CONFIG.copy.disclaimer}
      </div>
    </div>
  );
}
