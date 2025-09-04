#!/bin/bash
./do_build.sh
cd dist
python3 -m http.server
cd -
