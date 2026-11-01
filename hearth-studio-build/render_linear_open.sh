#!/bin/bash
# The family room with no fireplace in its wall ("open" variant, for catalog fireplaces of any size),
# rendered here (1 Nov 2026). Same passes as render_open.sh does for the cabin; the family room has one
# mask pass (three visible zones). Run from the repo root in Git Bash:
#   FIRE_OPEN_K=<k> bash hearth-studio-build/render_linear_open.sh
# Renders go to var/hs-renders (git-ignored); then run merge_linear_open.py.
cd "$(dirname "$0")"
PY=../var/blendenv/Scripts/python.exe
mkdir -p ../var/hs-renders
# absolute (Windows) paths: Blender reads a relative output path from the drive's root
OUT=$(cd ../var/hs-renders && pwd -W)
log(){ echo "$(date +%H:%M:%S) $*" >> $OUT/linear_open.log; }
job(){ # scene variant light mode scale spp outfile
  local t0=$(date +%s)
  if [ -f "$7" ]; then log "skip $7"; return; fi
  $PY scenes.py $1 $2 $3 $4 $5 $6 $7 > $OUT/linear_open_last.log 2>&1 || log "FAILED $*"
  log "done $1 $2 $3 $4 in $(( $(date +%s) - t0 ))s"
}
log "start (FIRE_OPEN_K=${FIRE_OPEN_K:-scenes.py default})"
job linear open day geo 100 1 $OUT/linear_open.geo.json
job linear open day mask1 100 16 $OUT/linear_open_mask1.exr
for L in day eve; do
  job linear open $L beauty 100 64 $OUT/linear_open_${L}_beauty.exr
  for t in tilt_px tilt_nx tilt_py tilt_ny; do job linear open $L $t 33 24 $OUT/linear_open_${L}_${t}.exr; done
done
job linear open eve fire 50 40 $OUT/linear_open_eve_fire.exr
log "end"
touch $OUT/LINEAR_OPEN_DONE
