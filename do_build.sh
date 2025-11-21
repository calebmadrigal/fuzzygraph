#!/bin/bash

# Bulid self-contained html file
npm install
npx parcel build src/index.html --no-source-maps --dist-dir dist # --no-optimize # blows up html from 1.25 to 4.1

# Copy examples
cp src/examples.html dist

# Copy images
cp -r images dist

# Copy previous versions to dist
curl -L -o dist/v1.html https://github.com/calebmadrigal/fuzzygraph/releases/download/v1.0.43/FuzzyGraph_v1.0.43.html

# Copy favicon
cp images/android-chrome-192x192.png dist
cp images/android-chrome-512x512.png dist
cp images/apple-touch-icon.png dist
cp images/favicon-16x16.png dist
cp images/favicon-32x32.png dist
cp images/favicon.ico dist
