import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          background: "#141416",
          color: "#e4e4e7",
          padding: "72px",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "620px",
          }}
        >
          <div style={{ display: "flex", fontSize: 18, letterSpacing: 6, color: "#c23a3a" }}>T2C</div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 64, lineHeight: 1.05, letterSpacing: -2 }}>
            <div style={{ display: "flex" }}>Swap any chain.</div>
            <div style={{ display: "flex" }}>Take USDT or LLM credit.</div>
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#a1a1aa" }}>
            $500 floor · 50 bps · wallet-only session
          </div>
        </div>
        <div
          style={{
            width: 360,
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 28,
            padding: 28,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 18,
          }}
        >
          <div style={{ display: "flex", fontFamily: "monospace", fontSize: 20 }}>ETH / USDC  $1,842.60</div>
          <div style={{ display: "flex", fontFamily: "monospace", fontSize: 20 }}>Reward      $9.21</div>
          <div style={{ display: "flex", fontFamily: "monospace", fontSize: 20, color: "#c23a3a" }}>
            Rail        USDT or LLM
          </div>
        </div>
      </div>
    ),
    size,
  );
}
