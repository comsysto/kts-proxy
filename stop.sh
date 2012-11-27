#!/bin/sh -li

# Absolute path to this script, e.g. /home/user/bin/foo.sh
SCRIPT=`readlink -f $0`
# Absolute path this script is in, thus /home/user/bin
DIR=`dirname $SCRIPT`

PID_FILE=$DIR/pid

for PID in $(cut -f 1 $PID_FILE); do
   echo "killing $PID"
   kill $PID
done

rm $PID_FILE