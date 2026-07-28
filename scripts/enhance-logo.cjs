const fs = require('fs');
const { PNG } = require('pngjs');

const inputPath = 'c:/Web/shopofbow/assets/new-logo.png';
const outputPathPublic = 'c:/Web/shopofbow/public/assets/new-logo.png';
const outputPathAssets = 'c:/Web/shopofbow/assets/new-logo.png';

fs.createReadStream(inputPath)
  .pipe(new PNG({ filterType: 4 }))
  .on('parsed', function () {
    let minX = this.width, minY = this.height, maxX = 0, maxY = 0;

    // Phase 1: High-precision color mask with smooth anti-aliased edge
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = (this.width * y + x) << 2;
        const r = this.data[idx];
        const g = this.data[idx + 1];
        const b = this.data[idx + 2];

        const isCyan = (b > 85 && g > 75 && b > r + 5);
        const isGold = (r > 100 && g > 80 && r > b + 10);
        const isWhiteCore = (r > 140 && g > 140 && b > 140);
        const isSparkle = (r > 120 && g > 120 && b > 90);
        
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const saturation = maxC - minC;

        if ((isCyan || isGold || isWhiteCore || isSparkle) && saturation > 8) {
          // Sharp pixel
          this.data[idx + 3] = 255;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        } else if ((isCyan || isGold || isWhiteCore) && saturation > 4) {
          // Anti-aliased boundary
          this.data[idx + 3] = 200;
        } else {
          // Background transparent
          this.data[idx + 3] = 0;
        }
      }
    }

    const cropWidth = Math.max(1, maxX - minX + 1);
    const cropHeight = Math.max(1, maxY - minY + 1);
    const cropped = new PNG({ width: cropWidth, height: cropHeight });

    this.bitblt(cropped, minX, minY, cropWidth, cropHeight, 0, 0);

    // Apply Unsharp Mask (Sharpening filter)
    const sharpened = new PNG({ width: cropWidth, height: cropHeight });
    const weights = [
      0, -1,  0,
     -1,  5, -1,
      0, -1,  0
    ];

    for (let y = 1; y < cropHeight - 1; y++) {
      for (let x = 1; x < cropWidth - 1; x++) {
        let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
        for (let cy = -1; cy <= 1; cy++) {
          for (let cx = -1; cx <= 1; cx++) {
            const cIdx = (cropWidth * (y + cy) + (x + cx)) << 2;
            const w = weights[(cy + 1) * 3 + (cx + 1)];
            rSum += cropped.data[cIdx] * w;
            gSum += cropped.data[cIdx + 1] * w;
            bSum += cropped.data[cIdx + 2] * w;
            aSum += cropped.data[cIdx + 3] * w;
          }
        }

        const outIdx = (cropWidth * y + x) << 2;
        sharpened.data[outIdx] = Math.min(255, Math.max(0, rSum));
        sharpened.data[outIdx + 1] = Math.min(255, Math.max(0, gSum));
        sharpened.data[outIdx + 2] = Math.min(255, Math.max(0, bSum));
        sharpened.data[outIdx + 3] = Math.min(255, Math.max(0, aSum));
      }
    }

    const buffer = PNG.sync.write(sharpened);
    fs.writeFileSync(outputPathPublic, buffer);
    fs.writeFileSync(outputPathAssets, buffer);
    console.log('SUCCESSFULLY_ENHANCED_SHARPNESS_OF_LOGO');
  })
  .on('error', function (err) {
    console.error('Error processing PNG:', err);
  });
