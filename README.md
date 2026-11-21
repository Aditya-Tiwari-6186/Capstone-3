# SecureMark

Invisible, encrypted image watermarks for ownership verification and tamper detection. Next.js 14 (App Router) backed by PostgreSQL on Neon; Docker Compose runs the app connected to the shared Neon database.

## Run it

The simplest way to run SecureMark is with Docker Compose connected to Neon. Set `DATABASE_URL` in the git-ignored `.env` file to the connection string from your Neon dashboard, including `sslmode=require`. Compose requires this value and passes it to the app. The database schema is initialized automatically. Docker does not import records from local `data/db.json` by default; image files and the signing key remain in the local app-data volume.

```bash
docker compose up
```

Copy `.env.example` to `.env`, then fill in `DATABASE_URL` with your Neon connection string. Set `SECUREMARK_SECRET` to the same long random value on every app instance that shares this database. Also make sure every instance uses the same Ed25519 signing key file; otherwise registrations made by one instance will fail signature checks on another. Keep these secrets backed up and unchanged.

Open http://localhost:3000. The first account becomes the administrator.

To stop the app while retaining local files, run `docker compose down`. `docker compose down -v` deletes only the local app-data volume; it does not delete data in Neon.

After startup:
1. Open http://localhost:3000 and choose **Log in → Create an account**. **The first account becomes the administrator.**
2. **Protect image**: pick DWT or DCT, upload a JPEG/PNG/WebP/TIFF (at least 240×240). Download the protected PNG and the PDF certificate.
3. **Check image** (no account needed): upload the protected PNG, then try an edited copy (re-saved as JPEG, cropped, rotated 90°, with something pasted over it).
4. **Admin** (link appears for the admin): users, images, verifications, hash-chained audit log, suspend/reactivate accounts.
5. **Research**: `npm run eval` regenerates `research/results.json`, shown at `/research` (a result set from 8 real photos is included).

Without `SMTP_URL`, e-mail confirmation is not required and confirmation/reset links are written to `data/outbox.log` (and shown on screen in development). Set `SMTP_URL` to enforce confirmation and send real mail.

### Other commands

| Command | What it does |
|---|---|
| `npm test` | 32 tests: Reed-Solomon, watermark round trips, attacks, registration/verification flow, signatures, audit chain |
| `npm run eval` | Robustness evaluation of five configurations (set `SAMPLE_DIR=/path/to/photos` to use your own images) |
| `npm run build && npm start` | Production build and start (requires PostgreSQL and `SECUREMARK_SECRET`) |
| `docker compose up` | Build and start the app connected to Neon |

### Environment (`.env.example`)

`DATABASE_URL` is the Neon PostgreSQL connection string; use the SSL-enabled URL from Neon. `SECUREMARK_SECRET` derives the AES-256-GCM payload key and JWT key; **changing it makes existing watermarks undecodable**. `SECUREMARK_IMPORT_LEGACY_DB` defaults to `0` in the Docker template so local records are not copied into Neon. `PUBLIC_URL` is used in certificates, QR codes and e-mail links. `SMTP_URL`/`MAIL_FROM` are optional; real mail delivery requires your own SMTP credentials. `COOKIE_SECURE` controls secure cookies.
Neon stores users, registrations, verification history, one-time tokens, and the audit log. Back up the local app-data volume separately: it holds the Ed25519 signing key `ed25519.pem` (without it old records can no longer be verified) and protected image files.

## How it works

**Registration.** The image is decoded to sRGB and tiled into 8×8 cells on the luminance channel. A 40-byte payload `nonce(12) | AES-256-GCM(registration no., owner no., timestamp)(12) | tag(16)` is wrapped with Reed-Solomon (16 parity bytes, corrects 8 wrong bytes) into 448 bits. Bit *b* is stored in a cell by quantisation index modulation: the cell's feature is snapped to the lattice `k·step + b·step/2`.
- **DWT**: feature = the cell's Haar LL value (a 3-level Haar LL coefficient of an 8×8 cell is 8× its mean), so only the low band moves and details are untouched. Step 12, typically ≈ 37 dB PSNR.
- **DCT**: feature = the (2,3) coefficient of the cell's 8×8 DCT. Step 28, typically ≈ 47 dB PSNR, less robust.
The 448-bit codeword is repeated across the whole image (cell *(x,y)* carries bit `(x + 37·y) mod 448`) and decoded by majority vote, so cropping becomes a cyclic shift that the decoder searches for.
The server stores a record `{regId, owner, time, algorithm, SHA-256 of original and of protected file, size, pHash}` signed with Ed25519, plus a block fingerprint. It refuses images that are already registered or that already carry a SecureMark watermark (including cropped, rotated, resized or re-compressed copies), and refuses any image whose watermark cannot be read back.

**Verification.** Recover the payload (as is, then 7 rotations/mirrors, then crop re-synchronisation over all 64 pixel offsets × bit shifts, then rescaling to registered sizes), check the AES-GCM tag, look up the record, check its Ed25519 signature and that payload and record agree, compare SHA-256. Four outcomes: **registered and unchanged**, **registered but modified**, **no watermark found** (never claimed as proof of "unregistered"), **inconclusive** (a watermark-like pattern that cannot be authenticated, a missing/unsigned record, …).

**Tamper localisation.** For modified images the (re-aligned) upload and the registered copy are compared in 32×32 blocks via 16 mean-luminance values per block with a tolerance, so JPEG re-saving and the watermark itself do not flag blocks, while pasted/removed content does. The result is classified *re-encoded only*, *local change* (red heatmap), *global change*, or *cropped*. This is coarse block-level evidence, not a statement about what was done.

**Also included:** SSIM and PSNR, perceptual hash (DCT pHash, Hamming distance) similarity hints at registration and verification, EXIF summary and comparison (supporting evidence only), PDF certificate with QR code, public record page `/verify/SMK-YYYY-NNNNNN`, e-mail confirmation and password reset (single-use hashed tokens), password change that revokes other sessions, per-IP and per-account rate limits, hash-chained audit log.

## API (JSON unless noted)

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /api/auth` · `POST /api/auth` `{mode: register│login│logout│forgot│reset│resend│verify│change}` | – | Accounts |
| `GET /api/images` · `POST /api/images` (multipart `file`, `alg`) | user | List / register |
| `GET /api/images/{id}` (PNG) · `GET /api/images/{id}/certificate` (PDF) | owner/admin | Download |
| `POST /api/verify` (multipart `file`) | none, 20/min/IP | Verify an image |
| `GET /api/verify?reg=SMK-…` | none | Public record + public key |
| `GET /api/history` | user | Own verification history |
| `GET /api/admin` · `PATCH /api/admin` `{userId, active}` | admin | Dashboard data, suspend/reactivate |
| `GET /api/research` | none | Evaluation results |

## Measured robustness (8 real photos, see `research/results.md`)

DWT + redundancy + Reed-Solomon (the default) recovered 100% after JPEG q30–q90, Gaussian noise σ10, 1% salt-and-pepper, blur σ1, +20 brightness, crops to 50% area, 90°/180° rotation and mirroring; 88% after blur σ2; 75% after resizing to 60% (when a registered image of the original size exists). **It does not survive**: contrast scaling ×1.2, arbitrary-angle rotation (5°), and (for DCT) blur or JPEG below q70.

## Limitations (read before relying on it)

- Geometric robustness is limited to crop, 90° rotations/mirroring and rescaling to a known registered size. Arbitrary rotation, perspective, and combined rescale+crop are not recovered. Contrast/gamma changes break the lattice.
- A missing watermark never proves an image is unregistered.
- PostgreSQL stores application state as a locked JSONB row so the existing atomic state-update and audit-chain behavior is preserved. Rate limits remain in-process memory.
- The original upload is not stored, only its hash. Registration does not prove authorship: the system records *who registered which file first*. The certificate says so.
- Not implemented: AI forgery detection, a dedicated dispute workflow, BMP input (the image library cannot read BMP), S3 storage.
- **Not yet run end-to-end under `next dev`/`next build` by the author of this change** (the build sandbox had no npm network access). Everything in `lib/` and `scripts/` is exercised by the 32 tests; the Next.js routes, pages, `bcryptjs`, `jose`, `qrcode` and `nodemailer` code paths are written against their documented APIs but untested. First step after `npm install`: run `npm test`, `npm run build`, and click through the flow above.

## Layout

```
app/            pages (/, /verify/[regId], /research, /admin) and API routes
components/     Drop (upload + preview), Result (verification report)
lib/wm.js       DWT/DCT QIM embedding, voting, SSIM          lib/rs.js       Reed-Solomon over GF(256)
lib/recover.js  decode with rotation / crop / resize search  lib/crypto.js   AES-GCM payload, Ed25519, keys
lib/forensics.js  block fingerprints, heatmap, pHash, EXIF   lib/verify.js   verification pipeline
lib/register.js   validation + registration                  lib/db.js       PostgreSQL, atomic updates, audit chain
lib/auth.js     sessions, tokens, rate limit, helpers        lib/cert.js     PDF certificate
scripts/        attacks.js, eval.js      test/  node:test suites      research/  evaluation output
docker-compose.yml   app service connected to Neon; local app-data volume
```
