# Encrypted lecture collections

`unlockLectures(password, signal?)` fetches `/brain/lectures/collections.json`, tries the bounded encrypted records, validates the authenticated payload and returns one `LectureCourse`. It performs no local/session storage or URL writes. UI lock must abort pending access, clear the password field and drop all references to the unlocked course, images and renderer. JavaScript garbage collection is not guaranteed memory erasure.

The HTTP cache may retain encrypted ciphertext. Requests use `no-cache` to revalidate it, avoiding a full pack download on every password retry when the host supports conditional responses. Passwords, keys and decrypted material are never deliberately persisted by this loader.

Errors: `LectureAccessError.code === 'password'` for no matching authenticated record (wrong password or damaged ciphertext); `'unavailable'` for network, unsupported crypto, invalid manifest or invalid authenticated payload. Cancellation produces `AbortError`. PBKDF2 itself cannot be interrupted by Web Crypto; abort checks prevent a canceled result being returned.

## Build/update

Keep plaintext JSON, lecture PDFs, extracted figures and passwords **outside this repository and its public build**. Supply the password through the `BRAIN_LECTURE_PASSWORD` environment variable. Never place it in a source file, test, document, argument, URL or committed configuration. With that variable already set:

```sh
node scripts/build-brain-lecture-pack.mjs --input <private-json-outside-repo>
```

The builder prints a nonsecret random record UUID. To replace that collection, pass `--replace <record-uuid>`; omit it to append another independently encrypted collection. Replacement preserves unrelated records, generates fresh salt/nonce and writes the encrypted pack atomically. `--output <path>` supports isolated maintenance/test output. Clear the environment variable after maintenance. Only the encrypted `public/brain/lectures/collections.json` belongs in version control.

Manifest v1 contains opaque UUIDs and cryptographic parameters only. Each record uses PBKDF2-HMAC-SHA-256 (600,000 iterations), a fresh random 16-byte salt, AES-256-GCM, a fresh random 12-byte nonce and a 128-bit authentication tag. Authenticated additional data binds version, identity and all cryptographic parameters. UTF-8 passwords are exact/case-sensitive. Keys are nonextractable in the browser; temporary password/plaintext byte buffers are cleared where practical.

Bounds: 8 records, 310,000–600,000 KDF iterations/record, 96 MiB manifest, 64 MiB decrypted payload, 40 lectures, 200 slides/deck, 12 MiB raster figure/reference. Validate every field, canonical topic/source links, graph endpoints, HTTPS resource URLs without credentials, raster data signatures and normalized hotspots. Active SVG/HTML image data is rejected. No lesson metadata sits beside the ciphertext.

## Limits and checks

This static design is **password encryption, not server authentication**. Anyone can download ciphertext and try passwords offline; the KDF slows attempts but cannot make a weak/shared password strong. Someone who unlocks the collection can inspect, copy or save its contents. Cached ciphertext and prior deployed packs cannot be revoked by hiding the UI. Sensitive or individually restricted materials need authenticated server-side access and authorization.

Run `node scripts/test-brain-lecture-access.mjs`. Tests use synthetic passwords only: independent crypto interoperability, exact/wrong passwords, ciphertext/header tampering, future records, malformed input and work bounds, unsafe URLs/images, cancellation, absence of browser persistence, outside-repo builder input, fresh salt/nonce and atomic replacement behavior.

Primary implementation references: [W3C Web Crypto recommendation](https://www.w3.org/TR/2017/REC-WebCryptoAPI-20170126/#aes-gcm); [OWASP PBKDF2 work-factor guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#pbkdf2). The work factor follows that guidance; this does not imply a FIPS-certified implementation or immunity to offline guessing.

## Presenter and content maintenance

The fourth Brain mode uses the same atlas renderer as Explore, with one renderer per open presentation. Arrow/Space reveals points before advancing; overview jumps to a slide; Escape dismisses overview/source comparison before leaving the player. Native form controls, figures and models keep their own keys. Window presentation works when browser fullscreen is unavailable. The green pointer can be toggled and is hidden for coarse pointers and keyboard navigation.

Each source lecture page maps to one presentation slide. Keep original order, page number, source reference image and qualifications. Interactive teaching models do not replace measured experimental data: use original figures for data-reading tasks and label synthetic traces. Paper reading guides are separate from instructor lectures. Never infer lecture coverage from an assigned reading alone.

Use `npm test` and strict TypeScript, then inspect actual rendered slides at desktop and narrow widths. Check source comparison, diagram state, pointer, keyboard focus, lock/reload and unchanged study modes. Local visual audit: `docs/codex/user-facing-tests/2026-10-05__user-facing-flow-test__lectures.md`.
