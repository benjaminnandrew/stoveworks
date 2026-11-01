#!/bin/bash
# Full render queue for the sample scenes. Logs to renders/final/queue.log
cd /home/claude/build
PY=/home/claude/blendenv/bin/python
OUT=renders/final
mkdir -p $OUT
log(){ echo "$(date +%H:%M:%S) $*" >> $OUT/queue.log; }
job(){ # scene variant light mode scale spp
  local f=$OUT/$1_$2_$3_$4.exr
  [ "$4" = "geo" ] && f=$OUT/$1_$2.geo.json
  [[ "$4" == mask* ]] && f=$OUT/$1_$2_$4.exr
  [[ "$4" == tilt* ]] && f=$OUT/$1_$2_$3_$4.exr
  if [ -f "$f" ]; then log "skip $f"; return; fi
  local t0=$(date +%s)
  $PY scenes.py $1 $2 $3 $4 $5 $6 $f > $OUT/last.log 2>&1 || log "FAILED $*"
  log "done $* in $(( $(date +%s) - t0 ))s"
}
variant(){ # scene variant lights...
  local s=$1 v=$2; shift 2
  job $s $v day geo 100 1
  job $s $v day mask1 100 16
  if [ "$s" = "cabin" ]; then job $s $v day mask2 100 16; fi
  for L in "$@"; do
    job $s $v $L beauty 100 64
    for t in tilt_px tilt_nx tilt_py tilt_ny; do job $s $v $L $t 33 24; done
  done
}
log "queue start"
variant cabin trad day
touch $OUT/READY_cabin_trad_day
variant cabin trad eve
variant linear linear day eve
variant cabin modern day eve
log "queue end"
touch $OUT/ALL_DONE
