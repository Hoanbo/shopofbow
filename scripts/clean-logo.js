const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const inputPath = 'c:/Web/shopofbow/assets/new-logo.png';
const outputPathPublic = 'c:/Web/shopofbow/public/assets/new-logo.png';
const outputPathAssets = 'c:/Web/shopofbow/assets/new-logo.png';

fs.createReadStream(inputPath)
  .pipe(new PNG({ filterType: 4 }))
  .on('parsed', function () {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = (this.width * y + x) << 2;
        const r = this.data[idx];
        const g = this.data[idx + 1];
        const b = this.data[idx + 2];
        
        // Calculate brightness of pixel
        const brightness = r * 0.299 + g * 0.587 + b * 0.114;

        if (brightness < 40) {
          // Pure transparent background
          this.data[idx + 3] = 0;
        } else if (brightness < 70) {
          // Smooth alpha fade on edge glow
          const alpha = Math.min(255, Math.floor((brightness - 35) * 8));
          this.data[idx + 3] = alpha;
        }
      }
    }

    // Save output
    const buffer = PNG.sync.write(this);
    fs.writeFileSync(outputPathPublic, buffer);
    fs.writeFileSync(outputPathAssets, buffer);
    console.log('SUCCESSFULLY_REMOVED_DARK_BACKGROUND_FROM_NEW_LOGO');
  })
  .on('error', function (err) {
    console.error('Error processing PNG:', err);
  });
