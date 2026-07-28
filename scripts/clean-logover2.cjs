const fs = require('fs');
const { PNG } = require('pngjs');

const inputPath = 'c:/Web/shopofbow/public/assets/new-logover2.png';
const outputPathPublic = 'c:/Web/shopofbow/public/assets/new-logover2.png';
const outputPathAssets = 'c:/Web/shopofbow/src/assets/new-logover2.png';

fs.createReadStream(inputPath)
  .pipe(new PNG({ filterType: 4 }))
  .on('parsed', function () {
    console.log(`Image size: ${this.width}x${this.height}`);

    let minX = this.width, minY = this.height, maxX = 0, maxY = 0;
    let nonTransparentCount = 0;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = (this.width * y + x) << 2;
        const r = this.data[idx];
        const g = this.data[idx + 1];
        const b = this.data[idx + 2];
        const a = this.data[idx + 3];

        // Check dark background vignette / dark pixels (r,g,b all low < 45)
        const isDarkBg = (r < 45 && g < 45 && b < 55);

        if (isDarkBg) {
          this.data[idx + 3] = 0; // Make background transparent
        } else if (a > 20) {
          nonTransparentCount++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    console.log(`Non-transparent pixels: ${nonTransparentCount}`);
    console.log(`Bounding Box: (${minX}, ${minY}) to (${maxX}, ${maxY})`);

    if (minX <= maxX && minY <= maxY) {
      const cropW = maxX - minX + 1;
      const cropH = maxY - minY + 1;
      const cropped = new PNG({ width: cropW, height: cropH });
      this.bitblt(cropped, minX, minY, cropW, cropH, 0, 0);

      const buffer = PNG.sync.write(cropped);
      fs.writeFileSync(outputPathPublic, buffer);
      fs.writeFileSync(outputPathAssets, buffer);
      console.log('SUCCESSFULLY_PROCESSED_LOGOVER2');
    }
  })
  .on('error', function (err) {
    console.error('PNG error:', err);
  });
