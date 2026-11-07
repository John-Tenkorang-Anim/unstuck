import type { Entry } from "@/lib/types";

export function LearningLoop() {
  return (
    <div
      className="learning-loop"
      aria-label="Try something, share what happened, help someone forward"
    >
      <svg viewBox="0 0 420 280" fill="none" aria-hidden="true">
        <defs>
          <marker
            id="loop-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="5"
            refY="4"
            orient="auto"
          >
            <path d="m1 1 4 3-4 3" stroke="#758568" strokeWidth="1.4" />
          </marker>
        </defs>
        <ellipse
          cx="211"
          cy="139"
          rx="118"
          ry="92"
          stroke="#d0d7c7"
          strokeDasharray="3 6"
        />
        <path
          d="M147 59q97-52 164 38M326 130q2 88-92 109M184 238Q83 227 90 140"
          stroke="#7b8b6f"
          strokeWidth="1.2"
          markerEnd="url(#loop-arrow)"
        />
        <path
          d="m224 90 12-17m12 24 19-6M150 183l-14 14m9-28-19 2"
          stroke="#8b9b7c"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path d="M170 142q31-35 58-8t-24 37q-37 0-34-29Z" fill="#d8f0b4" />
        <path
          d="m186 145 17-17m-8 0h8v8m-12 12-9 9m0-8v8h8"
          stroke="#3b5036"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x="210" y="207" textAnchor="middle" className="loop-handwriting">
          a little further, together
        </text>
        <circle cx="89" cy="126" r="4" fill="#b9d488" />
        <circle cx="324" cy="111" r="4" fill="#b9d488" />
      </svg>
      <span className="loop-label loop-label-one">
        <span>01</span> Try something
      </span>
      <span className="loop-label loop-label-two">
        <span>02</span> Share the story
      </span>
      <span className="loop-label loop-label-three">
        <span>03</span> Move us forward
      </span>
      <span className="loop-side-note">NO PERFECT ANSWERS REQUIRED.</span>
    </div>
  );
}

export function Artwork({
  type,
  className = "",
}: {
  type: Entry["illustration"];
  className?: string;
}) {
  if (type === "code")
    return (
      <div className={`entry-art art-code ${className}`} aria-hidden="true">
        <div className="code-window">
          <div className="code-window-bar">
            <i />
            <i />
            <i />
            <span>one-small-assumption.ts</span>
          </div>
          <div className="code-lines">
            <span className="code-muted">// the fix was one line.</span>
            <br />
            <span className="code-purple">const</span> key = [<br />
            <span className="code-indent">
              <span className="code-green">workspace.id</span>,
            </span>
            <br />
            <span className="code-indent">...filters</span>
            <br />
            ].join(<span className="code-green">&apos;:&apos;</span>);
            <br />
            <span className="code-muted">// the lesson was bigger.</span>
          </div>
          <span className="code-cursor" />
        </div>
        <span className="art-caption">LESSON LEARNED THE HARD WAY ↗</span>
      </div>
    );
  if (type === "pots")
    return (
      <div className={`entry-art art-pots ${className}`} aria-hidden="true">
        <svg viewBox="0 0 540 280" fill="none">
          <defs>
            <linearGradient
              id="pot-shade"
              x1="220"
              y1="120"
              x2="360"
              y2="270"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#D29369" />
              <stop offset="1" stopColor="#9C5C3E" />
            </linearGradient>
            <linearGradient
              id="inner-shade"
              x1="229"
              y1="115"
              x2="290"
              y2="208"
            >
              <stop stopColor="#C08359" />
              <stop offset="1" stopColor="#874C34" />
            </linearGradient>
            <pattern
              id="pot-grain"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r=".6" fill="#FFF" fillOpacity=".15" />
            </pattern>
          </defs>
          <ellipse
            cx="281"
            cy="245"
            rx="132"
            ry="14"
            fill="#9D805A"
            fillOpacity=".12"
          />
          <path
            d="M169 117c0 148 39 126 111 130 74 0 115-10 115-130"
            fill="url(#pot-shade)"
          />
          <path
            d="M169 117c0 148 39 126 111 130 74 0 115-10 115-130"
            fill="url(#pot-grain)"
          />
          <ellipse cx="282" cy="117" rx="113" ry="34" fill="#D9A67D" />
          <ellipse cx="282" cy="117" rx="99" ry="25" fill="#9C7250" />
          <ellipse cx="282" cy="115" rx="91" ry="21" fill="#C6AB7C" />
          <path
            d="M208 105c4 81 19 100 74 100 52 0 68-23 74-100"
            fill="url(#inner-shade)"
          />
          <ellipse cx="282" cy="105" rx="75" ry="24" fill="#DBA17D" />
          <ellipse cx="282" cy="105" rx="66" ry="17" fill="#704833" />
          <path
            d="M216 102q20-11 41 0l18-12 32 5 29 9-12 17-95-1Z"
            fill="#75834B"
          />
          <ellipse
            cx="259"
            cy="101"
            rx="23"
            ry="20"
            fill="#C95F43"
            transform="rotate(-12 259 101)"
          />
          <ellipse cx="303" cy="102" rx="23" ry="21" fill="#D4774F" />
          <ellipse cx="282" cy="87" rx="24" ry="21" fill="#D66547" />
          <path
            d="m280 70 2 13 10-9-6 13 14 1-17 3-13-6 10 1-8-10Z"
            fill="#4C6740"
          />
          <path d="m257 85 3 12 10-4-7 9-13-1 8-3-7-7Z" fill="#517044" />
          <path
            d="M175 156q96 42 216-3M185 197q83 33 193-2"
            stroke="#9F6345"
            strokeWidth="1.5"
            opacity=".4"
          />
          <path
            d="M116 94q12-22 44-18"
            stroke="#79836A"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeDasharray="3 4"
          />
          <path d="m154 71 8 5-8 5" stroke="#79836A" strokeWidth="1.3" />
          <text
            x="53"
            y="72"
            fill="#647158"
            fontSize="12"
            transform="rotate(-8 53 72)"
            className="art-note"
          >
            simple materials,
          </text>
          <text
            x="57"
            y="88"
            fill="#647158"
            fontSize="12"
            transform="rotate(-8 57 88)"
            className="art-note"
          >
            a different possibility.
          </text>
          <path
            d="M378 69q6-15 18-16m-13 21q19-10 32-2m-25 8q14 0 18 9"
            stroke="#778B5A"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="436" cy="185" r="3" fill="#AABD7F" />
          <circle cx="125" cy="200" r="2" fill="#AABD7F" />
          <path d="m427 127 8 0m-4-4v8" stroke="#AABD7F" strokeWidth="1.5" />
        </svg>
        <span className="art-caption">A SMALL EXPERIMENT IN POSSIBILITY</span>
      </div>
    );
  if (type === "chair")
    return (
      <div className={`entry-art art-chair ${className}`} aria-hidden="true">
        <svg viewBox="0 0 360 240" fill="none">
          <ellipse
            cx="180"
            cy="214"
            rx="83"
            ry="10"
            fill="#9b7455"
            opacity=".08"
          />
          <g
            stroke="#806A51"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m123 116 94-16 38 28-94 22-38-34Z" fill="#D8BE92" />
            <path d="m129 115-3-65 86-13 7 63M138 75l63-9m-63 24 65-9M159 150l-7 60m95-79 4 66M129 135l-8 52m93-35 3 31" />
            <path d="m151 200 65-17 34 5" strokeDasharray="4 5" />
          </g>
          <path d="m131 129 20 17" stroke="#CB6B50" strokeWidth="5" />
          <path
            d="M95 130q-30 11-25 33"
            stroke="#9D7E66"
            strokeDasharray="3 4"
          />
          <text
            x="36"
            y="182"
            fontSize="12"
            fill="#806A51"
            className="art-note"
            transform="rotate(-8 36 182)"
          >
            start with the joint.
          </text>
          <path d="m257 53 8-12m0 21 14-3" stroke="#B19770" strokeWidth="1.5" />
        </svg>
      </div>
    );
  if (type === "garden")
    return (
      <div className={`entry-art art-garden ${className}`} aria-hidden="true">
        <svg viewBox="0 0 360 240" fill="none">
          <path d="M55 195h250" stroke="#96AC83" strokeWidth="2" />
          <g stroke="#65815A" strokeWidth="2" strokeLinecap="round">
            <path
              d="M103 195v-65m0 39q-41 0-37-31 35-2 37 31m0-17q36 0 36-31-32-3-36 31M185 195V86m0 65q-45-1-40-34 35-3 40 34m0-27q43 0 43-34-40-5-43 34m0-23q-16-29 1-43 17 15-1 43M269 195v-48m0 33q-28-1-28-26 29-1 28 26m0-16q29 0 29-24-25-3-29 24"
              fill="#B5CEA1"
            />
          </g>
          <g stroke="#AFC4A1" strokeWidth="1.5">
            <path d="m97 52-4 13m37-26-4 13m23-2-4 13m118 0-4 13m25-34-4 13" />
          </g>
          <text x="166" y="220" fontSize="11" fill="#6F835F" letterSpacing="2">
            WATCH. WONDER. REPEAT.
          </text>
        </svg>
      </div>
    );
  if (type === "light")
    return (
      <div className={`entry-art art-light ${className}`} aria-hidden="true">
        <svg viewBox="0 0 360 240" fill="none">
          <path
            d="m136 40 97-11v145l-97 11V40Z"
            fill="#D8BC81"
            fillOpacity=".35"
          />
          <path
            d="m151 52 66-8v116l-66 9V52Z"
            fill="#F7ECCB"
            stroke="#B39965"
            strokeWidth="2"
          />
          <path
            d="m184 48 0 116m-33-59 65-9"
            stroke="#B39965"
            strokeWidth="2"
          />
          <path
            d="m152 169 120 42-175 0 55-42Z"
            fill="#EBD592"
            fillOpacity=".5"
          />
          <circle cx="267" cy="62" r="17" fill="#D4AD5E" />
          <path
            d="m266 33 0-7m0 72v-7m30-29h8m-72 0h7m7-21-5-5m46 52 5 5m-5-51 5-5"
            stroke="#D4AD5E"
            strokeWidth="2"
          />
          <text
            x="43"
            y="79"
            fill="#927C51"
            className="art-note"
            fontSize="12"
            transform="rotate(-7 43 79)"
          >
            what if...?
          </text>
        </svg>
      </div>
    );
  return (
    <div className={`entry-art art-water ${className}`} aria-hidden="true">
      <svg viewBox="0 0 360 240" fill="none">
        <g stroke="#6A8B98" strokeWidth="2">
          <path d="M125 57v38l-29 70q-11 29 18 29h64q29 0 17-29l-28-70V57" />
          <path d="M119 57h54m-59 88h65" />
          <path d="M213 43v72l-14 70q-3 14 12 14h47q15 0 12-14l-13-70V43m-49 0h54m-52 107h50" />
        </g>
        <path
          d="m112 151-10 24q-4 12 11 12h65q12 0 8-12l-10-24Z"
          fill="#ADC9CE"
        />
        <path d="m218 156-6 28q-1 7 8 7h30q8 0 7-7l-6-28Z" fill="#B7D0C7" />
        <circle cx="142" cy="169" r="4" fill="#E2EFF1" />
        <circle cx="160" cy="179" r="3" fill="#E2EFF1" />
        <text x="60" y="222" fill="#6A8B98" fontSize="11" letterSpacing="2">
          EVERY RESULT HAS SOMETHING TO TEACH.
        </text>
      </svg>
    </div>
  );
}
