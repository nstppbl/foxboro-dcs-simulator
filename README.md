# Foxboro DCS Training Simulator

A web-based training simulator for Foxboro I/A Series and EcoStruxure Foxboro DCS.
The UI has a RU/EN switch. Foxboro names, blocks and parameters always stay in English.

## Запуск / Run

Needs Node.js 20 or later (https://nodejs.org).

```bash
npm install
npm run dev      # open http://localhost:5173
npm test         # unit tests for the domain logic
npm run build    # static build in dist/
```

Progress and your topology are saved in the browser (localStorage).

## Status

| Stage | Area | Status |
|---|---|---|
| 1 | Architecture Builder (manual ch. 2) | done |
| 2 | Control engine: compounds, blocks, PERIOD/PHASE, alarms, HLBL (ch. 4) | done |
| 3 | Engineering: Control Editors-style Strategy Editor + legacy ICC sheets (ch. 5) | next |
| 4 | Process models incl. pharma (bioreactor, WFI, CIP in HLBL) | planned |
| 5 | Operator HMI: FoxView + Control HMI, faceplates, trends, alarms (ch. 3, 6-12) | planned |
| 6 | Fault injection + System Manager (ch. 13) | planned |
| 7 | Curriculum: theory, guided labs, tests, scoring | planned |

## Architecture Builder features
- Hardware palette: H92 workstation, H90/H91 servers, managed MESH switches, FCP270, ZCP270 with FCM100Et, FCP280, FDC280, FBM201-242, TAs and field instruments. You can filter by era (I/A Series or Foxboro DCS).
- Wire mode (press W) infers the link type: MESH A/B, uplink, 2 Mbps module fieldbus, FCM hosting, TA cable, or field wire on a free compatible channel. Invalid wiring is refused with a teaching message. For example, an FBM on a ZCP270 or an instrument wired straight to an FBM.
- Live validation against manual 2001V8 rules, each with a page reference. The rules cover letterbugs and FBM letterbug structure, FBM capacity per CP/FCM, A/B redundancy, more than 2 switches in a linear chain, the 7-switch RSTP limit, single points of failure, and controllers that cannot reach a workstation.
- MESH analysis: it detects the topology (Linear, Ring, Star, Inverted Tree) and lists single points of failure. You can fail and restore any switch, controller or station.
- Signal trace (double-click an instrument): instrument, TA, FBM channel, FCM/fieldbus, switches, CP (ECB, then AIN/AOUT), workstation. The path is highlighted on the canvas and shown as broken when a component on it has failed.
- Presets: Classic I/A V8 (FCP270 + ZCP270), Foxboro DCS pharma bioreactor (FCP280, Star), a troubleshooting exercise with planted design errors, and an empty canvas.

## Control engine (Stage 2)
- Simulated CP2701 runs a 50 ms BPC; each block executes on its PERIOD/PHASE (table from manual p. 4-18). Connections use C:B.P or :B.P; a connected input is secured.
- Blocks: AIN, AOUT, DIN, DOUT, PID, PIDA, RATIO, CALC (RPN steps), CHARC, SWCH, LLAG, DTIME, MTR, HLBL.
- PID: MODOPT P/I/PD/PI/PID, PBAND/INT/DERIV, INCOPT, A/M, L/R, bumpless transfer via BCALCI/BCALCO, HIABS/LOABS/HHABS/LLABS/HIDEV/LODEV/HIOUT/LOOUT alarms with deadband, priority, text, CRIT/PRTYPE/UNACK.
- Alarm manager: Current Alarms (CAD) ordering, ACK by block/compound, INHIB and compound CINHIB, history and messages.
- HLBL subset: `:=`, IF/ELSE/ENDIF, WHILE/ENDWHILE, WAIT, WAITUNTIL, SENDMSG, EXIT, C:B.P references, compile errors with line numbers.
- Lab database from LAB 1: TANK2_COMP (LT100, LC100, LV100 with the lab's parameters and alarm texts), PROCESS_2 (MTR_CNTRL, DEAD_TM, FLOW_CALC, LAG_TM) and TANK2_SEQ:FILL (HLBL fill sequence).
- Control screen: FoxSelect tree, Block Detail pages CNTRL / CONFIG / TUNE / ALARMS / TREND, faceplate (AUTO/MAN, LOCAL/REMOTE, ramp 1 %/5 %, ACK), compound ON/OFF and CINHIB, CAD and alarm history, run/pause/speed.

## Code layout
```
src/
  domain/hardware/   catalog, model + connection rules, validation, MESH analysis, trace, presets (pure TS, unit-tested)
  engine/            CP engine: scheduler, station (links, scan, alarms), block types, HLBL, lab databases (unit-tested)
  features/          UI per area (architecture/ now; control, engineering, operator, faults, curriculum next)
  i18n/              RU/EN strings
  store/             zustand stores persisted to localStorage
```
