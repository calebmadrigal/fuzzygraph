#!/bin/bash
npm install
npx parcel build src/index.html --no-source-maps --dist-dir dist # --no-optimize # blows up html from 1.25 to 4.1
cp src/examples.html dist
cp -r images dist

# favicon
cp images/android-chrome-192x192.png dist
cp images/android-chrome-512x512.png dist
cp images/apple-touch-icon.png dist
cp images/favicon-16x16.png dist
cp images/favicon-32x32.png dist
cp images/favicon.ico dist
