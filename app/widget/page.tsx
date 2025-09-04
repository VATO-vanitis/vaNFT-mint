import { promiseAny } from "@/lib/promiseAny";
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  useSwitchChain,
  usePublicClient,
  useWriteContract,
  useBalance,
} from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { formatEther } from "viem";

/* =========================================
 * CONFIG
 * ======================================= */
const CONFIG = {
  network: {
    chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 97),
    explorer: process.env.NEXT_PUBLIC_EXPLORER || "https://testnet.bscscan.com",
  },
  nft: {
    address:
      (process.env.NEXT_PUBLIC_NFT_ADDR ||
        "0x80279A67b1F485f4C9de376194a38448f5a3DEBf") as `0x${string}`,
  },
  ipfsGateway:
    process.env.NEXT_PUBLIC_IPFS_GATEWAY ||
    "https://nft.vato.international/ipfs/",
  // Optional USD (must exist on the CURRENT network) or manual fallback
  wbnbBusdPair: (process.env.NEXT_PUBLIC_WBNB_BUSD_PAIR || "") as
    | `0x${string}`
    | "",
  wbnb: (process.env.NEXT_PUBLIC_WBNB ||
    "0xae13d989dac2f0debff460ac112a837c89baa7cd") as `0x${string}`,
  busd: (process.env.NEXT_PUBLIC_BUSD ||
    "0xed24fc36d5ee211ea25a80239fb8c4cfd80f12ee") as `0x${string}`,
  manualBnbUsd:
    process.env.NEXT_PUBLIC_MANUAL_BNB_USD &&
    Number(process.env.NEXT_PUBLIC_MANUAL_BNB_USD),
  // Media sizing defaults (overridable via URL)
  media: {
    px: Number(process.env.NEXT_PUBLIC_WIDGET_MEDIA_PX || 320),
    fit: (process.env.NEXT_PUBLIC_WIDGET_MEDIA_FIT || "contain") as
      | "contain"
      | "cover",
  },
  // Links shown under the Collect button & in success notice
  links: {
    website:
      process.env.NEXT_PUBLIC_WEBSITE_URL || "https://vato.international",
    staking: process.env.NEXT_PUBLIC_STAKING_URL || "/staking",
    market:
      process.env.NEXT_PUBLIC_NFT_MARKET_URL ||
      "https://vato.international/nft",
  },
  copy: {
    subhead: "Choose quantity - push collect - Increase Benefits",
    disclaimer: "Using this page means you accept our terms.",
    headline: "Get your design",
    notLive: "Coming soon",
    soldOut: "Sold out",
    button: "Collect",
  },
  // (2) Multi-gateway for resilient metadata fetch
  gateways: [
    (process.env.NEXT_PUBLIC_IPFS_GATEWAY ||
      "https://nft.vato.international/ipfs/") as string,
    "https://ipfs.io/ipfs/",
    "https://cloudflare-ipfs.com/ipfs/",
  ],
  SLUG_MAP: {
    "t1-design-01": 1,  "t1-design-02": 2,  "t1-design-03": 3,
    "t1-design-04": 4,  "t1-design-05": 5,  "t1-design-06": 6,
    "t2-design-01": 7,  "t2-design-02": 8,  "t2-design-03": 9,
    "t2-design-04": 10, "t2-design-05": 11, "t2-design-06": 12,
    "t3-design-01": 13, "t3-design-02": 14, "t3-design-03": 15,
    "t3-design-04": 16, "t3-design-05": 17, "t3-design-06": 18,
    "t4-design-01": 19, "t4-design-02": 20, "t4-design-03": 21, "t4-design-04": 22,
    "t5-design-01": 23, "t5-design-02": 24,
    "t6-design-01": 25, "t6-design-02": 26, "t6-design-03": 27,
  } as Record<string, number>,
};

/* =========================================
 * ABIs (supports both struct layouts)
 * ======================================= */
const nftAbiV1 = [
  { stateMutability: "view", type: "function", name: "publicSaleEnabled", inputs: [], outputs: [{ type: "bool" }] },
  {
    stateMutability: "view", type: "function", name: "design",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "tier", type: "uint8" },
      { name: "maxSupply", type: "uint256" },
      { name: "minted", type: "uint256" },
      { name: "priceWei", type: "uint256" },
      { name: "active", type: "bool" },
      { name: "baseURI", type: "string" },
    ],
  },
  { stateMutability: "payable", type: "function", name: "mintByDesign",
    inputs: [{ name: "designId", type: "uint256" },{ name: "quantity", type: "uint256" }],
    outputs: [] },
] as const;

const nftAbiV2 = [
  { stateMutability: "view", type: "function", name: "publicSaleEnabled", inputs: [], outputs: [{ type: "bool" }] },
  {
    stateMutability: "view", type: "function", name: "design",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "name", type: "string" },
      { name: "tier", type: "uint8" },
      { name: "maxEditions", type: "uint16" },
      { name: "minted", type: "uint16" },
      { name: "tierBoostBps", type: "uint16" },
      { name: "mintPriceWei", type: "uint256" },
      { name: "active", type: "bool" },
      { name: "baseURI", type: "string" },
    ],
  },
  { stateMutability: "payable", type: "function", name: "mintByDesign",
    inputs: [{ name: "designId", type: "uint256" },{ name: "quantity", type: "uint256" }],
    outputs: [] },
] as const;

// Pancake/UniswapV2 pair
const pairAbi = [
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "token1", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  {
    type: "function", name: "getReserves", stateMutability: "view", inputs: [],
    outputs: [
      { type: "uint112", name: "_reserve0" },
      { type: "uint112", name: "_reserve1" },
      { type: "uint32", name: "_blockTimestampLast" },
    ],
  },
] as const;

/* =========================================
 * Helpers
 * ======================================= */
function isAddrLike(a?: string) {
  return !!a && /^0x[a-fA-F0-9]{40}$/.test(a);
}

function useConfigWarnings() {
  const [warnings, setWarnings] = useState<string[]>([]);
  useEffect(() => {
    const w: string[] = [];
    if (!CONFIG.network.chainId) w.push("NEXT_PUBLIC_CHAIN_ID is missing.");
    if (!isAddrLike(CONFIG.nft.address))
      w.push("NEXT_PUBLIC_NFT_ADDR looks invalid (expect 0x + 40 hex).");
    if (!CONFIG.ipfsGateway) w.push("NEXT_PUBLIC_IPFS_GATEWAY not set.");
    if (!CONFIG.wbnbBusdPair && !Number.isFinite(CONFIG.manualBnbUsd as number))
      w.push("USD price disabled: set NEXT_PUBLIC_WBNB_BUSD_PAIR or NEXT_PUBLIC_MANUAL_BNB_USD.");
    setWarnings(w);
  }, []);
  return warnings;
}

function useSlugAndId() {
  const [slug, setSlug] = useState<string | null>(null);
  const [id, setId] = useState<number | null>(null);
  const [debug, setDebug] = useState<boolean>(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const qId = params.get("designId");
    const qSlug = params.get("design");
    const dbg = params.get("debug");
    setDebug(dbg === "1");
    if (qId) setId(Number(qId));
    if (qSlug) setSlug(qSlug.toLowerCase());
    if (!qId && !qSlug) {
      const parts = window.location.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1]?.toLowerCase();
      if (last) setSlug(last);
    }
  }, []);
  useEffect(() => {
    if (id == null && slug && CONFIG.SLUG_MAP[slug]) {
      setId(CONFIG.SLUG_MAP[slug]);
    }
  }, [slug, id]);
  return { slug, designId: id, debug };
}

function parseTierAndDesignFromSlug(slug?: string | null) {
  if (!slug) return { tierNo: null as number | null, designNo: null as number | null };
  const m = slug.match(/^t(\d+)-design-(\d+)$/i);
  if (!m) return { tierNo: null, designNo: null };
  return { tierNo: Number(m[1]), designNo: Number(m[2]) };
}

function ipfsToGateway(uri: string, gateway = CONFIG.ipfsGateway) {
  if (!uri) return uri;
  if (uri.startsWith("ipfs://")) {
    let path = uri.slice("ipfs://".length).replace(/^ipfs\//, "");
    return gateway.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
  }
  return uri;
}

// (4) Deep candidate paths (baseURI may be folder or file)
// tries numeric {id}.json and slug.json at each path depth
function candidateMetaPaths(baseURI: string, designId: number, slug?: string | null) {
  const out: string[] = [];
  const http = ipfsToGateway(baseURI);
  if (/\.(json)$/i.test(http)) out.push(http);
  if (baseURI.startsWith("data:application/json;base64,")) {
    out.push(baseURI);
    return out;
  }
  let u: URL | null = null;
  try { u = new URL(http); } catch {}
  if (!u) return Array.from(new Set(out));
  const parts = u.pathname.split("/").filter(Boolean);
  const minLen = 2;
  for (let len = parts.length; len >= minLen; len--) {
    const base = u.origin + "/" + parts.slice(0, len).join("/") + "/";
    out.push(base + `${designId}.json`);
    if (slug) out.push(base + `${slug}.json`);
  }
  return Array.from(new Set(out));
}

// (2) Robust fetch: multi-gateway + promiseAny with graceful fallbacks
async function fetchJsonFromCandidates(paths: string[], gateways = CONFIG.gateways) {
  const urls: string[] = [];
  for (const p of paths) {
    if (!p) continue;
    if (p.startsWith("data:application/json;base64,")) {
      urls.push(p);
      continue;
    }
    if (p.startsWith("http://") || p.startsWith("https://")) {
      urls.push(p);
    } else if (p.startsWith("ipfs://")) {
      for (const g of gateways) urls.push(ipfsToGateway(p, g));
    } else {
      for (const g of gateways) urls.push((g.endsWith("/") ? g : g + "/") + p.replace(/^\/+/, ""));
    }
  }

  const tried: string[] = [];
  const attempts = urls.map((u) => (async () => {
    tried.push(u);
    if (u.startsWith("data:application/json;base64,")) {
      const jsonStr = atob(u.replace("data:application/json;base64,", ""));
      return JSON.parse(jsonStr);
    }
    // try cache first, then fall back to no-store on failure
    const r = await fetch(u, { cache: "force-cache" });
    if (!r.ok) {
      const r2 = await fetch(u, { cache: "no-store" });
      if (!r2.ok) throw new Error(`HTTP ${r.status}/${r2.status}`);
      return r2.json();
    }
    return r.json();
  })());

  try {
    const json = await promiseAny(attempts);
    return { json, tried };
  } catch (e) {
    return { json: null as any, tried, error: (e as any)?.message || String(e) };
  }
}

async function getBnbUsdPrice(client: any, pair: `0x${string}` | "", wbnb: `0x${string}`, busd: `0x${string}`): Promise<number | null> {
  try {
    if (!client || !pair) return null;
    const [t0, t1, reserves] = await Promise.all([
      client.readContract({ address: pair, abi: pairAbi, functionName: "token0" }) as Promise<string>,
      client.readContract({ address: pair, abi: pairAbi, functionName: "token1" }) as Promise<string>,
      client.readContract({ address: pair, abi: pairAbi, functionName: "getReserves" }) as Promise<[bigint, bigint, number]>,
    ]);
    const token0 = (t0 as string).toLowerCase();
    const token1 = (t1 as string).toLowerCase();
    const [r0, r1] = reserves;
    const a = CONFIG.wbnb.toLowerCase();
    const b = CONFIG.busd.toLowerCase();
    if (token0 === a && token1 === b) { if (r0 === 0n) return null; return Number(r1) / Number(r0); }
    if (token0 === b && token1 === a) { if (r1 === 0n) return null; return Number(r0) / Number(r1); }
    return null;
  } catch { return null; }
}

/* Media settings from URL */
function useMediaSettings() {
  const [px, setPx] = useState<number>(CONFIG.media.px);
  const [fit, setFit] = useState<"contain" | "cover">(CONFIG.media.fit);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const sizeStr = p.get("mediaSize") || p.get("media") || p.get("media_px") || "";
    const n = Number(sizeStr);
    if (Number.isFinite(n) && n > 0) setPx(Math.round(n));
    const fitStr = (p.get("fit") || "").toLowerCase();
    if (fitStr === "contain" || fitStr === "cover") setFit(fitStr as any);
  }, []);
  return { px, fit };
}

/* ============ Quantity input: "#,### NFT" (no prefill), with steppers ============ */
function formatQty(n: number | null) {
  if (!n || n <= 0) return "";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}
function QtyInput({
  value,
  onChange,
  className,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const display = (value && value > 0 ? `${formatQty(value)} NFT` : "");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value || "";
    const digits = raw.replace(/[^\d]/g, "");
    if (digits === "") { onChange(null); return; }
    const n = Number(digits);
    if (!Number.isFinite(n)) { onChange(null); return; }
    onChange(Math.max(0, Math.floor(n)));
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const maxBeforeSuffix = el.value.length - 4; // " NFT"
      const caret = el.selectionStart ?? el.value.length;
      if (caret > maxBeforeSuffix) el.setSelectionRange(maxBeforeSuffix, maxBeforeSuffix);
    });
  }

  function clampCaret() {
    const el = ref.current;
    if (!el) return;
    const maxBeforeSuffix = el.value.length - 4;
    const caret = el.selectionStart ?? 0;
    if (caret > maxBeforeSuffix) el.setSelectionRange(maxBeforeSuffix, maxBeforeSuffix);
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      placeholder="NFT"
      className={className}
      value={display}
      onChange={handleChange}
      onClick={clampCaret}
      onKeyUp={clampCaret}
      onMouseUp={clampCaret}
      onBlur={clampCaret}
    />
  );
}

/* =========================================
 * Page
 * ======================================= */
export default function Page() {
  const { slug, designId, debug } = useSlugAndId();
  const { tierNo: tierFromSlug, designNo: designNoFromSlug } = parseTierAndDesignFromSlug(slug);
  const { isConnected, chainId, address } = useAccount();
  const { switchChain } = useSwitchChain();
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { px: mediaPx, fit: mediaFit } = useMediaSettings();

  // (1) Config warnings
  const configWarnings = useConfigWarnings();

  // Wallet BNB balance
  const { data: bnbBal } = useBalance({
    address,
    chainId: CONFIG.network.chainId,
    query: { enabled: Boolean(address) },
  });

  // === STATE
  const [qty, setQty] = useState<number | null>(null); // no prefill
  const [loading, setLoading] = useState(false);

  const [priceWei, setPriceWei] = useState<bigint | null>(null);
  const [maxSupply, setMaxSupply] = useState<bigint | null>(null);
  const [minted, setMinted] = useState<bigint | null>(null);
  const [live, setLive] = useState<boolean>(false);

  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState<boolean>(false);
  const [metaLoading, setMetaLoading] = useState<boolean>(true);

  const [bnbUsd, setBnbUsd] = useState<number | null>(null);
  const [status, setStatus] = useState<{ kind: "info" | "error" | "success"; text: string; hash?: string } | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const [tierOnChain, setTierOnChain] = useState<number | null>(null);
  const [boostBps, setBoostBps] = useState<number | null>(null);
  const [debugInfo, setDebugInfo] = useState<{
    baseURI?: string;
    tried?: string[];
    error?: string;
    chosenMedia?: string | null;
    isVideo?: boolean;
    priceWei?: string | null;
    maxSupply?: string | null;
    minted?: string | null;
  }>({});

  const statusRef = useRef<HTMLDivElement | null>(null);

  const onWrongChain = isConnected && chainId !== CONFIG.network.chainId;

  // Derived
  const remaining = useMemo(() => {
    if (maxSupply == null || minted == null) return null;
    const r = Number(maxSupply - minted);
    return r >= 0 ? r : 0;
  }, [maxSupply, minted]);

  // Keep qty ≤ remaining
  useEffect(() => {
    if (remaining == null || qty == null) return;
    if (qty > remaining) setQty(remaining);
  }, [remaining, qty]);

  // Load design info (both ABIs)
  useEffect(() => {
    if (designId == null || !client) return;
    let cancelled = false;

    (async () => {
      try {
        setMetaLoading(true);

        let active = false;
        let baseURI = "";
        let price: bigint = 0n;
        let maxS: bigint = 0n;
        let mintedS: bigint = 0n;
        let tierTmp: number | null = null;
        let boostTmp: number | null = null;

        try {
          const [d, globalLive] = await Promise.all([
            client.readContract({
              address: CONFIG.nft.address,
              abi: nftAbiV1,
              functionName: "design",
              args: [BigInt(designId)],
            }) as Promise<[number, bigint, bigint, bigint, boolean, string]>,
            client.readContract({
              address: CONFIG.nft.address,
              abi: nftAbiV1,
              functionName: "publicSaleEnabled",
            }) as Promise<boolean>,
          ]);
          const [tier, maxSupply_, minted_, priceWei_, active_, baseURI_] = d;
          tierTmp = Number(tier);
          active = Boolean(active_ && globalLive);
          baseURI = String(baseURI_);
          price = BigInt(priceWei_);
          maxS = BigInt(maxSupply_);
          mintedS = BigInt(minted_);
        } catch {
          const [d2, globalLive2] = await Promise.all([
            client.readContract({
              address: CONFIG.nft.address,
              abi: nftAbiV2,
              functionName: "design",
              args: [BigInt(designId)],
            }) as Promise<[string, number, number, number, number, bigint, boolean, string]>,
            client.readContract({
              address: CONFIG.nft.address,
              abi: nftAbiV2,
              functionName: "publicSaleEnabled",
            }) as Promise<boolean>,
          ]);
          const [, tier, maxEditions, minted16, tierBoostBps, mintPriceWei, active2, baseURI2] = d2;
          tierTmp = Number(tier);
          boostTmp = Number(tierBoostBps);
          active = Boolean(active2 && globalLive2);
          baseURI = String(baseURI2);
          price = BigInt(mintPriceWei);
          maxS = BigInt(maxEditions);
          mintedS = BigInt(minted16);
        }

        if (cancelled) return;

        setTierOnChain(tierTmp);
        setBoostBps(boostTmp);
        setPriceWei(price);
        setMinted(mintedS);
        setMaxSupply(maxS);
        setLive(active);

        const paths = candidateMetaPaths(baseURI, designId, slug);
        const res = await fetchJsonFromCandidates(paths);
        let anim: string | null = null;
        let img: string | null = null;

        if (res.json) {
          const meta = res.json;
          const rawAnim = meta.animation_url ?? meta.animation ?? meta?.properties?.animation_url;
          const rawImg = meta.image ?? meta.image_url ?? meta.imageURI ?? meta?.properties?.image;
          if (rawAnim) anim = ipfsToGateway(String(rawAnim));
          if (rawImg) img = ipfsToGateway(String(rawImg));
        }

        if (!cancelled) {
          setDebugInfo((d) => ({
            ...d,
            baseURI,
            tried: res.tried || [],
            error: res.json ? undefined : (res.error || "No JSON found at candidates"),
            chosenMedia: anim || img || null,
            isVideo: !!anim,
            priceWei: price ? price.toString() : null,
            maxSupply: maxS ? maxS.toString() : null,
            minted: mintedS ? mintedS.toString() : null,
          }));
          if (anim) { setMediaUrl(anim); setIsVideo(true); }
          else if (img) { setMediaUrl(img); setIsVideo(false); }
          else { setMediaUrl(null); setIsVideo(false); }
        }
      } catch (e: any) {
        if (!cancelled) {
          setMediaUrl(null);
          setIsVideo(false);
          setDebugInfo((d) => ({ ...d, error: e?.message || String(e) }));
        }
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [designId, slug, client, refreshNonce]);

  // Optional BNB → USD
  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    (async () => {
      let p: number | null = null;
      if (CONFIG.wbnbBusdPair) {
        p = await getBnbUsdPrice(client, CONFIG.wbnbBusdPair, CONFIG.wbnb, CONFIG.busd);
      }
      if (p == null && Number.isFinite(CONFIG.manualBnbUsd as number)) {
        p = CONFIG.manualBnbUsd as number;
      }
      if (!cancelled) setBnbUsd(p);
    })();
    return () => { cancelled = true; };
  }, [client]);

  const soldOut = useMemo(
    () => (maxSupply != null && minted != null ? minted >= maxSupply : false),
    [maxSupply, minted]
  );

  const unitBnb = useMemo(() => {
    if (priceWei == null) return null;
    try { return Number(formatEther(priceWei)); } catch { return null; }
  }, [priceWei]);

  const unitUsd = useMemo(() => {
    if (unitBnb == null || bnbUsd == null) return null;
    const v = unitBnb * bnbUsd;
    return Number.isFinite(v) ? v : null;
  }, [unitBnb, bnbUsd]);

  const totalWei = useMemo(() => {
    if (priceWei == null) return null;
    const qtyNum = qty ?? 0;
    if (qtyNum <= 0) return null;
    try { return priceWei * BigInt(qtyNum); } catch { return null; }
  }, [priceWei, qty]);

  const totalBnb = useMemo(() => {
    if (totalWei == null) return null;
    try { return Number(formatEther(totalWei)); } catch { return null; }
  }, [totalWei]);

  const totalUsd = useMemo(() => {
    if (totalBnb == null || bnbUsd == null) return null;
    const v = totalBnb * bnbUsd;
    return Number.isFinite(v) ? v : null;
  }, [totalBnb, bnbUsd]);

  // Values for the caption
  const uiTier = tierFromSlug ?? tierOnChain ?? null;
  const uiDesignNo = designNoFromSlug ?? null;

  // Pre-flight: enough BNB?
  const needsFunds = useMemo(() => {
    if (!bnbBal?.value || totalWei == null) return false;
    try {
      return totalWei > bnbBal.value;
    } catch {
      return false;
    }
  }, [bnbBal?.value, totalWei]);

  function setFriendlyStatus(kind: "info" | "error" | "success", text: string, hash?: string) {
    setStatus({ kind, text, hash });
    requestAnimationFrame(() => {
      if (statusRef.current) {
        statusRef.current.focus();
        statusRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }

  function friendlyErrorMessage(raw: string) {
    const s = raw?.toLowerCase?.() || raw;
    if (/user rejected|denied|rejected the request/.test(s)) return "Transaction rejected.";
    if (/insufficient funds|insufficient balance/.test(s)) return "Not enough BNB for mint + gas.";
    if (/wrong network|chain|unsupported chain/.test(s)) return "Wrong network. Please switch.";
    if (/sold out|max supply|exceeds supply|insufficient supply|out of stock/.test(s)) return "Sold out.";
    if (/nonce too low|replacement transaction underpriced/.test(s)) return "Network is busy. Try again.";
    return raw;
  }

  async function doMint() {
    if (!client) return;
    if (onWrongChain) {
      try { await switchChain({ chainId: CONFIG.network.chainId }); } catch {}
      return;
    }
    if (!isConnected) return;
    if (designId == null || totalWei == null || !qty || qty <= 0) return;
    if (remaining != null && qty > remaining) return;

    try {
      setFriendlyStatus("info", "Submitting transaction…");
      setLoading(true);

      let h: `0x${string}`;
      try {
        h = (await writeContractAsync({
          address: CONFIG.nft.address,
          abi: nftAbiV1,
          functionName: "mintByDesign",
          args: [BigInt(designId), BigInt(qty)],
          value: totalWei,
        })) as `0x${string}`;
      } catch {
        h = (await writeContractAsync({
          address: CONFIG.nft.address,
          abi: nftAbiV2,
          functionName: "mintByDesign",
          args: [BigInt(designId), BigInt(qty)],
          value: totalWei,
        })) as `0x${string}`;
      }

      setFriendlyStatus("info", "Submitted. Waiting for confirmation…", h);
      await client.waitForTransactionReceipt({ hash: h });

      setFriendlyStatus("success", "Confirmed on-chain. View receipt.", h);
      setRefreshNonce((x) => x + 1);
    } catch (e: any) {
      const raw = e?.shortMessage || e?.message || String(e);
      setFriendlyStatus("error", friendlyErrorMessage(raw));
    } finally {
      setLoading(false);
    }
  }

  const mediaInnerClass =
    (mediaFit === "contain"
      ? "max-w-full max-h-full"
      : "w-full h-full") + " object-center " + (mediaFit === "contain" ? "object-contain" : "object-cover");

  // Button label with inline error messages
  const qtyMissing = !qty || qty <= 0;
  const ctaLabel = useMemo(() => {
    if (!isConnected) return "Please connect your Wallet";
    if (onWrongChain) return "Please switch to the BNB Network";
    if (soldOut) return CONFIG.copy.soldOut;
    if (!live) return CONFIG.copy.notLive;
    if (qtyMissing) return "Enter how much Pieces you want to collect";
    if (needsFunds) return "You need more BNB in wallet";
    return loading ? "Processing…" : CONFIG.copy.button;
  }, [isConnected, onWrongChain, soldOut, live, qtyMissing, needsFunds, loading]);

  // Error color for the button when an error message is showing
  const isErrorCta =
    (isConnected && (onWrongChain || soldOut || !live || needsFunds || qtyMissing));

  const ctaClass =
    (isErrorCta
      ? "w-full mt-4 rounded-xl px-6 py-3 font-semibold bg-black border border-gold text-white hover:bg-gold hover:text-white disabled:opacity-100"
      : "btn-primary w-full mt-4");

  return (
    <div className="mx-auto w-full max-w-5xl px-1 py-12">
      {/* (1) Config warnings */}
      {configWarnings.length > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-900 text-sm">
          <div className="font-semibold mb-1">Configuration warnings:</div>
          <ul className="list-disc ml-5">
            {configWarnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

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
          <span className="text-gold">Collect</span> <span className="text-white">vaNFT</span>
        </h1>
        <p className="mt-3 text-white max-w-xl">{CONFIG.copy.subhead}</p>
        <div className="mt-6"><ConnectButton /></div>
      </div>

      {/* Network warning */}
      {isConnected && onWrongChain && (
        <div className="mb-4 p-3 rounded-xl bg-black border border-gold text-sm flex flex-col sm:flex-row sm:items-center sm:justify-center gap-2">
          <span>Please switch to the correct network.</span>
          <button className="btn-secondary" onClick={() => switchChain({ chainId: CONFIG.network.chainId })}>Switch</button>
        </div>
      )}

      {/* Status (tx only; validation errors live on the button) */}
      {status && (
        <div
          ref={statusRef}
          tabIndex={-1}
          aria-live="polite"
          className={`mb-4 p-3 rounded-xl border text-sm outline-none ${
            status.kind === "error" ? "bg-red-50 border-red-200" :
            status.kind === "success" ? "bg-green-50 border-green-200" :
            "bg-blue-50 border-blue-200"
          }`}
        >
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <div className="flex items-center justify-center gap-3">
              <span>{status.text}</span>
              {status.hash && (
                <a className="underline" href={`${CONFIG.network.explorer}/tx/${status.hash}`} target="_blank" rel="noreferrer">
                  View on BscScan ↗
                </a>
              )}
            </div>
            {status.kind === "success" && (
              <a
                className="underline"
                href={CONFIG.links.staking}
                target="_blank"
                rel="noreferrer"
              >
                Congrats and welcome in the vaMILY, visit our Staking Platform and enjoy your APY Boost →
              </a>
            )}
          </div>
        </div>
      )}

      {designId == null ? (
        <div className="text-sm opacity-70 text-center">
          No design selected. Add <code>?design=t1-design-01</code> or <code>?designId=1</code> to the URL.
        </div>
      ) : (
        <>
          {/* Design media */}
          <div className="p-3">
            <div className="font-display text-base sm:text-3xl text-center font-semibold mb-2">
              {uiTier != null && uiDesignNo != null
                ? <>Tier {uiTier} – Design {uiDesignNo}</>
                : <>Design ID #{designId}</>}
            </div>
            <div
              className="rounded-xl bg-black mx-auto overflow-hidden grid place-items-center"
              style={{ width: mediaPx, height: mediaPx }}
            >
              {metaLoading ? (
                <div className="animate-pulse h-full w-full grid place-items-center text-xs opacity-60">
                  Loading media…
                </div>
              ) : mediaUrl ? (
                isVideo ? (
                  <video
                    src={mediaUrl}
                    className={mediaInnerClass}
                    autoPlay
                    loop
                    muted
                    playsInline
                    aria-label="NFT animation"
                  />
                ) : (
                  <img
                    src={mediaUrl}
                    className={mediaInnerClass + " block mx-auto"}
                    alt={`Design ${designId}`}
                    loading="lazy"
                  />
                )
              ) : (
                <div className="grid h-full w-full place-items-center text-xs opacity-60">
                  Media not available yet
                </div>
              )}
            </div>

            {boostBps != null && (
              <div className="text-center text-sm opacity-80 mt-3">
                Boost when staking: <b>+{(boostBps / 100).toFixed(2)}% APY</b>
              </div>
            )}
          </div>

          {/* four cards row */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {/* 1) Amount – "#,### NFT" + steppers; no prefilled 1 */}
            <div className="rounded-2xl border border-gold p-3">
              <div className="text-center font-semibold mb-2">Pieces</div>
              <div className="flex items-stretch gap-2">
                <button
                  className="btn-secondary px-3"
                  onClick={() => setQty((q) => Math.max(0, (q ?? 0) - 1) || null)}
                  disabled={!qty || qty <= 0}
                  aria-label="Decrease quantity"
                  title="Decrease"
                >
                  −
                </button>
                <QtyInput
                  value={qty}
                  onChange={(n) => setQty(n)}
                  className="w-full rounded-xl border border-gold bg-black px-3 py-2 text-white text-center"
                />
                <button
                  className="btn-secondary px-3"
                  onClick={() => setQty((q) => {
                    const next = (q ?? 0) + 1;
                    if (remaining != null && next > remaining) return remaining;
                    return next;
                  })}
                  disabled={remaining != null && (qty ?? 0) >= remaining}
                  aria-label="Increase quantity"
                  title="Increase"
                >
                  +
                </button>
              </div>
            </div>

            {/* 2) Availability */}
            <div className="rounded-2xl border border-gold p-3">
              <div className="text-center font-semibold mb-2">Availability</div>
              <div className="mt-2 text-xl text-center opacity-100">
                {maxSupply != null && minted != null ? (
                  <><b>{Number(maxSupply - minted)}</b> / {String(maxSupply)}</>
                ) : "—"}
              </div>
            </div>

            {/* 3) Price (unit) */}
            <div className="rounded-2xl border border-gold p-3">
              <div className="text-center font-semibold mb-2">Design Price</div>
              <div className="text-center text-xl font-semibold">
                {unitBnb != null ? `${unitBnb.toLocaleString(undefined, { maximumFractionDigits: 6 })} BNB` : "—"}
              </div>
              <div className="text-center text-sm opacity-80">
                {(CONFIG.wbnbBusdPair || Number.isFinite(CONFIG.manualBnbUsd))
                  ? (unitUsd != null ? `$${unitUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—")
                  : "USD unavailable on this network"}
              </div>
              {!live && (
                <div className="mt-3 p-2 rounded-lg bg-yellow-50 border border-yellow-200 text-xs text-center text-black">
                  {CONFIG.copy.notLive}
                </div>
              )}
              {soldOut && (
                <div className="mt-3 p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-center text-black">
                  {CONFIG.copy.soldOut}
                </div>
              )}
            </div>

            {/* 4) Total Price */}
            <div className="rounded-2xl border border-gold p-3">
              <div className="text-center font-semibold mb-2">Total Price</div>
              <div className="text-center text-xl font-semibold">
                {totalBnb != null ? `${totalBnb.toLocaleString(undefined, { maximumFractionDigits: 6 })} BNB` : "—"}
              </div>
              <div className="text-center text-sm opacity-80">
                {(CONFIG.wbnbBusdPair || Number.isFinite(CONFIG.manualBnbUsd))
                  ? (totalUsd != null ? `$${totalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—")
                  : "USD unavailable on this network"}
              </div>
            </div>
          </div>

          {/* Collect CTA */}
          <button
            className={ctaClass}
            onClick={doMint}
            disabled={
              !isConnected ||
              onWrongChain ||
              !live ||
              soldOut ||
              loading ||
              designId == null ||
              totalWei == null ||
              qtyMissing ||
              needsFunds
            }
            title={
              !isConnected ? "Connect wallet" :
              onWrongChain ? "Switch network" :
              !live ? "Not live yet" :
              soldOut ? "Sold out" :
              qtyMissing ? "Enter quantity" :
              needsFunds ? "Not enough BNB in wallet" : undefined
            }
          >
            {ctaLabel}
          </button>

          {/* (9) Link row under CTA */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <a
              className="btn-secondary w-full text-center"
              href={CONFIG.links.website}
              target="_blank"
              rel="noreferrer"
            >
              Website
            </a>
            <a
              className="btn-secondary w-full text-center"
              href={CONFIG.links.staking}
              target="_blank"
              rel="noreferrer"
            >
              Staking
            </a>
            <a
              className="btn-secondary w-full text-center"
              href={CONFIG.links.market}
              target="_blank"
              rel="noreferrer"
            >
              NFT Marketplace
            </a>
          </div>

          {/* (11) Optional debug panel (?debug=1) */}
          {debug && (
            <div className="mt-4 p-3 rounded-xl border border-dashed border-gold/60 text-xs">
              <div><b>Contract:</b> {CONFIG.nft.address}</div>
              <div><b>BaseURI:</b> {debugInfo.baseURI || "—"}</div>
              <div><b>Chosen media:</b> {debugInfo.chosenMedia || "—"} ({debugInfo.isVideo ? "video" : "image"})</div>
              <div><b>On-chain:</b> priceWei={debugInfo.priceWei || "—"}, minted={debugInfo.minted || "—"}, maxSupply={debugInfo.maxSupply || "—"}</div>
              <div className="mt-2"><b>Tried meta URLs:</b>
                <ul className="list-disc ml-5">
                  {(debugInfo.tried || []).map((u) => <li key={u}>{u}</li>)}
                </ul>
              </div>
              {debugInfo.error && <div className="text-red-400 mt-2"><b>Error:</b> {debugInfo.error}</div>}
            </div>
          )}

          {address && (
            <div className="mt-3 text-center text-xs opacity-70">
              Minting from: <code className="opacity-90">{CONFIG.nft.address}</code>
            </div>
          )}
        </>
      )}

      <div className="mt-8 text-xs opacity-70 text-center">{CONFIG.copy.disclaimer}</div>
    </div>
  );
}
