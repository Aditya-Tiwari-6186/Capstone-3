# SecureMark evaluation

Real photographs. Images: 8. Generated 2026-11-20T12:17:18.198Z.

## Quality and speed

| Configuration | bits | PSNR dB | SSIM | embed ms | extract ms |
|---|---|---|---|---|---|
| DCT, single embedding | 320 | 57.8 | 0.9989 | 5 | 0 |
| DWT, single embedding | 320 | 48.5 | 0.9966 | 5 | 0 |
| DWT + redundancy | 320 | 37.4 | 0.9571 | 8 | 1 |
| DWT + redundancy + Reed-Solomon | 448 | 37.4 | 0.9573 | 9 | 1 |
| DCT + redundancy + Reed-Solomon | 448 | 47.2 | 0.9892 | 8 | 1 |

## Pixel-aligned attacks (recovery rate = authenticated payload decoded; BER on embedded bits before error correction; NC = normalised correlation)

| Attack | DCT, single embedding | DWT, single embedding | DWT + redundancy | DWT + redundancy + Reed-Solomon | DCT + redundancy + Reed-Solomon |
|---|---|---|---|---|---|
| none | 100% · BER 0.0% · NC 1.00 | 88% · BER 0.0% · NC 1.00 | 100% · BER 0.0% · NC 1.00 | 100% · BER 0.0% · NC 1.00 | 100% · BER 0.0% · NC 1.00 |
| JPEG q90 | 100% · BER 0.0% · NC 1.00 | 88% · BER 0.0% · NC 1.00 | 100% · BER 0.0% · NC 1.00 | 100% · BER 0.0% · NC 1.00 | 100% · BER 0.0% · NC 1.00 |
| JPEG q70 | 88% · BER 0.1% · NC 1.00 | 75% · BER 0.1% · NC 1.00 | 100% · BER 0.0% · NC 1.00 | 100% · BER 0.0% · NC 1.00 | 100% · BER 0.0% · NC 1.00 |
| JPEG q50 | 0% · BER 32.2% · NC 0.36 | 88% · BER 0.0% · NC 1.00 | 100% · BER 0.0% · NC 1.00 | 100% · BER 0.0% · NC 1.00 | 0% · BER 37.0% · NC 0.26 |
| JPEG q30 | 0% · BER 45.5% · NC 0.09 | 75% · BER 0.2% · NC 1.00 | 100% · BER 0.0% · NC 1.00 | 100% · BER 0.0% · NC 1.00 | 0% · BER 47.7% · NC 0.05 |
| Gaussian noise σ5 | 0% · BER 4.2% · NC 0.92 | 75% · BER 0.1% · NC 1.00 | 100% · BER 0.0% · NC 1.00 | 100% · BER 0.0% · NC 1.00 | 100% · BER 0.0% · NC 1.00 |
| Gaussian noise σ10 | 0% · BER 37.2% · NC 0.26 | 75% · BER 0.4% · NC 0.99 | 100% · BER 0.0% · NC 1.00 | 100% · BER 0.0% · NC 1.00 | 0% · BER 14.8% · NC 0.70 |
| Salt & pepper 1% | 0% · BER 21.7% · NC 0.57 | 0% · BER 16.5% · NC 0.67 | 75% · BER 0.2% · NC 1.00 | 100% · BER 0.6% · NC 0.99 | 13% · BER 3.9% · NC 0.92 |
| Blur σ1 | 0% · BER 38.5% · NC 0.23 | 50% · BER 0.8% · NC 0.98 | 100% · BER 0.0% · NC 1.00 | 100% · BER 0.0% · NC 1.00 | 0% · BER 46.1% · NC 0.08 |
| Blur σ2 | 0% · BER 47.7% · NC 0.05 | 13% · BER 8.3% · NC 0.83 | 63% · BER 0.3% · NC 0.99 | 88% · BER 0.9% · NC 0.98 | 0% · BER 47.9% · NC 0.04 |
| Brightness +20 | 63% · BER 3.0% · NC 0.94 | 50% · BER 3.6% · NC 0.93 | 100% · BER 0.0% · NC 1.00 | 100% · BER 0.0% · NC 1.00 | 100% · BER 0.0% · NC 1.00 |
| Brightness −35 | 13% · BER 9.4% · NC 0.81 | 0% · BER 14.0% · NC 0.72 | 50% · BER 3.3% · NC 0.93 | 63% · BER 4.0% · NC 0.92 | 88% · BER 4.0% · NC 0.92 |
| Contrast ×1.2 | 0% · BER 5.6% · NC 0.89 | 0% · BER 32.7% · NC 0.35 | 0% · BER 37.2% · NC 0.26 | 0% · BER 38.6% · NC 0.23 | 75% · BER 3.2% · NC 0.94 |
| Colour shift | 88% · BER 0.2% · NC 1.00 | 25% · BER 9.0% · NC 0.82 | 63% · BER 2.6% · NC 0.95 | 63% · BER 5.6% · NC 0.89 | 100% · BER 0.0% · NC 1.00 |

## Geometric attacks, full pipeline with re-synchronisation (recovery rate)

| Attack | DWT + redundancy + RS | DCT + redundancy + RS |
|---|---|---|
| Crop to 75% area | 100% | 100% |
| Crop to 50% area | 100% | 100% |
| Rotate 90° | 100% | 100% |
| Rotate 180° | 100% | 100% |
| Mirror | 100% | 100% |
| Resize ×0.6 | 75% | 0% |
| Rotate 5° | 0% | 0% |
| JPEG q70 + crop 75% | 100% | 100% |
