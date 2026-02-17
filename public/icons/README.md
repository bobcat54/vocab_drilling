# PWA Icons

This directory should contain PWA icons in the following sizes:
- icon-192x192.png (192x192 pixels)
- icon-512x512.png (512x512 pixels)

You can generate these icons from your app logo using tools like:
- https://realfavicongenerator.net/
- https://www.pwabuilder.com/imageGenerator

For now, the app will work without these icons, but they are required for a complete PWA experience and the "Add to Home Screen" prompt on mobile devices.

To create placeholder icons quickly, you can use ImageMagick:
```bash
convert -size 192x192 xc:#10b981 -pointsize 72 -fill white -gravity center -annotate +0+0 'V' icon-192x192.png
convert -size 512x512 xc:#10b981 -pointsize 200 -fill white -gravity center -annotate +0+0 'V' icon-512x512.png
```
