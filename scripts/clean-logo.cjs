const fs = require('fs');
const { PNG } = require('pngjs');

// We use an un-modified backup if possible or process existing
const inputPath = 'c:/Web/shopofbow/assets/new-logo.png';
const outputPathPublic = 'c:/Web/shopofbow/public/assets/new-logo.png';
const outputPathAssets = 'c:/Web/shopofbow/assets/new-logo.png';

fs.createReadStream(inputPath)
  .pipe(new PNG({ filterType: 4 }))
  .on('parsed', function () {
    let minX = this.width, minY = this.height, maxX = 0, maxY = 0;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = (this.width * y + x) << 2;
        const r = this.data[idx];
        const g = this.data[idx + 1];
        const b = this.data[idx + 2];

        // Chromaticity check:
        // Logo features cyan (high B, high G, B > R), gold (high R, high G, R > B), or white core (high R, G, B)
        const isCyan = (b > 90 && g > 80 && b > r + 10);
        const isGold = (r > 110 && g > 90 && r > b + 15);
        const isWhiteCore = (r > 150 && g > 150 && b > 150);
        const isSparkle = (r > 130 && g > 130 && b > 100 && (Math.abs(r - g) < 40));
        
        // Background is neutral grey/black (low saturation, r approx g approx b)
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const saturation = maxC - minC;

        if ((isCyan || isGold || isWhiteCore || isSparkle) && saturation > 12) {
          // Keep pixel with full opacity
          this.data[idx + 3] = 255;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        } else if ((isCyan || isGold || isWhiteCore) && saturation > 6) {
          // Semi-transparent edge antialiasing
          this.data[idx + 3] = 160;
        } else {
          // Pure transparent background pixel
          this.data[idx + 3] = 0;
        }
      }
    }

    console.log(`Bounding box: (${minX}, ${minY}) to (${maxX}, ${maxY})`);

    // Create cropped PNG containing ONLY the logo icon
    const cropWidth = Math.max(1, maxX - minX + 1);
    const cropHeight = Math.max(1, maxY - minY + 1);
    const cropped = new PNG({ width: cropWidth, height: cropHeight });

    this.bitblt(cropped, minX, minY, cropWidth, cropHeight, 0, 0);

    const buffer = PNG.sync.write(cropped);
    fs.writeFileSync(outputPathPublic, buffer);
    fs.writeFileSync(outputPathAssets, buffer);
    console.log('SUCCESSFULLY_EXTRACTED_LOGO_ICON_ONLY');
  })
  .on('error', function (err) {
    console.error('Error processing PNG:', err);
  });
