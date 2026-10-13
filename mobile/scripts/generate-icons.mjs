import sharp from "sharp";
const arrow =
  '<path d="M345 665L665 345M345 345H665V665" fill="none" stroke="white" stroke-width="72" stroke-linecap="round" stroke-linejoin="round"/>';
await sharp(
  Buffer.from(
    `<svg width="1024" height="1024"><rect width="1024" height="1024" rx="230" fill="#6355D9"/>${arrow}</svg>`,
  ),
)
  .png()
  .toFile("assets/icon.png");
await sharp(
  Buffer.from(
    `<svg width="1024" height="1024" viewBox="-280 -280 1584 1584">${arrow}</svg>`,
  ),
)
  .png()
  .toFile("assets/adaptive-icon.png");
