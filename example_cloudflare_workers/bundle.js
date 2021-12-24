var LogLevels;
(function(LogLevels1) {
    LogLevels1[LogLevels1["NOTSET"] = 0] = "NOTSET";
    LogLevels1[LogLevels1["DEBUG"] = 10] = "DEBUG";
    LogLevels1[LogLevels1["INFO"] = 20] = "INFO";
    LogLevels1[LogLevels1["WARNING"] = 30] = "WARNING";
    LogLevels1[LogLevels1["ERROR"] = 40] = "ERROR";
    LogLevels1[LogLevels1["CRITICAL"] = 50] = "CRITICAL";
})(LogLevels || (LogLevels = {
}));
Object.keys(LogLevels).filter((key)=>isNaN(Number(key))
);
const byLevel = {
    [String(LogLevels.NOTSET)]: "NOTSET",
    [String(LogLevels.DEBUG)]: "DEBUG",
    [String(LogLevels.INFO)]: "INFO",
    [String(LogLevels.WARNING)]: "WARNING",
    [String(LogLevels.ERROR)]: "ERROR",
    [String(LogLevels.CRITICAL)]: "CRITICAL"
};
function getLevelByName(name) {
    switch(name){
        case "NOTSET":
            return LogLevels.NOTSET;
        case "DEBUG":
            return LogLevels.DEBUG;
        case "INFO":
            return LogLevels.INFO;
        case "WARNING":
            return LogLevels.WARNING;
        case "ERROR":
            return LogLevels.ERROR;
        case "CRITICAL":
            return LogLevels.CRITICAL;
        default:
            throw new Error(`no log level found for "${name}"`);
    }
}
function getLevelName(level) {
    const levelName = byLevel[level];
    if (levelName) {
        return levelName;
    }
    throw new Error(`no level name found for level: ${level}`);
}
class LogRecord {
    msg;
    #args;
    #datetime;
    level;
    levelName;
    loggerName;
    constructor(options){
        this.msg = options.msg;
        this.#args = [
            ...options.args
        ];
        this.level = options.level;
        this.loggerName = options.loggerName;
        this.#datetime = new Date();
        this.levelName = getLevelName(options.level);
    }
    get args() {
        return [
            ...this.#args
        ];
    }
    get datetime() {
        return new Date(this.#datetime.getTime());
    }
}
class Logger {
    #level;
    #handlers;
    #loggerName;
    constructor(loggerName, levelName, options = {
    }){
        this.#loggerName = loggerName;
        this.#level = getLevelByName(levelName);
        this.#handlers = options.handlers || [];
    }
    get level() {
        return this.#level;
    }
    set level(level) {
        this.#level = level;
    }
    get levelName() {
        return getLevelName(this.#level);
    }
    set levelName(levelName) {
        this.#level = getLevelByName(levelName);
    }
    get loggerName() {
        return this.#loggerName;
    }
    set handlers(hndls) {
        this.#handlers = hndls;
    }
    get handlers() {
        return this.#handlers;
    }
    _log(level, msg, ...args) {
        if (this.level > level) {
            return msg instanceof Function ? undefined : msg;
        }
        let fnResult;
        let logMessage;
        if (msg instanceof Function) {
            fnResult = msg();
            logMessage = this.asString(fnResult);
        } else {
            logMessage = this.asString(msg);
        }
        const record = new LogRecord({
            msg: logMessage,
            args: args,
            level: level,
            loggerName: this.loggerName
        });
        this.#handlers.forEach((handler)=>{
            handler.handle(record);
        });
        return msg instanceof Function ? fnResult : msg;
    }
    asString(data) {
        if (typeof data === "string") {
            return data;
        } else if (data === null || typeof data === "number" || typeof data === "bigint" || typeof data === "boolean" || typeof data === "undefined" || typeof data === "symbol") {
            return String(data);
        } else if (data instanceof Error) {
            return data.stack;
        } else if (typeof data === "object") {
            return JSON.stringify(data);
        }
        return "undefined";
    }
    debug(msg, ...args) {
        return this._log(LogLevels.DEBUG, msg, ...args);
    }
    info(msg, ...args) {
        return this._log(LogLevels.INFO, msg, ...args);
    }
    warning(msg, ...args) {
        return this._log(LogLevels.WARNING, msg, ...args);
    }
    error(msg, ...args) {
        return this._log(LogLevels.ERROR, msg, ...args);
    }
    critical(msg, ...args) {
        return this._log(LogLevels.CRITICAL, msg, ...args);
    }
}
const { Deno: Deno1  } = globalThis;
const noColor = typeof Deno1?.noColor === "boolean" ? Deno1.noColor : true;
let enabled = !noColor;
function code9(open, close) {
    return {
        open: `\x1b[${open.join(";")}m`,
        close: `\x1b[${close}m`,
        regexp: new RegExp(`\\x1b\\[${close}m`, "g")
    };
}
function run(str, code1) {
    return enabled ? `${code1.open}${str.replace(code1.regexp, code1.open)}${code1.close}` : str;
}
function bold(str) {
    return run(str, code9([
        1
    ], 22));
}
function red(str) {
    return run(str, code9([
        31
    ], 39));
}
function yellow(str) {
    return run(str, code9([
        33
    ], 39));
}
function blue(str) {
    return run(str, code9([
        34
    ], 39));
}
new RegExp([
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))", 
].join("|"), "g");
async function exists(filePath) {
    try {
        await Deno.lstat(filePath);
        return true;
    } catch (err) {
        if (err instanceof Deno.errors.NotFound) {
            return false;
        }
        throw err;
    }
}
function existsSync(filePath) {
    try {
        Deno.lstatSync(filePath);
        return true;
    } catch (err) {
        if (err instanceof Deno.errors.NotFound) {
            return false;
        }
        throw err;
    }
}
class DenoStdInternalError extends Error {
    constructor(message){
        super(message);
        this.name = "DenoStdInternalError";
    }
}
function assert(expr, msg = "") {
    if (!expr) {
        throw new DenoStdInternalError(msg);
    }
}
function copy(src, dst, off = 0) {
    off = Math.max(0, Math.min(off, dst.byteLength));
    const dstBytesAvailable = dst.byteLength - off;
    if (src.byteLength > dstBytesAvailable) {
        src = src.subarray(0, dstBytesAvailable);
    }
    dst.set(src, off);
    return src.byteLength;
}
const DEFAULT_BUF_SIZE = 4096;
const MIN_BUF_SIZE = 16;
const CR = "\r".charCodeAt(0);
const LF = "\n".charCodeAt(0);
class BufferFullError extends Error {
    partial;
    name = "BufferFullError";
    constructor(partial){
        super("Buffer full");
        this.partial = partial;
    }
}
class PartialReadError extends Error {
    name = "PartialReadError";
    partial;
    constructor(){
        super("Encountered UnexpectedEof, data only partially read");
    }
}
class BufReader {
    #buf;
    #rd;
    #r = 0;
    #w = 0;
    #eof = false;
    static create(r, size = 4096) {
        return r instanceof BufReader ? r : new BufReader(r, size);
    }
    constructor(rd, size = 4096){
        if (size < 16) {
            size = MIN_BUF_SIZE;
        }
        this.#reset(new Uint8Array(size), rd);
    }
    size() {
        return this.#buf.byteLength;
    }
    buffered() {
        return this.#w - this.#r;
    }
    #fill = async ()=>{
        if (this.#r > 0) {
            this.#buf.copyWithin(0, this.#r, this.#w);
            this.#w -= this.#r;
            this.#r = 0;
        }
        if (this.#w >= this.#buf.byteLength) {
            throw Error("bufio: tried to fill full buffer");
        }
        for(let i = 100; i > 0; i--){
            const rr = await this.#rd.read(this.#buf.subarray(this.#w));
            if (rr === null) {
                this.#eof = true;
                return;
            }
            assert(rr >= 0, "negative read");
            this.#w += rr;
            if (rr > 0) {
                return;
            }
        }
        throw new Error(`No progress after ${100} read() calls`);
    };
    reset(r) {
        this.#reset(this.#buf, r);
    }
    #reset = (buf, rd)=>{
        this.#buf = buf;
        this.#rd = rd;
        this.#eof = false;
    };
    async read(p) {
        let rr = p.byteLength;
        if (p.byteLength === 0) return rr;
        if (this.#r === this.#w) {
            if (p.byteLength >= this.#buf.byteLength) {
                const rr = await this.#rd.read(p);
                const nread = rr ?? 0;
                assert(nread >= 0, "negative read");
                return rr;
            }
            this.#r = 0;
            this.#w = 0;
            rr = await this.#rd.read(this.#buf);
            if (rr === 0 || rr === null) return rr;
            assert(rr >= 0, "negative read");
            this.#w += rr;
        }
        const copied = copy(this.#buf.subarray(this.#r, this.#w), p, 0);
        this.#r += copied;
        return copied;
    }
    async readFull(p) {
        let bytesRead = 0;
        while(bytesRead < p.length){
            try {
                const rr = await this.read(p.subarray(bytesRead));
                if (rr === null) {
                    if (bytesRead === 0) {
                        return null;
                    } else {
                        throw new PartialReadError();
                    }
                }
                bytesRead += rr;
            } catch (err) {
                if (err instanceof PartialReadError) {
                    err.partial = p.subarray(0, bytesRead);
                } else if (err instanceof Error) {
                    const e = new PartialReadError();
                    e.partial = p.subarray(0, bytesRead);
                    e.stack = err.stack;
                    e.message = err.message;
                    e.cause = err.cause;
                    throw err;
                }
                throw err;
            }
        }
        return p;
    }
    async readByte() {
        while(this.#r === this.#w){
            if (this.#eof) return null;
            await this.#fill();
        }
        const c = this.#buf[this.#r];
        this.#r++;
        return c;
    }
    async readString(delim) {
        if (delim.length !== 1) {
            throw new Error("Delimiter should be a single character");
        }
        const buffer = await this.readSlice(delim.charCodeAt(0));
        if (buffer === null) return null;
        return new TextDecoder().decode(buffer);
    }
    async readLine() {
        let line = null;
        try {
            line = await this.readSlice(LF);
        } catch (err) {
            if (err instanceof Deno.errors.BadResource) {
                throw err;
            }
            let partial;
            if (err instanceof PartialReadError) {
                partial = err.partial;
                assert(partial instanceof Uint8Array, "bufio: caught error from `readSlice()` without `partial` property");
            }
            if (!(err instanceof BufferFullError)) {
                throw err;
            }
            partial = err.partial;
            if (!this.#eof && partial && partial.byteLength > 0 && partial[partial.byteLength - 1] === CR) {
                assert(this.#r > 0, "bufio: tried to rewind past start of buffer");
                this.#r--;
                partial = partial.subarray(0, partial.byteLength - 1);
            }
            if (partial) {
                return {
                    line: partial,
                    more: !this.#eof
                };
            }
        }
        if (line === null) {
            return null;
        }
        if (line.byteLength === 0) {
            return {
                line,
                more: false
            };
        }
        if (line[line.byteLength - 1] == LF) {
            let drop = 1;
            if (line.byteLength > 1 && line[line.byteLength - 2] === CR) {
                drop = 2;
            }
            line = line.subarray(0, line.byteLength - drop);
        }
        return {
            line,
            more: false
        };
    }
    async readSlice(delim) {
        let s = 0;
        let slice;
        while(true){
            let i = this.#buf.subarray(this.#r + s, this.#w).indexOf(delim);
            if (i >= 0) {
                i += s;
                slice = this.#buf.subarray(this.#r, this.#r + i + 1);
                this.#r += i + 1;
                break;
            }
            if (this.#eof) {
                if (this.#r === this.#w) {
                    return null;
                }
                slice = this.#buf.subarray(this.#r, this.#w);
                this.#r = this.#w;
                break;
            }
            if (this.buffered() >= this.#buf.byteLength) {
                this.#r = this.#w;
                const oldbuf = this.#buf;
                const newbuf = this.#buf.slice(0);
                this.#buf = newbuf;
                throw new BufferFullError(oldbuf);
            }
            s = this.#w - this.#r;
            try {
                await this.#fill();
            } catch (err) {
                if (err instanceof PartialReadError) {
                    err.partial = slice;
                } else if (err instanceof Error) {
                    const e = new PartialReadError();
                    e.partial = slice;
                    e.stack = err.stack;
                    e.message = err.message;
                    e.cause = err.cause;
                    throw err;
                }
                throw err;
            }
        }
        return slice;
    }
    async peek(n6) {
        if (n6 < 0) {
            throw Error("negative count");
        }
        let avail = this.#w - this.#r;
        while(avail < n6 && avail < this.#buf.byteLength && !this.#eof){
            try {
                await this.#fill();
            } catch (err) {
                if (err instanceof PartialReadError) {
                    err.partial = this.#buf.subarray(this.#r, this.#w);
                } else if (err instanceof Error) {
                    const e = new PartialReadError();
                    e.partial = this.#buf.subarray(this.#r, this.#w);
                    e.stack = err.stack;
                    e.message = err.message;
                    e.cause = err.cause;
                    throw err;
                }
                throw err;
            }
            avail = this.#w - this.#r;
        }
        if (avail === 0 && this.#eof) {
            return null;
        } else if (avail < n6 && this.#eof) {
            return this.#buf.subarray(this.#r, this.#r + avail);
        } else if (avail < n6) {
            throw new BufferFullError(this.#buf.subarray(this.#r, this.#w));
        }
        return this.#buf.subarray(this.#r, this.#r + n6);
    }
}
class AbstractBufBase {
    buf;
    usedBufferBytes = 0;
    err = null;
    constructor(buf){
        this.buf = buf;
    }
    size() {
        return this.buf.byteLength;
    }
    available() {
        return this.buf.byteLength - this.usedBufferBytes;
    }
    buffered() {
        return this.usedBufferBytes;
    }
}
class BufWriter extends AbstractBufBase {
    #writer;
    static create(writer, size = 4096) {
        return writer instanceof BufWriter ? writer : new BufWriter(writer, size);
    }
    constructor(writer, size = 4096){
        if (size <= 0) {
            size = DEFAULT_BUF_SIZE;
        }
        const buf = new Uint8Array(size);
        super(buf);
        this.#writer = writer;
    }
    reset(w) {
        this.err = null;
        this.usedBufferBytes = 0;
        this.#writer = w;
    }
    async flush() {
        if (this.err !== null) throw this.err;
        if (this.usedBufferBytes === 0) return;
        try {
            const p = this.buf.subarray(0, this.usedBufferBytes);
            let nwritten = 0;
            while(nwritten < p.length){
                nwritten += await this.#writer.write(p.subarray(nwritten));
            }
        } catch (e) {
            if (e instanceof Error) {
                this.err = e;
            }
            throw e;
        }
        this.buf = new Uint8Array(this.buf.length);
        this.usedBufferBytes = 0;
    }
    async write(data) {
        if (this.err !== null) throw this.err;
        if (data.length === 0) return 0;
        let totalBytesWritten = 0;
        let numBytesWritten = 0;
        while(data.byteLength > this.available()){
            if (this.buffered() === 0) {
                try {
                    numBytesWritten = await this.#writer.write(data);
                } catch (e) {
                    if (e instanceof Error) {
                        this.err = e;
                    }
                    throw e;
                }
            } else {
                numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
                this.usedBufferBytes += numBytesWritten;
                await this.flush();
            }
            totalBytesWritten += numBytesWritten;
            data = data.subarray(numBytesWritten);
        }
        numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
        this.usedBufferBytes += numBytesWritten;
        totalBytesWritten += numBytesWritten;
        return totalBytesWritten;
    }
}
class BufWriterSync extends AbstractBufBase {
    #writer;
    static create(writer, size = 4096) {
        return writer instanceof BufWriterSync ? writer : new BufWriterSync(writer, size);
    }
    constructor(writer, size = 4096){
        if (size <= 0) {
            size = DEFAULT_BUF_SIZE;
        }
        const buf = new Uint8Array(size);
        super(buf);
        this.#writer = writer;
    }
    reset(w) {
        this.err = null;
        this.usedBufferBytes = 0;
        this.#writer = w;
    }
    flush() {
        if (this.err !== null) throw this.err;
        if (this.usedBufferBytes === 0) return;
        try {
            const p = this.buf.subarray(0, this.usedBufferBytes);
            let nwritten = 0;
            while(nwritten < p.length){
                nwritten += this.#writer.writeSync(p.subarray(nwritten));
            }
        } catch (e) {
            if (e instanceof Error) {
                this.err = e;
            }
            throw e;
        }
        this.buf = new Uint8Array(this.buf.length);
        this.usedBufferBytes = 0;
    }
    writeSync(data) {
        if (this.err !== null) throw this.err;
        if (data.length === 0) return 0;
        let totalBytesWritten = 0;
        let numBytesWritten = 0;
        while(data.byteLength > this.available()){
            if (this.buffered() === 0) {
                try {
                    numBytesWritten = this.#writer.writeSync(data);
                } catch (e) {
                    if (e instanceof Error) {
                        this.err = e;
                    }
                    throw e;
                }
            } else {
                numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
                this.usedBufferBytes += numBytesWritten;
                this.flush();
            }
            totalBytesWritten += numBytesWritten;
            data = data.subarray(numBytesWritten);
        }
        numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
        this.usedBufferBytes += numBytesWritten;
        totalBytesWritten += numBytesWritten;
        return totalBytesWritten;
    }
}
const DEFAULT_FORMATTER = "{levelName} {msg}";
class BaseHandler {
    level;
    levelName;
    formatter;
    constructor(levelName, options = {
    }){
        this.level = getLevelByName(levelName);
        this.levelName = levelName;
        this.formatter = options.formatter || DEFAULT_FORMATTER;
    }
    handle(logRecord) {
        if (this.level > logRecord.level) return;
        const msg = this.format(logRecord);
        return this.log(msg);
    }
    format(logRecord) {
        if (this.formatter instanceof Function) {
            return this.formatter(logRecord);
        }
        return this.formatter.replace(/{(\S+)}/g, (match, p1)=>{
            const value = logRecord[p1];
            if (value == null) {
                return match;
            }
            return String(value);
        });
    }
    log(_msg) {
    }
    async setup() {
    }
    async destroy() {
    }
}
class ConsoleHandler extends BaseHandler {
    format(logRecord) {
        let msg = super.format(logRecord);
        switch(logRecord.level){
            case LogLevels.INFO:
                msg = blue(msg);
                break;
            case LogLevels.WARNING:
                msg = yellow(msg);
                break;
            case LogLevels.ERROR:
                msg = red(msg);
                break;
            case LogLevels.CRITICAL:
                msg = bold(red(msg));
                break;
            default:
                break;
        }
        return msg;
    }
    log(msg) {
        console.log(msg);
    }
}
class WriterHandler extends BaseHandler {
    _writer;
    #encoder = new TextEncoder();
}
class FileHandler extends WriterHandler {
    _file;
    _buf;
    _filename;
    _mode;
    _openOptions;
    _encoder = new TextEncoder();
     #unloadCallback() {
        this.destroy();
    }
    constructor(levelName, options){
        super(levelName, options);
        this._filename = options.filename;
        this._mode = options.mode ? options.mode : "a";
        this._openOptions = {
            createNew: this._mode === "x",
            create: this._mode !== "x",
            append: this._mode === "a",
            truncate: this._mode !== "a",
            write: true
        };
    }
    async setup() {
        this._file = await Deno.open(this._filename, this._openOptions);
        this._writer = this._file;
        this._buf = new BufWriterSync(this._file);
        addEventListener("unload", this.#unloadCallback.bind(this));
    }
    handle(logRecord) {
        super.handle(logRecord);
        if (logRecord.level > LogLevels.ERROR) {
            this.flush();
        }
    }
    log(msg) {
        this._buf.writeSync(this._encoder.encode(msg + "\n"));
    }
    flush() {
        if (this._buf?.buffered() > 0) {
            this._buf.flush();
        }
    }
    destroy() {
        this.flush();
        this._file?.close();
        this._file = undefined;
        removeEventListener("unload", this.#unloadCallback);
        return Promise.resolve();
    }
}
class RotatingFileHandler extends FileHandler {
    #maxBytes;
    #maxBackupCount;
    #currentFileSize = 0;
    constructor(levelName, options){
        super(levelName, options);
        this.#maxBytes = options.maxBytes;
        this.#maxBackupCount = options.maxBackupCount;
    }
    async setup() {
        if (this.#maxBytes < 1) {
            this.destroy();
            throw new Error("maxBytes cannot be less than 1");
        }
        if (this.#maxBackupCount < 1) {
            this.destroy();
            throw new Error("maxBackupCount cannot be less than 1");
        }
        await super.setup();
        if (this._mode === "w") {
            for(let i = 1; i <= this.#maxBackupCount; i++){
                if (await exists(this._filename + "." + i)) {
                    await Deno.remove(this._filename + "." + i);
                }
            }
        } else if (this._mode === "x") {
            for(let i = 1; i <= this.#maxBackupCount; i++){
                if (await exists(this._filename + "." + i)) {
                    this.destroy();
                    throw new Deno.errors.AlreadyExists("Backup log file " + this._filename + "." + i + " already exists");
                }
            }
        } else {
            this.#currentFileSize = (await Deno.stat(this._filename)).size;
        }
    }
    log(msg) {
        const msgByteLength = this._encoder.encode(msg).byteLength + 1;
        if (this.#currentFileSize + msgByteLength > this.#maxBytes) {
            this.rotateLogFiles();
            this.#currentFileSize = 0;
        }
        this._buf.writeSync(this._encoder.encode(msg + "\n"));
        this.#currentFileSize += msgByteLength;
    }
    rotateLogFiles() {
        this._buf.flush();
        Deno.close(this._file.rid);
        for(let i = this.#maxBackupCount - 1; i >= 0; i--){
            const source = this._filename + (i === 0 ? "" : "." + i);
            const dest = this._filename + "." + (i + 1);
            if (existsSync(source)) {
                Deno.renameSync(source, dest);
            }
        }
        this._file = Deno.openSync(this._filename, this._openOptions);
        this._writer = this._file;
        this._buf = new BufWriterSync(this._file);
    }
}
const DEFAULT_LEVEL = "INFO";
const DEFAULT_CONFIG = {
    handlers: {
        default: new ConsoleHandler(DEFAULT_LEVEL)
    },
    loggers: {
        default: {
            level: DEFAULT_LEVEL,
            handlers: [
                "default"
            ]
        }
    }
};
const state = {
    handlers: new Map(),
    loggers: new Map(),
    config: DEFAULT_CONFIG
};
const handlers1 = {
    BaseHandler,
    ConsoleHandler,
    WriterHandler,
    FileHandler,
    RotatingFileHandler
};
function getLogger(name) {
    if (!name) {
        const d = state.loggers.get("default");
        assert(d != null, `"default" logger must be set for getting logger without name`);
        return d;
    }
    const result = state.loggers.get(name);
    if (!result) {
        const logger = new Logger(name, "NOTSET", {
            handlers: []
        });
        state.loggers.set(name, logger);
        return logger;
    }
    return result;
}
async function setup(config) {
    state.config = {
        handlers: {
            ...DEFAULT_CONFIG.handlers,
            ...config.handlers
        },
        loggers: {
            ...DEFAULT_CONFIG.loggers,
            ...config.loggers
        }
    };
    state.handlers.forEach((handler)=>{
        handler.destroy();
    });
    state.handlers.clear();
    const handlers = state.config.handlers || {
    };
    for(const handlerName1 in handlers){
        const handler = handlers[handlerName1];
        await handler.setup();
        state.handlers.set(handlerName1, handler);
    }
    state.loggers.clear();
    const loggers = state.config.loggers || {
    };
    for(const loggerName in loggers){
        const loggerConfig = loggers[loggerName];
        const handlerNames = loggerConfig.handlers || [];
        const handlers = [];
        handlerNames.forEach((handlerName)=>{
            const handler = state.handlers.get(handlerName);
            if (handler) {
                handlers.push(handler);
            }
        });
        const levelName = loggerConfig.level || DEFAULT_LEVEL;
        const logger = new Logger(loggerName, levelName, {
            handlers: handlers
        });
        state.loggers.set(loggerName, logger);
    }
}
await setup(DEFAULT_CONFIG);
function autoid(length = 20) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let autoid1 = "";
    const buffer = new Uint8Array(length);
    crypto.getRandomValues(buffer);
    for(let i = 0; i < length; ++i){
        autoid1 += chars.charAt(buffer[i] % chars.length);
    }
    return autoid1;
}
class NumberOfClientError extends Error {
    name = "NumberOfClientError";
    constructor(nb){
        super(`Requires at least 1 client, got ${nb}.`);
    }
}
class ClientsBuilder {
    clients = new Set();
    build() {
        if (this.clients.size === 0) {
            throw new NumberOfClientError(0);
        }
        return Array.from(this.clients);
    }
    register(principal, url, id, secret) {
        this.clients.add({
            principal,
            url,
            id,
            secret
        });
        return this;
    }
}
class FunctionsBuilder {
    httpFunctions = new Set();
    build() {
        return {
            https: Array.from(this.httpFunctions).map((b)=>b.build()
            )
        };
    }
    http(path) {
        const builder = new FunctionsHttpBuilder(path);
        this.httpFunctions.add(builder);
        return builder;
    }
}
class FunctionsHttpBuilder {
    path;
    onCallHandler;
    constructor(path){
        this.path = path;
    }
    build() {
        return {
            path: this.path,
            onCall: this.onCallHandler
        };
    }
    onCall(handler) {
        this.onCallHandler = handler;
        return this;
    }
}
class KeyNotFoundError extends Error {
    name = "KeyNotFoundError";
    constructor(key){
        super(`Key not found at '${key}'.`);
    }
}
class AuthBuilder {
    allowAnonymousUserValue;
    allowSignMethodPasswordValue;
    templates = {
        validation: new Map(),
        passwordReset: new Map()
    };
    onCreateUserHandler;
    onUpdateUserHandler;
    onDeleteUserHandler;
    build() {
        return {
            allowAnonymousUser: this.allowAnonymousUserValue ?? false,
            allowSignMethodPassword: this.allowSignMethodPasswordValue ?? false,
            templates: {
                validation: this.templates.validation,
                passwordReset: this.templates.passwordReset
            },
            onCreateUser: this.onCreateUserHandler,
            onUpdateUser: this.onUpdateUserHandler,
            onDeleteUser: this.onDeleteUserHandler
        };
    }
    allowAnonymousUser(value) {
        this.allowAnonymousUserValue = value;
        return this;
    }
    allowSignMethodPassword(value) {
        this.allowSignMethodPasswordValue = value;
        return this;
    }
    setTemplateValidation(locale, message) {
        this.templates.validation.set(locale, message);
        return this;
    }
    setTemplatePasswordReset(locale, message) {
        this.templates.passwordReset.set(locale, message);
        return this;
    }
    onCreateUser(handler) {
        this.onCreateUserHandler = handler;
        return this;
    }
    onUpdateUser(handler) {
        this.onUpdateUserHandler = handler;
        return this;
    }
    onDeleteUser(handler) {
        this.onDeleteUserHandler = handler;
        return this;
    }
}
class InvalidCollectionReferenceError extends Error {
    name = "InvalidCollectionReferenceError";
    constructor(reference){
        super(`Invalid collection path '${reference}'.`);
    }
}
class MailBuilder {
    onMessageSentHandler;
    build() {
        return {
            onMessageSent: this.onMessageSentHandler
        };
    }
    onMessageSent(handler) {
        this.onMessageSentHandler = handler;
        return this;
    }
}
class KVService {
    backend;
    constructor(backend){
        this.backend = backend;
    }
    get(key, options) {
        return this.backend.get(key, options);
    }
    list(prefix, filter) {
        return this.backend.list(prefix, filter);
    }
    set(key, metadata, data, options) {
        return this.backend.set(key, metadata, data, options);
    }
    delete(key) {
        return this.backend.delete(key);
    }
}
class NoopServiceError extends Error {
    name = "NoopServiceError";
}
class NoopKVService {
    get() {
        return Promise.reject(new NoopServiceError());
    }
    list() {
        return Promise.reject(new NoopServiceError());
    }
    set() {
        return Promise.reject(new NoopServiceError());
    }
    delete() {
        return Promise.reject(new NoopServiceError());
    }
}
class UserNotFoundError extends Error {
    name = "UserNotFoundError";
    constructor(userid){
        super(`User '${userid}' not found.`);
    }
}
class UserAlreadyExistsError extends Error {
    name = "UserAlreadyExistsError";
    constructor(userid){
        super(`User '${userid}' already exists.`);
    }
}
class ValidationCodeError extends Error {
    name = "ValidationCodeError";
}
class PasswordResetError extends Error {
    name = "PasswordResetError";
}
class PasswordResetCodeError extends Error {
    name = "PasswordResetCodeError";
}
class AuthService {
    backend;
    constructor(backend){
        this.backend = backend;
    }
    getUser(userid) {
        return this.backend.getUser(userid);
    }
    getUserByEmail(email) {
        return this.backend.getUserByEmail(email);
    }
    createUser(email, metadata) {
        return this.backend.createUser(email, metadata);
    }
    updateUser(userid, metadata) {
        return this.backend.updateUser(userid, metadata);
    }
    deleteUser(userid) {
        return this.backend.deleteUser(userid);
    }
    getSignInMethods(userid) {
        return this.backend.getSignInMethods(userid);
    }
    addSignInMethodPassword(userid, email, passwordHash) {
        return this.backend.addSignInMethodPassword(userid, email, passwordHash);
    }
    signInWithEmailPassword(email, passwordHash) {
        return this.backend.signInWithEmailPassword(email, passwordHash);
    }
    setEmailValidationCode(email, code1) {
        return this.backend.setEmailValidationCode(email, code1);
    }
    validateEmailWithCode(email, code2) {
        return this.backend.validateEmailWithCode(email, code2);
    }
    setPasswordResetCode(email, code3) {
        return this.backend.setPasswordResetCode(email, code3);
    }
    resetPasswordWithCode(email, code4, passwordHash) {
        return this.backend.resetPasswordWithCode(email, code4, passwordHash);
    }
}
class NoopAuthService {
    getUser() {
        return Promise.reject(new NoopServiceError());
    }
    getUserByEmail() {
        return Promise.reject(new NoopServiceError());
    }
    createUser() {
        return Promise.reject(new NoopServiceError());
    }
    updateUser() {
        return Promise.reject(new NoopServiceError());
    }
    deleteUser() {
        return Promise.reject(new NoopServiceError());
    }
    getSignInMethods() {
        return Promise.reject(new NoopServiceError());
    }
    addSignInMethodPassword() {
        return Promise.reject(new NoopServiceError());
    }
    signInWithEmailPassword() {
        return Promise.reject(new NoopServiceError());
    }
    setEmailValidationCode() {
        return Promise.reject(new NoopServiceError());
    }
    validateEmailWithCode() {
        return Promise.reject(new NoopServiceError());
    }
    setPasswordResetCode() {
        return Promise.reject(new NoopServiceError());
    }
    resetPasswordWithCode() {
        return Promise.reject(new NoopServiceError());
    }
}
class CollectionReference {
    segments;
    constructor(...segments){
        if (segments.length % 2 == 0 || segments.some((s)=>s.length === 0
        )) {
            throw new InvalidCollectionReferenceError(`/${segments.join("/")}`);
        }
        this.segments = segments;
    }
    toString() {
        return `/${this.segments.join("/")}`;
    }
}
function collection1(...segments) {
    if (segments.length === 1 && segments[0][0] === "/") {
        segments = segments[0].replace(/^\//, "").replace(/\/$/, "").split("/");
    }
    return new CollectionReference(...segments);
}
class InvalidDocumentIdentifierError extends Error {
    name = "InvalidDocumentIdentifierError";
    constructor(id){
        super(`Invalid document identifier '${id}'.`);
    }
}
class DocumentReference {
    collection;
    id;
    constructor(collection, id){
        this.collection = collection;
        if (!id) {
            id = autoid();
        }
        if (!id?.trim() || id.match(/[/]/)) {
            throw new InvalidDocumentIdentifierError(id ?? "");
        }
        this.id = id;
    }
    toString() {
        return `${this.collection.toString()}/${this.id}`;
    }
}
function doc(collection, ...segments) {
    if (collection instanceof CollectionReference) {
        return segments.length ? new DocumentReference(collection, segments[0]) : new DocumentReference(collection);
    }
    segments.unshift(collection);
    if (segments.length === 1 && segments[0][0] === "/") {
        segments = segments[0].replace(/^\//, "").replace(/\/$/, "").split("/");
    }
    const id = segments.pop();
    return new DocumentReference(new CollectionReference(...segments), id);
}
class DatabaseBuilder {
    collections = new Set();
    documents = new Set();
    build() {
        return {
            collections: Array.from(this.collections).map((b)=>b.build()
            ),
            documents: Array.from(this.documents).map((b)=>b.build()
            )
        };
    }
    collection(reference) {
        const builder = new DatabaseCollectionBuilder(reference);
        this.collections.add(builder);
        return builder;
    }
    document(reference) {
        const builder = new DatabaseDocumentBuilder(reference);
        this.documents.add(builder);
        return builder;
    }
}
function refToRegExp(ref) {
    return new RegExp(`^${ref.replace(/\{([\w]+)\}/g, "(?<$1>[^/]+)")}$`);
}
var DatabasePermissions;
(function(DatabasePermissions1) {
    DatabasePermissions1[DatabasePermissions1["None"] = 0] = "None";
    DatabasePermissions1[DatabasePermissions1["List"] = 1] = "List";
    DatabasePermissions1[DatabasePermissions1["Get"] = 2] = "Get";
    DatabasePermissions1[DatabasePermissions1["Create"] = 4] = "Create";
    DatabasePermissions1[DatabasePermissions1["Update"] = 8] = "Update";
    DatabasePermissions1[DatabasePermissions1["Delete"] = 16] = "Delete";
    DatabasePermissions1[DatabasePermissions1["Subscribe"] = 32] = "Subscribe";
})(DatabasePermissions || (DatabasePermissions = {
}));
class DatabaseCollectionBuilder {
    ref;
    onCreateHandler;
    permissionHandler;
    constructor(ref){
        this.ref = ref;
    }
    build() {
        return {
            ref: this.ref,
            matcher: refToRegExp(this.ref),
            onCreate: this.onCreateHandler,
            permission: this.permissionHandler
        };
    }
    onCreate(handler) {
        this.onCreateHandler = handler;
        return this;
    }
    permission(handler) {
        this.permissionHandler = handler;
        return this;
    }
}
class DatabaseDocumentBuilder {
    ref;
    onUpdateHandler;
    onDeleteHandler;
    permissionHandler;
    constructor(ref){
        this.ref = ref;
    }
    build() {
        return {
            ref: this.ref,
            matcher: refToRegExp(this.ref),
            onUpdate: this.onUpdateHandler,
            onDelete: this.onDeleteHandler,
            permission: this.permissionHandler
        };
    }
    onUpdate(handler) {
        this.onUpdateHandler = handler;
        return this;
    }
    onDelete(handler) {
        this.onDeleteHandler = handler;
        return this;
    }
    permission(handler) {
        this.permissionHandler = handler;
        return this;
    }
}
class DocumentNotFoundError extends Error {
    name = "DocumentNotFoundError";
    constructor(path){
        super(`Document '${path}' not found.`);
    }
}
class DocumentAlreadyExistsError extends Error {
    name = "DocumentAlreadyExistsError";
    constructor(path){
        super(`Document '${path}' already exists.`);
    }
}
class DatabaseService {
    backend;
    constructor(backend){
        this.backend = backend;
    }
    get(reference) {
        return this.backend.get(reference);
    }
    list(reference, filter) {
        return this.backend.list(reference, filter);
    }
    create(reference, metadata, data, options) {
        return this.backend.create(reference, metadata, data, options);
    }
    update(reference, metadata, data, options) {
        return this.backend.update(reference, metadata, data, options);
    }
    delete(reference) {
        return this.backend.delete(reference);
    }
}
class NoopDatabaseService {
    get() {
        return Promise.reject(new NoopServiceError());
    }
    list() {
        return Promise.reject(new NoopServiceError());
    }
    create() {
        return Promise.reject(new NoopServiceError());
    }
    update() {
        return Promise.reject(new NoopServiceError());
    }
    delete() {
        return Promise.reject(new NoopServiceError());
    }
}
class CachedDocument {
    reference;
    metadata;
    _data;
    constructor(reference, metadata, _data){
        this.reference = reference;
        this.metadata = metadata;
        this._data = _data;
    }
    data() {
        return Promise.resolve(this._data);
    }
}
class CachableDatabaseService {
    backend;
    cache = new Map();
    constructor(backend){
        this.backend = backend;
    }
    get(reference) {
        const key = reference.toString();
        if (this.cache.has(key)) {
            return Promise.resolve(this.cache.get(key));
        }
        return this.backend.get(reference).then((doc1)=>{
            this.cache.set(key, doc1);
            return doc1;
        });
    }
    list(reference, filter) {
        return this.backend.list(reference, filter).then((docs)=>{
            for (const doc2 of docs){
                this.cache.set(doc2.reference.toString(), doc2);
            }
            return docs;
        });
    }
    create(reference, metadata, data, options) {
        return this.backend.create(reference, metadata, data, options).then(()=>{
            const doc3 = new CachedDocument(reference, metadata, data);
            this.cache.set(reference.toString(), doc3);
        });
    }
    update(reference, metadata, data, options) {
        return this.backend.update(reference, metadata, data, options).then(()=>{
            this.cache.delete(reference.toString());
        });
    }
    delete(reference) {
        return this.backend.delete(reference).then(()=>{
            this.cache.delete(reference.toString());
        });
    }
}
class MailService {
    descriptor;
    provider;
    constructor(descriptor, provider){
        this.descriptor = descriptor;
        this.provider = provider;
    }
    async send(message) {
        await this.provider.send(message);
        if (this.descriptor.onMessageSent) {
            await this.descriptor.onMessageSent(message);
        }
    }
}
class NoopMailService {
    send() {
        return Promise.reject(new NoopServiceError());
    }
}
class CloudflareKVValue {
    key;
    metadata;
    _data;
    constructor(key, metadata, _data){
        this.key = key;
        this.metadata = metadata;
        this._data = _data;
    }
    data() {
        return Promise.resolve(this._data);
    }
}
class CloudflareKVListValue {
    key;
    metadata;
    ns;
    cachedData;
    constructor(key, metadata, ns){
        this.key = key;
        this.metadata = metadata;
        this.ns = ns;
    }
    data() {
        return this.cachedData !== undefined ? Promise.resolve(this.cachedData) : this.ns.get(this.key, "stream").then((data)=>{
            this.cachedData = data;
            return data;
        });
    }
}
class CloudflareKVProvider {
    ns;
    constructor(ns){
        this.ns = ns;
    }
    open() {
        return Promise.resolve();
    }
    close() {
        return Promise.resolve();
    }
    get(key) {
        return this.ns.getWithMetadata(key, "stream").catch(()=>{
            throw new KeyNotFoundError(key);
        }).then(({ metadata , value  })=>new CloudflareKVValue(key, metadata, value)
        );
    }
    list(prefix, filter) {
        return this.ns.list({
            prefix
        }).then(({ keys  })=>keys.map((key)=>new CloudflareKVListValue(key.name, key.metadata ?? {
                }, this.ns)
            )
        ).then((results)=>{
            if (filter) {
                const filterFns = [];
                for (const key of Object.keys(filter)){
                    const prop = key;
                    const op = filter[prop];
                    if ("eq" in op) {
                        filterFns.push((doc1)=>doc1[prop] == op["eq"]
                        );
                    } else if ("neq" in op) {
                        filterFns.push((doc2)=>doc2[prop] != op["neq"]
                        );
                    } else if ("gt" in op) {
                        filterFns.push((doc3)=>doc3[prop] > op["gt"]
                        );
                    } else if ("gte" in op) {
                        filterFns.push((doc4)=>doc4[prop] >= op["gte"]
                        );
                    } else if ("lt" in op) {
                        filterFns.push((doc5)=>doc5[prop] < op["lt"]
                        );
                    } else if ("lte" in op) {
                        filterFns.push((doc6)=>doc6[prop] != op["lte"]
                        );
                    } else if ("in" in op) {
                        filterFns.push((doc7)=>op["in"].includes(doc7[prop])
                        );
                    } else if ("nin" in op) {
                        filterFns.push((doc8)=>!op["nin"].includes(doc8[prop])
                        );
                    }
                }
                results = results.filter((doc9)=>filterFns.every((fn)=>fn(doc9.metadata)
                    )
                );
            }
            return results;
        });
    }
    set(key, metadata, data, options) {
        const kvoptions = options ? "expireAt" in options ? {
            expiration: options.expireAt.getTime() / 1000
        } : {
            expirationTtl: options.expireIn
        } : {
        };
        return this.ns.put(key, data ?? "", {
            metadata,
            ...kvoptions
        });
    }
    delete(key) {
        return this.ns.delete(key);
    }
}
function useridToKey(userid) {
    return `user::${userid}`;
}
class User {
    id;
    email;
    emailConfirmed;
    refreshTokenId;
    metadata;
    constructor(id, email, emailConfirmed, refreshTokenId, metadata){
        this.id = id;
        this.email = email;
        this.emailConfirmed = emailConfirmed;
        this.refreshTokenId = refreshTokenId;
        this.metadata = metadata;
    }
}
class AuthOnKvProvider {
    backend;
    constructor(backend){
        this.backend = backend;
    }
    async getUser(userid) {
        const key = useridToKey(userid);
        const value = await this.backend.get(key);
        const { email , emailConfirmed , refreshTokenId , ...metadata } = value.metadata;
        return new User(userid, email, emailConfirmed, refreshTokenId, metadata);
    }
    async getUserByEmail(email) {
        try {
            const { metadata: { userid  }  } = await this.backend.get(`signin::password::${email}`);
            const user = await this.getUser(userid);
            return user;
        } catch (err) {
            if (err instanceof KeyNotFoundError) {
                throw new UserNotFoundError(email);
            }
            throw err;
        }
    }
    async createUser(email, metadata) {
        const userid = autoid();
        try {
            await this.getUser(userid);
            throw new UserAlreadyExistsError(userid);
        } catch (_err) {
            const refreshTokenId = autoid();
            return this.backend.set(useridToKey(userid), {
                ...metadata,
                email,
                emailConfirmed: false,
                refreshTokenId
            }).then(()=>new User(userid, email, false, refreshTokenId, metadata)
            );
        }
    }
    async updateUser(userid, metadata, email, emailConfirmed, refreshTokenId) {
        const key = useridToKey(userid);
        const user = await this.getUser(userid);
        return this.backend.set(key, {
            ...user.metadata,
            ...metadata,
            email: email ?? user.email,
            emailConfirmed: emailConfirmed ?? user.emailConfirmed,
            refreshTokenId: refreshTokenId ?? user.refreshTokenId
        });
    }
    deleteUser(userid) {
        const key = useridToKey(userid);
        return this.backend.delete(key);
    }
    async getSignInMethods(userid) {
        const prefix = `usermethod::${userid}::`;
        const values = await this.backend.list(prefix);
        return values.map((value)=>value.key.substr(prefix.length)
        );
    }
    async addSignInMethodPassword(userid, email, passwordHash) {
        await Promise.all([
            this.backend.set(`usermethod::${userid}::password`, {
            }),
            this.backend.set(`signin::password::${email}`, {
                passwordHash,
                userid: userid
            }), 
        ]);
    }
    async signInWithEmailPassword(email, passwordHash) {
        try {
            const { metadata: { passwordHash: hash , userid  } ,  } = await this.backend.get(`signin::password::${email}`);
            if (hash !== passwordHash) {
                throw new UserNotFoundError(email);
            }
            return await this.getUser(userid);
        } catch (err) {
            throw new UserNotFoundError(email);
        }
    }
    async setEmailValidationCode(email, code5) {
        const user = await this.getUserByEmail(email);
        await this.backend.set(`validationcode::${email}`, {
            code: code5,
            userid: user.id
        }, undefined, {
            expireIn: 60 * 5
        });
    }
    async validateEmailWithCode(email, code6) {
        try {
            const value = await this.backend.get(`validationcode::${email}`);
            if (value.metadata.code !== code6) {
                throw new ValidationCodeError();
            }
            await Promise.all([
                this.updateUser(value.metadata.userid, {
                }, undefined, true),
                this.backend.delete(`validationcode::${email}`), 
            ]);
        } catch (err) {
            throw new ValidationCodeError();
        }
    }
    async setPasswordResetCode(email, code7) {
        const user = await this.getUserByEmail(email);
        try {
            await this.backend.get(`usermethod::${user.id}::password`);
            await this.backend.set(`passwordresetcode::${email}`, {
                code: code7,
                userid: user.id
            }, undefined, {
                expireIn: 60 * 5
            });
        } catch (_err) {
            throw new PasswordResetError();
        }
    }
    async resetPasswordWithCode(email, code8, passwordHash) {
        try {
            const value = await this.backend.get(`passwordresetcode::${email}`);
            if (value.metadata.code !== code8) {
                throw new ValidationCodeError();
            }
            await Promise.all([
                this.addSignInMethodPassword(value.metadata.userid, email, passwordHash),
                this.backend.delete(`passwordresetcode::${email}`), 
            ]);
        } catch (err) {
            throw new PasswordResetCodeError();
        }
    }
}
const EOC = "/";
function DocumentReferenceToKey(path) {
    return `${path.collection.toString()}/${EOC}${path.id}`;
}
function keyToDocumentReference(key) {
    const segments = key.split("/");
    const collection = segments.slice(1, -2);
    const id = segments.pop();
    return new DocumentReference(new CollectionReference(...collection), id);
}
class Document {
    reference;
    value;
    constructor(reference, value){
        this.reference = reference;
        this.value = value;
    }
    get metadata() {
        return this.value.metadata;
    }
    data() {
        return this.value.data().then((data)=>{
            if (typeof data === "string") {
                return JSON.parse(data);
            } else if (typeof ReadableStream !== "undefined" && data instanceof ReadableStream) {
                return new Response(data).text().then((text)=>JSON.parse(text)
                );
            } else if (typeof ArrayBuffer !== "undefined" && data instanceof ArrayBuffer) {
                return JSON.parse(new TextDecoder().decode(data));
            } else {
                return {
                };
            }
        });
    }
}
class DatabaseOnKvProvider {
    backend;
    constructor(backend){
        this.backend = backend;
    }
    get(reference) {
        const key = DocumentReferenceToKey(reference);
        return this.backend.get(key).then((value)=>new Document(reference, value)
        );
    }
    list(reference, filter) {
        const prefix = `${reference}/${EOC}`;
        return this.backend.list(prefix, filter).then((values)=>values.map((value)=>new Document(keyToDocumentReference(value.key), value)
            )
        );
    }
    create(reference, metadata, data, options) {
        const key = DocumentReferenceToKey(reference);
        return this.backend.get(key).then(()=>{
            throw new DocumentAlreadyExistsError(reference.toString());
        }).catch((err)=>{
            if (err instanceof KeyNotFoundError) {
                return this.backend.set(key, metadata, JSON.stringify(data), options);
            }
            return err;
        });
    }
    update(reference, metadata, data, options) {
        const key = DocumentReferenceToKey(reference);
        return this.get(reference).then(async (doc10)=>this.backend.set(key, {
                ...doc10.metadata,
                ...metadata
            }, JSON.stringify({
                ...await doc10.data(),
                ...data
            }), options)
        ).catch((err)=>{
            if (err instanceof KeyNotFoundError) {
                throw new DocumentNotFoundError(reference.toString());
            }
            return err;
        });
    }
    delete(reference) {
        const key = DocumentReferenceToKey(reference);
        return this.backend.delete(key);
    }
}
class MailLoggerProvider {
    logger = getLogger("baseless_mail_logger");
    async send(message) {
        this.logger.info(JSON.stringify(message));
    }
}
const clients1 = new ClientsBuilder();
const auth = new AuthBuilder();
const database = new DatabaseBuilder();
const functions = new FunctionsBuilder();
const mail = new MailBuilder();
const encoder = new TextEncoder();
const decoder = new TextDecoder();
function concat(...buffers) {
    const size = buffers.reduce((acc, { length  })=>acc + length
    , 0);
    const buf = new Uint8Array(size);
    let i = 0;
    buffers.forEach((buffer)=>{
        buf.set(buffer, i);
        i += buffer.length;
    });
    return buf;
}
const encodeBase64 = (input)=>{
    let unencoded = input;
    if (typeof unencoded === 'string') {
        unencoded = encoder.encode(unencoded);
    }
    const CHUNK_SIZE = 32768;
    const arr = [];
    for(let i = 0; i < unencoded.length; i += CHUNK_SIZE){
        arr.push(String.fromCharCode.apply(null, unencoded.subarray(i, i + 32768)));
    }
    return btoa(arr.join(''));
};
const encode = (input)=>{
    return encodeBase64(input).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
};
const decodeBase64 = (encoded)=>{
    return new Uint8Array(atob(encoded).split('').map((c)=>c.charCodeAt(0)
    ));
};
const decode = (input)=>{
    let encoded = input;
    if (encoded instanceof Uint8Array) {
        encoded = decoder.decode(encoded);
    }
    encoded = encoded.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
    try {
        return decodeBase64(encoded);
    } catch  {
        throw new TypeError('The input to be decoded is not correctly encoded.');
    }
};
class JOSEError extends Error {
    static get code() {
        return 'ERR_JOSE_GENERIC';
    }
    code = 'ERR_JOSE_GENERIC';
    constructor(message){
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace?.(this, this.constructor);
    }
}
class JWTClaimValidationFailed extends JOSEError {
    static get code() {
        return 'ERR_JWT_CLAIM_VALIDATION_FAILED';
    }
    code = 'ERR_JWT_CLAIM_VALIDATION_FAILED';
    claim;
    reason;
    constructor(message, claim = 'unspecified', reason = 'unspecified'){
        super(message);
        this.claim = claim;
        this.reason = reason;
    }
}
class JWTExpired extends JOSEError {
    static get code() {
        return 'ERR_JWT_EXPIRED';
    }
    code = 'ERR_JWT_EXPIRED';
    claim;
    reason;
    constructor(message, claim = 'unspecified', reason = 'unspecified'){
        super(message);
        this.claim = claim;
        this.reason = reason;
    }
}
class JOSEAlgNotAllowed extends JOSEError {
    static get code() {
        return 'ERR_JOSE_ALG_NOT_ALLOWED';
    }
    code = 'ERR_JOSE_ALG_NOT_ALLOWED';
}
class JOSENotSupported extends JOSEError {
    static get code() {
        return 'ERR_JOSE_NOT_SUPPORTED';
    }
    code = 'ERR_JOSE_NOT_SUPPORTED';
}
class JWSInvalid extends JOSEError {
    static get code() {
        return 'ERR_JWS_INVALID';
    }
    code = 'ERR_JWS_INVALID';
}
class JWTInvalid extends JOSEError {
    static get code() {
        return 'ERR_JWT_INVALID';
    }
    code = 'ERR_JWT_INVALID';
}
class JWSSignatureVerificationFailed extends JOSEError {
    static get code() {
        return 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED';
    }
    code = 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED';
    message = 'signature verification failed';
}
function isCryptoKey(key) {
    try {
        return key != null && typeof key.extractable === 'boolean' && typeof key.algorithm.name === 'string' && typeof key.type === 'string';
    } catch  {
        return false;
    }
}
crypto.getRandomValues.bind(crypto);
function isCloudflareWorkers() {
    return typeof WebSocketPair === 'function';
}
function isNodeJs() {
    try {
        return process.versions.node !== undefined;
    } catch  {
        return false;
    }
}
function unusable(name, prop = 'algorithm.name') {
    return new TypeError(`CryptoKey does not support this operation, its ${prop} must be ${name}`);
}
function isAlgorithm(algorithm, name) {
    return algorithm.name === name;
}
function getHashLength(hash) {
    return parseInt(hash.name.substr(4), 10);
}
function getNamedCurve(alg) {
    switch(alg){
        case 'ES256':
            return 'P-256';
        case 'ES384':
            return 'P-384';
        case 'ES512':
            return 'P-521';
        default:
            throw new Error('unreachable');
    }
}
function checkUsage(key, usages) {
    if (usages.length && !usages.some((expected)=>key.usages.includes(expected)
    )) {
        let msg = 'CryptoKey does not support this operation, its usages must include ';
        if (usages.length > 2) {
            const last = usages.pop();
            msg += `one of ${usages.join(', ')}, or ${last}.`;
        } else if (usages.length === 2) {
            msg += `one of ${usages[0]} or ${usages[1]}.`;
        } else {
            msg += `${usages[0]}.`;
        }
        throw new TypeError(msg);
    }
}
function checkSigCryptoKey(key, alg, ...usages) {
    switch(alg){
        case 'HS256':
        case 'HS384':
        case 'HS512':
            {
                if (!isAlgorithm(key.algorithm, 'HMAC')) throw unusable('HMAC');
                const expected = parseInt(alg.substr(2), 10);
                const actual = getHashLength(key.algorithm.hash);
                if (actual !== expected) throw unusable(`SHA-${expected}`, 'algorithm.hash');
                break;
            }
        case 'RS256':
        case 'RS384':
        case 'RS512':
            {
                if (!isAlgorithm(key.algorithm, 'RSASSA-PKCS1-v1_5')) throw unusable('RSASSA-PKCS1-v1_5');
                const expected = parseInt(alg.substr(2), 10);
                const actual = getHashLength(key.algorithm.hash);
                if (actual !== expected) throw unusable(`SHA-${expected}`, 'algorithm.hash');
                break;
            }
        case 'PS256':
        case 'PS384':
        case 'PS512':
            {
                if (!isAlgorithm(key.algorithm, 'RSA-PSS')) throw unusable('RSA-PSS');
                const expected = parseInt(alg.substr(2), 10);
                const actual = getHashLength(key.algorithm.hash);
                if (actual !== expected) throw unusable(`SHA-${expected}`, 'algorithm.hash');
                break;
            }
        case isNodeJs() && 'EdDSA':
            {
                if (key.algorithm.name !== 'NODE-ED25519' && key.algorithm.name !== 'NODE-ED448') throw unusable('NODE-ED25519 or NODE-ED448');
                break;
            }
        case isCloudflareWorkers() && 'EdDSA':
            {
                if (!isAlgorithm(key.algorithm, 'NODE-ED25519')) throw unusable('NODE-ED25519');
                break;
            }
        case 'ES256':
        case 'ES384':
        case 'ES512':
            {
                if (!isAlgorithm(key.algorithm, 'ECDSA')) throw unusable('ECDSA');
                const expected = getNamedCurve(alg);
                const actual = key.algorithm.namedCurve;
                if (actual !== expected) throw unusable(expected, 'algorithm.namedCurve');
                break;
            }
        default:
            throw new TypeError('CryptoKey does not support this operation');
    }
    checkUsage(key, usages);
}
const __default = (actual, ...types1)=>{
    let msg = 'Key must be ';
    if (types1.length > 2) {
        const last = types1.pop();
        msg += `one of type ${types1.join(', ')}, or ${last}.`;
    } else if (types1.length === 2) {
        msg += `one of type ${types1[0]} or ${types1[1]}.`;
    } else {
        msg += `of type ${types1[0]}.`;
    }
    if (actual == null) {
        msg += ` Received ${actual}`;
    } else if (typeof actual === 'function' && actual.name) {
        msg += ` Received function ${actual.name}`;
    } else if (typeof actual === 'object' && actual != null) {
        if (actual.constructor && actual.constructor.name) {
            msg += ` Received an instance of ${actual.constructor.name}`;
        }
    }
    return msg;
};
const types = [
    'CryptoKey'
];
const __default1 = (key)=>{
    return isCryptoKey(key);
};
const isDisjoint = (...headers)=>{
    const sources = headers.filter(Boolean);
    if (sources.length === 0 || sources.length === 1) {
        return true;
    }
    let acc;
    for (const header of sources){
        const parameters = Object.keys(header);
        if (!acc || acc.size === 0) {
            acc = new Set(parameters);
            continue;
        }
        for (const parameter of parameters){
            if (acc.has(parameter)) {
                return false;
            }
            acc.add(parameter);
        }
    }
    return true;
};
function isObjectLike(value) {
    return typeof value === 'object' && value !== null;
}
function isObject(input) {
    if (!isObjectLike(input) || Object.prototype.toString.call(input) !== '[object Object]') {
        return false;
    }
    if (Object.getPrototypeOf(input) === null) {
        return true;
    }
    let proto = input;
    while(Object.getPrototypeOf(proto) !== null){
        proto = Object.getPrototypeOf(proto);
    }
    return Object.getPrototypeOf(input) === proto;
}
const __default2 = (alg, key)=>{
    if (alg.startsWith('RS') || alg.startsWith('PS')) {
        const { modulusLength  } = key.algorithm;
        if (typeof modulusLength !== 'number' || modulusLength < 2048) {
            throw new TypeError(`${alg} requires key modulusLength to be 2048 bits or larger`);
        }
    }
};
const symmetricTypeCheck = (key)=>{
    if (key instanceof Uint8Array) return;
    if (!__default1(key)) {
        throw new TypeError(__default(key, ...types, 'Uint8Array'));
    }
    if (key.type !== 'secret') {
        throw new TypeError(`${types.join(' or ')} instances for symmetric algorithms must be of type "secret"`);
    }
};
const asymmetricTypeCheck = (key, usage)=>{
    if (!__default1(key)) {
        throw new TypeError(__default(key, ...types));
    }
    if (key.type === 'secret') {
        throw new TypeError(`${types.join(' or ')} instances for asymmetric algorithms must not be of type "secret"`);
    }
    if (usage === 'sign' && key.type === 'public') {
        throw new TypeError(`${types.join(' or ')} instances for asymmetric algorithm signing must be of type "private"`);
    }
    if (usage === 'decrypt' && key.type === 'public') {
        throw new TypeError(`${types.join(' or ')} instances for asymmetric algorithm decryption must be of type "private"`);
    }
    if (key.algorithm && usage === 'verify' && key.type === 'private') {
        throw new TypeError(`${types.join(' or ')} instances for asymmetric algorithm verifying must be of type "public"`);
    }
    if (key.algorithm && usage === 'encrypt' && key.type === 'private') {
        throw new TypeError(`${types.join(' or ')} instances for asymmetric algorithm encryption must be of type "public"`);
    }
};
const checkKeyType = (alg, key, usage)=>{
    const symmetric = alg.startsWith('HS') || alg === 'dir' || alg.startsWith('PBES2') || /^A\d{3}(?:GCM)?KW$/.test(alg);
    if (symmetric) {
        symmetricTypeCheck(key);
    } else {
        asymmetricTypeCheck(key, usage);
    }
};
function validateCrit(Err, recognizedDefault, recognizedOption, protectedHeader, joseHeader) {
    if (joseHeader.crit !== undefined && protectedHeader.crit === undefined) {
        throw new Err('"crit" (Critical) Header Parameter MUST be integrity protected');
    }
    if (!protectedHeader || protectedHeader.crit === undefined) {
        return new Set();
    }
    if (!Array.isArray(protectedHeader.crit) || protectedHeader.crit.length === 0 || protectedHeader.crit.some((input)=>typeof input !== 'string' || input.length === 0
    )) {
        throw new Err('"crit" (Critical) Header Parameter MUST be an array of non-empty strings when present');
    }
    let recognized;
    if (recognizedOption !== undefined) {
        recognized = new Map([
            ...Object.entries(recognizedOption),
            ...recognizedDefault.entries()
        ]);
    } else {
        recognized = recognizedDefault;
    }
    for (const parameter of protectedHeader.crit){
        if (!recognized.has(parameter)) {
            throw new JOSENotSupported(`Extension Header Parameter "${parameter}" is not recognized`);
        }
        if (joseHeader[parameter] === undefined) {
            throw new Err(`Extension Header Parameter "${parameter}" is missing`);
        } else if (recognized.get(parameter) && protectedHeader[parameter] === undefined) {
            throw new Err(`Extension Header Parameter "${parameter}" MUST be integrity protected`);
        }
    }
    return new Set(protectedHeader.crit);
}
const validateAlgorithms = (option, algorithms)=>{
    if (algorithms !== undefined && (!Array.isArray(algorithms) || algorithms.some((s)=>typeof s !== 'string'
    ))) {
        throw new TypeError(`"${option}" option must be an array of strings`);
    }
    if (!algorithms) {
        return undefined;
    }
    return new Set(algorithms);
};
Symbol();
function subtleDsa(alg, namedCurve) {
    const length = parseInt(alg.substr(-3), 10);
    switch(alg){
        case 'HS256':
        case 'HS384':
        case 'HS512':
            return {
                hash: `SHA-${length}`,
                name: 'HMAC'
            };
        case 'PS256':
        case 'PS384':
        case 'PS512':
            return {
                hash: `SHA-${length}`,
                name: 'RSA-PSS',
                saltLength: length >> 3
            };
        case 'RS256':
        case 'RS384':
        case 'RS512':
            return {
                hash: `SHA-${length}`,
                name: 'RSASSA-PKCS1-v1_5'
            };
        case 'ES256':
        case 'ES384':
        case 'ES512':
            return {
                hash: `SHA-${length}`,
                name: 'ECDSA',
                namedCurve
            };
        case (isCloudflareWorkers() || isNodeJs()) && 'EdDSA':
            return {
                name: namedCurve,
                namedCurve
            };
        default:
            throw new JOSENotSupported(`alg ${alg} is not supported either by JOSE or your javascript runtime`);
    }
}
function getCryptoKey(alg, key, usage) {
    if (isCryptoKey(key)) {
        checkSigCryptoKey(key, alg, usage);
        return key;
    }
    if (key instanceof Uint8Array) {
        if (!alg.startsWith('HS')) {
            throw new TypeError(__default(key, ...types));
        }
        return crypto.subtle.importKey('raw', key, {
            hash: `SHA-${alg.substr(-3)}`,
            name: 'HMAC'
        }, false, [
            usage
        ]);
    }
    throw new TypeError(__default(key, ...types, 'Uint8Array'));
}
const verify = async (alg, key, signature, data)=>{
    const cryptoKey = await getCryptoKey(alg, key, 'verify');
    __default2(alg, cryptoKey);
    const algorithm = subtleDsa(alg, cryptoKey.algorithm.namedCurve);
    try {
        return await crypto.subtle.verify(algorithm, cryptoKey, signature, data);
    } catch  {
        return false;
    }
};
async function flattenedVerify(jws, key, options) {
    if (!isObject(jws)) {
        throw new JWSInvalid('Flattened JWS must be an object');
    }
    if (jws.protected === undefined && jws.header === undefined) {
        throw new JWSInvalid('Flattened JWS must have either of the "protected" or "header" members');
    }
    if (jws.protected !== undefined && typeof jws.protected !== 'string') {
        throw new JWSInvalid('JWS Protected Header incorrect type');
    }
    if (jws.payload === undefined) {
        throw new JWSInvalid('JWS Payload missing');
    }
    if (typeof jws.signature !== 'string') {
        throw new JWSInvalid('JWS Signature missing or incorrect type');
    }
    if (jws.header !== undefined && !isObject(jws.header)) {
        throw new JWSInvalid('JWS Unprotected Header incorrect type');
    }
    let parsedProt = {
    };
    if (jws.protected) {
        const protectedHeader = decode(jws.protected);
        try {
            parsedProt = JSON.parse(decoder.decode(protectedHeader));
        } catch  {
            throw new JWSInvalid('JWS Protected Header is invalid');
        }
    }
    if (!isDisjoint(parsedProt, jws.header)) {
        throw new JWSInvalid('JWS Protected and JWS Unprotected Header Parameter names must be disjoint');
    }
    const joseHeader = {
        ...parsedProt,
        ...jws.header
    };
    const extensions = validateCrit(JWSInvalid, new Map([
        [
            'b64',
            true
        ]
    ]), options?.crit, parsedProt, joseHeader);
    let b64 = true;
    if (extensions.has('b64')) {
        b64 = parsedProt.b64;
        if (typeof b64 !== 'boolean') {
            throw new JWSInvalid('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
        }
    }
    const { alg  } = joseHeader;
    if (typeof alg !== 'string' || !alg) {
        throw new JWSInvalid('JWS "alg" (Algorithm) Header Parameter missing or invalid');
    }
    const algorithms = options && validateAlgorithms('algorithms', options.algorithms);
    if (algorithms && !algorithms.has(alg)) {
        throw new JOSEAlgNotAllowed('"alg" (Algorithm) Header Parameter not allowed');
    }
    if (b64) {
        if (typeof jws.payload !== 'string') {
            throw new JWSInvalid('JWS Payload must be a string');
        }
    } else if (typeof jws.payload !== 'string' && !(jws.payload instanceof Uint8Array)) {
        throw new JWSInvalid('JWS Payload must be a string or an Uint8Array instance');
    }
    let resolvedKey = false;
    if (typeof key === 'function') {
        key = await key(parsedProt, jws);
        resolvedKey = true;
    }
    checkKeyType(alg, key, 'verify');
    const data = concat(encoder.encode(jws.protected ?? ''), encoder.encode('.'), typeof jws.payload === 'string' ? encoder.encode(jws.payload) : jws.payload);
    const signature = decode(jws.signature);
    const verified = await verify(alg, key, signature, data);
    if (!verified) {
        throw new JWSSignatureVerificationFailed();
    }
    let payload;
    if (b64) {
        payload = decode(jws.payload);
    } else if (typeof jws.payload === 'string') {
        payload = encoder.encode(jws.payload);
    } else {
        payload = jws.payload;
    }
    const result = {
        payload
    };
    if (jws.protected !== undefined) {
        result.protectedHeader = parsedProt;
    }
    if (jws.header !== undefined) {
        result.unprotectedHeader = jws.header;
    }
    if (resolvedKey) {
        return {
            ...result,
            key
        };
    }
    return result;
}
async function compactVerify(jws, key, options) {
    if (jws instanceof Uint8Array) {
        jws = decoder.decode(jws);
    }
    if (typeof jws !== 'string') {
        throw new JWSInvalid('Compact JWS must be a string or Uint8Array');
    }
    const { 0: protectedHeader , 1: payload , 2: signature , length  } = jws.split('.');
    if (length !== 3) {
        throw new JWSInvalid('Invalid Compact JWS');
    }
    const verified = await flattenedVerify({
        payload,
        protected: protectedHeader,
        signature
    }, key, options);
    const result = {
        payload: verified.payload,
        protectedHeader: verified.protectedHeader
    };
    if (typeof key === 'function') {
        return {
            ...result,
            key: verified.key
        };
    }
    return result;
}
const __default3 = (date1)=>Math.floor(date1.getTime() / 1000)
;
const hour = 60 * 60;
const day = hour * 24;
const week = day * 7;
const year = day * 365.25;
const REGEX = /^(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)$/i;
const __default4 = (str)=>{
    const matched = REGEX.exec(str);
    if (!matched) {
        throw new TypeError('Invalid time period format');
    }
    const value = parseFloat(matched[1]);
    const unit = matched[2].toLowerCase();
    switch(unit){
        case 'sec':
        case 'secs':
        case 'second':
        case 'seconds':
        case 's':
            return Math.round(value);
        case 'minute':
        case 'minutes':
        case 'min':
        case 'mins':
        case 'm':
            return Math.round(value * 60);
        case 'hour':
        case 'hours':
        case 'hr':
        case 'hrs':
        case 'h':
            return Math.round(value * hour);
        case 'day':
        case 'days':
        case 'd':
            return Math.round(value * day);
        case 'week':
        case 'weeks':
        case 'w':
            return Math.round(value * week);
        default:
            return Math.round(value * year);
    }
};
const normalizeTyp = (value)=>value.toLowerCase().replace(/^application\//, '')
;
const checkAudiencePresence = (audPayload, audOption)=>{
    if (typeof audPayload === 'string') {
        return audOption.includes(audPayload);
    }
    if (Array.isArray(audPayload)) {
        return audOption.some(Set.prototype.has.bind(new Set(audPayload)));
    }
    return false;
};
const __default5 = (protectedHeader, encodedPayload, options = {
})=>{
    const { typ  } = options;
    if (typ && (typeof protectedHeader.typ !== 'string' || normalizeTyp(protectedHeader.typ) !== normalizeTyp(typ))) {
        throw new JWTClaimValidationFailed('unexpected "typ" JWT header value', 'typ', 'check_failed');
    }
    let payload;
    try {
        payload = JSON.parse(decoder.decode(encodedPayload));
    } catch  {
    }
    if (!isObject(payload)) {
        throw new JWTInvalid('JWT Claims Set must be a top-level JSON object');
    }
    const { issuer  } = options;
    if (issuer && !(Array.isArray(issuer) ? issuer : [
        issuer
    ]).includes(payload.iss)) {
        throw new JWTClaimValidationFailed('unexpected "iss" claim value', 'iss', 'check_failed');
    }
    const { subject  } = options;
    if (subject && payload.sub !== subject) {
        throw new JWTClaimValidationFailed('unexpected "sub" claim value', 'sub', 'check_failed');
    }
    const { audience  } = options;
    if (audience && !checkAudiencePresence(payload.aud, typeof audience === 'string' ? [
        audience
    ] : audience)) {
        throw new JWTClaimValidationFailed('unexpected "aud" claim value', 'aud', 'check_failed');
    }
    let tolerance;
    switch(typeof options.clockTolerance){
        case 'string':
            tolerance = __default4(options.clockTolerance);
            break;
        case 'number':
            tolerance = options.clockTolerance;
            break;
        case 'undefined':
            tolerance = 0;
            break;
        default:
            throw new TypeError('Invalid clockTolerance option type');
    }
    const { currentDate  } = options;
    const now = __default3(currentDate || new Date());
    if (payload.iat !== undefined || options.maxTokenAge) {
        if (typeof payload.iat !== 'number') {
            throw new JWTClaimValidationFailed('"iat" claim must be a number', 'iat', 'invalid');
        }
        if (payload.exp === undefined && payload.iat > now + tolerance) {
            throw new JWTClaimValidationFailed('"iat" claim timestamp check failed (it should be in the past)', 'iat', 'check_failed');
        }
    }
    if (payload.nbf !== undefined) {
        if (typeof payload.nbf !== 'number') {
            throw new JWTClaimValidationFailed('"nbf" claim must be a number', 'nbf', 'invalid');
        }
        if (payload.nbf > now + tolerance) {
            throw new JWTClaimValidationFailed('"nbf" claim timestamp check failed', 'nbf', 'check_failed');
        }
    }
    if (payload.exp !== undefined) {
        if (typeof payload.exp !== 'number') {
            throw new JWTClaimValidationFailed('"exp" claim must be a number', 'exp', 'invalid');
        }
        if (payload.exp <= now - tolerance) {
            throw new JWTExpired('"exp" claim timestamp check failed', 'exp', 'check_failed');
        }
    }
    if (options.maxTokenAge) {
        const age = now - payload.iat;
        const max = typeof options.maxTokenAge === 'number' ? options.maxTokenAge : __default4(options.maxTokenAge);
        if (age - tolerance > max) {
            throw new JWTExpired('"iat" claim timestamp check failed (too far in the past)', 'iat', 'check_failed');
        }
        if (age < 0 - tolerance) {
            throw new JWTClaimValidationFailed('"iat" claim timestamp check failed (it should be in the past)', 'iat', 'check_failed');
        }
    }
    return payload;
};
async function jwtVerify(jwt, key, options) {
    const verified = await compactVerify(jwt, key, options);
    if (verified.protectedHeader.crit?.includes('b64') && verified.protectedHeader.b64 === false) {
        throw new JWTInvalid('JWTs MUST NOT use unencoded payload');
    }
    const payload = __default5(verified.protectedHeader, verified.payload, options);
    const result = {
        payload,
        protectedHeader: verified.protectedHeader
    };
    if (typeof key === 'function') {
        return {
            ...result,
            key: verified.key
        };
    }
    return result;
}
const sign = async (alg, key, data)=>{
    const cryptoKey = await getCryptoKey(alg, key, 'sign');
    __default2(alg, cryptoKey);
    const signature = await crypto.subtle.sign(subtleDsa(alg, cryptoKey.algorithm.namedCurve), cryptoKey, data);
    return new Uint8Array(signature);
};
class FlattenedSign {
    _payload;
    _protectedHeader;
    _unprotectedHeader;
    constructor(payload){
        if (!(payload instanceof Uint8Array)) {
            throw new TypeError('payload must be an instance of Uint8Array');
        }
        this._payload = payload;
    }
    setProtectedHeader(protectedHeader) {
        if (this._protectedHeader) {
            throw new TypeError('setProtectedHeader can only be called once');
        }
        this._protectedHeader = protectedHeader;
        return this;
    }
    setUnprotectedHeader(unprotectedHeader) {
        if (this._unprotectedHeader) {
            throw new TypeError('setUnprotectedHeader can only be called once');
        }
        this._unprotectedHeader = unprotectedHeader;
        return this;
    }
    async sign(key, options) {
        if (!this._protectedHeader && !this._unprotectedHeader) {
            throw new JWSInvalid('either setProtectedHeader or setUnprotectedHeader must be called before #sign()');
        }
        if (!isDisjoint(this._protectedHeader, this._unprotectedHeader)) {
            throw new JWSInvalid('JWS Protected and JWS Unprotected Header Parameter names must be disjoint');
        }
        const joseHeader = {
            ...this._protectedHeader,
            ...this._unprotectedHeader
        };
        const extensions = validateCrit(JWSInvalid, new Map([
            [
                'b64',
                true
            ]
        ]), options?.crit, this._protectedHeader, joseHeader);
        let b64 = true;
        if (extensions.has('b64')) {
            b64 = this._protectedHeader.b64;
            if (typeof b64 !== 'boolean') {
                throw new JWSInvalid('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
            }
        }
        const { alg  } = joseHeader;
        if (typeof alg !== 'string' || !alg) {
            throw new JWSInvalid('JWS "alg" (Algorithm) Header Parameter missing or invalid');
        }
        checkKeyType(alg, key, 'sign');
        let payload = this._payload;
        if (b64) {
            payload = encoder.encode(encode(payload));
        }
        let protectedHeader;
        if (this._protectedHeader) {
            protectedHeader = encoder.encode(encode(JSON.stringify(this._protectedHeader)));
        } else {
            protectedHeader = encoder.encode('');
        }
        const data = concat(protectedHeader, encoder.encode('.'), payload);
        const signature = await sign(alg, key, data);
        const jws = {
            signature: encode(signature),
            payload: ''
        };
        if (b64) {
            jws.payload = decoder.decode(payload);
        }
        if (this._unprotectedHeader) {
            jws.header = this._unprotectedHeader;
        }
        if (this._protectedHeader) {
            jws.protected = decoder.decode(protectedHeader);
        }
        return jws;
    }
}
class CompactSign {
    _flattened;
    constructor(payload){
        this._flattened = new FlattenedSign(payload);
    }
    setProtectedHeader(protectedHeader) {
        this._flattened.setProtectedHeader(protectedHeader);
        return this;
    }
    async sign(key, options) {
        const jws = await this._flattened.sign(key, options);
        if (jws.payload === undefined) {
            throw new TypeError('use the flattened module for creating JWS with b64: false');
        }
        return `${jws.protected}.${jws.payload}.${jws.signature}`;
    }
}
class ProduceJWT {
    _payload;
    constructor(payload){
        if (!isObject(payload)) {
            throw new TypeError('JWT Claims Set MUST be an object');
        }
        this._payload = payload;
    }
    setIssuer(issuer) {
        this._payload = {
            ...this._payload,
            iss: issuer
        };
        return this;
    }
    setSubject(subject) {
        this._payload = {
            ...this._payload,
            sub: subject
        };
        return this;
    }
    setAudience(audience) {
        this._payload = {
            ...this._payload,
            aud: audience
        };
        return this;
    }
    setJti(jwtId) {
        this._payload = {
            ...this._payload,
            jti: jwtId
        };
        return this;
    }
    setNotBefore(input) {
        if (typeof input === 'number') {
            this._payload = {
                ...this._payload,
                nbf: input
            };
        } else {
            this._payload = {
                ...this._payload,
                nbf: __default3(new Date()) + __default4(input)
            };
        }
        return this;
    }
    setExpirationTime(input) {
        if (typeof input === 'number') {
            this._payload = {
                ...this._payload,
                exp: input
            };
        } else {
            this._payload = {
                ...this._payload,
                exp: __default3(new Date()) + __default4(input)
            };
        }
        return this;
    }
    setIssuedAt(input) {
        if (typeof input === 'undefined') {
            this._payload = {
                ...this._payload,
                iat: __default3(new Date())
            };
        } else {
            this._payload = {
                ...this._payload,
                iat: input
            };
        }
        return this;
    }
}
class SignJWT extends ProduceJWT {
    _protectedHeader;
    setProtectedHeader(protectedHeader) {
        this._protectedHeader = protectedHeader;
        return this;
    }
    async sign(key, options) {
        const sig = new CompactSign(encoder.encode(JSON.stringify(this._payload)));
        sig.setProtectedHeader(this._protectedHeader);
        if (Array.isArray(this._protectedHeader?.crit) && this._protectedHeader.crit.includes('b64') && this._protectedHeader.b64 === false) {
            throw new JWTInvalid('JWTs MUST NOT use unencoded payload');
        }
        return sig.sign(key, options);
    }
}
function getModulusLengthOption(options) {
    const modulusLength = options?.modulusLength ?? 2048;
    if (typeof modulusLength !== 'number' || modulusLength < 2048) {
        throw new JOSENotSupported('Invalid or unsupported modulusLength option provided, 2048 bits or larger keys must be used');
    }
    return modulusLength;
}
async function generateKeyPair(alg, options) {
    let algorithm;
    let keyUsages;
    switch(alg){
        case 'PS256':
        case 'PS384':
        case 'PS512':
            algorithm = {
                name: 'RSA-PSS',
                hash: `SHA-${alg.substr(-3)}`,
                publicExponent: new Uint8Array([
                    1,
                    0,
                    1
                ]),
                modulusLength: getModulusLengthOption(options)
            };
            keyUsages = [
                'sign',
                'verify'
            ];
            break;
        case 'RS256':
        case 'RS384':
        case 'RS512':
            algorithm = {
                name: 'RSASSA-PKCS1-v1_5',
                hash: `SHA-${alg.substr(-3)}`,
                publicExponent: new Uint8Array([
                    1,
                    0,
                    1
                ]),
                modulusLength: getModulusLengthOption(options)
            };
            keyUsages = [
                'sign',
                'verify'
            ];
            break;
        case 'RSA-OAEP':
        case 'RSA-OAEP-256':
        case 'RSA-OAEP-384':
        case 'RSA-OAEP-512':
            algorithm = {
                name: 'RSA-OAEP',
                hash: `SHA-${parseInt(alg.substr(-3), 10) || 1}`,
                publicExponent: new Uint8Array([
                    1,
                    0,
                    1
                ]),
                modulusLength: getModulusLengthOption(options)
            };
            keyUsages = [
                'decrypt',
                'unwrapKey',
                'encrypt',
                'wrapKey'
            ];
            break;
        case 'ES256':
            algorithm = {
                name: 'ECDSA',
                namedCurve: 'P-256'
            };
            keyUsages = [
                'sign',
                'verify'
            ];
            break;
        case 'ES384':
            algorithm = {
                name: 'ECDSA',
                namedCurve: 'P-384'
            };
            keyUsages = [
                'sign',
                'verify'
            ];
            break;
        case 'ES512':
            algorithm = {
                name: 'ECDSA',
                namedCurve: 'P-521'
            };
            keyUsages = [
                'sign',
                'verify'
            ];
            break;
        case (isCloudflareWorkers() || isNodeJs()) && 'EdDSA':
            switch(options?.crv){
                case undefined:
                case 'Ed25519':
                    algorithm = {
                        name: 'NODE-ED25519',
                        namedCurve: 'NODE-ED25519'
                    };
                    keyUsages = [
                        'sign',
                        'verify'
                    ];
                    break;
                case isNodeJs() && 'Ed448':
                    algorithm = {
                        name: 'NODE-ED448',
                        namedCurve: 'NODE-ED448'
                    };
                    keyUsages = [
                        'sign',
                        'verify'
                    ];
                    break;
                default:
                    throw new JOSENotSupported('Invalid or unsupported crv option provided, supported values are Ed25519 and Ed448');
            }
            break;
        case 'ECDH-ES':
        case 'ECDH-ES+A128KW':
        case 'ECDH-ES+A192KW':
        case 'ECDH-ES+A256KW':
            algorithm = {
                name: 'ECDH',
                namedCurve: options?.crv ?? 'P-256'
            };
            keyUsages = [
                'deriveKey',
                'deriveBits'
            ];
            break;
        default:
            throw new JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
    }
    return crypto.subtle.generateKey(algorithm, options?.extractable ?? false, keyUsages);
}
async function generateKeyPair1(alg, options) {
    return generateKeyPair(alg, options);
}
function encodePointer(p) {
    return encodeURI(escapePointer(p));
}
function escapePointer(p) {
    return p.replace(/~/g, "~0").replace(/\//g, "~1");
}
const schemaArrayKeyword = {
    prefixItems: true,
    items: true,
    allOf: true,
    anyOf: true,
    oneOf: true
};
const schemaMapKeyword = {
    $defs: true,
    definitions: true,
    properties: true,
    patternProperties: true,
    dependentSchemas: true
};
const ignoredKeyword = {
    id: true,
    $id: true,
    $ref: true,
    $schema: true,
    $anchor: true,
    $vocabulary: true,
    $comment: true,
    default: true,
    enum: true,
    const: true,
    required: true,
    type: true,
    maximum: true,
    minimum: true,
    exclusiveMaximum: true,
    exclusiveMinimum: true,
    multipleOf: true,
    maxLength: true,
    minLength: true,
    pattern: true,
    format: true,
    maxItems: true,
    minItems: true,
    uniqueItems: true,
    maxProperties: true,
    minProperties: true
};
let initialBaseURI = typeof self !== "undefined" && self.location ? new URL(self.location.origin + self.location.pathname + location.search) : new URL("https://github.com/cfworker");
function dereference(schema, lookup = Object.create(null), baseURI = initialBaseURI, basePointer = "") {
    if (schema && typeof schema === "object" && !Array.isArray(schema)) {
        const id = schema.$id || schema.id;
        if (id) {
            const url = new URL(id, baseURI.href);
            if (url.hash.length > 1) {
                lookup[url.href] = schema;
            } else {
                url.hash = "";
                if (basePointer === "") {
                    baseURI = url;
                } else {
                    dereference(schema, lookup, baseURI);
                }
            }
        }
    } else if (schema !== true && schema !== false) {
        return lookup;
    }
    const schemaURI = baseURI.href + (basePointer ? "#" + basePointer : "");
    if (lookup[schemaURI] !== undefined) {
        throw new Error(`Duplicate schema URI "${schemaURI}".`);
    }
    lookup[schemaURI] = schema;
    if (schema === true || schema === false) {
        return lookup;
    }
    if (schema.__absolute_uri__ === undefined) {
        Object.defineProperty(schema, "__absolute_uri__", {
            enumerable: false,
            value: schemaURI
        });
    }
    if (schema.$ref && schema.__absolute_ref__ === undefined) {
        const url = new URL(schema.$ref, baseURI.href);
        url.hash = url.hash;
        Object.defineProperty(schema, "__absolute_ref__", {
            enumerable: false,
            value: url.href
        });
    }
    if (schema.$recursiveRef && schema.__absolute_recursive_ref__ === undefined) {
        const url = new URL(schema.$recursiveRef, baseURI.href);
        url.hash = url.hash;
        Object.defineProperty(schema, "__absolute_recursive_ref__", {
            enumerable: false,
            value: url.href
        });
    }
    if (schema.$anchor) {
        const url = new URL("#" + schema.$anchor, baseURI.href);
        lookup[url.href] = schema;
    }
    for(let key in schema){
        if (ignoredKeyword[key]) {
            continue;
        }
        const keyBase = `${basePointer}/${encodePointer(key)}`;
        const subSchema = schema[key];
        if (Array.isArray(subSchema)) {
            if (schemaArrayKeyword[key]) {
                const length = subSchema.length;
                for(let i = 0; i < length; i++){
                    dereference(subSchema[i], lookup, baseURI, `${keyBase}/${i}`);
                }
            }
        } else if (schemaMapKeyword[key]) {
            for(let subKey in subSchema){
                dereference(subSchema[subKey], lookup, baseURI, `${keyBase}/${encodePointer(subKey)}`);
            }
        } else {
            dereference(subSchema, lookup, baseURI, keyBase);
        }
    }
    return lookup;
}
function deepCompareStrict(a, b) {
    const typeofa = typeof a;
    if (typeofa !== typeof b) {
        return false;
    }
    if (Array.isArray(a)) {
        if (!Array.isArray(b)) {
            return false;
        }
        const length = a.length;
        if (length !== b.length) {
            return false;
        }
        for(let i = 0; i < length; i++){
            if (!deepCompareStrict(a[i], b[i])) {
                return false;
            }
        }
        return true;
    }
    if (typeofa === "object") {
        if (!a || !b) {
            return a === b;
        }
        const aKeys = Object.keys(a);
        const bKeys = Object.keys(b);
        const length = aKeys.length;
        if (length !== bKeys.length) {
            return false;
        }
        for (const k of aKeys){
            if (!deepCompareStrict(a[k], b[k])) {
                return false;
            }
        }
        return true;
    }
    return a === b;
}
const DATE = /^(\d\d\d\d)-(\d\d)-(\d\d)$/;
const DAYS = [
    0,
    31,
    28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31
];
const TIME = /^(\d\d):(\d\d):(\d\d)(\.\d+)?(z|[+-]\d\d(?::?\d\d)?)?$/i;
const HOSTNAME = /^(?=.{1,253}\.?$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[-0-9a-z]{0,61}[0-9a-z])?)*\.?$/i;
const URIREF = /^(?:[a-z][a-z0-9+\-.]*:)?(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'"()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?(?:\?(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
const URITEMPLATE = /^(?:(?:[^\x00-\x20"'<>%\\^`{|}]|%[0-9a-f]{2})|\{[+#./;?&=,!@|]?(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?(?:,(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?)*\})*$/i;
const URL_ = /^(?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?!10(?:\.\d{1,3}){3})(?!127(?:\.\d{1,3}){3})(?!169\.254(?:\.\d{1,3}){2})(?!192\.168(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u{00a1}-\u{ffff}0-9]+-?)*[a-z\u{00a1}-\u{ffff}0-9]+)(?:\.(?:[a-z\u{00a1}-\u{ffff}0-9]+-?)*[a-z\u{00a1}-\u{ffff}0-9]+)*(?:\.(?:[a-z\u{00a1}-\u{ffff}]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?$/iu;
const UUID = /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const JSON_POINTER = /^(?:\/(?:[^~/]|~0|~1)*)*$/;
const JSON_POINTER_URI_FRAGMENT = /^#(?:\/(?:[a-z0-9_\-.!$&'()*+,;:=@]|%[0-9a-f]{2}|~0|~1)*)*$/i;
const RELATIVE_JSON_POINTER = /^(?:0|[1-9][0-9]*)(?:#|(?:\/(?:[^~/]|~0|~1)*)*)$/;
const FASTDATE = /^\d\d\d\d-[0-1]\d-[0-3]\d$/;
const FASTTIME = /^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i;
const FASTDATETIME = /^\d\d\d\d-[0-1]\d-[0-3]\d[t\s](?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i;
const FASTURIREFERENCE = /^(?:(?:[a-z][a-z0-9+-.]*:)?\/?\/)?(?:[^\\\s#][^\s#]*)?(?:#[^\\\s]*)?$/i;
const EMAIL = (input)=>{
    if (input[0] === '"') {
        return false;
    }
    const [name, host, ...rest] = input.split("@");
    if (!name || !host || rest.length !== 0 || name.length > 64 || host.length > 253) {
        return false;
    }
    if (name[0] === "." || name.endsWith(".") || name.includes("..")) {
        return false;
    }
    if (!/^[a-z0-9.-]+$/i.test(host) || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(name)) {
        return false;
    }
    return host.split(".").every((part)=>/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i.test(part)
    );
};
const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
const IPV6 = /^((([0-9a-f]{1,4}:){7}([0-9a-f]{1,4}|:))|(([0-9a-f]{1,4}:){6}(:[0-9a-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){5}(((:[0-9a-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){4}(((:[0-9a-f]{1,4}){1,3})|((:[0-9a-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){3}(((:[0-9a-f]{1,4}){1,4})|((:[0-9a-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){2}(((:[0-9a-f]{1,4}){1,5})|((:[0-9a-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){1}(((:[0-9a-f]{1,4}){1,6})|((:[0-9a-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9a-f]{1,4}){1,7})|((:[0-9a-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))$/i;
const DURATION = (input)=>input.length > 1 && input.length < 80 && (/^P\d+([.,]\d+)?W$/.test(input) || /^P[\dYMDTHS]*(\d[.,]\d+)?[YMDHS]$/.test(input) && /^P([.,\d]+Y)?([.,\d]+M)?([.,\d]+D)?(T([.,\d]+H)?([.,\d]+M)?([.,\d]+S)?)?$/.test(input))
;
function bind(r) {
    return r.test.bind(r);
}
const fullFormat = {
    date,
    time: time.bind(undefined, false),
    "date-time": date_time,
    duration: DURATION,
    uri,
    "uri-reference": bind(URIREF),
    "uri-template": bind(URITEMPLATE),
    url: bind(URL_),
    email: EMAIL,
    hostname: bind(HOSTNAME),
    ipv4: bind(IPV4),
    ipv6: bind(IPV6),
    regex: regex,
    uuid: bind(UUID),
    "json-pointer": bind(JSON_POINTER),
    "json-pointer-uri-fragment": bind(JSON_POINTER_URI_FRAGMENT),
    "relative-json-pointer": bind(RELATIVE_JSON_POINTER)
};
const fastFormat = {
    ...fullFormat,
    date: bind(FASTDATE),
    time: bind(FASTTIME),
    "date-time": bind(FASTDATETIME),
    "uri-reference": bind(FASTURIREFERENCE)
};
function isLeapYear(year1) {
    return year1 % 4 === 0 && (year1 % 100 !== 0 || year1 % 400 === 0);
}
function date(str) {
    const matches = str.match(DATE);
    if (!matches) {
        return false;
    }
    const year2 = +matches[1];
    const month = +matches[2];
    const day1 = +matches[3];
    return month >= 1 && month <= 12 && day1 >= 1 && day1 <= (month == 2 && isLeapYear(year2) ? 29 : DAYS[month]);
}
function time(full, str) {
    const matches = str.match(TIME);
    if (!matches) {
        return false;
    }
    const hour1 = +matches[1];
    const minute = +matches[2];
    const second = +matches[3];
    const timeZone = !!matches[5];
    return (hour1 <= 23 && minute <= 59 && second <= 59 || hour1 == 23 && minute == 59 && second == 60) && (!full || timeZone);
}
const DATE_TIME_SEPARATOR = /t|\s/i;
function date_time(str) {
    const dateTime = str.split(DATE_TIME_SEPARATOR);
    return dateTime.length == 2 && date(dateTime[0]) && time(true, dateTime[1]);
}
const NOT_URI_FRAGMENT = /\/|:/;
const URI_PATTERN = /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)(?:\?(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
function uri(str) {
    return NOT_URI_FRAGMENT.test(str) && URI_PATTERN.test(str);
}
const Z_ANCHOR = /[^\\]\\Z/;
function regex(str) {
    if (Z_ANCHOR.test(str)) {
        return false;
    }
    try {
        new RegExp(str);
        return true;
    } catch (e) {
        return false;
    }
}
function ucs2length(s) {
    let result = 0;
    let length = s.length;
    let index = 0;
    let charCode;
    while(index < length){
        result++;
        charCode = s.charCodeAt(index++);
        if (charCode >= 55296 && charCode <= 56319 && index < length) {
            charCode = s.charCodeAt(index);
            if ((charCode & 64512) == 56320) {
                index++;
            }
        }
    }
    return result;
}
function validate(instance, schema, draft = "2019-09", lookup = dereference(schema), shortCircuit = true, recursiveAnchor = null, instanceLocation = "#", schemaLocation = "#", evaluated = Object.create(null)) {
    if (schema === true) {
        return {
            valid: true,
            errors: []
        };
    }
    if (schema === false) {
        return {
            valid: false,
            errors: [
                {
                    instanceLocation,
                    keyword: "false",
                    keywordLocation: instanceLocation,
                    error: "False boolean schema."
                }, 
            ]
        };
    }
    const rawInstanceType = typeof instance;
    let instanceType;
    switch(rawInstanceType){
        case "boolean":
        case "number":
        case "string":
            instanceType = rawInstanceType;
            break;
        case "object":
            if (instance === null) {
                instanceType = "null";
            } else if (Array.isArray(instance)) {
                instanceType = "array";
            } else {
                instanceType = "object";
            }
            break;
        default:
            throw new Error(`Instances of "${rawInstanceType}" type are not supported.`);
    }
    const { $ref , $recursiveRef , $recursiveAnchor , type: $type , const: $const , enum: $enum , required: $required , not: $not , anyOf: $anyOf , allOf: $allOf , oneOf: $oneOf , if: $if , then: $then , else: $else , format: $format , properties: $properties , patternProperties: $patternProperties , additionalProperties: $additionalProperties , unevaluatedProperties: $unevaluatedProperties , minProperties: $minProperties , maxProperties: $maxProperties , propertyNames: $propertyNames , dependentRequired: $dependentRequired , dependentSchemas: $dependentSchemas , dependencies: $dependencies , prefixItems: $prefixItems , items: $items , additionalItems: $additionalItems , unevaluatedItems: $unevaluatedItems , contains: $contains , minContains: $minContains , maxContains: $maxContains , minItems: $minItems , maxItems: $maxItems , uniqueItems: $uniqueItems , minimum: $minimum , maximum: $maximum , exclusiveMinimum: $exclusiveMinimum , exclusiveMaximum: $exclusiveMaximum , multipleOf: $multipleOf , minLength: $minLength , maxLength: $maxLength , pattern: $pattern , __absolute_ref__ , __absolute_recursive_ref__ ,  } = schema;
    const errors = [];
    if ($recursiveAnchor === true && recursiveAnchor === null) {
        recursiveAnchor = schema;
    }
    if ($recursiveRef === "#") {
        const refSchema = recursiveAnchor === null ? lookup[__absolute_recursive_ref__] : recursiveAnchor;
        const keywordLocation = `${schemaLocation}/$recursiveRef`;
        const result = validate(instance, recursiveAnchor === null ? schema : recursiveAnchor, draft, lookup, shortCircuit, refSchema, instanceLocation, keywordLocation, evaluated);
        if (!result.valid) {
            errors.push({
                instanceLocation,
                keyword: "$recursiveRef",
                keywordLocation,
                error: "A subschema had errors."
            }, ...result.errors);
        }
    }
    if ($ref !== undefined) {
        const uri = __absolute_ref__ || $ref;
        const refSchema = lookup[uri];
        if (refSchema === undefined) {
            let message = `Unresolved $ref "${$ref}".`;
            if (__absolute_ref__ && __absolute_ref__ !== $ref) {
                message += `  Absolute URI "${__absolute_ref__}".`;
            }
            message += `\nKnown schemas:\n- ${Object.keys(lookup).join("\n- ")}`;
            throw new Error(message);
        }
        const keywordLocation = `${schemaLocation}/$ref`;
        const result = validate(instance, refSchema, draft, lookup, shortCircuit, recursiveAnchor, instanceLocation, keywordLocation, evaluated);
        if (!result.valid) {
            errors.push({
                instanceLocation,
                keyword: "$ref",
                keywordLocation,
                error: "A subschema had errors."
            }, ...result.errors);
        }
        if (draft === "4" || draft === "7") {
            return {
                valid: errors.length === 0,
                errors
            };
        }
    }
    if (Array.isArray($type)) {
        let length = $type.length;
        let valid = false;
        for(let i = 0; i < length; i++){
            if (instanceType === $type[i] || $type[i] === "integer" && instanceType === "number" && instance % 1 === 0 && instance === instance) {
                valid = true;
                break;
            }
        }
        if (!valid) {
            errors.push({
                instanceLocation,
                keyword: "type",
                keywordLocation: `${schemaLocation}/type`,
                error: `Instance type "${instanceType}" is invalid. Expected "${$type.join('", "')}".`
            });
        }
    } else if ($type === "integer") {
        if (instanceType !== "number" || instance % 1 || instance !== instance) {
            errors.push({
                instanceLocation,
                keyword: "type",
                keywordLocation: `${schemaLocation}/type`,
                error: `Instance type "${instanceType}" is invalid. Expected "${$type}".`
            });
        }
    } else if ($type !== undefined && instanceType !== $type) {
        errors.push({
            instanceLocation,
            keyword: "type",
            keywordLocation: `${schemaLocation}/type`,
            error: `Instance type "${instanceType}" is invalid. Expected "${$type}".`
        });
    }
    if ($const !== undefined) {
        if (instanceType === "object" || instanceType === "array") {
            if (!deepCompareStrict(instance, $const)) {
                errors.push({
                    instanceLocation,
                    keyword: "const",
                    keywordLocation: `${schemaLocation}/const`,
                    error: `Instance does not match ${JSON.stringify($const)}.`
                });
            }
        } else if (instance !== $const) {
            errors.push({
                instanceLocation,
                keyword: "const",
                keywordLocation: `${schemaLocation}/const`,
                error: `Instance does not match ${JSON.stringify($const)}.`
            });
        }
    }
    if ($enum !== undefined) {
        if (instanceType === "object" || instanceType === "array") {
            if (!$enum.some((value)=>deepCompareStrict(instance, value)
            )) {
                errors.push({
                    instanceLocation,
                    keyword: "enum",
                    keywordLocation: `${schemaLocation}/enum`,
                    error: `Instance does not match any of ${JSON.stringify($enum)}.`
                });
            }
        } else if (!$enum.some((value)=>instance === value
        )) {
            errors.push({
                instanceLocation,
                keyword: "enum",
                keywordLocation: `${schemaLocation}/enum`,
                error: `Instance does not match any of ${JSON.stringify($enum)}.`
            });
        }
    }
    if ($not !== undefined) {
        const keywordLocation = `${schemaLocation}/not`;
        const result = validate(instance, $not, draft, lookup, shortCircuit, recursiveAnchor, instanceLocation, keywordLocation);
        if (result.valid) {
            errors.push({
                instanceLocation,
                keyword: "not",
                keywordLocation,
                error: 'Instance matched "not" schema.'
            });
        }
    }
    let subEvaluateds = [];
    if ($anyOf !== undefined) {
        const keywordLocation = `${schemaLocation}/anyOf`;
        const errorsLength = errors.length;
        let anyValid = false;
        for(let i = 0; i < $anyOf.length; i++){
            const subSchema = $anyOf[i];
            const subEvaluated = Object.create(evaluated);
            const result = validate(instance, subSchema, draft, lookup, shortCircuit, $recursiveAnchor === true ? recursiveAnchor : null, instanceLocation, `${keywordLocation}/${i}`, subEvaluated);
            errors.push(...result.errors);
            anyValid = anyValid || result.valid;
            if (result.valid) {
                subEvaluateds.push(subEvaluated);
            }
        }
        if (anyValid) {
            errors.length = errorsLength;
        } else {
            errors.splice(errorsLength, 0, {
                instanceLocation,
                keyword: "anyOf",
                keywordLocation,
                error: "Instance does not match any subschemas."
            });
        }
    }
    if ($allOf !== undefined) {
        const keywordLocation = `${schemaLocation}/allOf`;
        const errorsLength = errors.length;
        let allValid = true;
        for(let i = 0; i < $allOf.length; i++){
            const subSchema = $allOf[i];
            const subEvaluated = Object.create(evaluated);
            const result = validate(instance, subSchema, draft, lookup, shortCircuit, $recursiveAnchor === true ? recursiveAnchor : null, instanceLocation, `${keywordLocation}/${i}`, subEvaluated);
            errors.push(...result.errors);
            allValid = allValid && result.valid;
            if (result.valid) {
                subEvaluateds.push(subEvaluated);
            }
        }
        if (allValid) {
            errors.length = errorsLength;
        } else {
            errors.splice(errorsLength, 0, {
                instanceLocation,
                keyword: "allOf",
                keywordLocation,
                error: `Instance does not match every subschema.`
            });
        }
    }
    if ($oneOf !== undefined) {
        const keywordLocation = `${schemaLocation}/oneOf`;
        const errorsLength = errors.length;
        const matches = $oneOf.filter((subSchema, i)=>{
            const subEvaluated = Object.create(evaluated);
            const result = validate(instance, subSchema, draft, lookup, shortCircuit, $recursiveAnchor === true ? recursiveAnchor : null, instanceLocation, `${keywordLocation}/${i}`, subEvaluated);
            errors.push(...result.errors);
            if (result.valid) {
                subEvaluateds.push(subEvaluated);
            }
            return result.valid;
        }).length;
        if (matches === 1) {
            errors.length = errorsLength;
        } else {
            errors.splice(errorsLength, 0, {
                instanceLocation,
                keyword: "oneOf",
                keywordLocation,
                error: `Instance does not match exactly one subschema (${matches} matches).`
            });
        }
    }
    if (instanceType === "object" || instanceType === "array") {
        Object.assign(evaluated, ...subEvaluateds);
    }
    if ($if !== undefined) {
        const keywordLocation = `${schemaLocation}/if`;
        const conditionResult = validate(instance, $if, draft, lookup, shortCircuit, recursiveAnchor, instanceLocation, keywordLocation, evaluated).valid;
        if (conditionResult) {
            if ($then !== undefined) {
                const thenResult = validate(instance, $then, draft, lookup, shortCircuit, recursiveAnchor, instanceLocation, `${schemaLocation}/then`, evaluated);
                if (!thenResult.valid) {
                    errors.push({
                        instanceLocation,
                        keyword: "if",
                        keywordLocation,
                        error: `Instance does not match "then" schema.`
                    }, ...thenResult.errors);
                }
            }
        } else if ($else !== undefined) {
            const elseResult = validate(instance, $else, draft, lookup, shortCircuit, recursiveAnchor, instanceLocation, `${schemaLocation}/else`, evaluated);
            if (!elseResult.valid) {
                errors.push({
                    instanceLocation,
                    keyword: "if",
                    keywordLocation,
                    error: `Instance does not match "else" schema.`
                }, ...elseResult.errors);
            }
        }
    }
    if (instanceType === "object") {
        if ($required !== undefined) {
            for (const key of $required){
                if (!(key in instance)) {
                    errors.push({
                        instanceLocation,
                        keyword: "required",
                        keywordLocation: `${schemaLocation}/required`,
                        error: `Instance does not have required property "${key}".`
                    });
                }
            }
        }
        const keys = Object.keys(instance);
        if ($minProperties !== undefined && keys.length < $minProperties) {
            errors.push({
                instanceLocation,
                keyword: "minProperties",
                keywordLocation: `${schemaLocation}/minProperties`,
                error: `Instance does not have at least ${$minProperties} properties.`
            });
        }
        if ($maxProperties !== undefined && keys.length > $maxProperties) {
            errors.push({
                instanceLocation,
                keyword: "maxProperties",
                keywordLocation: `${schemaLocation}/maxProperties`,
                error: `Instance does not have at least ${$maxProperties} properties.`
            });
        }
        if ($propertyNames !== undefined) {
            const keywordLocation = `${schemaLocation}/propertyNames`;
            for(const key in instance){
                const subInstancePointer = `${instanceLocation}/${encodePointer(key)}`;
                const result = validate(key, $propertyNames, draft, lookup, shortCircuit, recursiveAnchor, subInstancePointer, keywordLocation);
                if (!result.valid) {
                    errors.push({
                        instanceLocation,
                        keyword: "propertyNames",
                        keywordLocation,
                        error: `Property name "${key}" does not match schema.`
                    }, ...result.errors);
                }
            }
        }
        if ($dependentRequired !== undefined) {
            const keywordLocation = `${schemaLocation}/dependantRequired`;
            for(const key in $dependentRequired){
                if (key in instance) {
                    const required = $dependentRequired[key];
                    for (const dependantKey of required){
                        if (!(dependantKey in instance)) {
                            errors.push({
                                instanceLocation,
                                keyword: "dependentRequired",
                                keywordLocation,
                                error: `Instance has "${key}" but does not have "${dependantKey}".`
                            });
                        }
                    }
                }
            }
        }
        if ($dependentSchemas !== undefined) {
            for(const key in $dependentSchemas){
                const keywordLocation = `${schemaLocation}/dependentSchemas`;
                if (key in instance) {
                    const result = validate(instance, $dependentSchemas[key], draft, lookup, shortCircuit, recursiveAnchor, instanceLocation, `${keywordLocation}/${encodePointer(key)}`, evaluated);
                    if (!result.valid) {
                        errors.push({
                            instanceLocation,
                            keyword: "dependentSchemas",
                            keywordLocation,
                            error: `Instance has "${key}" but does not match dependant schema.`
                        }, ...result.errors);
                    }
                }
            }
        }
        if ($dependencies !== undefined) {
            const keywordLocation = `${schemaLocation}/dependencies`;
            for(const key in $dependencies){
                if (key in instance) {
                    const propsOrSchema = $dependencies[key];
                    if (Array.isArray(propsOrSchema)) {
                        for (const dependantKey of propsOrSchema){
                            if (!(dependantKey in instance)) {
                                errors.push({
                                    instanceLocation,
                                    keyword: "dependencies",
                                    keywordLocation,
                                    error: `Instance has "${key}" but does not have "${dependantKey}".`
                                });
                            }
                        }
                    } else {
                        const result = validate(instance, propsOrSchema, draft, lookup, shortCircuit, recursiveAnchor, instanceLocation, `${keywordLocation}/${encodePointer(key)}`);
                        if (!result.valid) {
                            errors.push({
                                instanceLocation,
                                keyword: "dependencies",
                                keywordLocation,
                                error: `Instance has "${key}" but does not match dependant schema.`
                            }, ...result.errors);
                        }
                    }
                }
            }
        }
        const thisEvaluated = Object.create(null);
        let stop = false;
        if ($properties !== undefined) {
            const keywordLocation = `${schemaLocation}/properties`;
            for(const key in $properties){
                if (!(key in instance)) {
                    continue;
                }
                const subInstancePointer = `${instanceLocation}/${encodePointer(key)}`;
                const result = validate(instance[key], $properties[key], draft, lookup, shortCircuit, recursiveAnchor, subInstancePointer, `${keywordLocation}/${encodePointer(key)}`);
                if (result.valid) {
                    evaluated[key] = thisEvaluated[key] = true;
                } else {
                    stop = shortCircuit;
                    errors.push({
                        instanceLocation,
                        keyword: "properties",
                        keywordLocation,
                        error: `Property "${key}" does not match schema.`
                    }, ...result.errors);
                    if (stop) {
                        break;
                    }
                }
            }
        }
        if (!stop && $patternProperties !== undefined) {
            const keywordLocation = `${schemaLocation}/patternProperties`;
            for(const pattern in $patternProperties){
                const regex1 = new RegExp(pattern);
                const subSchema = $patternProperties[pattern];
                for(const key in instance){
                    if (!regex1.test(key)) {
                        continue;
                    }
                    const subInstancePointer = `${instanceLocation}/${encodePointer(key)}`;
                    const result = validate(instance[key], subSchema, draft, lookup, shortCircuit, recursiveAnchor, subInstancePointer, `${keywordLocation}/${encodePointer(pattern)}`);
                    if (result.valid) {
                        evaluated[key] = thisEvaluated[key] = true;
                    } else {
                        stop = shortCircuit;
                        errors.push({
                            instanceLocation,
                            keyword: "patternProperties",
                            keywordLocation,
                            error: `Property "${key}" matches pattern "${pattern}" but does not match associated schema.`
                        }, ...result.errors);
                    }
                }
            }
        }
        if (!stop && $additionalProperties !== undefined) {
            const keywordLocation = `${schemaLocation}/additionalProperties`;
            for(const key in instance){
                if (thisEvaluated[key]) {
                    continue;
                }
                const subInstancePointer = `${instanceLocation}/${encodePointer(key)}`;
                const result = validate(instance[key], $additionalProperties, draft, lookup, shortCircuit, recursiveAnchor, subInstancePointer, keywordLocation);
                if (result.valid) {
                    evaluated[key] = true;
                } else {
                    stop = shortCircuit;
                    errors.push({
                        instanceLocation,
                        keyword: "additionalProperties",
                        keywordLocation,
                        error: `Property "${key}" does not match additional properties schema.`
                    }, ...result.errors);
                }
            }
        } else if (!stop && $unevaluatedProperties !== undefined) {
            const keywordLocation = `${schemaLocation}/unevaluatedProperties`;
            for(const key in instance){
                if (!evaluated[key]) {
                    const subInstancePointer = `${instanceLocation}/${encodePointer(key)}`;
                    const result = validate(instance[key], $unevaluatedProperties, draft, lookup, shortCircuit, recursiveAnchor, subInstancePointer, keywordLocation);
                    if (result.valid) {
                        evaluated[key] = true;
                    } else {
                        errors.push({
                            instanceLocation,
                            keyword: "unevaluatedProperties",
                            keywordLocation,
                            error: `Property "${key}" does not match unevaluated properties schema.`
                        }, ...result.errors);
                    }
                }
            }
        }
    } else if (instanceType === "array") {
        if ($maxItems !== undefined && instance.length > $maxItems) {
            errors.push({
                instanceLocation,
                keyword: "maxItems",
                keywordLocation: `${schemaLocation}/maxItems`,
                error: `Array has too many items (${instance.length} > ${$maxItems}).`
            });
        }
        if ($minItems !== undefined && instance.length < $minItems) {
            errors.push({
                instanceLocation,
                keyword: "minItems",
                keywordLocation: `${schemaLocation}/minItems`,
                error: `Array has too few items (${instance.length} < ${$minItems}).`
            });
        }
        const length = instance.length;
        let i = 0;
        let stop = false;
        if ($prefixItems !== undefined) {
            const keywordLocation = `${schemaLocation}/prefixItems`;
            const length2 = Math.min($prefixItems.length, length);
            for(; i < length2; i++){
                const result = validate(instance[i], $prefixItems[i], draft, lookup, shortCircuit, recursiveAnchor, `${instanceLocation}/${i}`, `${keywordLocation}/${i}`);
                evaluated[i] = true;
                if (!result.valid) {
                    stop = shortCircuit;
                    errors.push({
                        instanceLocation,
                        keyword: "prefixItems",
                        keywordLocation,
                        error: `Items did not match schema.`
                    }, ...result.errors);
                    if (stop) {
                        break;
                    }
                }
            }
        }
        if ($items !== undefined) {
            const keywordLocation = `${schemaLocation}/items`;
            if (Array.isArray($items)) {
                const length2 = Math.min($items.length, length);
                for(; i < length2; i++){
                    const result = validate(instance[i], $items[i], draft, lookup, shortCircuit, recursiveAnchor, `${instanceLocation}/${i}`, `${keywordLocation}/${i}`);
                    evaluated[i] = true;
                    if (!result.valid) {
                        stop = shortCircuit;
                        errors.push({
                            instanceLocation,
                            keyword: "items",
                            keywordLocation,
                            error: `Items did not match schema.`
                        }, ...result.errors);
                        if (stop) {
                            break;
                        }
                    }
                }
            } else {
                for(; i < length; i++){
                    const result = validate(instance[i], $items, draft, lookup, shortCircuit, recursiveAnchor, `${instanceLocation}/${i}`, keywordLocation);
                    evaluated[i] = true;
                    if (!result.valid) {
                        stop = shortCircuit;
                        errors.push({
                            instanceLocation,
                            keyword: "items",
                            keywordLocation,
                            error: `Items did not match schema.`
                        }, ...result.errors);
                        if (stop) {
                            break;
                        }
                    }
                }
            }
            if (!stop && $additionalItems !== undefined) {
                const keywordLocation = `${schemaLocation}/additionalItems`;
                for(; i < length; i++){
                    const result = validate(instance[i], $additionalItems, draft, lookup, shortCircuit, recursiveAnchor, `${instanceLocation}/${i}`, keywordLocation);
                    evaluated[i] = true;
                    if (!result.valid) {
                        stop = shortCircuit;
                        errors.push({
                            instanceLocation,
                            keyword: "additionalItems",
                            keywordLocation,
                            error: `Items did not match additional items schema.`
                        }, ...result.errors);
                    }
                }
            }
        }
        if ($contains !== undefined) {
            if (length === 0 && $minContains === undefined) {
                errors.push({
                    instanceLocation,
                    keyword: "contains",
                    keywordLocation: `${schemaLocation}/contains`,
                    error: `Array is empty. It must contain at least one item matching the schema.`
                });
            } else if ($minContains !== undefined && length < $minContains) {
                errors.push({
                    instanceLocation,
                    keyword: "minContains",
                    keywordLocation: `${schemaLocation}/minContains`,
                    error: `Array has less items (${length}) than minContains (${$minContains}).`
                });
            } else {
                const keywordLocation = `${schemaLocation}/contains`;
                const errorsLength = errors.length;
                let contained = 0;
                for(let j = 0; j < length; j++){
                    const result = validate(instance[j], $contains, draft, lookup, shortCircuit, recursiveAnchor, `${instanceLocation}/${j}`, keywordLocation);
                    if (result.valid) {
                        evaluated[j] = true;
                        contained++;
                    } else {
                        errors.push(...result.errors);
                    }
                }
                if (contained >= ($minContains || 0)) {
                    errors.length = errorsLength;
                }
                if ($minContains === undefined && $maxContains === undefined && contained === 0) {
                    errors.splice(errorsLength, 0, {
                        instanceLocation,
                        keyword: "contains",
                        keywordLocation,
                        error: `Array does not contain item matching schema.`
                    });
                } else if ($minContains !== undefined && contained < $minContains) {
                    errors.push({
                        instanceLocation,
                        keyword: "minContains",
                        keywordLocation: `${schemaLocation}/minContains`,
                        error: `Array must contain at least ${$minContains} items matching schema. Only ${contained} items were found.`
                    });
                } else if ($maxContains !== undefined && contained > $maxContains) {
                    errors.push({
                        instanceLocation,
                        keyword: "maxContains",
                        keywordLocation: `${schemaLocation}/maxContains`,
                        error: `Array may contain at most ${$maxContains} items matching schema. ${contained} items were found.`
                    });
                }
            }
        }
        if (!stop && $unevaluatedItems !== undefined) {
            const keywordLocation = `${schemaLocation}/unevaluatedItems`;
            for(i; i < length; i++){
                if (evaluated[i]) {
                    continue;
                }
                const result = validate(instance[i], $unevaluatedItems, draft, lookup, shortCircuit, recursiveAnchor, `${instanceLocation}/${i}`, keywordLocation);
                evaluated[i] = true;
                if (!result.valid) {
                    errors.push({
                        instanceLocation,
                        keyword: "unevaluatedItems",
                        keywordLocation,
                        error: `Items did not match unevaluated items schema.`
                    }, ...result.errors);
                }
            }
        }
        if ($uniqueItems) {
            for(let j = 0; j < length; j++){
                const a = instance[j];
                const ao = typeof a === "object" && a !== null;
                for(let k = 0; k < length; k++){
                    if (j === k) {
                        continue;
                    }
                    const b = instance[k];
                    const bo = typeof b === "object" && b !== null;
                    if (a === b || ao && bo && deepCompareStrict(a, b)) {
                        errors.push({
                            instanceLocation,
                            keyword: "uniqueItems",
                            keywordLocation: `${schemaLocation}/uniqueItems`,
                            error: `Duplicate items at indexes ${j} and ${k}.`
                        });
                        j = Number.MAX_SAFE_INTEGER;
                        k = Number.MAX_SAFE_INTEGER;
                    }
                }
            }
        }
    } else if (instanceType === "number") {
        if (draft === "4") {
            if ($minimum !== undefined && ($exclusiveMinimum === true && instance <= $minimum || instance < $minimum)) {
                errors.push({
                    instanceLocation,
                    keyword: "minimum",
                    keywordLocation: `${schemaLocation}/minimum`,
                    error: `${instance} is less than ${$exclusiveMinimum ? "or equal to " : ""} ${$minimum}.`
                });
            }
            if ($maximum !== undefined && ($exclusiveMaximum === true && instance >= $maximum || instance > $maximum)) {
                errors.push({
                    instanceLocation,
                    keyword: "maximum",
                    keywordLocation: `${schemaLocation}/maximum`,
                    error: `${instance} is greater than ${$exclusiveMaximum ? "or equal to " : ""} ${$maximum}.`
                });
            }
        } else {
            if ($minimum !== undefined && instance < $minimum) {
                errors.push({
                    instanceLocation,
                    keyword: "minimum",
                    keywordLocation: `${schemaLocation}/minimum`,
                    error: `${instance} is less than ${$minimum}.`
                });
            }
            if ($maximum !== undefined && instance > $maximum) {
                errors.push({
                    instanceLocation,
                    keyword: "maximum",
                    keywordLocation: `${schemaLocation}/maximum`,
                    error: `${instance} is greater than ${$maximum}.`
                });
            }
            if ($exclusiveMinimum !== undefined && instance <= $exclusiveMinimum) {
                errors.push({
                    instanceLocation,
                    keyword: "exclusiveMinimum",
                    keywordLocation: `${schemaLocation}/exclusiveMinimum`,
                    error: `${instance} is less than ${$exclusiveMinimum}.`
                });
            }
            if ($exclusiveMaximum !== undefined && instance >= $exclusiveMaximum) {
                errors.push({
                    instanceLocation,
                    keyword: "exclusiveMaximum",
                    keywordLocation: `${schemaLocation}/exclusiveMaximum`,
                    error: `${instance} is greater than or equal to ${$exclusiveMaximum}.`
                });
            }
        }
        if ($multipleOf !== undefined) {
            const remainder = instance % $multipleOf;
            if (Math.abs(0 - remainder) >= 0.00000011920929 && Math.abs($multipleOf - remainder) >= 0.00000011920929) {
                errors.push({
                    instanceLocation,
                    keyword: "multipleOf",
                    keywordLocation: `${schemaLocation}/multipleOf`,
                    error: `${instance} is not a multiple of ${$multipleOf}.`
                });
            }
        }
    } else if (instanceType === "string") {
        const length = $minLength === undefined && $maxLength === undefined ? 0 : ucs2length(instance);
        if ($minLength !== undefined && length < $minLength) {
            errors.push({
                instanceLocation,
                keyword: "minLength",
                keywordLocation: `${schemaLocation}/minLength`,
                error: `String is too short (${length} < ${$minLength}).`
            });
        }
        if ($maxLength !== undefined && length > $maxLength) {
            errors.push({
                instanceLocation,
                keyword: "maxLength",
                keywordLocation: `${schemaLocation}/maxLength`,
                error: `String is too long (${length} > ${$maxLength}).`
            });
        }
        if ($pattern !== undefined && !new RegExp($pattern).test(instance)) {
            errors.push({
                instanceLocation,
                keyword: "pattern",
                keywordLocation: `${schemaLocation}/pattern`,
                error: `String does not match pattern.`
            });
        }
        if ($format !== undefined && fastFormat[$format] && !fastFormat[$format](instance)) {
            errors.push({
                instanceLocation,
                keyword: "format",
                keywordLocation: `${schemaLocation}/format`,
                error: `String does not match format "${$format}".`
            });
        }
    }
    return {
        valid: errors.length === 0,
        errors
    };
}
class Validator {
    constructor(schema, draft = "2019-09", shortCircuit = true){
        this.schema = schema;
        this.draft = draft;
        this.shortCircuit = shortCircuit;
        this.lookup = dereference(schema);
    }
    validate(instance) {
        return validate(instance, this.schema, this.draft, this.lookup, this.shortCircuit);
    }
    addSchema(schema, id) {
        if (id) {
            schema = {
                ...schema,
                $id: id
            };
        }
        dereference(schema, this.lookup);
    }
}
const commandsSchema = {
    "$defs": {
        "filter": {
            type: "object",
            additionalProperties: {
                type: "object",
                oneOf: [
                    {
                        properties: {
                            eq: {
                                type: [
                                    "string",
                                    "number",
                                    "boolean"
                                ]
                            }
                        },
                        required: [
                            "eq"
                        ]
                    },
                    {
                        properties: {
                            neq: {
                                type: [
                                    "string",
                                    "number",
                                    "boolean"
                                ]
                            }
                        },
                        required: [
                            "neq"
                        ]
                    },
                    {
                        properties: {
                            gt: {
                                type: [
                                    "string",
                                    "number",
                                    "boolean"
                                ]
                            }
                        },
                        required: [
                            "gt"
                        ]
                    },
                    {
                        properties: {
                            gte: {
                                type: [
                                    "string",
                                    "number",
                                    "boolean"
                                ]
                            }
                        },
                        required: [
                            "gte"
                        ]
                    },
                    {
                        properties: {
                            lt: {
                                type: [
                                    "string",
                                    "number",
                                    "boolean"
                                ]
                            }
                        },
                        required: [
                            "lt"
                        ]
                    },
                    {
                        properties: {
                            lte: {
                                type: [
                                    "string",
                                    "number",
                                    "boolean"
                                ]
                            }
                        },
                        required: [
                            "lte"
                        ]
                    },
                    {
                        properties: {
                            in: {
                                type: "array",
                                items: {
                                    type: [
                                        "string",
                                        "number",
                                        "boolean"
                                    ]
                                }
                            }
                        },
                        required: [
                            "in"
                        ]
                    },
                    {
                        properties: {
                            nin: {
                                type: "array",
                                items: {
                                    type: [
                                        "string",
                                        "number",
                                        "boolean"
                                    ]
                                }
                            }
                        },
                        required: [
                            "nin"
                        ]
                    }, 
                ]
            }
        }
    },
    type: "object",
    additionalProperties: {
        type: "object",
        required: [
            "cmd"
        ],
        oneOf: [
            {
                properties: {
                    cmd: {
                        const: "fn.call"
                    },
                    ref: {
                        type: "string"
                    }
                },
                required: [
                    "ref"
                ]
            },
            {
                properties: {
                    cmd: {
                        const: "db.get"
                    },
                    ref: {
                        type: "string"
                    }
                },
                required: [
                    "ref"
                ]
            },
            {
                properties: {
                    cmd: {
                        const: "db.create"
                    },
                    ref: {
                        type: "string"
                    },
                    metadata: {
                        type: "object"
                    },
                    data: {
                        type: "object"
                    }
                },
                required: [
                    "ref",
                    "metadata"
                ]
            },
            {
                properties: {
                    cmd: {
                        const: "db.update"
                    },
                    ref: {
                        type: "string"
                    },
                    metadata: {
                        type: "object"
                    },
                    data: {
                        type: "object"
                    }
                },
                required: [
                    "ref",
                    "metadata"
                ]
            },
            {
                properties: {
                    cmd: {
                        const: "db.list"
                    },
                    ref: {
                        type: "string"
                    },
                    filter: {
                        "$ref": "#/$defs/filter"
                    }
                },
                required: [
                    "ref"
                ]
            },
            {
                properties: {
                    cmd: {
                        const: "db.delete"
                    },
                    ref: {
                        type: "string"
                    }
                },
                required: [
                    "ref"
                ]
            },
            {
                properties: {
                    cmd: {
                        const: "kv.get"
                    },
                    key: {
                        type: "string"
                    }
                },
                required: [
                    "key"
                ]
            },
            {
                properties: {
                    cmd: {
                        const: "kv.set"
                    },
                    key: {
                        type: "string"
                    },
                    metadata: {
                        type: "object"
                    },
                    data: {
                        type: [
                            "string",
                            "object"
                        ]
                    }
                },
                required: [
                    "key",
                    "metadata"
                ]
            },
            {
                properties: {
                    cmd: {
                        const: "kv.list"
                    },
                    prefix: {
                        type: "string"
                    },
                    filter: {
                        "$ref": "#/$defs/filter"
                    }
                },
                required: [
                    "prefix"
                ]
            },
            {
                properties: {
                    cmd: {
                        const: "kv.delete"
                    },
                    key: {
                        type: "string"
                    }
                },
                required: [
                    "key"
                ]
            },
            {
                properties: {
                    cmd: {
                        const: "auth.create-anonymous-user"
                    }
                }
            },
            {
                properties: {
                    cmd: {
                        const: "auth.add-sign-with-email-password"
                    },
                    locale: {
                        type: "string"
                    },
                    email: {
                        type: "string"
                    },
                    password: {
                        type: "string"
                    }
                },
                required: [
                    "locale",
                    "email",
                    "password"
                ]
            },
            {
                properties: {
                    cmd: {
                        const: "auth.create-user-with-email-password"
                    },
                    locale: {
                        type: "string"
                    },
                    email: {
                        type: "string"
                    },
                    password: {
                        type: "string"
                    }
                },
                required: [
                    "locale",
                    "email",
                    "password"
                ]
            },
            {
                properties: {
                    cmd: {
                        const: "auth.sign-with-email-password"
                    },
                    email: {
                        type: "string"
                    },
                    password: {
                        type: "string"
                    }
                },
                required: [
                    "email",
                    "password"
                ]
            },
            {
                properties: {
                    cmd: {
                        const: "auth.send-email-validation-code"
                    },
                    locale: {
                        type: "string"
                    },
                    email: {
                        type: "string"
                    }
                },
                required: [
                    "locale",
                    "email"
                ]
            },
            {
                properties: {
                    cmd: {
                        const: "auth.validate-email"
                    },
                    email: {
                        type: "string"
                    },
                    code: {
                        type: "string"
                    }
                },
                required: [
                    "email",
                    "code"
                ]
            },
            {
                properties: {
                    cmd: {
                        const: "auth.send-password-reset-code"
                    },
                    email: {
                        type: "string"
                    },
                    locale: {
                        type: "string"
                    }
                },
                required: [
                    "email",
                    "locale"
                ]
            },
            {
                properties: {
                    cmd: {
                        const: "auth.reset-password"
                    },
                    email: {
                        type: "string"
                    },
                    code: {
                        type: "string"
                    },
                    password: {
                        type: "string"
                    }
                },
                required: [
                    "email",
                    "code",
                    "password"
                ]
            }, 
        ]
    }
};
const validator = new Validator(commandsSchema);
class AuthController {
    data;
    constructor(data){
        this.data = data;
    }
    _getMessageTemplate(type, locale) {
        const templates = this.data.authDescriptor.templates;
        for (const key of [
            locale,
            "en"
        ]){
            if (templates[type].has(key)) {
                return templates[type].get(key);
            }
        }
    }
    async _sendValidationEmailTo(authService, mailService, client, locale, to) {
        const code = autoid(40);
        const tpl = this._getMessageTemplate("validation", locale);
        await authService.setEmailValidationCode(to, code);
        if (tpl) {
            const link = tpl.link + `?code=${code}`;
            await mailService.send({
                to,
                subject: tpl.subject.replace("%APP_NAME%", client.principal).replace("%LINK%", link),
                text: tpl.text.replace("%APP_NAME%", client.principal).replace("%LINK%", link),
                html: (tpl.html && tpl.html.replace("%APP_NAME%", client.principal).replace("%LINK%", link)) ?? undefined
            });
        } else {
            console.error(`Could not find validation template for locale "${locale}". Validation code is "${code}".`);
            this.data.logger.error(`Could not find validation template for locale "${locale}". Validation code is "${code}".`);
        }
    }
    async _createJWTs(context, user) {
        const { algKey , privateKey  } = this.data;
        const access_token = await new SignJWT({
            scope: "*"
        }).setSubject(user.id).setExpirationTime("15min").setIssuer(context.client.principal).setAudience(context.client.principal).setProtectedHeader({
            alg: algKey
        }).sign(privateKey);
        const refresh_token = await new SignJWT({
            scope: "*"
        }).setSubject(user.id).setExpirationTime("1week").setIssuer(context.client.principal).setAudience(context.client.principal).setJti(user.refreshTokenId).setProtectedHeader({
            alg: algKey
        }).sign(privateKey);
        return {
            access_token,
            refresh_token
        };
    }
    async sendValidationEmail(_request, context, locale, email) {
        const user = await context.auth.getUserByEmail(email);
        if (!user.email || user.emailConfirmed) {
            return {
                error: "NotAllowed"
            };
        }
        context.waitUntil(this._sendValidationEmailTo(context.auth, context.mail, context.client, locale, user.email));
        return {
        };
    }
    async validateEmailWithCode(_request, context, email, code) {
        try {
            await context.auth.validateEmailWithCode(email, code);
            return {
            };
        } catch (err) {
            return {
                error: `${err}`
            };
        }
    }
    async sendPasswordResetEmail(_request, context, locale, email) {
        const code = autoid(40);
        const tpl = this._getMessageTemplate("passwordReset", locale);
        await context.auth.setPasswordResetCode(email, code);
        if (tpl) {
            const link = tpl.link + `?code=${code}`;
            context.waitUntil(context.mail.send({
                to: email,
                subject: tpl.subject.replace("%APP_NAME%", context.client.principal).replace("%LINK%", link),
                text: tpl.text.replace("%APP_NAME%", context.client.principal).replace("%LINK%", link),
                html: (tpl.html && tpl.html.replace("%APP_NAME%", context.client.principal).replace("%LINK%", link)) ?? undefined
            }));
        } else {
            console.error(`Could not find password reset template for locale "${locale}". Reset password code is "${code}".`);
            this.data.logger.error(`Could not find password reset template for locale "${locale}". Reset password code is "${code}".`);
        }
        return {
        };
    }
    async _hashPassword(password) {
        const buffer = new TextEncoder().encode(password);
        const hash = await crypto.subtle.digest({
            name: "SHA-512"
        }, buffer);
        return new TextDecoder().decode(hash);
    }
    async resetPasswordWithCode(_request, context, email, code, password) {
        try {
            await context.auth.resetPasswordWithCode(email, code, await this._hashPassword(password));
            return {
            };
        } catch (err) {
            return {
                error: `${err}`
            };
        }
    }
    async createAnonymousUser(_request, context) {
        const { authDescriptor  } = this.data;
        if (!authDescriptor.allowAnonymousUser) {
            return {
                error: "METHOD_NOT_ALLOWED"
            };
        }
        const user = await context.auth.createUser(null, {
        });
        if (authDescriptor.onCreateUser) {
            context.waitUntil(authDescriptor.onCreateUser(context, user));
        }
        return await this._createJWTs(context, user);
    }
    async addSignWithEmailPassword(_request, context, locale, email, password) {
        const { authDescriptor  } = this.data;
        if (!authDescriptor.allowSignMethodPassword) {
            return {
                error: "METHOD_NOT_ALLOWED"
            };
        }
        if (!context.currentUserId) {
            return {
                error: "UNAUTHORIZED"
            };
        }
        const user = await context.auth.getUser(context.currentUserId);
        if (!user.email) {
            await context.auth.updateUser(user.id, {
            }, email, undefined);
            user.email = email;
        }
        await context.auth.addSignInMethodPassword(user.id, user.email, await this._hashPassword(password));
        context.waitUntil(this._sendValidationEmailTo(context.auth, context.mail, context.client, locale, email));
        if (authDescriptor.onUpdateUser) {
            context.waitUntil(authDescriptor.onUpdateUser(context, user));
        }
        return {
        };
    }
    async createUserWithEmail(_request, context, locale, email, password) {
        try {
            await context.auth.getUserByEmail(email);
            return {
            };
        } catch (_err) {
            const user = await context.auth.createUser(email, {
            });
            await context.auth.addSignInMethodPassword(user.id, email, await this._hashPassword(password));
            context.waitUntil(this._sendValidationEmailTo(context.auth, context.mail, context.client, locale, email));
            const { authDescriptor  } = this.data;
            if (authDescriptor.onCreateUser) {
                context.waitUntil(authDescriptor.onCreateUser(context, user));
            }
            return {
            };
        }
    }
    async signWithEmailPassword(_request, context, email, password) {
        const { authDescriptor  } = this.data;
        if (!authDescriptor.allowSignMethodPassword) {
            return {
                error: "NotAllowed"
            };
        }
        try {
            const passwordHash = await this._hashPassword(password);
            const user = await context.auth.signInWithEmailPassword(email, passwordHash);
            if (!user.emailConfirmed) {
                return {
                    error: "AuthEmailNotConfirmed"
                };
            }
            return await this._createJWTs(context, user);
        } catch (_err) {
            return {
                error: "NotAllowed"
            };
        }
    }
}
class Document1 {
    reference;
    metadata;
    _data;
    constructor(reference, metadata, _data){
        this.reference = reference;
        this.metadata = metadata;
        this._data = _data;
    }
    async data() {
        return this._data;
    }
}
class DatabaseController {
    data;
    constructor(data){
        this.data = data;
    }
    _findCollectionDescriptor(ref) {
        const collections = this.data.databaseDescriptor.collections;
        for (const desc of collections){
            const match = ref.match(desc.matcher);
            if (match) {
                return [
                    desc,
                    match.groups ?? {
                    }
                ];
            }
        }
        return undefined;
    }
    _findDocumentDescriptor(ref) {
        const documents = this.data.databaseDescriptor.documents;
        for (const desc of documents){
            const match = ref.match(desc.matcher);
            if (match) {
                return [
                    desc,
                    match.groups ?? {
                    }
                ];
            }
        }
        return undefined;
    }
    async _getPermission(context, params, handler) {
        if (typeof handler === "function") {
            return await handler(context, params);
        } else {
            return handler ?? DatabasePermissions.None;
        }
    }
    _testPermission(flag, permission) {
        return (flag & permission) > 0;
    }
    async get(_request, context, reference) {
        const result = this._findDocumentDescriptor(reference.toString());
        if (result) {
            const [desc, params] = result;
            const permission = await this._getPermission(context, params ?? {
            }, desc.permission);
            if ((permission & DatabasePermissions.Get) > 0) {
                try {
                    const doc11 = await context.database.get(reference);
                    return {
                        metadata: doc11.metadata,
                        data: await doc11.data()
                    };
                } catch (err) {
                    return {
                        error: `${err}`
                    };
                }
            }
        }
        return {
            error: "DocumentNotFound"
        };
    }
    async create(_request, context, reference, metadata, data) {
        const result = this._findCollectionDescriptor(reference.collection.toString());
        if (result) {
            const [desc, params] = result;
            const flag = await this._getPermission(context, params ?? {
            }, desc.permission);
            if (this._testPermission(flag, DatabasePermissions.Create)) {
                try {
                    await context.database.create(reference, metadata, data);
                    if (desc.onCreate) {
                        const doc12 = new Document1(reference, metadata, data ?? {
                        });
                        await desc.onCreate(context, doc12, params);
                    }
                    return {
                    };
                } catch (err) {
                    return {
                        error: `${err}`
                    };
                }
            }
        }
        return {
            error: "DocumentNotFound"
        };
    }
    async update(_request, context, reference, metadata, data) {
        const result = this._findDocumentDescriptor(reference.toString());
        if (result) {
            const [desc, params] = result;
            const flag = await this._getPermission(context, params ?? {
            }, desc.permission);
            if (this._testPermission(flag, DatabasePermissions.Update)) {
                try {
                    if (desc.onUpdate) {
                        const before = await context.database.get(reference);
                        await context.database.update(reference, metadata, data);
                        const after = new Document1(reference, metadata, data ?? {
                        });
                        await desc.onUpdate(context, {
                            before,
                            after
                        }, params);
                    } else {
                        await context.database.update(reference, metadata, data);
                    }
                    return {
                    };
                } catch (err) {
                    return {
                        error: `${err}`
                    };
                }
            }
        }
        return {
            error: "DocumentNotFound"
        };
    }
    async list(_request, context, reference, filter) {
        const result = this._findCollectionDescriptor(reference.toString());
        if (result) {
            const [desc, params] = result;
            const flag = await this._getPermission(context, params, desc.permission);
            if (this._testPermission(flag, DatabasePermissions.List)) {
                try {
                    const docs = await context.database.list(reference, filter);
                    const docsWithData = await Promise.all(docs.map(async (doc13)=>({
                            ref: doc13.reference.toString(),
                            metadata: doc13.metadata,
                            data: await doc13.data()
                        })
                    ));
                    return {
                        docs: docsWithData
                    };
                } catch (err) {
                    return {
                        error: `${err}`
                    };
                }
            }
        }
        return {
            error: "CollectionNotFound"
        };
    }
    async delete(_request, context, reference) {
        const result = this._findDocumentDescriptor(reference.toString());
        if (result) {
            const [desc, params] = result;
            const flag = await this._getPermission(context, params, desc.permission);
            if (this._testPermission(flag, DatabasePermissions.Delete)) {
                try {
                    if (desc.onDelete) {
                        const doc14 = await context.database.get(reference);
                        await context.database.delete(reference);
                        await desc.onDelete(context, doc14, params);
                    } else {
                        await context.database.delete(reference);
                    }
                    return {
                    };
                } catch (err) {
                    return {
                        error: `${err}`
                    };
                }
            }
        }
        return {
            error: "DocumentNotFound"
        };
    }
}
class Server {
    data;
    authController;
    databaseController;
    constructor(init){
        this.data = {
            ...init,
            authService: init.authProvider ? new AuthService(init.authProvider) : new NoopAuthService(),
            kvService: init.kvProvider ? new KVService(init.kvProvider) : new NoopKVService(),
            databaseService: init.databaseProvider ? new DatabaseService(init.databaseProvider) : new NoopDatabaseService(),
            mailService: init.mailProvider ? new MailService(init.mailDescriptor, init.mailProvider) : new NoopMailService(),
            functionsMap: new Map(init.functionsDescriptor.https.filter((http)=>http.onCall
            ).map((http)=>[
                    http.path,
                    http.onCall
                ]
            )),
            logger: getLogger("baseless_server")
        };
        this.authController = new AuthController(this.data);
        this.databaseController = new DatabaseController(this.data);
    }
    async handle(request) {
        const { logger , clientsDescriptor , databaseService , publicKey , authService , kvService , mailService ,  } = this.data;
        if (!request.headers.has("X-BASELESS-CLIENT-ID")) {
            return [
                new Response(null, {
                    status: 401
                }),
                []
            ];
        }
        const client_id = request.headers.get("X-BASELESS-CLIENT-ID") ?? "";
        const client = clientsDescriptor.find((c)=>c.id === client_id
        );
        if (!client) {
            return [
                new Response(null, {
                    status: 401
                }),
                []
            ];
        }
        const dbService = new CachableDatabaseService(databaseService);
        let currentUserId;
        if (request.headers.get("Authorization")) {
            const authorization = request.headers.get("Authorization") ?? "";
            const match = authorization.match(/(?<scheme>[^ ]+) (?<params>.+)/);
            if (match) {
                const scheme = match.groups?.scheme.toLowerCase() ?? "";
                const params = match.groups?.params ?? "";
                if (scheme === "bearer") {
                    try {
                        const { payload  } = await jwtVerify(params, publicKey, {
                            issuer: client.principal,
                            audience: client.principal
                        });
                        currentUserId = payload.sub ?? "";
                    } catch (err) {
                        logger.error(`Could not parse Authorization header, got error : ${err}`);
                    }
                }
            }
        }
        const waitUntilCollection = [];
        const context = {
            client,
            currentUserId,
            auth: authService,
            kv: kvService,
            database: dbService,
            mail: mailService,
            waitUntil (promise) {
                waitUntilCollection.push(promise);
            }
        };
        let commands;
        const url = new URL(request.url);
        logger.info(`${request.method} ${url.pathname}`);
        if (url.pathname.length > 1) {
            const fnName = url.pathname.substring(1);
            if (this.data.functionsMap.has(fnName)) {
                try {
                    const onCall = this.data.functionsMap.get(fnName);
                    const response = await onCall(request, context);
                    return [
                        response,
                        waitUntilCollection
                    ];
                } catch (_err) {
                    return [
                        new Response(null, {
                            status: 500
                        }),
                        waitUntilCollection
                    ];
                }
            }
            return [
                new Response(null, {
                    status: 405
                }),
                waitUntilCollection
            ];
        }
        switch(request.headers.get("Content-Type")?.toLocaleLowerCase()){
            case "application/json":
                {
                    let body = "";
                    if (request.body) {
                        const buffer = await new Response(request.body).arrayBuffer();
                        body = new TextDecoder().decode(buffer);
                    }
                    try {
                        commands = JSON.parse(body);
                    } catch (err) {
                        logger.error(`Could not parse JSON body, got error : ${err}`);
                        return [
                            new Response(null, {
                                status: 400
                            }),
                            waitUntilCollection
                        ];
                    }
                    const result = validator.validate(commands);
                    if (!result.valid) {
                        logger.error(`JSON body did not validate againts schema, got error : ${result.errors}`);
                        return [
                            new Response(JSON.stringify(result.errors), {
                                status: 400
                            }),
                            waitUntilCollection, 
                        ];
                    }
                    break;
                }
        }
        if (!commands) {
            return [
                new Response(null, {
                    status: 400
                }),
                waitUntilCollection, 
            ];
        }
        const promises = Object.entries(commands).map(([key, cmd])=>{
            switch(cmd.cmd){
                case "auth.create-anonymous-user":
                    return this.authController.createAnonymousUser(request, context).then((res)=>[
                            key,
                            res
                        ]
                    );
                case "auth.add-sign-with-email-password":
                    return this.authController.addSignWithEmailPassword(request, context, cmd.locale, cmd.email, cmd.password).then((res)=>[
                            key,
                            res
                        ]
                    );
                case "auth.create-user-with-email-password":
                    return this.authController.createUserWithEmail(request, context, cmd.locale, cmd.email, cmd.password).then((res)=>[
                            key,
                            res
                        ]
                    );
                case "auth.send-email-validation-code":
                    return this.authController.sendValidationEmail(request, context, cmd.locale, cmd.email).then((res)=>[
                            key,
                            res
                        ]
                    );
                case "auth.validate-email":
                    return this.authController.validateEmailWithCode(request, context, cmd.email, cmd.code).then((res)=>[
                            key,
                            res
                        ]
                    );
                case "auth.send-password-reset-code":
                    return this.authController.sendPasswordResetEmail(request, context, cmd.locale, cmd.email).then((res)=>[
                            key,
                            res
                        ]
                    );
                case "auth.reset-password":
                    return this.authController.resetPasswordWithCode(request, context, cmd.email, cmd.code, cmd.password).then((res)=>[
                            key,
                            res
                        ]
                    );
                case "auth.sign-with-email-password":
                    return this.authController.signWithEmailPassword(request, context, cmd.email, cmd.password).then((res)=>[
                            key,
                            res
                        ]
                    );
                case "db.get":
                    return this.databaseController.get(request, context, doc(cmd.ref)).then((res)=>[
                            key,
                            res
                        ]
                    );
                case "db.list":
                    return this.databaseController.list(request, context, collection1(cmd.ref), cmd.filter).then((res)=>[
                            key,
                            res
                        ]
                    );
                case "db.create":
                    return this.databaseController.create(request, context, doc(cmd.ref), cmd.metadata, cmd.data).then((res)=>[
                            key,
                            res
                        ]
                    );
                case "db.update":
                    return this.databaseController.update(request, context, doc(cmd.ref), cmd.metadata, cmd.data).then((res)=>[
                            key,
                            res
                        ]
                    );
                case "db.delete":
                    return this.databaseController.delete(request, context, doc(cmd.ref)).then((res)=>[
                            key,
                            res
                        ]
                    );
                default:
                    return Promise.resolve([
                        key,
                        {
                            error: "METHOD_NOT_ALLOWED"
                        }
                    ]);
            }
        });
        const responses = await Promise.all(promises);
        const results1 = responses.reduce((results, [key, res])=>{
            results[key] = res;
            return results;
        }, {
        });
        return [
            new Response(JSON.stringify(results1), {
                status: 200
            }),
            waitUntilCollection, 
        ];
    }
}
auth.allowAnonymousUser(true).allowSignMethodPassword(true);
clients1.register("Hello World", "http://localhost:8080/", "hello-world", "secret");
functions.http("hello-world").onCall(async ()=>{
    return new Response("Hello World!");
});
await setup({
    handlers: {
        console: new handlers1.ConsoleHandler("DEBUG")
    },
    loggers: {
        default: {
            level: "DEBUG",
            handlers: [
                "console"
            ]
        },
        baseless_server: {
            level: "DEBUG",
            handlers: [
                "console"
            ]
        },
        baseless_mail_logger: {
            level: "DEBUG",
            handlers: [
                "console"
            ]
        }
    }
});
let server;
const __default6 = {
    async fetch (request, env, ctx) {
        if (!server) {
            const { publicKey , privateKey  } = await generateKeyPair1("ES256");
            const kvProvider = new CloudflareKVProvider(env.BASELESS_KV);
            const kvBackendAuth = new CloudflareKVProvider(env.BASELESS_AUTH);
            const kvBackendDb = new CloudflareKVProvider(env.BASELESS_DB);
            const authProvider = new AuthOnKvProvider(kvBackendAuth);
            const databaseProvider = new DatabaseOnKvProvider(kvBackendDb);
            const mailProvider = new MailLoggerProvider();
            server = new Server({
                clientsDescriptor: clients1.build(),
                authDescriptor: auth.build(),
                databaseDescriptor: database.build(),
                functionsDescriptor: functions.build(),
                mailDescriptor: mail.build(),
                authProvider,
                kvProvider,
                databaseProvider,
                mailProvider,
                algKey: "ES256",
                publicKey,
                privateKey
            });
        }
        const url = new URL(request.url);
        console.log("Blep!");
        try {
            const segments = url.pathname.replace(/(^\/|\/$)/, "").split("/");
            switch(segments[0]){
                case "obase":
                    {
                        url.pathname = "/" + segments.splice(1).join("/");
                        const req = new Request(url.toString(), request);
                        const [response, waitUntil] = await server.handle(req);
                        for (const p of waitUntil){
                            ctx.waitUntil(p);
                        }
                        return response;
                    }
            }
            return new Response(null, {
                status: 404
            });
        } catch (err) {
            return new Response(JSON.stringify(err), {
                status: 500
            });
        }
    }
};
export { __default6 as default };
