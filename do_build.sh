#!/bin/bash
npm install
npx parcel build src/index.html --no-source-maps --dist-dir dist
cp images/* dist
