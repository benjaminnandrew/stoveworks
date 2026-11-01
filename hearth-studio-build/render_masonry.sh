#!/bin/bash
# The lake house den (masonry fireplace, for catalog inserts), built here 1 Nov 2026. Run from the repo
# root in Git Bash: bash hearth-studio-build/render_masonry.sh [part]
#   part 1: geometry, masks and the day passes; part 2: the evening passes and the fire pass
# (two parts keep each run under ten minutes). Renders go to var/hs-renders; then post.py.
cd "$(dirname "$0")"
PY=../var/blendenv/Scripts/python.exe
mkdir -p ../var/hs-renders
OUT=$(cd ../var/hs-renders && pwd -W)   # absolute: Blender reads a relative path from the drive's root
log(){ echo "$(date +%H:%M:%S) $*" >> $OUT/masonry.log; }
job(){ # scene variant light mode scale spp outfile
  local t0=$(date +%s)
  if [ -f "$7" ]; then log "skip $7"; return; fi
  $PY scenes.py $1 $2 $3 $4 $5 $6 $7 > $OUT/masonry_last.log 2>&1 || log "FAILED $*"
  log "done $1 $2 $3 $4 in $(( $(date +%s) - t0 ))s"
}
V=masonry
if [ "${1:-1}" = "1" ]; then
  log "part 1 start"
  job masonry $V day geo 100 1 $OUT/masonry_$V.geo.json
  job masonry $V day mask1 100 16 $OUT/masonry_${V}_mask1.exr
  job masonry $V day mask2 100 16 $OUT/masonry_${V}_mask2.exr
  job masonry $V day beauty 100 64 $OUT/masonry_${V}_day_beauty.exr
  for t in tilt_px tilt_nx tilt_py tilt_ny; do job masonry $V day $t 33 24 $OUT/masonry_${V}_day_${t}.exr; done
  log "part 1 end"
else
  log "part 2 start"
  job masonry $V eve beauty 100 64 $OUT/masonry_${V}_eve_beauty.exr
  for t in tilt_px tilt_nx tilt_py tilt_ny; do job masonry $V eve $t 33 24 $OUT/masonry_${V}_eve_${t}.exr; done
  job masonry $V eve fire 50 40 $OUT/masonry_${V}_eve_fire.exr
  log "part 2 end"
fi
