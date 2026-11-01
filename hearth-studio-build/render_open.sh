#!/bin/bash
# Empty-hearth lake cabin ("open" variant) for catalog stoves. Logs to renders/final/open.log
cd /home/claude/build
PY=/home/claude/blendenv/bin/python
OUT=renders/final
log(){ echo "$(date +%H:%M:%S) $*" >> $OUT/open.log; }
job(){ # scene variant light mode scale spp outfile
  local t0=$(date +%s)
  if [ -f "$7" ]; then log "skip $7"; return; fi
  $PY scenes.py $1 $2 $3 $4 $5 $6 $7 > $OUT/open_last.log 2>&1 || log "FAILED $*"
  log "done $1 $2 $3 $4 in $(( $(date +%s) - t0 ))s"
}
log "start"
job cabin open day geo 100 1 $OUT/cabin_open.geo.json
job cabin open day mask1 100 16 $OUT/cabin_open_mask1.exr
job cabin open day mask2 100 16 $OUT/cabin_open_mask2.exr
for L in day eve; do
  job cabin open $L beauty 100 64 $OUT/cabin_open_${L}_beauty.exr
  for t in tilt_px tilt_nx tilt_py tilt_ny; do job cabin open $L $t 33 24 $OUT/cabin_open_${L}_${t}.exr; done
done
job cabin open eve fire 50 40 $OUT/cabin_open_eve_fire.exr
log "end"
touch $OUT/OPEN_DONE
