#!/bin/bash

set -x

set +x
echo "================"
echo "--Instance Resizing ==> START--"
echo "================"
set -x

sh resize.sh

set +x
echo "================"
echo "--Instance Resizing ==> END--"
echo "================"
set -x