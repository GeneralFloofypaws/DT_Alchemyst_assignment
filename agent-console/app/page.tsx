//currently ws is trapped IN useeffect 
//fixed!!!
"use client";
import "./page.css"
import { useEffect, useState, useRef } from "react";
import { diffContext, DiffRes } from "@/mewtils/diffs";
//this file is getting long 
//but now we enter chaos mode
import { chaosbuff } from "@/chaosmode/catnip";


type ToolCall = {
    call_id: string;
    tool_name: string;
    args: unknown;
    status: "waiting" | "complete";
    result: unknown | null;
  }

//add custom type for timeline ... 

type timelineevent = {
  id: string;
  type: string;

  startSeq: number;
  endSeq: number;

  text?: string;
  count?: number;

  packet?: unknown;
};

export default function Home() {
  
const chaosR = useRef(new chaosbuff());
  const wsRef = useRef<WebSocket | null>(null);
  const [response, setResponse] = useState("");
  const [input, setInput] = useState("");
  //now for streaming
  const [streamstats, setstreamstats] = useState<"Idle" | "Streaming" | "Complete">("Idle");
    //now we prepz for da timeline
  const processedseqz = useRef(new Set<number>());
  const [timeline, settimeline] = useState<timelineevent[]>([]);//we'll ts-frenly this later
  //now for connection stats uff :sob:
  //except just conn and disconn won't do ... so uff again write ur own type
  type ConnStats = | "Connected" | "Disconnected" | "Reconnecting ..." | "Connecting ...";
  const [connectionstatus, setconnectionstatus] = useState<ConnStats>("Connecting ...");
  //we cat TypeScript political correctness later 
  //oki now we update TS PC-ness heehee
  const [toolcalls, setToolcalls] = useState<ToolCall[]>([]);
  const lastSeqR = useRef(0);

  //oki now comes the pretty stuff, scrolling and stream stats
  const reconntimeoutR = useRef<NodeJS.Timeout | null>(null);
  
  const reconnAttR = useRef(0); //recon attempts

  const shutdownR = useRef(false);

  //it's a new day it's a new cat now we add reconn recovery
  const izreconnR = useRef(false);

  //now snapsh
  //const [snapshots, setsnaps] = useState([]); ... why is ts reading this as never[]??
  type conxsnaps = {context_id: string; data: unknown;};
  const [snapshots, setsnaps] = useState<conxsnaps[]>([]);

  const [contdiff, setcontdiff] = useState<DiffRes>({
    added: [], rem: [], change: [],
  });
  
  //now history ... was this task 2 or 3 uff 
  //so many states 
  const [snapshotnow, setnowsnaps] = useState(0);
  const currentsnaps = snapshots[snapshotnow];

  const timelineEnds = useRef<HTMLDivElement | null>(null);

  const sendmsg = () => {
    if (!wsRef.current) return;
    if (wsRef.current.readyState !== WebSocket.OPEN) return;
    if (streamstats === "Streaming") return;

    setResponse("");
    setToolcalls([]);
    setstreamstats("Streaming");

    wsRef.current.send(JSON.stringify({type: "USER_MESSAGE", content: input}));

    setInput("");
  };

  const connect = () => {
    shutdownR.current = false;

    wsRef.current = new WebSocket("ws://localhost:4747/ws");
    const ws = wsRef.current;

    ws.onopen = () => {
      console.log("CONNECTED");
      console.log("Reconnect?", izreconnR.current);
      console.log("Last seq that went thru", lastSeqR.current);
      setconnectionstatus("Connected");
      reconnAttR.current = 0;
      if (izreconnR.current) {
        console.log("RESUME-ing");
        ws.send(JSON.stringify({type: "RESUME", last_seq: lastSeqR.current}));
        izreconnR.current = false;
      }
    };

    ws.onmessage = (message: MessageEvent) => {
      const data = JSON.parse(message.data);

      if (data.type == "PING"){
        const pong = {
          type: "PONG",
          echo: data.challenge ?? "",
        };

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(pong));
        };
        return;
      }

      console.log("RAW EVENT", data.seq, data.type);

      const packets = chaosR.current.push(data);

      for (const packet of packets) {

        if (processedseqz.current.has(packet.seq)) continue;

        processedseqz.current.add(packet.seq);
        lastSeqR.current = Math.max(lastSeqR.current, packet.seq);
        if (processedseqz.current.size > 1000) {
            processedseqz.current.delete(lastSeqR.current - 1000);
        }
        

        /*settimeline(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            ...packet,
          },
        ]);*/ //merge token pax

        settimeline(prev => {

  if (packet.type === "TOKEN") {

    const last = prev[prev.length - 1];

    if (last && last.type === "TOKEN_GROUP") {

      return [
        ...prev.slice(0, -1),
        {
          ...last,
          endSeq: packet.seq,
          count: (last.count ?? 0) + 1,
          text: (last.text ?? "") + (packet.text ?? ""),
        },
      ];
    }

    return [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: "TOKEN_GROUP",
        startSeq: packet.seq,
        endSeq: packet.seq,
        count: 1,
        text: packet.text ?? "",
      },
    ];
  }

  return [
    ...prev,
    {
      id: crypto.randomUUID(),
      type: packet.type,
      startSeq: packet.seq,
      endSeq: packet.seq,
      packet,
    },
  ];
});

        if (packet.type == "TOKEN"){
          setResponse((prev) => prev + packet.text);
        }

        if (packet.type === "STREAM_END") {
          setstreamstats("Complete");
        }

        if (packet.type === "TOOL_CALL"){

          const socket = wsRef.current;

          socket?.send(
            JSON.stringify({
              type: "TOOL_ACK",
              call_id: packet.call_id
            })
          );

          console.log("you have been ack-ed", packet.call_id);

          setToolcalls(prev => [
            ...prev,
            {
              call_id: packet.call_id as string,
              tool_name: packet.tool_name as string, 
              args: packet.args,
              status: "waiting",
              result: null,
            }
          ]);
        }

        if (packet.type === "TOOL_RESULT"){
          setToolcalls(prev =>
            prev.map(tool =>
              tool.call_id === packet.call_id
                ? {...tool, result: packet.result, status: "complete"}
                : tool
            )
          );
        }

        if (packet.type === "CONTEXT_SNAPSHOT") {

          setsnaps(prev => {
            const previous = [...prev].reverse().find(
              snap => snap.context_id === packet.context_id
            );

            if (previous){
              const diffs = diffContext(previous.data, packet.data);
              setcontdiff(diffs);
            }

            return [
              ...prev,
              {
                context_id: packet.context_id as string,
                data: packet.data
              }
            ];
          });
        }
      }
    };

    ws.onclose = (e) => {
  console.log("CLOSED", e.code, e.reason);

  if (shutdownR.current) return;

  console.log("Scheduling reconnect");

  izreconnR.current = true;
  setconnectionstatus("Reconnecting ...");

  const delay = Math.min(500 * (2 ** reconnAttR.current), 10000);

  console.log("Delay =", delay);

  reconnAttR.current++;

  reconntimeoutR.current = setTimeout(() => {
    console.log("Attempting reconnect");
    connect();
  }, delay);
};
  };

  useEffect(() => {
    connect();

    return () => {
      shutdownR.current = true;
      if (reconntimeoutR.current) clearTimeout(reconntimeoutR.current);
      wsRef.current?.close();
    };
  }, []);

  useEffect(() => {
    timelineEnds.current?.scrollIntoView({ behavior: "smooth" });
  }, [timeline]);

  return (
  <main className="dashboard">

    <header className="header">
      <h1>Agent Console</h1>

      <div className="status">
        {connectionstatus}
      </div>
    </header>

    <div className="prompt">
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") sendmsg();
        }}
      />

      <button
        onClick={sendmsg}
        disabled={
          connectionstatus !== "Connected"
          || streamstats === "Streaming"
        }
      >
        {streamstats === "Streaming" ? "Working ..." : "Send"}
      </button>
    </div>

    <div className="grid">

      <section className="card">
        <h2>Assistant Response</h2>
        <p><strong>Status:</strong> {streamstats}</p>
        <pre>{response}</pre>
      </section>

      <section className="card">
        <h2>Timeline</h2>
        <ul>
  {timeline.map(event => (
    <li key={event.id}>

      {event.type === "TOKEN_GROUP" ? (
        <>
           Streamed {event.count} token{event.count !== 1 ? "s" : ""}

          <details>
            <summary>  
              Seq #{event.startSeq} → #{event.endSeq}
            </summary>

            <pre>{event.text}</pre>
          </details>
        </>
      ) : (
        <>
          #{event.startSeq} {event.type}
        </>
      )}

    </li>
  ))}
</ul>
      </section>

      <section className="toolCard">
        <h2>Tool Calls</h2>

        {toolcalls.map(tool => (
          <div key={tool.call_id}>
            <p>{tool.tool_name}</p>
            <pre>{JSON.stringify(tool.args, null, 2)}</pre>
            <p>Status: {tool.status}</p>
            {tool.result && (
              <pre>{JSON.stringify(tool.result, null, 2)}</pre>
            )}
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Context Inspector</h2>

        <p>
          Context ID: {currentsnaps?.context_id ?? "None"}
        </p>

        <pre>
          {snapshots.length > 0
            ? JSON.stringify(currentsnaps.data, null, 2)
            : "No context yet"}
        </pre>

        <h3>Added</h3>
        <pre>{JSON.stringify(contdiff.added, null, 2)}</pre>

        <h3>Removed</h3>
        <pre>{JSON.stringify(contdiff.rem, null, 2)}</pre>

        <h3>Changed</h3>
        <pre>{JSON.stringify(contdiff.change, null, 2)}</pre>
      </section>

    </div>

  </main>
);
}
//okay task 1 done now we work on reconn 
//the U in UI rn stands for ugly

///heyyy just ran chaos ... HEARTBEAT SURVIVES, DUPES WORK
