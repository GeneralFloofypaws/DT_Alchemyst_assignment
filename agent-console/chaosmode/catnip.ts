//two seconds in and I can see tokens forgetting how to +1
//okay the server gave me the random probabilities ... dropAfterMSsgs is 32
//packets are taking vacations of a few ms

export /*type*/ interface SEvent {
    seq: number;
    type: string;
    call_id?: string;
    tool_name?: string;
    args?: unknown;
    result?: unknown;
    text?: string;
    challenge?: string;
    context_id?: string;
    data?: unknown;
};
//okay now we broach the issues one by ome
//k now to order the seqs ... like if they're NOT in order then hold the ordered ones in an array or smth
export class chaosbuff {
    private expseq = 1;
    private pending = new Map<number, SEvent>();

    push(packet: SEvent): SEvent[] {

    if (!this.pending.has(this.expseq)) {console.log("Waiting for missing seq", this.expseq, "Highest seen", Math.max(...this.pending.keys()));
}

    console.log("Incoming:", packet.seq);

    
    if (packet.seq < this.expseq) {
        console.log("Ignoring stale packet", packet.seq);
        return [];
    }

    this.pending.set(packet.seq, packet);

    console.log("Expected:", this.expseq);
    console.log("Pending:", [...this.pending.keys()].sort((a,b)=>a-b));

    return this.drain();
}

    private drain(): SEvent[] {
    const ready: SEvent[] = [];

    while (this.pending.has(this.expseq)) {
        console.log("Emitting", this.expseq);

        const packet = this.pending.get(this.expseq)!;
        ready.push(packet);

        this.pending.delete(this.expseq);
        this.expseq++;
    }

    return ready;
}

}

//alrighty ordering is done 
//now we do exponential backoff see page.tsx 
