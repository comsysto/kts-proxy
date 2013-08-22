#!/bin/sh -li

# Absolute path to this script, e.g. /home/user/bin/foo.sh
SCRIPT=`readlink -f $0`
# Absolute path this script is in, thus /home/user/bin
DIR=`dirname $SCRIPT`

nohup nodejs "$DIR/kts-proxy.js" > /dev/null &

MY_PID=$!
PID_FILE=$DIR/pid

echo "kill the slow - on duty"
echo "storing PID: $MY_PID into $PID_FILE"
echo "$MY_PID" >> "$PID_FILE"