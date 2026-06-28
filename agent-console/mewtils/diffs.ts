//this is a peaceful, react-free zone :)
//we do notacknowledge the existence of react here 

/*export type DiffRes = {
    added: string[];
    rem: string[];
    change: string[];
}

//oki dis be the skeleton, we replace dis laturr

export function diffContext(
    oldstuff: unknown,
    newstuff: unknown
): DiffRes {
    const result: DiffRes = {added: [], rem: [], change: []};
    
    if (
        typeof oldstuff !== "object" || typeof newstuff !== "object" || oldstuff === null || newstuff === null
    )

        {return result;}

    const oldO = oldstuff as Record<string, unknown>;
    const newO = newstuff as Record<string, unknown>;

    const oldK = Object.keys(oldO);
    const newK = Object.keys(newO);

    //now the Ami-Monjulika-part
    //in new but not in old
    for (const key of newK) {
        if (!(key in oldO)) {
            result.added.push(key);
        }
        //check if there's any typa alter

        else if (oldO[key] !== newO[key]) {
            result.change.push(key);
        }
    }
    //in old but not in new
    for (const key of oldK){
        if (!(key in newO)){
            result.rem.push(key);
        }
    }

    return result;
}*/

//disclaimer or disclosure idk but ... this isn't recursive so ... will update if I have time

//OKAY NEVER MIND !!!! TURNS OUT IT'S A MASSIVE NESTED ORDEAL omg

export type DiffRes = {
    added: string[];
    rem: string[];
    change: string[];
};

function walk(
    oldV: unknown,
    newV: unknown,
    path: string,
    result: DiffRes
) {
    // Base case: one of them refused to objectification ... hehe 2026
    if (
        typeof oldV !== "object" ||
        typeof newV !== "object" ||
        oldV === null ||
        newV === null
    ) {
        if (oldV !== newV) {
            result.change.push(path);
        }
        return;
    }

    const oldObj = oldV as Record<string, unknown>;
    const newObj = newV as Record<string, unknown>; //... newObj reminds me of my ICSE Java days

    const oldKeys = Object.keys(oldObj);
    const newKeys = Object.keys(newObj);

    
    for (const key of newKeys) {
        const currentPath = path ? `${path}.${key}` : key;

        if (!(key in oldObj)) {
            result.added.push(currentPath);
            continue;
        }

        walk(oldObj[key], newObj[key], currentPath, result);
    }

    
    for (const key of oldKeys) {
        const currentPath = path ? `${path}.${key}` : key;

        if (!(key in newObj)) {
            result.rem.push(currentPath);
        }
    }
}

export function diffContext(
    oldStuff: unknown,
    newStuff: unknown
): DiffRes {
    const result: DiffRes = {
        added: [],
        rem: [],
        change: [],
    };

    walk(oldStuff, newStuff, "", result);

    return result;
}
// ... why did ctx_schema just get compared with ctx_session ????? 
// do we group in context_id ???


