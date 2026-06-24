import fs from "fs";
import path from "path";
import sharp from "sharp";

async function fetchFontAsBase64(cssUrl) {
  console.log(`Fetching font CSS from: ${cssUrl}...`);
  const res = await fetch(cssUrl);
  const cssText = await res.text();
  
  // Extract ttf url
  const match = cssText.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/);
  if (!match || !match[1]) {
    throw new Error(`Failed to extract font URL from CSS: ${cssText}`);
  }
  
  const fontUrl = match[1];
  console.log(`Downloading font binary from: ${fontUrl}...`);
  const fontRes = await fetch(fontUrl);
  const fontArrayBuffer = await fontRes.arrayBuffer();
  const fontBuffer = Buffer.from(fontArrayBuffer);
  
  return fontBuffer.toString("base64");
}

async function start() {
  try {
    const playfairBase64 = await fetchFontAsBase64("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,600");
    const cinzelBase64 = await fetchFontAsBase64("https://fonts.googleapis.com/css2?family=Cinzel:wght@500");
    const interBase64 = await fetchFontAsBase64("https://fonts.googleapis.com/css2?family=Inter:wght@900");
    
    // 1. Large Logo SVG
    const largeSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="150" viewBox="0 0 600 150">
  <defs>
    <style>
      @font-face {
        font-family: 'Playfair Display';
        font-style: italic;
        font-weight: 600;
        src: url(data:font/ttf;base64,${playfairBase64}) format('truetype');
      }
      @font-face {
        font-family: 'Cinzel';
        font-style: normal;
        font-weight: 500;
        src: url(data:font/ttf;base64,${cinzelBase64}) format('truetype');
      }
      @font-face {
        font-family: 'Inter';
        font-style: normal;
        font-weight: 900;
        src: url(data:font/ttf;base64,${interBase64}) format('truetype');
      }
      
      .logo-s {
        font-family: 'Playfair Display', serif;
        font-size: 110px;
        font-style: italic;
        font-weight: 600;
        fill: #1e293b;
      }
      .logo-e {
        font-family: 'Cinzel', serif;
        font-size: 90px;
        font-weight: 500;
        fill: #1e293b;
      }
      .logo-text {
        font-family: 'Inter', sans-serif;
        font-size: 76px;
        font-weight: 900;
        letter-spacing: -2px;
        fill: #1e293b;
      }
      .divider {
        fill: #1e293b;
      }
    </style>
    <mask id="s-cut">
      <rect x="0" y="0" width="200" height="150" fill="white" />
      <text x="25" y="112" class="logo-s" fill="black" stroke="black" stroke-width="3">S</text>
    </mask>
  </defs>
  
  <g transform="translate(10, 5)">
    <text x="48" y="104" class="logo-e" mask="url(#s-cut)">E</text>
    <text x="25" y="112" class="logo-s">S</text>
  </g>
  
  <rect x="175" y="25" width="4" height="100" class="divider" />
  
  <text x="200" y="102" class="logo-text">Logistique</text>
</svg>
    `.trim();

    // 1b. Large Logo SVG (White version)
    const largeSvgWhite = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="150" viewBox="0 0 600 150">
  <defs>
    <style>
      @font-face {
        font-family: 'Playfair Display';
        font-style: italic;
        font-weight: 600;
        src: url(data:font/ttf;base64,${playfairBase64}) format('truetype');
      }
      @font-face {
        font-family: 'Cinzel';
        font-style: normal;
        font-weight: 500;
        src: url(data:font/ttf;base64,${cinzelBase64}) format('truetype');
      }
      @font-face {
        font-family: 'Inter';
        font-style: normal;
        font-weight: 900;
        src: url(data:font/ttf;base64,${interBase64}) format('truetype');
      }
      
      .logo-s {
        font-family: 'Playfair Display', serif;
        font-size: 110px;
        font-style: italic;
        font-weight: 600;
        fill: #f8fafc;
      }
      .logo-e {
        font-family: 'Cinzel', serif;
        font-size: 90px;
        font-weight: 500;
        fill: #f8fafc;
      }
      .logo-text {
        font-family: 'Inter', sans-serif;
        font-size: 76px;
        font-weight: 900;
        letter-spacing: -2px;
        fill: #f8fafc;
      }
      .divider {
        fill: #f8fafc;
      }
    </style>
    <mask id="s-cut-white">
      <rect x="0" y="0" width="200" height="150" fill="white" />
      <text x="25" y="112" class="logo-s" fill="black" stroke="black" stroke-width="3">S</text>
    </mask>
  </defs>
  
  <g transform="translate(10, 5)">
    <text x="48" y="104" class="logo-e" mask="url(#s-cut-white)">E</text>
    <text x="25" y="112" class="logo-s">S</text>
  </g>
  
  <rect x="175" y="25" width="4" height="100" class="divider" />
  
  <text x="200" y="102" class="logo-text">Logistique</text>
</svg>
    `.trim();

    // 2. Short / Monogram Logo SVG
    const shortSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
  <defs>
    <style>
      @font-face {
        font-family: 'Playfair Display';
        font-style: italic;
        font-weight: 600;
        src: url(data:font/ttf;base64,${playfairBase64}) format('truetype');
      }
      @font-face {
        font-family: 'Cinzel';
        font-style: normal;
        font-weight: 500;
        src: url(data:font/ttf;base64,${cinzelBase64}) format('truetype');
      }
      .logo-s {
        font-family: 'Playfair Display', serif;
        font-size: 110px;
        font-style: italic;
        font-weight: 600;
        fill: #1e293b;
      }
      .logo-e {
        font-family: 'Cinzel', serif;
        font-size: 90px;
        font-weight: 500;
        fill: #1e293b;
      }
    </style>
    <mask id="s-cut-mono">
      <rect x="0" y="0" width="150" height="150" fill="white" />
      <text x="25" y="112" class="logo-s" fill="black" stroke="black" stroke-width="3">S</text>
    </mask>
  </defs>
  
  <g transform="translate(5, 5)">
    <text x="48" y="104" class="logo-e" mask="url(#s-cut-mono)">E</text>
    <text x="25" y="112" class="logo-s">S</text>
  </g>
</svg>
    `.trim();

    // 2b. Short / Monogram Logo SVG (White version)
    const shortSvgWhite = `
<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
  <defs>
    <style>
      @font-face {
        font-family: 'Playfair Display';
        font-style: italic;
        font-weight: 600;
        src: url(data:font/ttf;base64,${playfairBase64}) format('truetype');
      }
      @font-face {
        font-family: 'Cinzel';
        font-style: normal;
        font-weight: 500;
        src: url(data:font/ttf;base64,${cinzelBase64}) format('truetype');
      }
      .logo-s {
        font-family: 'Playfair Display', serif;
        font-size: 110px;
        font-style: italic;
        font-weight: 600;
        fill: #f8fafc;
      }
      .logo-e {
        font-family: 'Cinzel', serif;
        font-size: 90px;
        font-weight: 500;
        fill: #f8fafc;
      }
    </style>
    <mask id="s-cut-mono-white">
      <rect x="0" y="0" width="150" height="150" fill="white" />
      <text x="25" y="112" class="logo-s" fill="black" stroke="black" stroke-width="3">S</text>
    </mask>
  </defs>
  
  <g transform="translate(5, 5)">
    <text x="48" y="104" class="logo-e" mask="url(#s-cut-mono-white)">E</text>
    <text x="25" y="112" class="logo-s">S</text>
  </g>
</svg>
    `.trim();

    // Ensure public folder exists
    if (!fs.existsSync("public")) {
      fs.mkdirSync("public", { recursive: true });
    }

    // Render Large Logo to PNG
    console.log("Rendering Large logo with Sharp...");
    await sharp(Buffer.from(largeSvg))
      .png()
      .toFile("public/SE LogoLargeHEXT02.png");
    console.log("Large logo generated successfully at public/SE LogoLargeHEXT02.png!");

    // Render Large White Logo to PNG
    console.log("Rendering Large White logo with Sharp...");
    await sharp(Buffer.from(largeSvgWhite))
      .png()
      .toFile("public/SE LogoLarge_white.png");
    console.log("Large White logo generated successfully at public/SE LogoLarge_white.png!");

    // Render Short Logo to PNG
    console.log("Rendering Short logo with Sharp...");
    await sharp(Buffer.from(shortSvg))
      .png()
      .toFile("public/SE LogoWBT01.png");
    console.log("Short logo generated successfully at public/SE LogoWBT01.png!");

    // Render Short White Logo to PNG
    console.log("Rendering Short White logo with Sharp...");
    await sharp(Buffer.from(shortSvgWhite))
      .png()
      .toFile("public/SE LogoWBT01_white.png");
    console.log("Short White logo generated successfully at public/SE LogoWBT01_white.png!");

    // Overwrite legacy filenames for backward compatibility
    fs.copyFileSync("public/SE LogoLargeHEXT02.png", "public/logo-dark.png");
    fs.copyFileSync("public/SE LogoLarge_white.png", "public/logo-light.png");
    fs.copyFileSync("public/SE LogoWBT01.png", "public/logo-short-dark.png");
    fs.copyFileSync("public/SE LogoWBT01_white.png", "public/logo-short-light.png");
    console.log("Legacy logo files overwritten successfully!");

  } catch (err) {
    console.error("Error generating logos:", err);
    process.exit(1);
  }
}

start();
