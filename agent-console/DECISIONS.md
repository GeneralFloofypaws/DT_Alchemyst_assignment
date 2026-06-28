When I first started this assignment, I knew the biggest challenge wasn't rendering messages, it was making sure the UI only updated with the correct packets even when the server intentionally started behaving badly.

For ordering I used a Map<number, Packet> as a small reorder buffer.

Whenever a packet arrives I first check whether I've already processed that sequence number. If I have, I ignore it immediately. Otherwise I put it into the buffer.

I then try to emit packets starting from the sequence number I'm expecting next. As long as the next sequence exists in the buffer, I remove it and let the UI consume it. The moment I hit a gap I stop. That way packets can arrive in any order but the UI still always renders them in sequence.

I also keep a Set of processed sequence numbers so duplicates from chaos mode don't get rendered twice. Looking up a sequence in a Set is basically instant, so it felt like the simplest choice.



I ended up using both useState and useRef, but for different reasons.

Anything that should immediately update the UI lives in useState. Things like the streamed response, tool calls, timeline, snapshots and connection status all need React to re-render the page when they change.

Everything that represents mutable connection state lives inside useRef instead. Things like the WebSocket itself, the reconnect timer, reconnect attempt counter, highest processed sequence, shutdown flag and reorder buffer don't need to trigger renders every time they change. If I had stored those in state, React would have been re-rendering constantly while packets were arriving.

So the rough rule I followed was:

If changing the value should redraw the UI, I used state.

If changing the value was only part of the networking logic, I used refs.



Tool calls can interrupt token streaming, so I didn't want the whole page jumping around every time a tool event appeared.

Instead I kept each major section inside its own card and rendered tool calls in a dedicated panel. The streamed response keeps growing in one place while the tool panel updates independently. Token events are also grouped together in the timeline instead of creating one new DOM node per token, which makes the timeline much easier to read.



For reconnects I treated the socket and the UI as two separate pieces of state.

The socket may receive packets out of order, duplicates or replayed events after a RESUME.

The UI only advances after the reorder buffer releases packets in sequence.

I keep track of the highest sequence number that has actually been processed by the UI lastSeqR. During reconnect I send that value in the RESUME message. When replayed packets arrive, anything with an older sequence number is ignored because it has already been gone through.

That separation between "received" and "actually rendered" made the reconnect logic much easier to reason about.



If this needed to display fifty agent streams at once, I'd probably split each stream into its own isolated component with its own reorder buffer instead of having everything live in one page. I'd also virtualize long timelines so the browser isn't trying to render thousands of DOM nodes at once, as is done in like the common LLMs we know.

For much longer responses, I'd stop storing the entire response as one giant string. I'd probably chunk the output, virtualize the rendered text, and eventually move older chunks out of memory. The current approach is perfectly fine for chat-sized responses, but full document generation would eventually start slowing down rendering performance by a lot.



One interesting thing I noticed while testing chaos mode was that I occasionally ended up waiting forever for a missing sequence number.

The chaos engine intentionally reorders, duplicates and delays packets, but from reading the implementation it doesn't appear to intentionally drop them.

I couldn't prove whether this was caused by a protocol issue, replay behaviour during reconnect, or something else entirely, so I didn't try to "fix" it in the client.

If I were continuing this project, I'd add a watchdog around the reorder buffer that logs whenever a sequence has been missing for an unusually long time. That would make it much easier to distinguish between genuine packet loss and an unexpected replay edge case.
