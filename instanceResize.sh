#!/bin/bash

set -x

set +x
echo "================"
echo "--Instance Resizing ==> START--"
echo "================"
set -x

sh https://gist.githubusercontent.com/joozero/b48ee68e2174a4f1ead93aaf2b582090/raw/2dda79390a10328df66e5f6162846017c682bef5/resize.sh

set +x
echo "================"
echo "--Instance Resizing ==> END--"
echo "================"
set -x