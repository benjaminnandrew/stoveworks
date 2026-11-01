#!/bin/bash
# Extra passes for catalog stoves in the empty-hearth lake cabin: direct sun only (for the stove's sun
# shadow) and a white probe box the size of a Morsø 7110 B (light on a stove's faces, shadow it casts).
cd /home/claude/build
PY=/home/claude/blendenv/bin/python
OUT=renders/final
log(){ echo "$(date +%H:%M:%S) $*" >> $OUT/stove_passes.log; }
log start
$PY scenes.py cabin open day sundirect 50 48 $OUT/cabin_open_day_sundirect.exr > $OUT/sp_last.log 2>&1 && log "done sundirect" || log "FAILED sundirect"
for L in day eve; do
  PROBE=0.5748,0.4699,0.6701 $PY scenes.py cabin open $L beauty 50 48 $OUT/cabin_open_${L}_probe.exr > $OUT/sp_last.log 2>&1 && log "done probe $L" || log "FAILED probe $L"
done
log end
touch $OUT/STOVE_PASSES_DONE
