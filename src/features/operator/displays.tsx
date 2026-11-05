import type { Bilingual } from "../../domain/hardware/catalog";
import type { ControlStation } from "../../engine/station";
import { useSim } from "../../store/sim";
import { fmt, priColor } from "../control/ui";
import {
  Agitator,
  BG,
  Ctrl,
  Label,
  Mimic,
  on,
  Pipe,
  Pump,
  Tag,
  val,
  Valve,
  Vessel,
} from "./mimic";
import { useContext } from "react";

/** A process graphic display (FoxView "display file"). */
export interface DisplayDef {
  id: string;
  title: Bilingual;
  /** compound the display belongs to: used to pick a scenario */
  needs: string;
  Svg: () => React.ReactElement;
}

const W = 1000;
const H = 600;

function Frame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full select-none"
      preserveAspectRatio="xMidYMid meet"
      data-help="screen:graphic"
    >
      <rect width={W} height={H} fill={BG} />
      <text
        x={12}
        y={22}
        fontSize={15}
        fill="#fff"
        fontWeight="bold"
        fontFamily="monospace"
      >
        {title}
      </text>
      {children}
    </svg>
  );
}

/** Active alarm texts of the given blocks (like the MEASHT/MEASLT text fields on the course graphic). */
function AlarmTexts({ x, y, refs }: { x: number; y: number; refs: string[] }) {
  const { st } = useContext(Mimic)!;
  const list = st.alarms.entries.filter(
    (e) => e.active && !e.inhibited && refs.includes(e.ref),
  );
  return (
    <g>
      {list.slice(0, 4).map((e, i) => (
        <text
          key={e.id}
          x={x}
          y={y + i * 16}
          fontSize={13}
          fill={priColor(e.pri)}
          fontFamily="monospace"
          fontWeight="bold"
          className={e.acked ? "" : "fox-blink"}
        >
          {e.text}
        </text>
      ))}
    </g>
  );
}

/** Push button that writes one parameter (operator action from a graphic). */
function Push({
  x,
  y,
  label,
  c,
  b,
  p,
  v,
  w = 80,
}: {
  x: number;
  y: number;
  label: string;
  c: string;
  b: string;
  p: string;
  v: boolean | number;
  w?: number;
}) {
  return (
    <g
      transform={`translate(${x},${y})`}
      className="cursor-pointer"
      onClick={() => useSim.getState().set(c, b, p, v)}
      data-help={`param:${p}`}
      data-testid={`push-${b}-${p}-${String(v)}`}
    >
      <rect width={w} height={24} fill="#d8d8d8" stroke="#000" />
      <rect x={1} y={1} width={w - 2} height={2} fill="#fff" />
      <text
        x={w / 2}
        y={16}
        fontSize={12}
        textAnchor="middle"
        fontFamily="monospace"
      >
        {label}
      </text>
    </g>
  );
}

/** HLBL program status box. */
function SeqBox({
  x,
  y,
  c,
  b,
  phases,
}: {
  x: number;
  y: number;
  c: string;
  b: string;
  phases?: { tag: [string, string, string]; names: Record<number, string> };
}) {
  const { st, pick } = useContext(Mimic)!;
  const k = st.block(c, b);
  if (!k) return null;
  const state = String(k.p.STATE);
  const color =
    state === "ERROR"
      ? "#ff5050"
      : state === "DONE"
        ? "#7dff7d"
        : state === "IDLE"
          ? "#ccc"
          : "#ffe14d";
  const ph = phases ? val(st, ...phases.tag) : 0;
  return (
    <g transform={`translate(${x},${y})`}>
      <rect
        width={250}
        height={phases ? 150 : 128}
        fill="#1c2026"
        stroke="#999"
      />
      <g
        className="cursor-pointer"
        onClick={() => pick(c, b)}
        data-help="block:HLBL"
      >
        <text
          x={10}
          y={20}
          fontSize={13}
          fill="#fff"
          fontFamily="monospace"
          fontWeight="bold"
        >
          {c}:{b}
        </text>
        <text x={10} y={42} fontSize={13} fill={color} fontFamily="monospace">
          STATE {state} · STMNO {fmt(k.p.STMNO)}
        </text>
        <text x={10} y={62} fontSize={11} fill="#7fd4ff" fontFamily="monospace">
          {String(k.p.LASTMSG || "").slice(0, 32)}
        </text>
        {phases && (
          <text x={10} y={84} fontSize={13} fill="#fff" fontFamily="monospace">
            PHASE {ph}: {phases.names[ph] ?? "-"}
          </text>
        )}
      </g>
      <Push
        x={10}
        y={phases ? 112 : 90}
        label="START"
        c={c}
        b={b}
        p="ACTIVE"
        v={true}
      />
      <Push
        x={100}
        y={phases ? 112 : 90}
        label="ABORT"
        c={c}
        b={b}
        p="ACTIVE"
        v={false}
      />
    </g>
  );
}

// ======================================================================= TANK2 (course)
function Tank2() {
  const st = useSim((s) => s.station);
  const lvl = val(st, "TANK2_COMP", "LT100", "PNT");
  const sp = val(st, "TANK2_COMP", "LC100", "SPT");
  const vout = val(st, "TANK2_COMP", "LV100", "OUT");
  const run = on(st, "PROCESS_2", "MTR_CNTRL", "MSTAT");
  return (
    <Frame title="TANK2_DISP">
      <Pipe d="M 40 120 L 330 120 L 330 160" flow={vout > 1} />
      <Valve
        x={200}
        y={120}
        open={vout}
        label="LV100"
        c="TANK2_COMP"
        b="LV100"
        analog
      />
      <Ctrl x={200} y={50} c="TANK2_COMP" b="LC100" />
      <Vessel
        x={300}
        y={160}
        w={220}
        h={320}
        fill={lvl / 10}
        sp={sp / 10}
        label="TANK2"
      />
      <Tag x={545} y={260} c="TANK2_COMP" b="LT100" />
      <Label x={545} y={300} size={11}>
        SPT {sp.toFixed(1)} INCHES
      </Label>
      <Pipe d="M 410 480 L 410 540 L 700 540" flow={run && lvl > 0.1} />
      <Pump
        x={720}
        y={540}
        run={run}
        label="MTR_CNTRL"
        c="PROCESS_2"
        b="MTR_CNTRL"
      />
      <Pipe d="M 736 540 L 960 540" flow={run && lvl > 0.1} />
      <Push
        x={680}
        y={430}
        label="START"
        c="PROCESS_2"
        b="MTR_CNTRL"
        p="MANRUN"
        v={true}
      />
      <Push
        x={770}
        y={430}
        label="STOP"
        c="PROCESS_2"
        b="MTR_CNTRL"
        p="MANRUN"
        v={false}
      />
      <AlarmTexts
        x={300}
        y={510}
        refs={["TANK2_COMP:LC100", "TANK2_COMP:LT100"]}
      />
      <SeqBox x={700} y={60} c="TANK2_SEQ" b="FILL" />
    </Frame>
  );
}

// ======================================================================= T-101
function Tank101() {
  const st = useSim((s) => s.station);
  const lvl = val(st, "TANK101", "LT101", "PNT");
  const sp = val(st, "TANK101", "LIC101", "SPT");
  const vout = val(st, "TANK101", "LV101", "OUT");
  const qout = val(st, "TANK101", "FT102", "PNT");
  return (
    <Frame title="T101_DISP  T-101 LEVEL">
      <Pipe d="M 40 120 L 380 120 L 380 160" flow={vout > 1} />
      <Tag x={60} y={150} c="TANK101" b="FT101" />
      <Valve
        x={240}
        y={120}
        open={vout}
        label="LV101"
        c="TANK101"
        b="LV101"
        analog
      />
      <Ctrl x={240} y={50} c="TANK101" b="LIC101" />
      <Vessel
        x={340}
        y={160}
        w={240}
        h={320}
        fill={lvl / 5}
        sp={sp / 5}
        label="T-101"
      />
      <Tag x={605} y={260} c="TANK101" b="LT101" />
      <Pipe d="M 460 480 L 460 540 L 700 540" flow={qout > 0.5} />
      <Pump x={720} y={540} run={qout > 0.5} label="P-102 (DRAW-OFF)" />
      <Pipe d="M 736 540 L 960 540" flow={qout > 0.5} />
      <Tag x={800} y={500} c="TANK101" b="FT102" />
      <AlarmTexts x={340} y={515} refs={["TANK101:LIC101", "TANK101:LT101"]} />
    </Frame>
  );
}

// ======================================================================= P-201
function Flow201() {
  const st = useSim((s) => s.station);
  const run = on(st, "FLOW201", "YS201", "CIN");
  const vout = val(st, "FLOW201", "FV201", "OUT");
  const q = val(st, "FLOW201", "FT201", "PNT");
  return (
    <Frame title="P201_DISP  P-201 TRANSFER">
      <Vessel x={60} y={200} w={150} h={240} fill={0.7} label="SUPPLY" />
      <Pipe d="M 210 400 L 330 400" flow={q > 0.5} />
      <Pump x={350} y={400} run={run} label="P-201" c="FLOW201" b="P201" />
      <Pipe d="M 366 400 L 440 400 L 440 260 L 940 260" flow={q > 0.5} />
      <Tag x={400} y={200} c="FLOW201" b="PT202" />
      <Valve
        x={620}
        y={260}
        open={vout}
        label="FV201"
        c="FLOW201"
        b="FV201"
        analog
      />
      <Ctrl x={620} y={150} c="FLOW201" b="FIC201" />
      <Tag x={760} y={300} c="FLOW201" b="FT201" />
      <Tag x={300} y={470} c="FLOW201" b="YS201" p="CIN" label="YS201 RUN" />
      <Push
        x={300}
        y={510}
        label="START"
        c="FLOW201"
        b="P201"
        p="COUT"
        v={true}
      />
      <Push
        x={390}
        y={510}
        label="STOP"
        c="FLOW201"
        b="P201"
        p="COUT"
        v={false}
      />
      <Label x={490} y={528} size={11} color="#ddd">
        (P201 in MANUAL: START/STOP sets COUT)
      </Label>
      <AlarmTexts x={560} y={420} refs={["FLOW201:FIC201", "FLOW201:PT202"]} />
    </Frame>
  );
}

// ======================================================================= E-301
function Hex301() {
  const st = useSim((s) => s.station);
  const vout = val(st, "HEX301", "TV301", "OUT");
  return (
    <Frame title="E301_DISP  E-301 PRODUCT HEATER">
      <Pipe
        d="M 500 40 L 500 220"
        flow={vout > 1}
        color={vout > 1 ? "#ffb070" : undefined}
      />
      <Label x={510} y={52} size={11}>
        STEAM 4 BAR
      </Label>
      <Valve
        x={500}
        y={120}
        open={vout}
        label="TV301"
        c="HEX301"
        b="TV301"
        analog
        vertical
      />
      <Ctrl x={640} y={110} c="HEX301" b="TIC301" />
      <Tag x={370} y={150} c="HEX301" b="FT304" />
      <rect
        x={300}
        y={220}
        width={400}
        height={140}
        rx={60}
        fill="#3a3f46"
        stroke="#ccc"
        strokeWidth={2}
      />
      {[250, 275, 300, 325].map((y) => (
        <line
          key={y}
          x1={330}
          x2={670}
          y1={y + 5}
          y2={y + 5}
          stroke="#5fb4ff"
          strokeWidth={3}
        />
      ))}
      <Label x={500} y={385} anchor="middle">
        E-301
      </Label>
      <Pipe d="M 40 290 L 300 290" flow />
      <Tag x={80} y={250} c="HEX301" b="TT302" />
      <Tag x={190} y={250} c="HEX301" b="FT303" />
      <Pipe d="M 700 290 L 960 290" flow />
      <Tag x={780} y={250} c="HEX301" b="TT301" />
      <Pipe d="M 500 360 L 500 480 L 600 480" color="#888" />
      <Label x={610} y={485} size={11}>
        CONDENSATE
      </Label>
      <AlarmTexts x={300} y={430} refs={["HEX301:TIC301"]} />
    </Frame>
  );
}

// ======================================================================= R-401
const BATCH_PHASES: Record<number, string> = {
  0: "IDLE",
  1: "CHARGE_A",
  2: "CHARGE_B",
  3: "HEAT",
  4: "REACT",
  5: "COOL",
  6: "DISCHARGE",
  7: "COMPLETE",
  9: "HELD",
};

function Reactor() {
  const st = useSim((s) => s.station);
  const vol = val(st, "REACTOR", "LT401", "PNT");
  const fa = val(st, "REACTOR", "FV404", "OUT");
  const fb = val(st, "REACTOR", "FV405", "OUT");
  const tv = val(st, "REACTOR", "TV402", "OUT");
  const ag = on(st, "REACTOR", "YS407", "CIN");
  const dis = on(st, "REACTOR", "ZSO406", "CIN");
  const ilk = on(st, "REACTOR", "ILK401", "BO01");
  return (
    <Frame title="R401_DISP  R-401 BATCH REACTOR">
      {/* feeds */}
      <Pipe d="M 30 90 L 420 90 L 420 150" flow={fa > 1} />
      <Label x={30} y={80} size={11}>
        FEED A
      </Label>
      <Valve
        x={220}
        y={90}
        open={fa}
        label="FV404"
        c="REACTOR"
        b="FV404"
        analog
      />
      <Tag x={290} y={70} c="REACTOR" b="FT404" w={84} />
      <Tag
        x={290}
        y={118}
        c="REACTOR"
        b="FQ404"
        p="RO01"
        label="FQ404 L"
        eu=" "
        w={84}
      />
      <Pipe
        d="M 30 200 L 300 200 L 300 120 L 470 120 L 470 150"
        flow={fb > 1}
      />
      <Label x={30} y={190} size={11}>
        FEED B
      </Label>
      <Valve
        x={160}
        y={200}
        open={fb}
        label="FV405"
        c="REACTOR"
        b="FV405"
        analog
      />
      <Tag x={30} y={240} c="REACTOR" b="FT405" w={84} />
      <Tag
        x={130}
        y={240}
        c="REACTOR"
        b="FQ405"
        p="RO01"
        label="FQ405 L"
        eu=" "
        w={84}
      />
      <Ctrl x={200} y={330} c="REACTOR" b="FIC404" />
      <Ctrl x={200} y={420} c="REACTOR" b="FIC405" />
      {/* reactor */}
      <Vessel
        x={380}
        y={150}
        w={200}
        h={280}
        fill={vol / 1000}
        label="R-401"
        jacket
        labelDx={-60}
      />
      <Agitator x={480} y={110} h={250} run={ag} />
      <Pump x={480} y={100} run={ag} label="" c="REACTOR" b="M407" />
      <Label x={505} y={100} size={11}>
        M407 {ag ? "RUN" : "STOP"}
      </Label>
      <Tag x={600} y={160} c="REACTOR" b="LT401" />
      <Tag x={600} y={205} c="REACTOR" b="TT401" />
      <Tag x={600} y={250} c="REACTOR" b="PT403" />
      <Tag x={600} y={295} c="REACTOR" b="TT402" />
      {/* jacket */}
      <Pipe
        d="M 360 520 L 360 360 L 370 360"
        flow={tv > 1}
        color={tv > 50 ? "#ffb070" : tv > 1 ? "#5fb4ff" : undefined}
      />
      <Valve
        x={360}
        y={470}
        open={tv}
        label="TV402"
        c="REACTOR"
        b="TV402"
        analog
        vertical
      />
      <Label x={250} y={540} size={11}>
        {tv > 50
          ? "JACKET: STEAM"
          : tv > 1
            ? "JACKET: COOLING WATER"
            : "JACKET: OFF"}
      </Label>
      <Ctrl x={740} y={380} c="REACTOR" b="TIC401" />
      <Ctrl x={740} y={470} c="REACTOR" b="TIC402" />
      <Label x={700} y={355} size={10} color="#ddd">
        CASCADE TIC401 → TIC402 → TV402
      </Label>
      {/* discharge */}
      <Pipe d="M 480 430 L 480 560 L 700 560" flow={dis && vol > 1} />
      <Valve
        x={480}
        y={500}
        open={dis ? 100 : 0}
        label="XV406"
        c="REACTOR"
        b="XV406"
        vertical
      />
      {ilk && (
        <text
          x={600}
          y={340}
          fontSize={14}
          fill="#ff4040"
          fontWeight="bold"
          className="fox-blink"
        >
          INTERLOCK ILK401: FULL COOLING
        </text>
      )}
      <SeqBox
        x={730}
        y={30}
        c="R401_SEQ"
        b="PHASES"
        phases={{ tag: ["R401_SEQ", "RECIPE", "RO01"], names: BATCH_PHASES }}
      />
      <AlarmTexts
        x={30}
        y={500}
        refs={[
          "REACTOR:TIC401",
          "REACTOR:LT401",
          "REACTOR:PT403",
          "REACTOR:TT401",
        ]}
      />
    </Frame>
  );
}

// ======================================================================= WFI
function Wfi() {
  const st = useSim((s) => s.station);
  const lvl = val(st, "WFI501", "LT501", "PNT");
  const sp = val(st, "WFI501", "LIC501", "SPT");
  const prod = val(st, "WFI501", "FV501", "OUT");
  const steam = val(st, "WFI501", "TV502", "OUT");
  const divert = on(st, "WFI501", "XV503", "COUT");
  return (
    <Frame title="WFI_DISP  T-501 HOT WFI">
      <rect
        x={40}
        y={60}
        width={110}
        height={90}
        fill="#3a3f46"
        stroke="#ccc"
      />
      <Label x={95} y={110} anchor="middle">
        STILL
      </Label>
      <Pipe d="M 150 100 L 420 100 L 420 170" flow={prod > 1 && !divert} />
      <Valve
        x={230}
        y={100}
        open={prod}
        label="FV501"
        c="WFI501"
        b="FV501"
        analog
      />
      <Ctrl x={230} y={200} c="WFI501" b="LIC501" />
      <Tag x={300} y={130} c="WFI501" b="AT503" />
      <Pipe d="M 360 100 L 360 40 L 600 40" flow={divert && prod > 1} />
      <Valve
        x={360}
        y={70}
        open={divert ? 100 : 0}
        label="XV503"
        c="WFI501"
        b="XV503"
        vertical
      />
      <Label x={610} y={44} size={11}>
        TO DRAIN
      </Label>
      {divert && (
        <text
          x={420}
          y={64}
          fontSize={13}
          fill="#ff4040"
          fontWeight="bold"
          className="fox-blink"
        >
          DIVERTING: CONDUCTIVITY HIGH
        </text>
      )}
      <Vessel
        x={380}
        y={170}
        w={170}
        h={250}
        fill={lvl / 100}
        sp={sp / 100}
        label="T-501"
        round
      />
      <Tag x={570} y={200} c="WFI501" b="LT501" />
      {/* loop */}
      <Pipe d="M 465 420 L 465 520 L 900 520 L 900 300 L 560 300" flow />
      <Pump x={600} y={520} run label="P-502" />
      <rect
        x={700}
        y={490}
        width={90}
        height={60}
        fill="#3a3f46"
        stroke="#ccc"
      />
      <Label x={745} y={525} anchor="middle" size={11}>
        HEATER
      </Label>
      <Valve
        x={745}
        y={460}
        open={steam}
        label="TV502"
        c="WFI501"
        b="TV502"
        analog
        vertical
      />
      <Ctrl x={800} y={400} c="WFI501" b="TIC502" />
      <Tag x={700} y={270} c="WFI501" b="TT502" />
      <Tag x={820} y={270} c="WFI501" b="FT504" />
      <Label x={760} y={590} size={11} color="#ddd">
        POINTS OF USE · LOOP ≥ 65 °C
      </Label>
      <AlarmTexts
        x={40}
        y={460}
        refs={["WFI501:LT501", "WFI501:AT503", "WFI501:TIC502"]}
      />
    </Frame>
  );
}

// ======================================================================= CIP
function Cip() {
  const st = useSim((s) => s.station);
  const vol = val(st, "CIP", "LT601", "PNT");
  const w = on(st, "CIP", "XV601", "COUT");
  const ca = on(st, "CIP", "XV602", "COUT");
  const ac = on(st, "CIP", "XV603", "COUT");
  const dr = on(st, "CIP", "XV604", "COUT");
  const p = on(st, "CIP", "P601", "COUT");
  const steam = val(st, "CIP", "TV602", "OUT");
  return (
    <Frame title="CIP_DISP  C-601 CIP SKID">
      <Pipe d="M 30 80 L 300 80 L 300 160" flow={w} />
      <Label x={30} y={70} size={11}>
        PURIFIED WATER
      </Label>
      <Valve
        x={150}
        y={80}
        open={w ? 100 : 0}
        label="XV601"
        c="CIP"
        b="XV601"
      />
      <Pipe d="M 30 140 L 230 140 L 230 120 L 280 120 L 280 160" flow={ca} />
      <Label x={30} y={130} size={11}>
        CAUSTIC
      </Label>
      <Valve
        x={120}
        y={140}
        open={ca ? 100 : 0}
        label="XV602"
        c="CIP"
        b="XV602"
      />
      <Pipe d="M 30 200 L 200 200" flow={ac} />
      <Pipe d="M 200 200 L 240 200 L 240 160" flow={ac} />
      <Label x={30} y={190} size={11}>
        ACID
      </Label>
      <Valve
        x={120}
        y={200}
        open={ac ? 100 : 0}
        label="XV603"
        c="CIP"
        b="XV603"
      />
      <Vessel
        x={220}
        y={160}
        w={160}
        h={240}
        fill={vol / 500}
        label="CIP TANK"
      />
      <Tag x={400} y={180} c="CIP" b="LT601" />
      <Pipe d="M 300 400 L 300 480 L 460 480" flow={p} />
      <Pump x={480} y={480} run={p} label="P601" c="CIP" b="P601" />
      <Pipe d="M 496 480 L 620 480" flow={p} />
      <rect
        x={620}
        y={450}
        width={80}
        height={60}
        fill="#3a3f46"
        stroke="#ccc"
      />
      <Label x={660} y={485} anchor="middle" size={11}>
        HEATER
      </Label>
      <Valve
        x={660}
        y={420}
        open={steam}
        label="TV602"
        c="CIP"
        b="TV602"
        analog
        vertical
      />
      <Ctrl x={760} y={380} c="CIP" b="TIC602" />
      <Pipe d="M 700 480 L 900 480 L 900 280 L 560 280" flow={p} />
      <Label x={830} y={470} size={11}>
        TO EQUIPMENT
      </Label>
      <Tag x={720} y={520} c="CIP" b="TT602" />
      <Tag x={840} y={520} c="CIP" b="FT604" />
      <Tag x={700} y={250} c="CIP" b="AT603" />
      <Pipe d="M 560 280 L 400 280 L 400 260" flow={p && !dr} />
      <Pipe d="M 560 280 L 560 200 L 640 200" flow={p && dr} />
      <Valve
        x={560}
        y={230}
        open={dr ? 100 : 0}
        label="XV604"
        c="CIP"
        b="XV604"
        vertical
      />
      <Label x={650} y={204} size={11}>
        DRAIN
      </Label>
      <SeqBox x={730} y={40} c="CIP_SEQ" b="CIP_PROG" />
      <AlarmTexts x={30} y={540} refs={["CIP:FT604", "CIP:TIC602"]} />
    </Frame>
  );
}

export const DISPLAYS: DisplayDef[] = [
  {
    id: "TANK2_DISP",
    title: { en: "TANK2 (course)", ru: "TANK2 (курс)" },
    needs: "TANK2_COMP",
    Svg: Tank2,
  },
  {
    id: "T101_DISP",
    title: { en: "T-101 level", ru: "T-101 уровень" },
    needs: "TANK101",
    Svg: Tank101,
  },
  {
    id: "P201_DISP",
    title: { en: "P-201 flow", ru: "P-201 расход" },
    needs: "FLOW201",
    Svg: Flow201,
  },
  {
    id: "E301_DISP",
    title: { en: "E-301 heater", ru: "E-301 теплообменник" },
    needs: "HEX301",
    Svg: Hex301,
  },
  {
    id: "R401_DISP",
    title: { en: "R-401 reactor", ru: "R-401 реактор" },
    needs: "REACTOR",
    Svg: Reactor,
  },
  {
    id: "WFI_DISP",
    title: { en: "T-501 WFI", ru: "T-501 WFI" },
    needs: "WFI501",
    Svg: Wfi,
  },
  {
    id: "CIP_DISP",
    title: { en: "C-601 CIP", ru: "C-601 CIP" },
    needs: "CIP",
    Svg: Cip,
  },
];

/** Displays that match the compounds loaded in the CP. */
export function displaysFor(st: ControlStation) {
  return DISPLAYS.filter((d) => st.db.compounds.includes(d.needs));
}
