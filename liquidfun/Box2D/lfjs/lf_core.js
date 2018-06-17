var Module = typeof Module !== "undefined" ? Module : {};
var moduleOverrides = {};
var key;
for (key in Module) {
 if (Module.hasOwnProperty(key)) {
  moduleOverrides[key] = Module[key];
 }
}
Module["arguments"] = [];
Module["thisProgram"] = "./this.program";
Module["quit"] = (function(status, toThrow) {
 throw toThrow;
});
Module["preRun"] = [];
Module["postRun"] = [];
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;
if (Module["ENVIRONMENT"]) {
 if (Module["ENVIRONMENT"] === "WEB") {
  ENVIRONMENT_IS_WEB = true;
 } else if (Module["ENVIRONMENT"] === "WORKER") {
  ENVIRONMENT_IS_WORKER = true;
 } else if (Module["ENVIRONMENT"] === "NODE") {
  ENVIRONMENT_IS_NODE = true;
 } else if (Module["ENVIRONMENT"] === "SHELL") {
  ENVIRONMENT_IS_SHELL = true;
 } else {
  throw new Error("Module['ENVIRONMENT'] value is not valid. must be one of: WEB|WORKER|NODE|SHELL.");
 }
} else {
 ENVIRONMENT_IS_WEB = typeof window === "object";
 ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
 ENVIRONMENT_IS_NODE = typeof process === "object" && typeof require === "function" && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
 ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
}
if (ENVIRONMENT_IS_NODE) {
 var nodeFS;
 var nodePath;
 Module["read"] = function shell_read(filename, binary) {
  var ret;
  if (!nodeFS) nodeFS = require("fs");
  if (!nodePath) nodePath = require("path");
  filename = nodePath["normalize"](filename);
  ret = nodeFS["readFileSync"](filename);
  return binary ? ret : ret.toString();
 };
 Module["readBinary"] = function readBinary(filename) {
  var ret = Module["read"](filename, true);
  if (!ret.buffer) {
   ret = new Uint8Array(ret);
  }
  assert(ret.buffer);
  return ret;
 };
 if (process["argv"].length > 1) {
  Module["thisProgram"] = process["argv"][1].replace(/\\/g, "/");
 }
 Module["arguments"] = process["argv"].slice(2);
 if (typeof module !== "undefined") {
  module["exports"] = Module;
 }
 process["on"]("uncaughtException", (function(ex) {
  if (!(ex instanceof ExitStatus)) {
   throw ex;
  }
 }));
 process["on"]("unhandledRejection", (function(reason, p) {
  process["exit"](1);
 }));
 Module["inspect"] = (function() {
  return "[Emscripten Module object]";
 });
} else if (ENVIRONMENT_IS_SHELL) {
 if (typeof read != "undefined") {
  Module["read"] = function shell_read(f) {
   return read(f);
  };
 }
 Module["readBinary"] = function readBinary(f) {
  var data;
  if (typeof readbuffer === "function") {
   return new Uint8Array(readbuffer(f));
  }
  data = read(f, "binary");
  assert(typeof data === "object");
  return data;
 };
 if (typeof scriptArgs != "undefined") {
  Module["arguments"] = scriptArgs;
 } else if (typeof arguments != "undefined") {
  Module["arguments"] = arguments;
 }
 if (typeof quit === "function") {
  Module["quit"] = (function(status, toThrow) {
   quit(status);
  });
 }
} else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
 Module["read"] = function shell_read(url) {
  var xhr = new XMLHttpRequest;
  xhr.open("GET", url, false);
  xhr.send(null);
  return xhr.responseText;
 };
 if (ENVIRONMENT_IS_WORKER) {
  Module["readBinary"] = function readBinary(url) {
   var xhr = new XMLHttpRequest;
   xhr.open("GET", url, false);
   xhr.responseType = "arraybuffer";
   xhr.send(null);
   return new Uint8Array(xhr.response);
  };
 }
 Module["readAsync"] = function readAsync(url, onload, onerror) {
  var xhr = new XMLHttpRequest;
  xhr.open("GET", url, true);
  xhr.responseType = "arraybuffer";
  xhr.onload = function xhr_onload() {
   if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
    onload(xhr.response);
    return;
   }
   onerror();
  };
  xhr.onerror = onerror;
  xhr.send(null);
 };
 Module["setWindowTitle"] = (function(title) {
  document.title = title;
 });
} else {
 throw new Error("not compiled for this environment");
}
Module["print"] = typeof console !== "undefined" ? console.log.bind(console) : typeof print !== "undefined" ? print : null;
Module["printErr"] = typeof printErr !== "undefined" ? printErr : typeof console !== "undefined" && console.warn.bind(console) || Module["print"];
Module.print = Module["print"];
Module.printErr = Module["printErr"];
for (key in moduleOverrides) {
 if (moduleOverrides.hasOwnProperty(key)) {
  Module[key] = moduleOverrides[key];
 }
}
moduleOverrides = undefined;
var STACK_ALIGN = 16;
function staticAlloc(size) {
 assert(!staticSealed);
 var ret = STATICTOP;
 STATICTOP = STATICTOP + size + 15 & -16;
 return ret;
}
function dynamicAlloc(size) {
 assert(DYNAMICTOP_PTR);
 var ret = HEAP32[DYNAMICTOP_PTR >> 2];
 var end = ret + size + 15 & -16;
 HEAP32[DYNAMICTOP_PTR >> 2] = end;
 if (end >= TOTAL_MEMORY) {
  var success = enlargeMemory();
  if (!success) {
   HEAP32[DYNAMICTOP_PTR >> 2] = ret;
   return 0;
  }
 }
 return ret;
}
function alignMemory(size, factor) {
 if (!factor) factor = STACK_ALIGN;
 var ret = size = Math.ceil(size / factor) * factor;
 return ret;
}
function getNativeTypeSize(type) {
 switch (type) {
 case "i1":
 case "i8":
  return 1;
 case "i16":
  return 2;
 case "i32":
  return 4;
 case "i64":
  return 8;
 case "float":
  return 4;
 case "double":
  return 8;
 default:
  {
   if (type[type.length - 1] === "*") {
    return 4;
   } else if (type[0] === "i") {
    var bits = parseInt(type.substr(1));
    assert(bits % 8 === 0);
    return bits / 8;
   } else {
    return 0;
   }
  }
 }
}
function warnOnce(text) {
 if (!warnOnce.shown) warnOnce.shown = {};
 if (!warnOnce.shown[text]) {
  warnOnce.shown[text] = 1;
  Module.printErr(text);
 }
}
var asm2wasmImports = {
 "f64-rem": (function(x, y) {
  return x % y;
 }),
 "debugger": (function() {
  debugger;
 })
};
var jsCallStartIndex = 1;
var functionPointers = new Array(0);
var funcWrappers = {};
function dynCall(sig, ptr, args) {
 if (args && args.length) {
  return Module["dynCall_" + sig].apply(null, [ ptr ].concat(args));
 } else {
  return Module["dynCall_" + sig].call(null, ptr);
 }
}
var GLOBAL_BASE = 1024;
var ABORT = 0;
var EXITSTATUS = 0;
function assert(condition, text) {
 if (!condition) {
  abort("Assertion failed: " + text);
 }
}
function getCFunc(ident) {
 var func = Module["_" + ident];
 assert(func, "Cannot call unknown function " + ident + ", make sure it is exported");
 return func;
}
var JSfuncs = {
 "stackSave": (function() {
  stackSave();
 }),
 "stackRestore": (function() {
  stackRestore();
 }),
 "arrayToC": (function(arr) {
  var ret = stackAlloc(arr.length);
  writeArrayToMemory(arr, ret);
  return ret;
 }),
 "stringToC": (function(str) {
  var ret = 0;
  if (str !== null && str !== undefined && str !== 0) {
   var len = (str.length << 2) + 1;
   ret = stackAlloc(len);
   stringToUTF8(str, ret, len);
  }
  return ret;
 })
};
var toC = {
 "string": JSfuncs["stringToC"],
 "array": JSfuncs["arrayToC"]
};
function ccall(ident, returnType, argTypes, args, opts) {
 var func = getCFunc(ident);
 var cArgs = [];
 var stack = 0;
 if (args) {
  for (var i = 0; i < args.length; i++) {
   var converter = toC[argTypes[i]];
   if (converter) {
    if (stack === 0) stack = stackSave();
    cArgs[i] = converter(args[i]);
   } else {
    cArgs[i] = args[i];
   }
  }
 }
 var ret = func.apply(null, cArgs);
 if (returnType === "string") ret = Pointer_stringify(ret); else if (returnType === "boolean") ret = Boolean(ret);
 if (stack !== 0) {
  stackRestore(stack);
 }
 return ret;
}
function cwrap(ident, returnType, argTypes) {
 argTypes = argTypes || [];
 var cfunc = getCFunc(ident);
 var numericArgs = argTypes.every((function(type) {
  return type === "number";
 }));
 var numericRet = returnType !== "string";
 if (numericRet && numericArgs) {
  return cfunc;
 }
 return (function() {
  return ccall(ident, returnType, argTypes, arguments);
 });
}
function setValue(ptr, value, type, noSafe) {
 type = type || "i8";
 if (type.charAt(type.length - 1) === "*") type = "i32";
 switch (type) {
 case "i1":
  HEAP8[ptr >> 0] = value;
  break;
 case "i8":
  HEAP8[ptr >> 0] = value;
  break;
 case "i16":
  HEAP16[ptr >> 1] = value;
  break;
 case "i32":
  HEAP32[ptr >> 2] = value;
  break;
 case "i64":
  tempI64 = [ value >>> 0, (tempDouble = value, +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0) ], HEAP32[ptr >> 2] = tempI64[0], HEAP32[ptr + 4 >> 2] = tempI64[1];
  break;
 case "float":
  HEAPF32[ptr >> 2] = value;
  break;
 case "double":
  HEAPF64[ptr >> 3] = value;
  break;
 default:
  abort("invalid type for setValue: " + type);
 }
}
var ALLOC_STATIC = 2;
var ALLOC_NONE = 4;
function Pointer_stringify(ptr, length) {
 if (length === 0 || !ptr) return "";
 var hasUtf = 0;
 var t;
 var i = 0;
 while (1) {
  t = HEAPU8[ptr + i >> 0];
  hasUtf |= t;
  if (t == 0 && !length) break;
  i++;
  if (length && i == length) break;
 }
 if (!length) length = i;
 var ret = "";
 if (hasUtf < 128) {
  var MAX_CHUNK = 1024;
  var curr;
  while (length > 0) {
   curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
   ret = ret ? ret + curr : curr;
   ptr += MAX_CHUNK;
   length -= MAX_CHUNK;
  }
  return ret;
 }
 return UTF8ToString(ptr);
}
var UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;
function UTF8ArrayToString(u8Array, idx) {
 var endPtr = idx;
 while (u8Array[endPtr]) ++endPtr;
 if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
  return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
 } else {
  var u0, u1, u2, u3, u4, u5;
  var str = "";
  while (1) {
   u0 = u8Array[idx++];
   if (!u0) return str;
   if (!(u0 & 128)) {
    str += String.fromCharCode(u0);
    continue;
   }
   u1 = u8Array[idx++] & 63;
   if ((u0 & 224) == 192) {
    str += String.fromCharCode((u0 & 31) << 6 | u1);
    continue;
   }
   u2 = u8Array[idx++] & 63;
   if ((u0 & 240) == 224) {
    u0 = (u0 & 15) << 12 | u1 << 6 | u2;
   } else {
    u3 = u8Array[idx++] & 63;
    if ((u0 & 248) == 240) {
     u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | u3;
    } else {
     u4 = u8Array[idx++] & 63;
     if ((u0 & 252) == 248) {
      u0 = (u0 & 3) << 24 | u1 << 18 | u2 << 12 | u3 << 6 | u4;
     } else {
      u5 = u8Array[idx++] & 63;
      u0 = (u0 & 1) << 30 | u1 << 24 | u2 << 18 | u3 << 12 | u4 << 6 | u5;
     }
    }
   }
   if (u0 < 65536) {
    str += String.fromCharCode(u0);
   } else {
    var ch = u0 - 65536;
    str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
   }
  }
 }
}
function UTF8ToString(ptr) {
 return UTF8ArrayToString(HEAPU8, ptr);
}
function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
 if (!(maxBytesToWrite > 0)) return 0;
 var startIdx = outIdx;
 var endIdx = outIdx + maxBytesToWrite - 1;
 for (var i = 0; i < str.length; ++i) {
  var u = str.charCodeAt(i);
  if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
  if (u <= 127) {
   if (outIdx >= endIdx) break;
   outU8Array[outIdx++] = u;
  } else if (u <= 2047) {
   if (outIdx + 1 >= endIdx) break;
   outU8Array[outIdx++] = 192 | u >> 6;
   outU8Array[outIdx++] = 128 | u & 63;
  } else if (u <= 65535) {
   if (outIdx + 2 >= endIdx) break;
   outU8Array[outIdx++] = 224 | u >> 12;
   outU8Array[outIdx++] = 128 | u >> 6 & 63;
   outU8Array[outIdx++] = 128 | u & 63;
  } else if (u <= 2097151) {
   if (outIdx + 3 >= endIdx) break;
   outU8Array[outIdx++] = 240 | u >> 18;
   outU8Array[outIdx++] = 128 | u >> 12 & 63;
   outU8Array[outIdx++] = 128 | u >> 6 & 63;
   outU8Array[outIdx++] = 128 | u & 63;
  } else if (u <= 67108863) {
   if (outIdx + 4 >= endIdx) break;
   outU8Array[outIdx++] = 248 | u >> 24;
   outU8Array[outIdx++] = 128 | u >> 18 & 63;
   outU8Array[outIdx++] = 128 | u >> 12 & 63;
   outU8Array[outIdx++] = 128 | u >> 6 & 63;
   outU8Array[outIdx++] = 128 | u & 63;
  } else {
   if (outIdx + 5 >= endIdx) break;
   outU8Array[outIdx++] = 252 | u >> 30;
   outU8Array[outIdx++] = 128 | u >> 24 & 63;
   outU8Array[outIdx++] = 128 | u >> 18 & 63;
   outU8Array[outIdx++] = 128 | u >> 12 & 63;
   outU8Array[outIdx++] = 128 | u >> 6 & 63;
   outU8Array[outIdx++] = 128 | u & 63;
  }
 }
 outU8Array[outIdx] = 0;
 return outIdx - startIdx;
}
function stringToUTF8(str, outPtr, maxBytesToWrite) {
 return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
}
function lengthBytesUTF8(str) {
 var len = 0;
 for (var i = 0; i < str.length; ++i) {
  var u = str.charCodeAt(i);
  if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
  if (u <= 127) {
   ++len;
  } else if (u <= 2047) {
   len += 2;
  } else if (u <= 65535) {
   len += 3;
  } else if (u <= 2097151) {
   len += 4;
  } else if (u <= 67108863) {
   len += 5;
  } else {
   len += 6;
  }
 }
 return len;
}
var UTF16Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-16le") : undefined;
function demangle(func) {
 return func;
}
function demangleAll(text) {
 var regex = /__Z[\w\d_]+/g;
 return text.replace(regex, (function(x) {
  var y = demangle(x);
  return x === y ? x : x + " [" + y + "]";
 }));
}
function jsStackTrace() {
 var err = new Error;
 if (!err.stack) {
  try {
   throw new Error(0);
  } catch (e) {
   err = e;
  }
  if (!err.stack) {
   return "(no stack trace available)";
  }
 }
 return err.stack.toString();
}
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;
function alignUp(x, multiple) {
 if (x % multiple > 0) {
  x += multiple - x % multiple;
 }
 return x;
}
var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
function updateGlobalBuffer(buf) {
 Module["buffer"] = buffer = buf;
}
function updateGlobalBufferViews() {
 Module["HEAP8"] = HEAP8 = new Int8Array(buffer);
 Module["HEAP16"] = HEAP16 = new Int16Array(buffer);
 Module["HEAP32"] = HEAP32 = new Int32Array(buffer);
 Module["HEAPU8"] = HEAPU8 = new Uint8Array(buffer);
 Module["HEAPU16"] = HEAPU16 = new Uint16Array(buffer);
 Module["HEAPU32"] = HEAPU32 = new Uint32Array(buffer);
 Module["HEAPF32"] = HEAPF32 = new Float32Array(buffer);
 Module["HEAPF64"] = HEAPF64 = new Float64Array(buffer);
}
var STATIC_BASE, STATICTOP, staticSealed;
var STACK_BASE, STACKTOP, STACK_MAX;
var DYNAMIC_BASE, DYNAMICTOP_PTR;
STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
staticSealed = false;
function abortOnCannotGrowMemory() {
 abort("Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value " + TOTAL_MEMORY + ", (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ");
}
function enlargeMemory() {
 abortOnCannotGrowMemory();
}
var TOTAL_STACK = Module["TOTAL_STACK"] || 5242880;
var TOTAL_MEMORY = Module["TOTAL_MEMORY"] || 33554432;
if (TOTAL_MEMORY < TOTAL_STACK) Module.printErr("TOTAL_MEMORY should be larger than TOTAL_STACK, was " + TOTAL_MEMORY + "! (TOTAL_STACK=" + TOTAL_STACK + ")");
if (Module["buffer"]) {
 buffer = Module["buffer"];
} else {
 if (typeof WebAssembly === "object" && typeof WebAssembly.Memory === "function") {
  Module["wasmMemory"] = new WebAssembly.Memory({
   "initial": TOTAL_MEMORY / WASM_PAGE_SIZE,
   "maximum": TOTAL_MEMORY / WASM_PAGE_SIZE
  });
  buffer = Module["wasmMemory"].buffer;
 } else {
  buffer = new ArrayBuffer(TOTAL_MEMORY);
 }
 Module["buffer"] = buffer;
}
updateGlobalBufferViews();
function getTotalMemory() {
 return TOTAL_MEMORY;
}
HEAP32[0] = 1668509029;
HEAP16[1] = 25459;
if (HEAPU8[2] !== 115 || HEAPU8[3] !== 99) throw "Runtime error: expected the system to be little-endian!";
function callRuntimeCallbacks(callbacks) {
 while (callbacks.length > 0) {
  var callback = callbacks.shift();
  if (typeof callback == "function") {
   callback();
   continue;
  }
  var func = callback.func;
  if (typeof func === "number") {
   if (callback.arg === undefined) {
    Module["dynCall_v"](func);
   } else {
    Module["dynCall_vi"](func, callback.arg);
   }
  } else {
   func(callback.arg === undefined ? null : callback.arg);
  }
 }
}
var __ATPRERUN__ = [];
var __ATINIT__ = [];
var __ATMAIN__ = [];
var __ATEXIT__ = [];
var __ATPOSTRUN__ = [];
var runtimeInitialized = false;
var runtimeExited = false;
function preRun() {
 if (Module["preRun"]) {
  if (typeof Module["preRun"] == "function") Module["preRun"] = [ Module["preRun"] ];
  while (Module["preRun"].length) {
   addOnPreRun(Module["preRun"].shift());
  }
 }
 callRuntimeCallbacks(__ATPRERUN__);
}
function ensureInitRuntime() {
 if (runtimeInitialized) return;
 runtimeInitialized = true;
 callRuntimeCallbacks(__ATINIT__);
}
function preMain() {
 callRuntimeCallbacks(__ATMAIN__);
}
function exitRuntime() {
 callRuntimeCallbacks(__ATEXIT__);
 runtimeExited = true;
}
function postRun() {
 if (Module["postRun"]) {
  if (typeof Module["postRun"] == "function") Module["postRun"] = [ Module["postRun"] ];
  while (Module["postRun"].length) {
   addOnPostRun(Module["postRun"].shift());
  }
 }
 callRuntimeCallbacks(__ATPOSTRUN__);
}
function addOnPreRun(cb) {
 __ATPRERUN__.unshift(cb);
}
function addOnPostRun(cb) {
 __ATPOSTRUN__.unshift(cb);
}
function writeArrayToMemory(array, buffer) {
 HEAP8.set(array, buffer);
}
function writeAsciiToMemory(str, buffer, dontAddNull) {
 for (var i = 0; i < str.length; ++i) {
  HEAP8[buffer++ >> 0] = str.charCodeAt(i);
 }
 if (!dontAddNull) HEAP8[buffer >> 0] = 0;
}
var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_max = Math.max;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null;
function addRunDependency(id) {
 runDependencies++;
 if (Module["monitorRunDependencies"]) {
  Module["monitorRunDependencies"](runDependencies);
 }
}
function removeRunDependency(id) {
 runDependencies--;
 if (Module["monitorRunDependencies"]) {
  Module["monitorRunDependencies"](runDependencies);
 }
 if (runDependencies == 0) {
  if (runDependencyWatcher !== null) {
   clearInterval(runDependencyWatcher);
   runDependencyWatcher = null;
  }
  if (dependenciesFulfilled) {
   var callback = dependenciesFulfilled;
   dependenciesFulfilled = null;
   callback();
  }
 }
}
Module["preloadedImages"] = {};
Module["preloadedAudios"] = {};
var dataURIPrefix = "data:application/octet-stream;base64,";
function isDataURI(filename) {
 return String.prototype.startsWith ? filename.startsWith(dataURIPrefix) : filename.indexOf(dataURIPrefix) === 0;
}
function integrateWasmJS() {
 var wasmTextFile = "lf_core.wast";
 var wasmBinaryFile = "lf_core.wasm";
 var asmjsCodeFile = "lf_core.temp.asm.js";
 if (typeof Module["locateFile"] === "function") {
  if (!isDataURI(wasmTextFile)) {
   wasmTextFile = Module["locateFile"](wasmTextFile);
  }
  if (!isDataURI(wasmBinaryFile)) {
   wasmBinaryFile = Module["locateFile"](wasmBinaryFile);
  }
  if (!isDataURI(asmjsCodeFile)) {
   asmjsCodeFile = Module["locateFile"](asmjsCodeFile);
  }
 }
 var wasmPageSize = 64 * 1024;
 var info = {
  "global": null,
  "env": null,
  "asm2wasm": asm2wasmImports,
  "parent": Module
 };
 var exports = null;
 function mergeMemory(newBuffer) {
  var oldBuffer = Module["buffer"];
  if (newBuffer.byteLength < oldBuffer.byteLength) {
   Module["printErr"]("the new buffer in mergeMemory is smaller than the previous one. in native wasm, we should grow memory here");
  }
  var oldView = new Int8Array(oldBuffer);
  var newView = new Int8Array(newBuffer);
  newView.set(oldView);
  updateGlobalBuffer(newBuffer);
  updateGlobalBufferViews();
 }
 function fixImports(imports) {
  return imports;
 }
 function getBinary() {
  try {
   if (Module["wasmBinary"]) {
    return new Uint8Array(Module["wasmBinary"]);
   }
   if (Module["readBinary"]) {
    return Module["readBinary"](wasmBinaryFile);
   } else {
    throw "on the web, we need the wasm binary to be preloaded and set on Module['wasmBinary']. emcc.py will do that for you when generating HTML (but not JS)";
   }
  } catch (err) {
   abort(err);
  }
 }
 function getBinaryPromise() {
  if (!Module["wasmBinary"] && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && typeof fetch === "function") {
   return fetch(wasmBinaryFile, {
    credentials: "same-origin"
   }).then((function(response) {
    if (!response["ok"]) {
     throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
    }
    return response["arrayBuffer"]();
   })).catch((function() {
    return getBinary();
   }));
  }
  return new Promise((function(resolve, reject) {
   resolve(getBinary());
  }));
 }
 function doNativeWasm(global, env, providedBuffer) {
  if (typeof WebAssembly !== "object") {
   Module["printErr"]("no native wasm support detected");
   return false;
  }
  if (!(Module["wasmMemory"] instanceof WebAssembly.Memory)) {
   Module["printErr"]("no native wasm Memory in use");
   return false;
  }
  env["memory"] = Module["wasmMemory"];
  info["global"] = {
   "NaN": NaN,
   "Infinity": Infinity
  };
  info["global.Math"] = Math;
  info["env"] = env;
  function receiveInstance(instance, module) {
   exports = instance.exports;
   if (exports.memory) mergeMemory(exports.memory);
   Module["asm"] = exports;
   Module["usingWasm"] = true;
   removeRunDependency("wasm-instantiate");
  }
  addRunDependency("wasm-instantiate");
  if (Module["instantiateWasm"]) {
   try {
    return Module["instantiateWasm"](info, receiveInstance);
   } catch (e) {
    Module["printErr"]("Module.instantiateWasm callback failed with error: " + e);
    return false;
   }
  }
  function receiveInstantiatedSource(output) {
   receiveInstance(output["instance"], output["module"]);
  }
  function instantiateArrayBuffer(receiver) {
   getBinaryPromise().then((function(binary) {
    return WebAssembly.instantiate(binary, info);
   })).then(receiver).catch((function(reason) {
    Module["printErr"]("failed to asynchronously prepare wasm: " + reason);
    abort(reason);
   }));
  }
  if (!Module["wasmBinary"] && typeof WebAssembly.instantiateStreaming === "function" && !isDataURI(wasmBinaryFile) && typeof fetch === "function") {
   WebAssembly.instantiateStreaming(fetch(wasmBinaryFile, {
    credentials: "same-origin"
   }), info).then(receiveInstantiatedSource).catch((function(reason) {
    Module["printErr"]("wasm streaming compile failed: " + reason);
    Module["printErr"]("falling back to ArrayBuffer instantiation");
    instantiateArrayBuffer(receiveInstantiatedSource);
   }));
  } else {
   instantiateArrayBuffer(receiveInstantiatedSource);
  }
  return {};
 }
 Module["asmPreload"] = Module["asm"];
 var asmjsReallocBuffer = Module["reallocBuffer"];
 var wasmReallocBuffer = (function(size) {
  var PAGE_MULTIPLE = Module["usingWasm"] ? WASM_PAGE_SIZE : ASMJS_PAGE_SIZE;
  size = alignUp(size, PAGE_MULTIPLE);
  var old = Module["buffer"];
  var oldSize = old.byteLength;
  if (Module["usingWasm"]) {
   try {
    var result = Module["wasmMemory"].grow((size - oldSize) / wasmPageSize);
    if (result !== (-1 | 0)) {
     return Module["buffer"] = Module["wasmMemory"].buffer;
    } else {
     return null;
    }
   } catch (e) {
    return null;
   }
  }
 });
 Module["reallocBuffer"] = (function(size) {
  if (finalMethod === "asmjs") {
   return asmjsReallocBuffer(size);
  } else {
   return wasmReallocBuffer(size);
  }
 });
 var finalMethod = "";
 Module["asm"] = (function(global, env, providedBuffer) {
  env = fixImports(env);
  if (!env["table"]) {
   var TABLE_SIZE = Module["wasmTableSize"];
   if (TABLE_SIZE === undefined) TABLE_SIZE = 1024;
   var MAX_TABLE_SIZE = Module["wasmMaxTableSize"];
   if (typeof WebAssembly === "object" && typeof WebAssembly.Table === "function") {
    if (MAX_TABLE_SIZE !== undefined) {
     env["table"] = new WebAssembly.Table({
      "initial": TABLE_SIZE,
      "maximum": MAX_TABLE_SIZE,
      "element": "anyfunc"
     });
    } else {
     env["table"] = new WebAssembly.Table({
      "initial": TABLE_SIZE,
      element: "anyfunc"
     });
    }
   } else {
    env["table"] = new Array(TABLE_SIZE);
   }
   Module["wasmTable"] = env["table"];
  }
  if (!env["memoryBase"]) {
   env["memoryBase"] = Module["STATIC_BASE"];
  }
  if (!env["tableBase"]) {
   env["tableBase"] = 0;
  }
  var exports;
  exports = doNativeWasm(global, env, providedBuffer);
  assert(exports, "no binaryen method succeeded.");
  return exports;
 });
}
integrateWasmJS();
STATIC_BASE = GLOBAL_BASE;
STATICTOP = STATIC_BASE + 10064;
__ATINIT__.push();
var STATIC_BUMP = 10064;
Module["STATIC_BASE"] = STATIC_BASE;
Module["STATIC_BUMP"] = STATIC_BUMP;
var tempDoublePtr = STATICTOP;
STATICTOP += 16;
function __ZSt18uncaught_exceptionv() {
 return !!__ZSt18uncaught_exceptionv.uncaught_exception;
}
var EXCEPTIONS = {
 last: 0,
 caught: [],
 infos: {},
 deAdjust: (function(adjusted) {
  if (!adjusted || EXCEPTIONS.infos[adjusted]) return adjusted;
  for (var key in EXCEPTIONS.infos) {
   var ptr = +key;
   var info = EXCEPTIONS.infos[ptr];
   if (info.adjusted === adjusted) {
    return ptr;
   }
  }
  return adjusted;
 }),
 addRef: (function(ptr) {
  if (!ptr) return;
  var info = EXCEPTIONS.infos[ptr];
  info.refcount++;
 }),
 decRef: (function(ptr) {
  if (!ptr) return;
  var info = EXCEPTIONS.infos[ptr];
  assert(info.refcount > 0);
  info.refcount--;
  if (info.refcount === 0 && !info.rethrown) {
   if (info.destructor) {
    Module["dynCall_vi"](info.destructor, ptr);
   }
   delete EXCEPTIONS.infos[ptr];
   ___cxa_free_exception(ptr);
  }
 }),
 clearRef: (function(ptr) {
  if (!ptr) return;
  var info = EXCEPTIONS.infos[ptr];
  info.refcount = 0;
 })
};
function ___cxa_begin_catch(ptr) {
 var info = EXCEPTIONS.infos[ptr];
 if (info && !info.caught) {
  info.caught = true;
  __ZSt18uncaught_exceptionv.uncaught_exception--;
 }
 if (info) info.rethrown = false;
 EXCEPTIONS.caught.push(ptr);
 EXCEPTIONS.addRef(EXCEPTIONS.deAdjust(ptr));
 return ptr;
}
function ___cxa_pure_virtual() {
 ABORT = true;
 throw "Pure virtual function called!";
}
function ___resumeException(ptr) {
 if (!EXCEPTIONS.last) {
  EXCEPTIONS.last = ptr;
 }
 throw ptr + " - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch.";
}
function ___cxa_find_matching_catch() {
 var thrown = EXCEPTIONS.last;
 if (!thrown) {
  return (setTempRet0(0), 0) | 0;
 }
 var info = EXCEPTIONS.infos[thrown];
 var throwntype = info.type;
 if (!throwntype) {
  return (setTempRet0(0), thrown) | 0;
 }
 var typeArray = Array.prototype.slice.call(arguments);
 var pointer = Module["___cxa_is_pointer_type"](throwntype);
 if (!___cxa_find_matching_catch.buffer) ___cxa_find_matching_catch.buffer = _malloc(4);
 HEAP32[___cxa_find_matching_catch.buffer >> 2] = thrown;
 thrown = ___cxa_find_matching_catch.buffer;
 for (var i = 0; i < typeArray.length; i++) {
  if (typeArray[i] && Module["___cxa_can_catch"](typeArray[i], throwntype, thrown)) {
   thrown = HEAP32[thrown >> 2];
   info.adjusted = thrown;
   return (setTempRet0(typeArray[i]), thrown) | 0;
  }
 }
 thrown = HEAP32[thrown >> 2];
 return (setTempRet0(throwntype), thrown) | 0;
}
function ___gxx_personality_v0() {}
var SYSCALLS = {
 varargs: 0,
 get: (function(varargs) {
  SYSCALLS.varargs += 4;
  var ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
  return ret;
 }),
 getStr: (function() {
  var ret = Pointer_stringify(SYSCALLS.get());
  return ret;
 }),
 get64: (function() {
  var low = SYSCALLS.get(), high = SYSCALLS.get();
  if (low >= 0) assert(high === 0); else assert(high === -1);
  return low;
 }),
 getZero: (function() {
  assert(SYSCALLS.get() === 0);
 })
};
function ___syscall140(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
  var offset = offset_low;
  FS.llseek(stream, offset, whence);
  HEAP32[result >> 2] = stream.position;
  if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null;
  return 0;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}
function flush_NO_FILESYSTEM() {
 var fflush = Module["_fflush"];
 if (fflush) fflush(0);
 var printChar = ___syscall146.printChar;
 if (!printChar) return;
 var buffers = ___syscall146.buffers;
 if (buffers[1].length) printChar(1, 10);
 if (buffers[2].length) printChar(2, 10);
}
function ___syscall146(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.get(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
  var ret = 0;
  if (!___syscall146.buffers) {
   ___syscall146.buffers = [ null, [], [] ];
   ___syscall146.printChar = (function(stream, curr) {
    var buffer = ___syscall146.buffers[stream];
    assert(buffer);
    if (curr === 0 || curr === 10) {
     (stream === 1 ? Module["print"] : Module["printErr"])(UTF8ArrayToString(buffer, 0));
     buffer.length = 0;
    } else {
     buffer.push(curr);
    }
   });
  }
  for (var i = 0; i < iovcnt; i++) {
   var ptr = HEAP32[iov + i * 8 >> 2];
   var len = HEAP32[iov + (i * 8 + 4) >> 2];
   for (var j = 0; j < len; j++) {
    ___syscall146.printChar(stream, HEAPU8[ptr + j]);
   }
   ret += len;
  }
  return ret;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}
function ___syscall6(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD();
  FS.close(stream);
  return 0;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}
function _abort() {
 Module["abort"]();
}
function _b2WorldBeginContactBody(worldPtr, contactPtr) {
 b2World.BeginContactBody(worldPtr, contactPtr);
}
function _b2WorldEndContactBody(worldPtr, contactPtr) {
 b2World.EndContactBody(worldPtr, contactPtr);
}
function _b2WorldPostSolve(worldPtr, contactPtr, impulsePtr) {
 b2World.PostSolve(worldPtr, contactPtr, impulsePtr);
}
function _b2WorldPreSolve(worldPtr, contactPtr, oldManifoldPtr) {
 b2World.PreSolve(worldPtr, contactPtr, oldManifoldPtr);
}
function _b2WorldQueryAABB(worldPtr, fixturePtr) {
 return b2World.QueryAABB(worldPtr, fixturePtr);
}
function _b2WorldRayCastCallback(worldPtr, fixturePtr, pointX, pointY, normalX, normalY, fraction) {
 return b2World.RayCast(worldPtr, fixturePtr, pointX, pointY, normalX, normalY, fraction);
}
var _llvm_floor_f32 = Math_floor;
function _llvm_trap() {
 abort("trap!");
}
function _emscripten_memcpy_big(dest, src, num) {
 HEAPU8.set(HEAPU8.subarray(src, src + num), dest);
 return dest;
}
var PTHREAD_SPECIFIC = {};
function _pthread_getspecific(key) {
 return PTHREAD_SPECIFIC[key] || 0;
}
var PTHREAD_SPECIFIC_NEXT_KEY = 1;
var ERRNO_CODES = {
 EPERM: 1,
 ENOENT: 2,
 ESRCH: 3,
 EINTR: 4,
 EIO: 5,
 ENXIO: 6,
 E2BIG: 7,
 ENOEXEC: 8,
 EBADF: 9,
 ECHILD: 10,
 EAGAIN: 11,
 EWOULDBLOCK: 11,
 ENOMEM: 12,
 EACCES: 13,
 EFAULT: 14,
 ENOTBLK: 15,
 EBUSY: 16,
 EEXIST: 17,
 EXDEV: 18,
 ENODEV: 19,
 ENOTDIR: 20,
 EISDIR: 21,
 EINVAL: 22,
 ENFILE: 23,
 EMFILE: 24,
 ENOTTY: 25,
 ETXTBSY: 26,
 EFBIG: 27,
 ENOSPC: 28,
 ESPIPE: 29,
 EROFS: 30,
 EMLINK: 31,
 EPIPE: 32,
 EDOM: 33,
 ERANGE: 34,
 ENOMSG: 42,
 EIDRM: 43,
 ECHRNG: 44,
 EL2NSYNC: 45,
 EL3HLT: 46,
 EL3RST: 47,
 ELNRNG: 48,
 EUNATCH: 49,
 ENOCSI: 50,
 EL2HLT: 51,
 EDEADLK: 35,
 ENOLCK: 37,
 EBADE: 52,
 EBADR: 53,
 EXFULL: 54,
 ENOANO: 55,
 EBADRQC: 56,
 EBADSLT: 57,
 EDEADLOCK: 35,
 EBFONT: 59,
 ENOSTR: 60,
 ENODATA: 61,
 ETIME: 62,
 ENOSR: 63,
 ENONET: 64,
 ENOPKG: 65,
 EREMOTE: 66,
 ENOLINK: 67,
 EADV: 68,
 ESRMNT: 69,
 ECOMM: 70,
 EPROTO: 71,
 EMULTIHOP: 72,
 EDOTDOT: 73,
 EBADMSG: 74,
 ENOTUNIQ: 76,
 EBADFD: 77,
 EREMCHG: 78,
 ELIBACC: 79,
 ELIBBAD: 80,
 ELIBSCN: 81,
 ELIBMAX: 82,
 ELIBEXEC: 83,
 ENOSYS: 38,
 ENOTEMPTY: 39,
 ENAMETOOLONG: 36,
 ELOOP: 40,
 EOPNOTSUPP: 95,
 EPFNOSUPPORT: 96,
 ECONNRESET: 104,
 ENOBUFS: 105,
 EAFNOSUPPORT: 97,
 EPROTOTYPE: 91,
 ENOTSOCK: 88,
 ENOPROTOOPT: 92,
 ESHUTDOWN: 108,
 ECONNREFUSED: 111,
 EADDRINUSE: 98,
 ECONNABORTED: 103,
 ENETUNREACH: 101,
 ENETDOWN: 100,
 ETIMEDOUT: 110,
 EHOSTDOWN: 112,
 EHOSTUNREACH: 113,
 EINPROGRESS: 115,
 EALREADY: 114,
 EDESTADDRREQ: 89,
 EMSGSIZE: 90,
 EPROTONOSUPPORT: 93,
 ESOCKTNOSUPPORT: 94,
 EADDRNOTAVAIL: 99,
 ENETRESET: 102,
 EISCONN: 106,
 ENOTCONN: 107,
 ETOOMANYREFS: 109,
 EUSERS: 87,
 EDQUOT: 122,
 ESTALE: 116,
 ENOTSUP: 95,
 ENOMEDIUM: 123,
 EILSEQ: 84,
 EOVERFLOW: 75,
 ECANCELED: 125,
 ENOTRECOVERABLE: 131,
 EOWNERDEAD: 130,
 ESTRPIPE: 86
};
function _pthread_key_create(key, destructor) {
 if (key == 0) {
  return ERRNO_CODES.EINVAL;
 }
 HEAP32[key >> 2] = PTHREAD_SPECIFIC_NEXT_KEY;
 PTHREAD_SPECIFIC[PTHREAD_SPECIFIC_NEXT_KEY] = 0;
 PTHREAD_SPECIFIC_NEXT_KEY++;
 return 0;
}
function _pthread_once(ptr, func) {
 if (!_pthread_once.seen) _pthread_once.seen = {};
 if (ptr in _pthread_once.seen) return;
 Module["dynCall_v"](func);
 _pthread_once.seen[ptr] = 1;
}
function _pthread_setspecific(key, value) {
 if (!(key in PTHREAD_SPECIFIC)) {
  return ERRNO_CODES.EINVAL;
 }
 PTHREAD_SPECIFIC[key] = value;
 return 0;
}
function ___setErrNo(value) {
 if (Module["___errno_location"]) HEAP32[Module["___errno_location"]() >> 2] = value;
 return value;
}
DYNAMICTOP_PTR = staticAlloc(4);
STACK_BASE = STACKTOP = alignMemory(STATICTOP);
STACK_MAX = STACK_BASE + TOTAL_STACK;
DYNAMIC_BASE = alignMemory(STACK_MAX);
HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;
staticSealed = true;
var ASSERTIONS = false;
Module["wasmTableSize"] = 292;
Module["wasmMaxTableSize"] = 292;
function invoke_fif(index, a1, a2) {
 try {
  return Module["dynCall_fif"](index, a1, a2);
 } catch (e) {
  if (typeof e !== "number" && e !== "longjmp") throw e;
  Module["setThrew"](1, 0);
 }
}
function invoke_fiiiif(index, a1, a2, a3, a4, a5) {
 try {
  return Module["dynCall_fiiiif"](index, a1, a2, a3, a4, a5);
 } catch (e) {
  if (typeof e !== "number" && e !== "longjmp") throw e;
  Module["setThrew"](1, 0);
 }
}
function invoke_fiiiiif(index, a1, a2, a3, a4, a5, a6) {
 try {
  return Module["dynCall_fiiiiif"](index, a1, a2, a3, a4, a5, a6);
 } catch (e) {
  if (typeof e !== "number" && e !== "longjmp") throw e;
  Module["setThrew"](1, 0);
 }
}
function invoke_ii(index, a1) {
 try {
  return Module["dynCall_ii"](index, a1);
 } catch (e) {
  if (typeof e !== "number" && e !== "longjmp") throw e;
  Module["setThrew"](1, 0);
 }
}
function invoke_iii(index, a1, a2) {
 try {
  return Module["dynCall_iii"](index, a1, a2);
 } catch (e) {
  if (typeof e !== "number" && e !== "longjmp") throw e;
  Module["setThrew"](1, 0);
 }
}
function invoke_iiii(index, a1, a2, a3) {
 try {
  return Module["dynCall_iiii"](index, a1, a2, a3);
 } catch (e) {
  if (typeof e !== "number" && e !== "longjmp") throw e;
  Module["setThrew"](1, 0);
 }
}
function invoke_iiiii(index, a1, a2, a3, a4) {
 try {
  return Module["dynCall_iiiii"](index, a1, a2, a3, a4);
 } catch (e) {
  if (typeof e !== "number" && e !== "longjmp") throw e;
  Module["setThrew"](1, 0);
 }
}
function invoke_iiiiii(index, a1, a2, a3, a4, a5) {
 try {
  return Module["dynCall_iiiiii"](index, a1, a2, a3, a4, a5);
 } catch (e) {
  if (typeof e !== "number" && e !== "longjmp") throw e;
  Module["setThrew"](1, 0);
 }
}
function invoke_v(index) {
 try {
  Module["dynCall_v"](index);
 } catch (e) {
  if (typeof e !== "number" && e !== "longjmp") throw e;
  Module["setThrew"](1, 0);
 }
}
function invoke_vi(index, a1) {
 try {
  Module["dynCall_vi"](index, a1);
 } catch (e) {
  if (typeof e !== "number" && e !== "longjmp") throw e;
  Module["setThrew"](1, 0);
 }
}
function invoke_vii(index, a1, a2) {
 try {
  Module["dynCall_vii"](index, a1, a2);
 } catch (e) {
  if (typeof e !== "number" && e !== "longjmp") throw e;
  Module["setThrew"](1, 0);
 }
}
function invoke_viif(index, a1, a2, a3) {
 try {
  Module["dynCall_viif"](index, a1, a2, a3);
 } catch (e) {
  if (typeof e !== "number" && e !== "longjmp") throw e;
  Module["setThrew"](1, 0);
 }
}
function invoke_viii(index, a1, a2, a3) {
 try {
  Module["dynCall_viii"](index, a1, a2, a3);
 } catch (e) {
  if (typeof e !== "number" && e !== "longjmp") throw e;
  Module["setThrew"](1, 0);
 }
}
function invoke_viiii(index, a1, a2, a3, a4) {
 try {
  Module["dynCall_viiii"](index, a1, a2, a3, a4);
 } catch (e) {
  if (typeof e !== "number" && e !== "longjmp") throw e;
  Module["setThrew"](1, 0);
 }
}
function invoke_viiiii(index, a1, a2, a3, a4, a5) {
 try {
  Module["dynCall_viiiii"](index, a1, a2, a3, a4, a5);
 } catch (e) {
  if (typeof e !== "number" && e !== "longjmp") throw e;
  Module["setThrew"](1, 0);
 }
}
function invoke_viiiiii(index, a1, a2, a3, a4, a5, a6) {
 try {
  Module["dynCall_viiiiii"](index, a1, a2, a3, a4, a5, a6);
 } catch (e) {
  if (typeof e !== "number" && e !== "longjmp") throw e;
  Module["setThrew"](1, 0);
 }
}
Module.asmGlobalArg = {};
Module.asmLibraryArg = {
 "abort": abort,
 "assert": assert,
 "enlargeMemory": enlargeMemory,
 "getTotalMemory": getTotalMemory,
 "abortOnCannotGrowMemory": abortOnCannotGrowMemory,
 "invoke_fif": invoke_fif,
 "invoke_fiiiif": invoke_fiiiif,
 "invoke_fiiiiif": invoke_fiiiiif,
 "invoke_ii": invoke_ii,
 "invoke_iii": invoke_iii,
 "invoke_iiii": invoke_iiii,
 "invoke_iiiii": invoke_iiiii,
 "invoke_iiiiii": invoke_iiiiii,
 "invoke_v": invoke_v,
 "invoke_vi": invoke_vi,
 "invoke_vii": invoke_vii,
 "invoke_viif": invoke_viif,
 "invoke_viii": invoke_viii,
 "invoke_viiii": invoke_viiii,
 "invoke_viiiii": invoke_viiiii,
 "invoke_viiiiii": invoke_viiiiii,
 "__ZSt18uncaught_exceptionv": __ZSt18uncaught_exceptionv,
 "___cxa_begin_catch": ___cxa_begin_catch,
 "___cxa_find_matching_catch": ___cxa_find_matching_catch,
 "___cxa_pure_virtual": ___cxa_pure_virtual,
 "___gxx_personality_v0": ___gxx_personality_v0,
 "___resumeException": ___resumeException,
 "___setErrNo": ___setErrNo,
 "___syscall140": ___syscall140,
 "___syscall146": ___syscall146,
 "___syscall6": ___syscall6,
 "_abort": _abort,
 "_b2WorldBeginContactBody": _b2WorldBeginContactBody,
 "_b2WorldEndContactBody": _b2WorldEndContactBody,
 "_b2WorldPostSolve": _b2WorldPostSolve,
 "_b2WorldPreSolve": _b2WorldPreSolve,
 "_b2WorldQueryAABB": _b2WorldQueryAABB,
 "_b2WorldRayCastCallback": _b2WorldRayCastCallback,
 "_emscripten_memcpy_big": _emscripten_memcpy_big,
 "_llvm_floor_f32": _llvm_floor_f32,
 "_llvm_trap": _llvm_trap,
 "_pthread_getspecific": _pthread_getspecific,
 "_pthread_key_create": _pthread_key_create,
 "_pthread_once": _pthread_once,
 "_pthread_setspecific": _pthread_setspecific,
 "flush_NO_FILESYSTEM": flush_NO_FILESYSTEM,
 "DYNAMICTOP_PTR": DYNAMICTOP_PTR,
 "tempDoublePtr": tempDoublePtr,
 "ABORT": ABORT,
 "STACKTOP": STACKTOP,
 "STACK_MAX": STACK_MAX
};
var asm = Module["asm"](Module.asmGlobalArg, Module.asmLibraryArg, buffer);
Module["asm"] = asm;
var ___cxa_can_catch = Module["___cxa_can_catch"] = (function() {
 return Module["asm"]["___cxa_can_catch"].apply(null, arguments);
});
var ___cxa_is_pointer_type = Module["___cxa_is_pointer_type"] = (function() {
 return Module["asm"]["___cxa_is_pointer_type"].apply(null, arguments);
});
var ___errno_location = Module["___errno_location"] = (function() {
 return Module["asm"]["___errno_location"].apply(null, arguments);
});
var _b2Body_ApplyAngularImpulse = Module["_b2Body_ApplyAngularImpulse"] = (function() {
 return Module["asm"]["_b2Body_ApplyAngularImpulse"].apply(null, arguments);
});
var _b2Body_ApplyForce = Module["_b2Body_ApplyForce"] = (function() {
 return Module["asm"]["_b2Body_ApplyForce"].apply(null, arguments);
});
var _b2Body_ApplyForceToCenter = Module["_b2Body_ApplyForceToCenter"] = (function() {
 return Module["asm"]["_b2Body_ApplyForceToCenter"].apply(null, arguments);
});
var _b2Body_ApplyLinearImpulse = Module["_b2Body_ApplyLinearImpulse"] = (function() {
 return Module["asm"]["_b2Body_ApplyLinearImpulse"].apply(null, arguments);
});
var _b2Body_ApplyTorque = Module["_b2Body_ApplyTorque"] = (function() {
 return Module["asm"]["_b2Body_ApplyTorque"].apply(null, arguments);
});
var _b2Body_DestroyFixture = Module["_b2Body_DestroyFixture"] = (function() {
 return Module["asm"]["_b2Body_DestroyFixture"].apply(null, arguments);
});
var _b2Body_GetAngle = Module["_b2Body_GetAngle"] = (function() {
 return Module["asm"]["_b2Body_GetAngle"].apply(null, arguments);
});
var _b2Body_GetAngularVelocity = Module["_b2Body_GetAngularVelocity"] = (function() {
 return Module["asm"]["_b2Body_GetAngularVelocity"].apply(null, arguments);
});
var _b2Body_GetInertia = Module["_b2Body_GetInertia"] = (function() {
 return Module["asm"]["_b2Body_GetInertia"].apply(null, arguments);
});
var _b2Body_GetLinearVelocity = Module["_b2Body_GetLinearVelocity"] = (function() {
 return Module["asm"]["_b2Body_GetLinearVelocity"].apply(null, arguments);
});
var _b2Body_GetLocalPoint = Module["_b2Body_GetLocalPoint"] = (function() {
 return Module["asm"]["_b2Body_GetLocalPoint"].apply(null, arguments);
});
var _b2Body_GetLocalVector = Module["_b2Body_GetLocalVector"] = (function() {
 return Module["asm"]["_b2Body_GetLocalVector"].apply(null, arguments);
});
var _b2Body_GetMass = Module["_b2Body_GetMass"] = (function() {
 return Module["asm"]["_b2Body_GetMass"].apply(null, arguments);
});
var _b2Body_GetPosition = Module["_b2Body_GetPosition"] = (function() {
 return Module["asm"]["_b2Body_GetPosition"].apply(null, arguments);
});
var _b2Body_GetTransform = Module["_b2Body_GetTransform"] = (function() {
 return Module["asm"]["_b2Body_GetTransform"].apply(null, arguments);
});
var _b2Body_GetType = Module["_b2Body_GetType"] = (function() {
 return Module["asm"]["_b2Body_GetType"].apply(null, arguments);
});
var _b2Body_GetWorldCenter = Module["_b2Body_GetWorldCenter"] = (function() {
 return Module["asm"]["_b2Body_GetWorldCenter"].apply(null, arguments);
});
var _b2Body_GetWorldPoint = Module["_b2Body_GetWorldPoint"] = (function() {
 return Module["asm"]["_b2Body_GetWorldPoint"].apply(null, arguments);
});
var _b2Body_GetWorldVector = Module["_b2Body_GetWorldVector"] = (function() {
 return Module["asm"]["_b2Body_GetWorldVector"].apply(null, arguments);
});
var _b2Body_SetAngularVelocity = Module["_b2Body_SetAngularVelocity"] = (function() {
 return Module["asm"]["_b2Body_SetAngularVelocity"].apply(null, arguments);
});
var _b2Body_SetAwake = Module["_b2Body_SetAwake"] = (function() {
 return Module["asm"]["_b2Body_SetAwake"].apply(null, arguments);
});
var _b2Body_SetFixedRotation = Module["_b2Body_SetFixedRotation"] = (function() {
 return Module["asm"]["_b2Body_SetFixedRotation"].apply(null, arguments);
});
var _b2Body_SetLinearVelocity = Module["_b2Body_SetLinearVelocity"] = (function() {
 return Module["asm"]["_b2Body_SetLinearVelocity"].apply(null, arguments);
});
var _b2Body_SetMassData = Module["_b2Body_SetMassData"] = (function() {
 return Module["asm"]["_b2Body_SetMassData"].apply(null, arguments);
});
var _b2Body_SetTransform = Module["_b2Body_SetTransform"] = (function() {
 return Module["asm"]["_b2Body_SetTransform"].apply(null, arguments);
});
var _b2Body_SetType = Module["_b2Body_SetType"] = (function() {
 return Module["asm"]["_b2Body_SetType"].apply(null, arguments);
});
var _b2ChainShape_CreateFixture = Module["_b2ChainShape_CreateFixture"] = (function() {
 return Module["asm"]["_b2ChainShape_CreateFixture"].apply(null, arguments);
});
var _b2CircleShape_CreateFixture = Module["_b2CircleShape_CreateFixture"] = (function() {
 return Module["asm"]["_b2CircleShape_CreateFixture"].apply(null, arguments);
});
var _b2CircleShape_CreateParticleGroup = Module["_b2CircleShape_CreateParticleGroup"] = (function() {
 return Module["asm"]["_b2CircleShape_CreateParticleGroup"].apply(null, arguments);
});
var _b2CircleShape_DestroyParticlesInShape = Module["_b2CircleShape_DestroyParticlesInShape"] = (function() {
 return Module["asm"]["_b2CircleShape_DestroyParticlesInShape"].apply(null, arguments);
});
var _b2Contact_GetManifold = Module["_b2Contact_GetManifold"] = (function() {
 return Module["asm"]["_b2Contact_GetManifold"].apply(null, arguments);
});
var _b2Contact_GetWorldManifold = Module["_b2Contact_GetWorldManifold"] = (function() {
 return Module["asm"]["_b2Contact_GetWorldManifold"].apply(null, arguments);
});
var _b2DistanceJointDef_Create = Module["_b2DistanceJointDef_Create"] = (function() {
 return Module["asm"]["_b2DistanceJointDef_Create"].apply(null, arguments);
});
var _b2EdgeShape_CreateFixture = Module["_b2EdgeShape_CreateFixture"] = (function() {
 return Module["asm"]["_b2EdgeShape_CreateFixture"].apply(null, arguments);
});
var _b2Fixture_TestPoint = Module["_b2Fixture_TestPoint"] = (function() {
 return Module["asm"]["_b2Fixture_TestPoint"].apply(null, arguments);
});
var _b2FrictionJointDef_Create = Module["_b2FrictionJointDef_Create"] = (function() {
 return Module["asm"]["_b2FrictionJointDef_Create"].apply(null, arguments);
});
var _b2GearJointDef_Create = Module["_b2GearJointDef_Create"] = (function() {
 return Module["asm"]["_b2GearJointDef_Create"].apply(null, arguments);
});
var _b2GearJoint_GetRatio = Module["_b2GearJoint_GetRatio"] = (function() {
 return Module["asm"]["_b2GearJoint_GetRatio"].apply(null, arguments);
});
var _b2Joint_GetBodyA = Module["_b2Joint_GetBodyA"] = (function() {
 return Module["asm"]["_b2Joint_GetBodyA"].apply(null, arguments);
});
var _b2Joint_GetBodyB = Module["_b2Joint_GetBodyB"] = (function() {
 return Module["asm"]["_b2Joint_GetBodyB"].apply(null, arguments);
});
var _b2Manifold_GetPointCount = Module["_b2Manifold_GetPointCount"] = (function() {
 return Module["asm"]["_b2Manifold_GetPointCount"].apply(null, arguments);
});
var _b2MotorJointDef_Create = Module["_b2MotorJointDef_Create"] = (function() {
 return Module["asm"]["_b2MotorJointDef_Create"].apply(null, arguments);
});
var _b2MotorJointDef_InitializeAndCreate = Module["_b2MotorJointDef_InitializeAndCreate"] = (function() {
 return Module["asm"]["_b2MotorJointDef_InitializeAndCreate"].apply(null, arguments);
});
var _b2MotorJoint_SetAngularOffset = Module["_b2MotorJoint_SetAngularOffset"] = (function() {
 return Module["asm"]["_b2MotorJoint_SetAngularOffset"].apply(null, arguments);
});
var _b2MotorJoint_SetLinearOffset = Module["_b2MotorJoint_SetLinearOffset"] = (function() {
 return Module["asm"]["_b2MotorJoint_SetLinearOffset"].apply(null, arguments);
});
var _b2MouseJointDef_Create = Module["_b2MouseJointDef_Create"] = (function() {
 return Module["asm"]["_b2MouseJointDef_Create"].apply(null, arguments);
});
var _b2MouseJoint_SetTarget = Module["_b2MouseJoint_SetTarget"] = (function() {
 return Module["asm"]["_b2MouseJoint_SetTarget"].apply(null, arguments);
});
var _b2ParticleGroup_ApplyForce = Module["_b2ParticleGroup_ApplyForce"] = (function() {
 return Module["asm"]["_b2ParticleGroup_ApplyForce"].apply(null, arguments);
});
var _b2ParticleGroup_ApplyLinearImpulse = Module["_b2ParticleGroup_ApplyLinearImpulse"] = (function() {
 return Module["asm"]["_b2ParticleGroup_ApplyLinearImpulse"].apply(null, arguments);
});
var _b2ParticleGroup_DestroyParticles = Module["_b2ParticleGroup_DestroyParticles"] = (function() {
 return Module["asm"]["_b2ParticleGroup_DestroyParticles"].apply(null, arguments);
});
var _b2ParticleGroup_GetBufferIndex = Module["_b2ParticleGroup_GetBufferIndex"] = (function() {
 return Module["asm"]["_b2ParticleGroup_GetBufferIndex"].apply(null, arguments);
});
var _b2ParticleGroup_GetParticleCount = Module["_b2ParticleGroup_GetParticleCount"] = (function() {
 return Module["asm"]["_b2ParticleGroup_GetParticleCount"].apply(null, arguments);
});
var _b2ParticleSystem_CreateParticle = Module["_b2ParticleSystem_CreateParticle"] = (function() {
 return Module["asm"]["_b2ParticleSystem_CreateParticle"].apply(null, arguments);
});
var _b2ParticleSystem_GetColorBuffer = Module["_b2ParticleSystem_GetColorBuffer"] = (function() {
 return Module["asm"]["_b2ParticleSystem_GetColorBuffer"].apply(null, arguments);
});
var _b2ParticleSystem_GetParticleCount = Module["_b2ParticleSystem_GetParticleCount"] = (function() {
 return Module["asm"]["_b2ParticleSystem_GetParticleCount"].apply(null, arguments);
});
var _b2ParticleSystem_GetParticleLifetime = Module["_b2ParticleSystem_GetParticleLifetime"] = (function() {
 return Module["asm"]["_b2ParticleSystem_GetParticleLifetime"].apply(null, arguments);
});
var _b2ParticleSystem_GetPositionBuffer = Module["_b2ParticleSystem_GetPositionBuffer"] = (function() {
 return Module["asm"]["_b2ParticleSystem_GetPositionBuffer"].apply(null, arguments);
});
var _b2ParticleSystem_GetVelocityBuffer = Module["_b2ParticleSystem_GetVelocityBuffer"] = (function() {
 return Module["asm"]["_b2ParticleSystem_GetVelocityBuffer"].apply(null, arguments);
});
var _b2ParticleSystem_SetDamping = Module["_b2ParticleSystem_SetDamping"] = (function() {
 return Module["asm"]["_b2ParticleSystem_SetDamping"].apply(null, arguments);
});
var _b2ParticleSystem_SetDensity = Module["_b2ParticleSystem_SetDensity"] = (function() {
 return Module["asm"]["_b2ParticleSystem_SetDensity"].apply(null, arguments);
});
var _b2ParticleSystem_SetGravityScale = Module["_b2ParticleSystem_SetGravityScale"] = (function() {
 return Module["asm"]["_b2ParticleSystem_SetGravityScale"].apply(null, arguments);
});
var _b2ParticleSystem_SetMaxParticleCount = Module["_b2ParticleSystem_SetMaxParticleCount"] = (function() {
 return Module["asm"]["_b2ParticleSystem_SetMaxParticleCount"].apply(null, arguments);
});
var _b2ParticleSystem_SetParticleLifetime = Module["_b2ParticleSystem_SetParticleLifetime"] = (function() {
 return Module["asm"]["_b2ParticleSystem_SetParticleLifetime"].apply(null, arguments);
});
var _b2ParticleSystem_SetRadius = Module["_b2ParticleSystem_SetRadius"] = (function() {
 return Module["asm"]["_b2ParticleSystem_SetRadius"].apply(null, arguments);
});
var _b2PolygonShape_CreateFixture_3 = Module["_b2PolygonShape_CreateFixture_3"] = (function() {
 return Module["asm"]["_b2PolygonShape_CreateFixture_3"].apply(null, arguments);
});
var _b2PolygonShape_CreateFixture_4 = Module["_b2PolygonShape_CreateFixture_4"] = (function() {
 return Module["asm"]["_b2PolygonShape_CreateFixture_4"].apply(null, arguments);
});
var _b2PolygonShape_CreateFixture_5 = Module["_b2PolygonShape_CreateFixture_5"] = (function() {
 return Module["asm"]["_b2PolygonShape_CreateFixture_5"].apply(null, arguments);
});
var _b2PolygonShape_CreateFixture_6 = Module["_b2PolygonShape_CreateFixture_6"] = (function() {
 return Module["asm"]["_b2PolygonShape_CreateFixture_6"].apply(null, arguments);
});
var _b2PolygonShape_CreateFixture_7 = Module["_b2PolygonShape_CreateFixture_7"] = (function() {
 return Module["asm"]["_b2PolygonShape_CreateFixture_7"].apply(null, arguments);
});
var _b2PolygonShape_CreateFixture_8 = Module["_b2PolygonShape_CreateFixture_8"] = (function() {
 return Module["asm"]["_b2PolygonShape_CreateFixture_8"].apply(null, arguments);
});
var _b2PolygonShape_CreateParticleGroup_4 = Module["_b2PolygonShape_CreateParticleGroup_4"] = (function() {
 return Module["asm"]["_b2PolygonShape_CreateParticleGroup_4"].apply(null, arguments);
});
var _b2PolygonShape_DestroyParticlesInShape_4 = Module["_b2PolygonShape_DestroyParticlesInShape_4"] = (function() {
 return Module["asm"]["_b2PolygonShape_DestroyParticlesInShape_4"].apply(null, arguments);
});
var _b2PrismaticJointDef_Create = Module["_b2PrismaticJointDef_Create"] = (function() {
 return Module["asm"]["_b2PrismaticJointDef_Create"].apply(null, arguments);
});
var _b2PrismaticJoint_EnableLimit = Module["_b2PrismaticJoint_EnableLimit"] = (function() {
 return Module["asm"]["_b2PrismaticJoint_EnableLimit"].apply(null, arguments);
});
var _b2PrismaticJoint_EnableMotor = Module["_b2PrismaticJoint_EnableMotor"] = (function() {
 return Module["asm"]["_b2PrismaticJoint_EnableMotor"].apply(null, arguments);
});
var _b2PrismaticJoint_GetJointTranslation = Module["_b2PrismaticJoint_GetJointTranslation"] = (function() {
 return Module["asm"]["_b2PrismaticJoint_GetJointTranslation"].apply(null, arguments);
});
var _b2PrismaticJoint_GetMotorForce = Module["_b2PrismaticJoint_GetMotorForce"] = (function() {
 return Module["asm"]["_b2PrismaticJoint_GetMotorForce"].apply(null, arguments);
});
var _b2PrismaticJoint_GetMotorSpeed = Module["_b2PrismaticJoint_GetMotorSpeed"] = (function() {
 return Module["asm"]["_b2PrismaticJoint_GetMotorSpeed"].apply(null, arguments);
});
var _b2PrismaticJoint_IsLimitEnabled = Module["_b2PrismaticJoint_IsLimitEnabled"] = (function() {
 return Module["asm"]["_b2PrismaticJoint_IsLimitEnabled"].apply(null, arguments);
});
var _b2PrismaticJoint_IsMotorEnabled = Module["_b2PrismaticJoint_IsMotorEnabled"] = (function() {
 return Module["asm"]["_b2PrismaticJoint_IsMotorEnabled"].apply(null, arguments);
});
var _b2PrismaticJoint_SetMotorSpeed = Module["_b2PrismaticJoint_SetMotorSpeed"] = (function() {
 return Module["asm"]["_b2PrismaticJoint_SetMotorSpeed"].apply(null, arguments);
});
var _b2PulleyJointDef_Create = Module["_b2PulleyJointDef_Create"] = (function() {
 return Module["asm"]["_b2PulleyJointDef_Create"].apply(null, arguments);
});
var _b2RevoluteJointDef_Create = Module["_b2RevoluteJointDef_Create"] = (function() {
 return Module["asm"]["_b2RevoluteJointDef_Create"].apply(null, arguments);
});
var _b2RevoluteJointDef_InitializeAndCreate = Module["_b2RevoluteJointDef_InitializeAndCreate"] = (function() {
 return Module["asm"]["_b2RevoluteJointDef_InitializeAndCreate"].apply(null, arguments);
});
var _b2RevoluteJoint_EnableLimit = Module["_b2RevoluteJoint_EnableLimit"] = (function() {
 return Module["asm"]["_b2RevoluteJoint_EnableLimit"].apply(null, arguments);
});
var _b2RevoluteJoint_EnableMotor = Module["_b2RevoluteJoint_EnableMotor"] = (function() {
 return Module["asm"]["_b2RevoluteJoint_EnableMotor"].apply(null, arguments);
});
var _b2RevoluteJoint_GetJointAngle = Module["_b2RevoluteJoint_GetJointAngle"] = (function() {
 return Module["asm"]["_b2RevoluteJoint_GetJointAngle"].apply(null, arguments);
});
var _b2RevoluteJoint_IsLimitEnabled = Module["_b2RevoluteJoint_IsLimitEnabled"] = (function() {
 return Module["asm"]["_b2RevoluteJoint_IsLimitEnabled"].apply(null, arguments);
});
var _b2RevoluteJoint_IsMotorEnabled = Module["_b2RevoluteJoint_IsMotorEnabled"] = (function() {
 return Module["asm"]["_b2RevoluteJoint_IsMotorEnabled"].apply(null, arguments);
});
var _b2RevoluteJoint_SetMotorSpeed = Module["_b2RevoluteJoint_SetMotorSpeed"] = (function() {
 return Module["asm"]["_b2RevoluteJoint_SetMotorSpeed"].apply(null, arguments);
});
var _b2RopeJointDef_Create = Module["_b2RopeJointDef_Create"] = (function() {
 return Module["asm"]["_b2RopeJointDef_Create"].apply(null, arguments);
});
var _b2WeldJointDef_Create = Module["_b2WeldJointDef_Create"] = (function() {
 return Module["asm"]["_b2WeldJointDef_Create"].apply(null, arguments);
});
var _b2WheelJointDef_Create = Module["_b2WheelJointDef_Create"] = (function() {
 return Module["asm"]["_b2WheelJointDef_Create"].apply(null, arguments);
});
var _b2WheelJoint_SetMotorSpeed = Module["_b2WheelJoint_SetMotorSpeed"] = (function() {
 return Module["asm"]["_b2WheelJoint_SetMotorSpeed"].apply(null, arguments);
});
var _b2WheelJoint_SetSpringFrequencyHz = Module["_b2WheelJoint_SetSpringFrequencyHz"] = (function() {
 return Module["asm"]["_b2WheelJoint_SetSpringFrequencyHz"].apply(null, arguments);
});
var _b2World_Create = Module["_b2World_Create"] = (function() {
 return Module["asm"]["_b2World_Create"].apply(null, arguments);
});
var _b2World_CreateBody = Module["_b2World_CreateBody"] = (function() {
 return Module["asm"]["_b2World_CreateBody"].apply(null, arguments);
});
var _b2World_CreateParticleSystem = Module["_b2World_CreateParticleSystem"] = (function() {
 return Module["asm"]["_b2World_CreateParticleSystem"].apply(null, arguments);
});
var _b2World_Delete = Module["_b2World_Delete"] = (function() {
 return Module["asm"]["_b2World_Delete"].apply(null, arguments);
});
var _b2World_DestroyBody = Module["_b2World_DestroyBody"] = (function() {
 return Module["asm"]["_b2World_DestroyBody"].apply(null, arguments);
});
var _b2World_DestroyJoint = Module["_b2World_DestroyJoint"] = (function() {
 return Module["asm"]["_b2World_DestroyJoint"].apply(null, arguments);
});
var _b2World_DestroyParticleSystem = Module["_b2World_DestroyParticleSystem"] = (function() {
 return Module["asm"]["_b2World_DestroyParticleSystem"].apply(null, arguments);
});
var _b2World_QueryAABB = Module["_b2World_QueryAABB"] = (function() {
 return Module["asm"]["_b2World_QueryAABB"].apply(null, arguments);
});
var _b2World_RayCast = Module["_b2World_RayCast"] = (function() {
 return Module["asm"]["_b2World_RayCast"].apply(null, arguments);
});
var _b2World_SetContactListener = Module["_b2World_SetContactListener"] = (function() {
 return Module["asm"]["_b2World_SetContactListener"].apply(null, arguments);
});
var _b2World_SetGravity = Module["_b2World_SetGravity"] = (function() {
 return Module["asm"]["_b2World_SetGravity"].apply(null, arguments);
});
var _free = Module["_free"] = (function() {
 return Module["asm"]["_free"].apply(null, arguments);
});
var _llvm_bswap_i32 = Module["_llvm_bswap_i32"] = (function() {
 return Module["asm"]["_llvm_bswap_i32"].apply(null, arguments);
});
var _malloc = Module["_malloc"] = (function() {
 return Module["asm"]["_malloc"].apply(null, arguments);
});
var _memcpy = Module["_memcpy"] = (function() {
 return Module["asm"]["_memcpy"].apply(null, arguments);
});
var _memmove = Module["_memmove"] = (function() {
 return Module["asm"]["_memmove"].apply(null, arguments);
});
var _memset = Module["_memset"] = (function() {
 return Module["asm"]["_memset"].apply(null, arguments);
});
var _sbrk = Module["_sbrk"] = (function() {
 return Module["asm"]["_sbrk"].apply(null, arguments);
});
var establishStackSpace = Module["establishStackSpace"] = (function() {
 return Module["asm"]["establishStackSpace"].apply(null, arguments);
});
var getTempRet0 = Module["getTempRet0"] = (function() {
 return Module["asm"]["getTempRet0"].apply(null, arguments);
});
var runPostSets = Module["runPostSets"] = (function() {
 return Module["asm"]["runPostSets"].apply(null, arguments);
});
var setTempRet0 = Module["setTempRet0"] = (function() {
 return Module["asm"]["setTempRet0"].apply(null, arguments);
});
var setThrew = Module["setThrew"] = (function() {
 return Module["asm"]["setThrew"].apply(null, arguments);
});
var stackAlloc = Module["stackAlloc"] = (function() {
 return Module["asm"]["stackAlloc"].apply(null, arguments);
});
var stackRestore = Module["stackRestore"] = (function() {
 return Module["asm"]["stackRestore"].apply(null, arguments);
});
var stackSave = Module["stackSave"] = (function() {
 return Module["asm"]["stackSave"].apply(null, arguments);
});
var dynCall_fif = Module["dynCall_fif"] = (function() {
 return Module["asm"]["dynCall_fif"].apply(null, arguments);
});
var dynCall_fiiiif = Module["dynCall_fiiiif"] = (function() {
 return Module["asm"]["dynCall_fiiiif"].apply(null, arguments);
});
var dynCall_fiiiiif = Module["dynCall_fiiiiif"] = (function() {
 return Module["asm"]["dynCall_fiiiiif"].apply(null, arguments);
});
var dynCall_ii = Module["dynCall_ii"] = (function() {
 return Module["asm"]["dynCall_ii"].apply(null, arguments);
});
var dynCall_iii = Module["dynCall_iii"] = (function() {
 return Module["asm"]["dynCall_iii"].apply(null, arguments);
});
var dynCall_iiii = Module["dynCall_iiii"] = (function() {
 return Module["asm"]["dynCall_iiii"].apply(null, arguments);
});
var dynCall_iiiii = Module["dynCall_iiiii"] = (function() {
 return Module["asm"]["dynCall_iiiii"].apply(null, arguments);
});
var dynCall_iiiiii = Module["dynCall_iiiiii"] = (function() {
 return Module["asm"]["dynCall_iiiiii"].apply(null, arguments);
});
var dynCall_v = Module["dynCall_v"] = (function() {
 return Module["asm"]["dynCall_v"].apply(null, arguments);
});
var dynCall_vi = Module["dynCall_vi"] = (function() {
 return Module["asm"]["dynCall_vi"].apply(null, arguments);
});
var dynCall_vii = Module["dynCall_vii"] = (function() {
 return Module["asm"]["dynCall_vii"].apply(null, arguments);
});
var dynCall_viif = Module["dynCall_viif"] = (function() {
 return Module["asm"]["dynCall_viif"].apply(null, arguments);
});
var dynCall_viii = Module["dynCall_viii"] = (function() {
 return Module["asm"]["dynCall_viii"].apply(null, arguments);
});
var dynCall_viiii = Module["dynCall_viiii"] = (function() {
 return Module["asm"]["dynCall_viiii"].apply(null, arguments);
});
var dynCall_viiiii = Module["dynCall_viiiii"] = (function() {
 return Module["asm"]["dynCall_viiiii"].apply(null, arguments);
});
var dynCall_viiiiii = Module["dynCall_viiiiii"] = (function() {
 return Module["asm"]["dynCall_viiiiii"].apply(null, arguments);
});
Module["asm"] = asm;
Module["ccall"] = ccall;
Module["cwrap"] = cwrap;
function ExitStatus(status) {
 this.name = "ExitStatus";
 this.message = "Program terminated with exit(" + status + ")";
 this.status = status;
}
ExitStatus.prototype = new Error;
ExitStatus.prototype.constructor = ExitStatus;
var initialStackTop;
dependenciesFulfilled = function runCaller() {
 if (!Module["calledRun"]) run();
 if (!Module["calledRun"]) dependenciesFulfilled = runCaller;
};
function run(args) {
 args = args || Module["arguments"];
 if (runDependencies > 0) {
  return;
 }
 preRun();
 if (runDependencies > 0) return;
 if (Module["calledRun"]) return;
 function doRun() {
  if (Module["calledRun"]) return;
  Module["calledRun"] = true;
  if (ABORT) return;
  ensureInitRuntime();
  preMain();
  if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
  postRun();
 }
 if (Module["setStatus"]) {
  Module["setStatus"]("Running...");
  setTimeout((function() {
   setTimeout((function() {
    Module["setStatus"]("");
   }), 1);
   doRun();
  }), 1);
 } else {
  doRun();
 }
}
Module["run"] = run;
function exit(status, implicit) {
 if (implicit && Module["noExitRuntime"] && status === 0) {
  return;
 }
 if (Module["noExitRuntime"]) {} else {
  ABORT = true;
  EXITSTATUS = status;
  STACKTOP = initialStackTop;
  exitRuntime();
  if (Module["onExit"]) Module["onExit"](status);
 }
 if (ENVIRONMENT_IS_NODE) {
  process["exit"](status);
 }
 Module["quit"](status, new ExitStatus(status));
}
Module["exit"] = exit;
function abort(what) {
 if (Module["onAbort"]) {
  Module["onAbort"](what);
 }
 if (what !== undefined) {
  Module.print(what);
  Module.printErr(what);
  what = JSON.stringify(what);
 } else {
  what = "";
 }
 ABORT = true;
 EXITSTATUS = 1;
 throw "abort(" + what + "). Build with -s ASSERTIONS=1 for more info.";
}
Module["abort"] = abort;
if (Module["preInit"]) {
 if (typeof Module["preInit"] == "function") Module["preInit"] = [ Module["preInit"] ];
 while (Module["preInit"].length > 0) {
  Module["preInit"].pop()();
 }
}
Module["noExitRuntime"] = true;
run();



