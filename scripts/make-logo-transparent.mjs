import fs from "node:fs";
import sharp from "sharp";

const src =
  process.argv[2] ??
  "/Users/apple/.cursor/projects/Users-apple-Share-fees/assets/logi1-e90a8564-9430-4e4e-899f-f03cd8604b6c.png";

const paths = [
  "public/logo.png",
  "src/app/icon.png",
  "src/app/apple-icon.png",
];

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

for (let i = 0; i < data.length; i += channels) {
  const a = data[i + 3];
  // Drop faint fringe (alpha=1 white halo) that reads as a dark box when scaled.
  if (a < 128) {
    data[i + 3] = 0;
    continue;
  }
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  if (r < 28 && g < 28 && b < 28) {
    data[i + 3] = 0;
  }
}

let png = await sharp(data, { raw: { width, height, channels: 4 } })
  .trim({ threshold: 0 })
  .png({ compressionLevel: 9 })
  .toBuffer();

for (const path of paths) {
  fs.writeFileSync(path, png);
  const meta = await sharp(path).metadata();
  console.log(`saved ${path} (${meta.width}x${meta.height})`);
}
