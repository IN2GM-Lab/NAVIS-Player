// Fast-ish ASCII PLY parsing in a Web Worker to keep the main thread smooth.

const decoder = new TextDecoder();
let cachedHeader = null;
let cachedHeaderRaw = null;

const TYPE_INFO = {
    char:  { size: 1, read: (dv, o) => dv.getInt8(o) },
    int8:  { size: 1, read: (dv, o) => dv.getInt8(o) },
    uchar: { size: 1, read: (dv, o) => dv.getUint8(o) },
    uint8: { size: 1, read: (dv, o) => dv.getUint8(o) },
    short: { size: 2, read: (dv, o, le) => dv.getInt16(o, le) },
    int16: { size: 2, read: (dv, o, le) => dv.getInt16(o, le) },
    ushort:{ size: 2, read: (dv, o, le) => dv.getUint16(o, le) },
    uint16:{ size: 2, read: (dv, o, le) => dv.getUint16(o, le) },
    int:   { size: 4, read: (dv, o, le) => dv.getInt32(o, le) },
    int32: { size: 4, read: (dv, o, le) => dv.getInt32(o, le) },
    uint:  { size: 4, read: (dv, o, le) => dv.getUint32(o, le) },
    uint32:{ size: 4, read: (dv, o, le) => dv.getUint32(o, le) },
    float: { size: 4, read: (dv, o, le) => dv.getFloat32(o, le) },
    float32:{ size: 4, read: (dv, o, le) => dv.getFloat32(o, le) },
    double:{ size: 8, read: (dv, o, le) => dv.getFloat64(o, le) },
    float64:{ size: 8, read: (dv, o, le) => dv.getFloat64(o, le) },
};

function parseHeader(text) {
    const endToken = "end_header";
    const endIdx = text.indexOf(endToken);
    if (endIdx === -1) throw new Error("Missing PLY end_header");

    const after = text.slice(endIdx + endToken.length, endIdx + endToken.length + 2);
    const newlineLen = after.startsWith("\r\n") ? 2 : 1;
    const headerText = text.slice(0, endIdx);
    const headerLines = headerText.split("\n");

    let vertexCount = 0;
    let format = "ascii";
    let properties = [];
    let inVertex = false;

    for (let raw of headerLines) {
        const line = raw.trim();
        if (!line) continue;
        const parts = line.split(/\s+/);
        const key = parts[0];
        if (key === "format") {
            format = parts[1];
        } else if (key === "element") {
            inVertex = parts[1] === "vertex";
            if (inVertex) {
                vertexCount = parseInt(parts[2], 10);
                properties = [];
            } else {
                inVertex = false;
            }
        } else if (key === "property" && inVertex) {
            // Skip list support; expect scalar properties.
            const type = parts[1];
            const name = parts[parts.length - 1];
            properties.push({ type, name });
        }
    }

    if (!vertexCount) throw new Error("No vertex count in PLY header");

    cachedHeaderRaw = text.slice(0, endIdx + endToken.length + newlineLen);
    cachedHeader = {
        vertexCount,
        dataStart: cachedHeaderRaw.length,
        format,
        properties
    };
    return cachedHeader;
}

function splitWhitespace(str) {
    const out = [];
    let start = -1;
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code <= 32) { // whitespace
            if (start !== -1) {
                out.push(str.slice(start, i));
                start = -1;
            }
        } else if (start === -1) {
            start = i;
        }
    }
    if (start !== -1) out.push(str.slice(start));
    return out;
}

function parseAscii(text, header) {
    const lines = text.slice(header.dataStart).split(/\r?\n/);
    const { vertexCount, properties } = header;

    const positions = new Float32Array(vertexCount * 3);
    const colors    = new Uint8Array(vertexCount * 3);
    colors.fill(255);

    const hasProps = properties && properties.length > 0;

    let written = 0;
    for (let i = 0; i < lines.length && written < vertexCount; i++) {
        const line = lines[i];
        if (!line) continue;
        const parts = splitWhitespace(line);
        if (!parts.length) continue;

        const base = written * 3;

        if (hasProps) {
            for (let p = 0; p < Math.min(parts.length, properties.length); p++) {
                const prop = properties[p];
                const raw = parts[p];
                const info = TYPE_INFO[prop.type];
                const asNumber = (info && info.size > 1) ? parseFloat(raw) : parseInt(raw, 10);
                if (prop.name === "x") positions[base] = asNumber;
                else if (prop.name === "y") positions[base + 1] = asNumber;
                else if (prop.name === "z") positions[base + 2] = asNumber;
                else if (prop.name === "red" || prop.name === "r") colors[base] = asNumber;
                else if (prop.name === "green" || prop.name === "g") colors[base + 1] = asNumber;
                else if (prop.name === "blue" || prop.name === "b") colors[base + 2] = asNumber;
            }
        } else if (parts.length >= 6) {
            positions[base]     = parseFloat(parts[0]);
            positions[base + 1] = parseFloat(parts[1]);
            positions[base + 2] = parseFloat(parts[2]);
            colors[base]        = parseInt(parts[3], 10);
            colors[base + 1]    = parseInt(parts[4], 10);
            colors[base + 2]    = parseInt(parts[5], 10);
        } else {
            continue;
        }

        written++;
    }

    if (written !== vertexCount) {
        throw new Error(`Expected ${vertexCount} vertices, parsed ${written}`);
    }
    return { positions, colors, vertexCount };
}

function parseBinary(buffer, header) {
    const littleEndian = header.format.includes("little");
    const { vertexCount, properties } = header;
    if (!properties.length) throw new Error("No vertex properties for binary PLY");

    const stride = properties.reduce((sum, p) => {
        const info = TYPE_INFO[p.type];
        if (!info) throw new Error(`Unsupported PLY type: ${p.type}`);
        return sum + info.size;
    }, 0);

    const positions = new Float32Array(vertexCount * 3);
    const colors    = new Uint8Array(vertexCount * 3);
    colors.fill(255);

    const dv = new DataView(buffer, header.dataStart);

    for (let i = 0; i < vertexCount; i++) {
        let offset = i * stride;
        const base = i * 3;
        for (let p = 0; p < properties.length; p++) {
            const prop = properties[p];
            const info = TYPE_INFO[prop.type];
            if (!info) throw new Error(`Unsupported PLY type: ${prop.type}`);
            const value = info.read(dv, offset, littleEndian);
            offset += info.size;

            if (prop.name === "x") positions[base] = value;
            else if (prop.name === "y") positions[base + 1] = value;
            else if (prop.name === "z") positions[base + 2] = value;
            else if (prop.name === "red" || prop.name === "r") colors[base] = value;
            else if (prop.name === "green" || prop.name === "g") colors[base + 1] = value;
            else if (prop.name === "blue" || prop.name === "b") colors[base + 2] = value;
        }
    }

    return { positions, colors, vertexCount };
}

function parsePLY(buffer) {
    const parseStart = performance.now();
    const text = decoder.decode(buffer);

    let header;
    if (cachedHeader && cachedHeaderRaw && text.startsWith(cachedHeaderRaw)) {
        header = cachedHeader;
    } else {
        header = parseHeader(text);
    }

    const format = header.format || "ascii";
    let frame;
    if (format.startsWith("ascii")) {
        frame = parseAscii(text, header);
    } else if (format.includes("binary")) {
        frame = parseBinary(buffer, header);
    } else {
        throw new Error(`Unsupported PLY format: ${format}`);
    }

    frame.parseMs = performance.now() - parseStart;
    return frame;
}

self.onmessage = (e) => {
    const { id, buffer } = e.data;
    try {
        const frame = parsePLY(buffer);
        self.postMessage({ id, frame }, [frame.positions.buffer, frame.colors.buffer]);
    } catch (err) {
        self.postMessage({ id, error: err.message });
    }
};
