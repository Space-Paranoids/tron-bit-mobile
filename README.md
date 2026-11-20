# Bit — phone app

Bit, the yes/no companion from *Tron* (1982), on your phone. Think of a yes or no question and tap Bit: it thinks for a moment and answers. Now and then you get the long *yes, yes, yes* or *no, no, no*.

It's a web app: open the page once, add it to your home screen, and it works like an app, fully offline.

Companion to the desktop app, [tron-bit-desktop](https://github.com/Space-Paranoids/tron-bit-desktop). The shapes, colours, lighting and shape changes are ported from its renderer.

## Install

Open **https://space-paranoids.github.io/tron-bit-mobile/**, then:

- **iPhone / iPad (Safari):** Share button → *Add to Home Screen*.
- **Android (Chrome):** ⋮ menu → *Add to Home screen* (or *Install app*).
- **Desktop (Chrome / Edge):** the install icon at the right of the address bar.

After the first visit everything is stored on the device, so it works with no connection.

Prefer a real Android app? Download **Bit.apk** from the [Releases page](https://github.com/Space-Paranoids/tron-bit-mobile/releases/latest), which is the only official download. Install steps and checksums are on that page.

### Publishing a new APK version

1. Replace `android/Bit.apk` with the new build (signed with the same key).
2. Run `sha256sum Bit.apk > Bit.apk.sha256` in `android/` and put the new hash in `android/RELEASE_NOTES.md`.
3. Commit to `main`, then push a new tag such as `v1.0.1`. The *Release APK* workflow checks the hash, the notes and the signing certificate, then publishes the release.

## Using it

- Tap Bit (or press Space / Enter on a keyboard). Each answer is one bit from the browser's secure random generator, so yes and no are exactly even.
- **Rigging:** tap the background instead of Bit to choose the answer. Left of Bit always gives *no*, right of Bit always gives *yes*. Tapping Bit itself stays random.
- About one answer in ten is the long version.
- No sound on iPhone? Check the ring/silent switch and the volume.

## Privacy

No accounts, ads, tracking, cookies or network calls. Every file comes from this site and nothing is sent anywhere. A strict Content Security Policy blocks anything from outside.

## Files

Plain static files, no build step: `index.html`, `style.css`, `app.js` (renderer and answers), `sw.js` (offline cache), `manifest.webmanifest` (home-screen app), `bit.bin` (the shapes), `sounds/`, `icons/`, `fonts/`.

To try it on a computer: `python -m http.server 8000` in this folder, then open http://localhost:8000. When you change any file, bump `VERSION` in `sw.js` so installed copies update.

## Credits

- 3D model: [Tron "Bit"](https://www.thingiverse.com/thing:2748353) by Ferjerez, licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Bit's voice: clips from the film, cleaned up.
- Font: [Orbitron](https://fonts.google.com/specimen/Orbitron), SIL Open Font License (`fonts/OFL-Orbitron.txt`).

## License

Code: MIT, see [LICENSE](LICENSE). The model, voice clips and font keep their own terms above.
