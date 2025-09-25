#!/bin/bash
npm install
npx parcel build src/index.html --no-source-maps --dist-dir dist # --no-optimize # blows up html from 1.25 to 4.1
cp images/* dist
