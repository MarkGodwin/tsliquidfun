var Module=typeof Module!=="undefined"?Module:{};var moduleOverrides={};var key;for(key in Module){if(Module.hasOwnProperty(key)){moduleOverrides[key]=Module[key]}}Module["arguments"]=[];Module["thisProgram"]="./this.program";Module["quit"]=(function(status,toThrow){throw toThrow});Module["preRun"]=[];Module["postRun"]=[];var ENVIRONMENT_IS_WEB=false;var ENVIRONMENT_IS_WORKER=false;var ENVIRONMENT_IS_NODE=false;var ENVIRONMENT_IS_SHELL=false;if(Module["ENVIRONMENT"]){if(Module["ENVIRONMENT"]==="WEB"){ENVIRONMENT_IS_WEB=true}else if(Module["ENVIRONMENT"]==="WORKER"){ENVIRONMENT_IS_WORKER=true}else if(Module["ENVIRONMENT"]==="NODE"){ENVIRONMENT_IS_NODE=true}else if(Module["ENVIRONMENT"]==="SHELL"){ENVIRONMENT_IS_SHELL=true}else{throw new Error("Module['ENVIRONMENT'] value is not valid. must be one of: WEB|WORKER|NODE|SHELL.")}}else{ENVIRONMENT_IS_WEB=typeof window==="object";ENVIRONMENT_IS_WORKER=typeof importScripts==="function";ENVIRONMENT_IS_NODE=typeof process==="object"&&typeof require==="function"&&!ENVIRONMENT_IS_WEB&&!ENVIRONMENT_IS_WORKER;ENVIRONMENT_IS_SHELL=!ENVIRONMENT_IS_WEB&&!ENVIRONMENT_IS_NODE&&!ENVIRONMENT_IS_WORKER}if(ENVIRONMENT_IS_NODE){var nodeFS;var nodePath;Module["read"]=function shell_read(filename,binary){var ret;if(!nodeFS)nodeFS=require("fs");if(!nodePath)nodePath=require("path");filename=nodePath["normalize"](filename);ret=nodeFS["readFileSync"](filename);return binary?ret:ret.toString()};Module["readBinary"]=function readBinary(filename){var ret=Module["read"](filename,true);if(!ret.buffer){ret=new Uint8Array(ret)}assert(ret.buffer);return ret};if(process["argv"].length>1){Module["thisProgram"]=process["argv"][1].replace(/\\/g,"/")}Module["arguments"]=process["argv"].slice(2);if(typeof module!=="undefined"){module["exports"]=Module}process["on"]("uncaughtException",(function(ex){if(!(ex instanceof ExitStatus)){throw ex}}));process["on"]("unhandledRejection",(function(reason,p){process["exit"](1)}));Module["inspect"]=(function(){return"[Emscripten Module object]"})}else if(ENVIRONMENT_IS_SHELL){if(typeof read!="undefined"){Module["read"]=function shell_read(f){return read(f)}}Module["readBinary"]=function readBinary(f){var data;if(typeof readbuffer==="function"){return new Uint8Array(readbuffer(f))}data=read(f,"binary");assert(typeof data==="object");return data};if(typeof scriptArgs!="undefined"){Module["arguments"]=scriptArgs}else if(typeof arguments!="undefined"){Module["arguments"]=arguments}if(typeof quit==="function"){Module["quit"]=(function(status,toThrow){quit(status)})}}else if(ENVIRONMENT_IS_WEB||ENVIRONMENT_IS_WORKER){Module["read"]=function shell_read(url){var xhr=new XMLHttpRequest;xhr.open("GET",url,false);xhr.send(null);return xhr.responseText};if(ENVIRONMENT_IS_WORKER){Module["readBinary"]=function readBinary(url){var xhr=new XMLHttpRequest;xhr.open("GET",url,false);xhr.responseType="arraybuffer";xhr.send(null);return new Uint8Array(xhr.response)}}Module["readAsync"]=function readAsync(url,onload,onerror){var xhr=new XMLHttpRequest;xhr.open("GET",url,true);xhr.responseType="arraybuffer";xhr.onload=function xhr_onload(){if(xhr.status==200||xhr.status==0&&xhr.response){onload(xhr.response);return}onerror()};xhr.onerror=onerror;xhr.send(null)};Module["setWindowTitle"]=(function(title){document.title=title})}else{throw new Error("not compiled for this environment")}Module["print"]=typeof console!=="undefined"?console.log.bind(console):typeof print!=="undefined"?print:null;Module["printErr"]=typeof printErr!=="undefined"?printErr:typeof console!=="undefined"&&console.warn.bind(console)||Module["print"];Module.print=Module["print"];Module.printErr=Module["printErr"];for(key in moduleOverrides){if(moduleOverrides.hasOwnProperty(key)){Module[key]=moduleOverrides[key]}}moduleOverrides=undefined;var STACK_ALIGN=16;function staticAlloc(size){assert(!staticSealed);var ret=STATICTOP;STATICTOP=STATICTOP+size+15&-16;return ret}function dynamicAlloc(size){assert(DYNAMICTOP_PTR);var ret=HEAP32[DYNAMICTOP_PTR>>2];var end=ret+size+15&-16;HEAP32[DYNAMICTOP_PTR>>2]=end;if(end>=TOTAL_MEMORY){var success=enlargeMemory();if(!success){HEAP32[DYNAMICTOP_PTR>>2]=ret;return 0}}return ret}function alignMemory(size,factor){if(!factor)factor=STACK_ALIGN;var ret=size=Math.ceil(size/factor)*factor;return ret}function getNativeTypeSize(type){switch(type){case"i1":case"i8":return 1;case"i16":return 2;case"i32":return 4;case"i64":return 8;case"float":return 4;case"double":return 8;default:{if(type[type.length-1]==="*"){return 4}else if(type[0]==="i"){var bits=parseInt(type.substr(1));assert(bits%8===0);return bits/8}else{return 0}}}}function warnOnce(text){if(!warnOnce.shown)warnOnce.shown={};if(!warnOnce.shown[text]){warnOnce.shown[text]=1;Module.printErr(text)}}var asm2wasmImports={"f64-rem":(function(x,y){return x%y}),"debugger":(function(){debugger})};var jsCallStartIndex=1;var functionPointers=new Array(0);var funcWrappers={};function dynCall(sig,ptr,args){if(args&&args.length){return Module["dynCall_"+sig].apply(null,[ptr].concat(args))}else{return Module["dynCall_"+sig].call(null,ptr)}}var GLOBAL_BASE=1024;var ABORT=0;var EXITSTATUS=0;function assert(condition,text){if(!condition){abort("Assertion failed: "+text)}}function getCFunc(ident){var func=Module["_"+ident];assert(func,"Cannot call unknown function "+ident+", make sure it is exported");return func}var JSfuncs={"stackSave":(function(){stackSave()}),"stackRestore":(function(){stackRestore()}),"arrayToC":(function(arr){var ret=stackAlloc(arr.length);writeArrayToMemory(arr,ret);return ret}),"stringToC":(function(str){var ret=0;if(str!==null&&str!==undefined&&str!==0){var len=(str.length<<2)+1;ret=stackAlloc(len);stringToUTF8(str,ret,len)}return ret})};var toC={"string":JSfuncs["stringToC"],"array":JSfuncs["arrayToC"]};function ccall(ident,returnType,argTypes,args,opts){var func=getCFunc(ident);var cArgs=[];var stack=0;if(args){for(var i=0;i<args.length;i++){var converter=toC[argTypes[i]];if(converter){if(stack===0)stack=stackSave();cArgs[i]=converter(args[i])}else{cArgs[i]=args[i]}}}var ret=func.apply(null,cArgs);if(returnType==="string")ret=Pointer_stringify(ret);else if(returnType==="boolean")ret=Boolean(ret);if(stack!==0){stackRestore(stack)}return ret}function setValue(ptr,value,type,noSafe){type=type||"i8";if(type.charAt(type.length-1)==="*")type="i32";switch(type){case"i1":HEAP8[ptr>>0]=value;break;case"i8":HEAP8[ptr>>0]=value;break;case"i16":HEAP16[ptr>>1]=value;break;case"i32":HEAP32[ptr>>2]=value;break;case"i64":tempI64=[value>>>0,(tempDouble=value,+Math_abs(tempDouble)>=1?tempDouble>0?(Math_min(+Math_floor(tempDouble/4294967296),4294967295)|0)>>>0:~~+Math_ceil((tempDouble- +(~~tempDouble>>>0))/4294967296)>>>0:0)],HEAP32[ptr>>2]=tempI64[0],HEAP32[ptr+4>>2]=tempI64[1];break;case"float":HEAPF32[ptr>>2]=value;break;case"double":HEAPF64[ptr>>3]=value;break;default:abort("invalid type for setValue: "+type)}}var ALLOC_STATIC=2;var ALLOC_NONE=4;function Pointer_stringify(ptr,length){if(length===0||!ptr)return"";var hasUtf=0;var t;var i=0;while(1){t=HEAPU8[ptr+i>>0];hasUtf|=t;if(t==0&&!length)break;i++;if(length&&i==length)break}if(!length)length=i;var ret="";if(hasUtf<128){var MAX_CHUNK=1024;var curr;while(length>0){curr=String.fromCharCode.apply(String,HEAPU8.subarray(ptr,ptr+Math.min(length,MAX_CHUNK)));ret=ret?ret+curr:curr;ptr+=MAX_CHUNK;length-=MAX_CHUNK}return ret}return UTF8ToString(ptr)}var UTF8Decoder=typeof TextDecoder!=="undefined"?new TextDecoder("utf8"):undefined;function UTF8ArrayToString(u8Array,idx){var endPtr=idx;while(u8Array[endPtr])++endPtr;if(endPtr-idx>16&&u8Array.subarray&&UTF8Decoder){return UTF8Decoder.decode(u8Array.subarray(idx,endPtr))}else{var u0,u1,u2,u3,u4,u5;var str="";while(1){u0=u8Array[idx++];if(!u0)return str;if(!(u0&128)){str+=String.fromCharCode(u0);continue}u1=u8Array[idx++]&63;if((u0&224)==192){str+=String.fromCharCode((u0&31)<<6|u1);continue}u2=u8Array[idx++]&63;if((u0&240)==224){u0=(u0&15)<<12|u1<<6|u2}else{u3=u8Array[idx++]&63;if((u0&248)==240){u0=(u0&7)<<18|u1<<12|u2<<6|u3}else{u4=u8Array[idx++]&63;if((u0&252)==248){u0=(u0&3)<<24|u1<<18|u2<<12|u3<<6|u4}else{u5=u8Array[idx++]&63;u0=(u0&1)<<30|u1<<24|u2<<18|u3<<12|u4<<6|u5}}}if(u0<65536){str+=String.fromCharCode(u0)}else{var ch=u0-65536;str+=String.fromCharCode(55296|ch>>10,56320|ch&1023)}}}}function UTF8ToString(ptr){return UTF8ArrayToString(HEAPU8,ptr)}function stringToUTF8Array(str,outU8Array,outIdx,maxBytesToWrite){if(!(maxBytesToWrite>0))return 0;var startIdx=outIdx;var endIdx=outIdx+maxBytesToWrite-1;for(var i=0;i<str.length;++i){var u=str.charCodeAt(i);if(u>=55296&&u<=57343)u=65536+((u&1023)<<10)|str.charCodeAt(++i)&1023;if(u<=127){if(outIdx>=endIdx)break;outU8Array[outIdx++]=u}else if(u<=2047){if(outIdx+1>=endIdx)break;outU8Array[outIdx++]=192|u>>6;outU8Array[outIdx++]=128|u&63}else if(u<=65535){if(outIdx+2>=endIdx)break;outU8Array[outIdx++]=224|u>>12;outU8Array[outIdx++]=128|u>>6&63;outU8Array[outIdx++]=128|u&63}else if(u<=2097151){if(outIdx+3>=endIdx)break;outU8Array[outIdx++]=240|u>>18;outU8Array[outIdx++]=128|u>>12&63;outU8Array[outIdx++]=128|u>>6&63;outU8Array[outIdx++]=128|u&63}else if(u<=67108863){if(outIdx+4>=endIdx)break;outU8Array[outIdx++]=248|u>>24;outU8Array[outIdx++]=128|u>>18&63;outU8Array[outIdx++]=128|u>>12&63;outU8Array[outIdx++]=128|u>>6&63;outU8Array[outIdx++]=128|u&63}else{if(outIdx+5>=endIdx)break;outU8Array[outIdx++]=252|u>>30;outU8Array[outIdx++]=128|u>>24&63;outU8Array[outIdx++]=128|u>>18&63;outU8Array[outIdx++]=128|u>>12&63;outU8Array[outIdx++]=128|u>>6&63;outU8Array[outIdx++]=128|u&63}}outU8Array[outIdx]=0;return outIdx-startIdx}function stringToUTF8(str,outPtr,maxBytesToWrite){return stringToUTF8Array(str,HEAPU8,outPtr,maxBytesToWrite)}function lengthBytesUTF8(str){var len=0;for(var i=0;i<str.length;++i){var u=str.charCodeAt(i);if(u>=55296&&u<=57343)u=65536+((u&1023)<<10)|str.charCodeAt(++i)&1023;if(u<=127){++len}else if(u<=2047){len+=2}else if(u<=65535){len+=3}else if(u<=2097151){len+=4}else if(u<=67108863){len+=5}else{len+=6}}return len}var UTF16Decoder=typeof TextDecoder!=="undefined"?new TextDecoder("utf-16le"):undefined;function demangle(func){return func}function demangleAll(text){var regex=/__Z[\w\d_]+/g;return text.replace(regex,(function(x){var y=demangle(x);return x===y?x:x+" ["+y+"]"}))}function jsStackTrace(){var err=new Error;if(!err.stack){try{throw new Error(0)}catch(e){err=e}if(!err.stack){return"(no stack trace available)"}}return err.stack.toString()}var WASM_PAGE_SIZE=65536;var ASMJS_PAGE_SIZE=16777216;function alignUp(x,multiple){if(x%multiple>0){x+=multiple-x%multiple}return x}var buffer,HEAP8,HEAPU8,HEAP16,HEAPU16,HEAP32,HEAPU32,HEAPF32,HEAPF64;function updateGlobalBuffer(buf){Module["buffer"]=buffer=buf}function updateGlobalBufferViews(){Module["HEAP8"]=HEAP8=new Int8Array(buffer);Module["HEAP16"]=HEAP16=new Int16Array(buffer);Module["HEAP32"]=HEAP32=new Int32Array(buffer);Module["HEAPU8"]=HEAPU8=new Uint8Array(buffer);Module["HEAPU16"]=HEAPU16=new Uint16Array(buffer);Module["HEAPU32"]=HEAPU32=new Uint32Array(buffer);Module["HEAPF32"]=HEAPF32=new Float32Array(buffer);Module["HEAPF64"]=HEAPF64=new Float64Array(buffer)}var STATIC_BASE,STATICTOP,staticSealed;var STACK_BASE,STACKTOP,STACK_MAX;var DYNAMIC_BASE,DYNAMICTOP_PTR;STATIC_BASE=STATICTOP=STACK_BASE=STACKTOP=STACK_MAX=DYNAMIC_BASE=DYNAMICTOP_PTR=0;staticSealed=false;function abortOnCannotGrowMemory(){abort("Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value "+TOTAL_MEMORY+", (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ")}function enlargeMemory(){abortOnCannotGrowMemory()}var TOTAL_STACK=Module["TOTAL_STACK"]||5242880;var TOTAL_MEMORY=Module["TOTAL_MEMORY"]||33554432;if(TOTAL_MEMORY<TOTAL_STACK)Module.printErr("TOTAL_MEMORY should be larger than TOTAL_STACK, was "+TOTAL_MEMORY+"! (TOTAL_STACK="+TOTAL_STACK+")");if(Module["buffer"]){buffer=Module["buffer"]}else{if(typeof WebAssembly==="object"&&typeof WebAssembly.Memory==="function"){Module["wasmMemory"]=new WebAssembly.Memory({"initial":TOTAL_MEMORY/WASM_PAGE_SIZE,"maximum":TOTAL_MEMORY/WASM_PAGE_SIZE});buffer=Module["wasmMemory"].buffer}else{buffer=new ArrayBuffer(TOTAL_MEMORY)}Module["buffer"]=buffer}updateGlobalBufferViews();function getTotalMemory(){return TOTAL_MEMORY}HEAP32[0]=1668509029;HEAP16[1]=25459;if(HEAPU8[2]!==115||HEAPU8[3]!==99)throw"Runtime error: expected the system to be little-endian!";function callRuntimeCallbacks(callbacks){while(callbacks.length>0){var callback=callbacks.shift();if(typeof callback=="function"){callback();continue}var func=callback.func;if(typeof func==="number"){if(callback.arg===undefined){Module["dynCall_v"](func)}else{Module["dynCall_vi"](func,callback.arg)}}else{func(callback.arg===undefined?null:callback.arg)}}}var __ATPRERUN__=[];var __ATINIT__=[];var __ATMAIN__=[];var __ATEXIT__=[];var __ATPOSTRUN__=[];var runtimeInitialized=false;var runtimeExited=false;function preRun(){if(Module["preRun"]){if(typeof Module["preRun"]=="function")Module["preRun"]=[Module["preRun"]];while(Module["preRun"].length){addOnPreRun(Module["preRun"].shift())}}callRuntimeCallbacks(__ATPRERUN__)}function ensureInitRuntime(){if(runtimeInitialized)return;runtimeInitialized=true;callRuntimeCallbacks(__ATINIT__)}function preMain(){callRuntimeCallbacks(__ATMAIN__)}function exitRuntime(){callRuntimeCallbacks(__ATEXIT__);runtimeExited=true}function postRun(){if(Module["postRun"]){if(typeof Module["postRun"]=="function")Module["postRun"]=[Module["postRun"]];while(Module["postRun"].length){addOnPostRun(Module["postRun"].shift())}}callRuntimeCallbacks(__ATPOSTRUN__)}function addOnPreRun(cb){__ATPRERUN__.unshift(cb)}function addOnPostRun(cb){__ATPOSTRUN__.unshift(cb)}function writeArrayToMemory(array,buffer){HEAP8.set(array,buffer)}function writeAsciiToMemory(str,buffer,dontAddNull){for(var i=0;i<str.length;++i){HEAP8[buffer++>>0]=str.charCodeAt(i)}if(!dontAddNull)HEAP8[buffer>>0]=0}var Math_abs=Math.abs;var Math_cos=Math.cos;var Math_sin=Math.sin;var Math_tan=Math.tan;var Math_acos=Math.acos;var Math_asin=Math.asin;var Math_atan=Math.atan;var Math_atan2=Math.atan2;var Math_exp=Math.exp;var Math_log=Math.log;var Math_sqrt=Math.sqrt;var Math_ceil=Math.ceil;var Math_floor=Math.floor;var Math_pow=Math.pow;var Math_imul=Math.imul;var Math_fround=Math.fround;var Math_round=Math.round;var Math_min=Math.min;var Math_max=Math.max;var Math_clz32=Math.clz32;var Math_trunc=Math.trunc;var runDependencies=0;var runDependencyWatcher=null;var dependenciesFulfilled=null;function addRunDependency(id){runDependencies++;if(Module["monitorRunDependencies"]){Module["monitorRunDependencies"](runDependencies)}}function removeRunDependency(id){runDependencies--;if(Module["monitorRunDependencies"]){Module["monitorRunDependencies"](runDependencies)}if(runDependencies==0){if(runDependencyWatcher!==null){clearInterval(runDependencyWatcher);runDependencyWatcher=null}if(dependenciesFulfilled){var callback=dependenciesFulfilled;dependenciesFulfilled=null;callback()}}}Module["preloadedImages"]={};Module["preloadedAudios"]={};var dataURIPrefix="data:application/octet-stream;base64,";function isDataURI(filename){return String.prototype.startsWith?filename.startsWith(dataURIPrefix):filename.indexOf(dataURIPrefix)===0}function integrateWasmJS(){var wasmTextFile="lf_core.wast";var wasmBinaryFile="lf_core.wasm";var asmjsCodeFile="lf_core.temp.asm.js";if(typeof Module["locateFile"]==="function"){if(!isDataURI(wasmTextFile)){wasmTextFile=Module["locateFile"](wasmTextFile)}if(!isDataURI(wasmBinaryFile)){wasmBinaryFile=Module["locateFile"](wasmBinaryFile)}if(!isDataURI(asmjsCodeFile)){asmjsCodeFile=Module["locateFile"](asmjsCodeFile)}}var wasmPageSize=64*1024;var info={"global":null,"env":null,"asm2wasm":asm2wasmImports,"parent":Module};var exports=null;function mergeMemory(newBuffer){var oldBuffer=Module["buffer"];if(newBuffer.byteLength<oldBuffer.byteLength){Module["printErr"]("the new buffer in mergeMemory is smaller than the previous one. in native wasm, we should grow memory here")}var oldView=new Int8Array(oldBuffer);var newView=new Int8Array(newBuffer);newView.set(oldView);updateGlobalBuffer(newBuffer);updateGlobalBufferViews()}function fixImports(imports){return imports}function getBinary(){try{if(Module["wasmBinary"]){return new Uint8Array(Module["wasmBinary"])}if(Module["readBinary"]){return Module["readBinary"](wasmBinaryFile)}else{throw"on the web, we need the wasm binary to be preloaded and set on Module['wasmBinary']. emcc.py will do that for you when generating HTML (but not JS)"}}catch(err){abort(err)}}function getBinaryPromise(){if(!Module["wasmBinary"]&&(ENVIRONMENT_IS_WEB||ENVIRONMENT_IS_WORKER)&&typeof fetch==="function"){return fetch(wasmBinaryFile,{credentials:"same-origin"}).then((function(response){if(!response["ok"]){throw"failed to load wasm binary file at '"+wasmBinaryFile+"'"}return response["arrayBuffer"]()})).catch((function(){return getBinary()}))}return new Promise((function(resolve,reject){resolve(getBinary())}))}function doNativeWasm(global,env,providedBuffer){if(typeof WebAssembly!=="object"){Module["printErr"]("no native wasm support detected");return false}if(!(Module["wasmMemory"]instanceof WebAssembly.Memory)){Module["printErr"]("no native wasm Memory in use");return false}env["memory"]=Module["wasmMemory"];info["global"]={"NaN":NaN,"Infinity":Infinity};info["global.Math"]=Math;info["env"]=env;function receiveInstance(instance,module){exports=instance.exports;if(exports.memory)mergeMemory(exports.memory);Module["asm"]=exports;Module["usingWasm"]=true;removeRunDependency("wasm-instantiate")}addRunDependency("wasm-instantiate");if(Module["instantiateWasm"]){try{return Module["instantiateWasm"](info,receiveInstance)}catch(e){Module["printErr"]("Module.instantiateWasm callback failed with error: "+e);return false}}function receiveInstantiatedSource(output){receiveInstance(output["instance"],output["module"])}function instantiateArrayBuffer(receiver){getBinaryPromise().then((function(binary){return WebAssembly.instantiate(binary,info)})).then(receiver).catch((function(reason){Module["printErr"]("failed to asynchronously prepare wasm: "+reason);abort(reason)}))}if(!Module["wasmBinary"]&&typeof WebAssembly.instantiateStreaming==="function"&&!isDataURI(wasmBinaryFile)&&typeof fetch==="function"){WebAssembly.instantiateStreaming(fetch(wasmBinaryFile,{credentials:"same-origin"}),info).then(receiveInstantiatedSource).catch((function(reason){Module["printErr"]("wasm streaming compile failed: "+reason);Module["printErr"]("falling back to ArrayBuffer instantiation");instantiateArrayBuffer(receiveInstantiatedSource)}))}else{instantiateArrayBuffer(receiveInstantiatedSource)}return{}}Module["asmPreload"]=Module["asm"];var asmjsReallocBuffer=Module["reallocBuffer"];var wasmReallocBuffer=(function(size){var PAGE_MULTIPLE=Module["usingWasm"]?WASM_PAGE_SIZE:ASMJS_PAGE_SIZE;size=alignUp(size,PAGE_MULTIPLE);var old=Module["buffer"];var oldSize=old.byteLength;if(Module["usingWasm"]){try{var result=Module["wasmMemory"].grow((size-oldSize)/wasmPageSize);if(result!==(-1|0)){return Module["buffer"]=Module["wasmMemory"].buffer}else{return null}}catch(e){return null}}});Module["reallocBuffer"]=(function(size){if(finalMethod==="asmjs"){return asmjsReallocBuffer(size)}else{return wasmReallocBuffer(size)}});var finalMethod="";Module["asm"]=(function(global,env,providedBuffer){env=fixImports(env);if(!env["table"]){var TABLE_SIZE=Module["wasmTableSize"];if(TABLE_SIZE===undefined)TABLE_SIZE=1024;var MAX_TABLE_SIZE=Module["wasmMaxTableSize"];if(typeof WebAssembly==="object"&&typeof WebAssembly.Table==="function"){if(MAX_TABLE_SIZE!==undefined){env["table"]=new WebAssembly.Table({"initial":TABLE_SIZE,"maximum":MAX_TABLE_SIZE,"element":"anyfunc"})}else{env["table"]=new WebAssembly.Table({"initial":TABLE_SIZE,element:"anyfunc"})}}else{env["table"]=new Array(TABLE_SIZE)}Module["wasmTable"]=env["table"]}if(!env["memoryBase"]){env["memoryBase"]=Module["STATIC_BASE"]}if(!env["tableBase"]){env["tableBase"]=0}var exports;exports=doNativeWasm(global,env,providedBuffer);assert(exports,"no binaryen method succeeded.");return exports});}integrateWasmJS();STATIC_BASE=GLOBAL_BASE;STATICTOP=STATIC_BASE+10064;__ATINIT__.push();var STATIC_BUMP=10064;Module["STATIC_BASE"]=STATIC_BASE;Module["STATIC_BUMP"]=STATIC_BUMP;var tempDoublePtr=STATICTOP;STATICTOP+=16;function __ZSt18uncaught_exceptionv(){return!!__ZSt18uncaught_exceptionv.uncaught_exception}var EXCEPTIONS={last:0,caught:[],infos:{},deAdjust:(function(adjusted){if(!adjusted||EXCEPTIONS.infos[adjusted])return adjusted;for(var key in EXCEPTIONS.infos){var ptr=+key;var info=EXCEPTIONS.infos[ptr];if(info.adjusted===adjusted){return ptr}}return adjusted}),addRef:(function(ptr){if(!ptr)return;var info=EXCEPTIONS.infos[ptr];info.refcount++}),decRef:(function(ptr){if(!ptr)return;var info=EXCEPTIONS.infos[ptr];assert(info.refcount>0);info.refcount--;if(info.refcount===0&&!info.rethrown){if(info.destructor){Module["dynCall_vi"](info.destructor,ptr)}delete EXCEPTIONS.infos[ptr];___cxa_free_exception(ptr)}}),clearRef:(function(ptr){if(!ptr)return;var info=EXCEPTIONS.infos[ptr];info.refcount=0})};function ___cxa_begin_catch(ptr){var info=EXCEPTIONS.infos[ptr];if(info&&!info.caught){info.caught=true;__ZSt18uncaught_exceptionv.uncaught_exception--}if(info)info.rethrown=false;EXCEPTIONS.caught.push(ptr);EXCEPTIONS.addRef(EXCEPTIONS.deAdjust(ptr));return ptr}function ___cxa_pure_virtual(){ABORT=true;throw"Pure virtual function called!"}function ___resumeException(ptr){if(!EXCEPTIONS.last){EXCEPTIONS.last=ptr}throw ptr+" - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch."}function ___cxa_find_matching_catch(){var thrown=EXCEPTIONS.last;if(!thrown){return(setTempRet0(0),0)|0}var info=EXCEPTIONS.infos[thrown];var throwntype=info.type;if(!throwntype){return(setTempRet0(0),thrown)|0}var typeArray=Array.prototype.slice.call(arguments);var pointer=Module["___cxa_is_pointer_type"](throwntype);if(!___cxa_find_matching_catch.buffer)___cxa_find_matching_catch.buffer=_malloc(4);HEAP32[___cxa_find_matching_catch.buffer>>2]=thrown;thrown=___cxa_find_matching_catch.buffer;for(var i=0;i<typeArray.length;i++){if(typeArray[i]&&Module["___cxa_can_catch"](typeArray[i],throwntype,thrown)){thrown=HEAP32[thrown>>2];info.adjusted=thrown;return(setTempRet0(typeArray[i]),thrown)|0}}thrown=HEAP32[thrown>>2];return(setTempRet0(throwntype),thrown)|0}function ___gxx_personality_v0(){}var SYSCALLS={varargs:0,get:(function(varargs){SYSCALLS.varargs+=4;var ret=HEAP32[SYSCALLS.varargs-4>>2];return ret}),getStr:(function(){var ret=Pointer_stringify(SYSCALLS.get());return ret}),get64:(function(){var low=SYSCALLS.get(),high=SYSCALLS.get();if(low>=0)assert(high===0);else assert(high===-1);return low}),getZero:(function(){assert(SYSCALLS.get()===0)})};function ___syscall140(which,varargs){SYSCALLS.varargs=varargs;try{var stream=SYSCALLS.getStreamFromFD(),offset_high=SYSCALLS.get(),offset_low=SYSCALLS.get(),result=SYSCALLS.get(),whence=SYSCALLS.get();var offset=offset_low;FS.llseek(stream,offset,whence);HEAP32[result>>2]=stream.position;if(stream.getdents&&offset===0&&whence===0)stream.getdents=null;return 0}catch(e){if(typeof FS==="undefined"||!(e instanceof FS.ErrnoError))abort(e);return-e.errno}}function flush_NO_FILESYSTEM(){var fflush=Module["_fflush"];if(fflush)fflush(0);var printChar=___syscall146.printChar;if(!printChar)return;var buffers=___syscall146.buffers;if(buffers[1].length)printChar(1,10);if(buffers[2].length)printChar(2,10)}function ___syscall146(which,varargs){SYSCALLS.varargs=varargs;try{var stream=SYSCALLS.get(),iov=SYSCALLS.get(),iovcnt=SYSCALLS.get();var ret=0;if(!___syscall146.buffers){___syscall146.buffers=[null,[],[]];___syscall146.printChar=(function(stream,curr){var buffer=___syscall146.buffers[stream];assert(buffer);if(curr===0||curr===10){(stream===1?Module["print"]:Module["printErr"])(UTF8ArrayToString(buffer,0));buffer.length=0}else{buffer.push(curr)}})}for(var i=0;i<iovcnt;i++){var ptr=HEAP32[iov+i*8>>2];var len=HEAP32[iov+(i*8+4)>>2];for(var j=0;j<len;j++){___syscall146.printChar(stream,HEAPU8[ptr+j])}ret+=len}return ret}catch(e){if(typeof FS==="undefined"||!(e instanceof FS.ErrnoError))abort(e);return-e.errno}}function ___syscall6(which,varargs){SYSCALLS.varargs=varargs;try{var stream=SYSCALLS.getStreamFromFD();FS.close(stream);return 0}catch(e){if(typeof FS==="undefined"||!(e instanceof FS.ErrnoError))abort(e);return-e.errno}}function _abort(){Module["abort"]()}function _b2WorldBeginContactBody(worldPtr,contactPtr){b2World.BeginContactBody(worldPtr,contactPtr)}function _b2WorldEndContactBody(worldPtr,contactPtr){b2World.EndContactBody(worldPtr,contactPtr)}function _b2WorldPostSolve(worldPtr,contactPtr,impulsePtr){b2World.PostSolve(worldPtr,contactPtr,impulsePtr)}function _b2WorldPreSolve(worldPtr,contactPtr,oldManifoldPtr){b2World.PreSolve(worldPtr,contactPtr,oldManifoldPtr)}function _b2WorldQueryAABB(worldPtr,fixturePtr){return b2World.QueryAABB(worldPtr,fixturePtr)}function _b2WorldRayCastCallback(worldPtr,fixturePtr,pointX,pointY,normalX,normalY,fraction){return b2World.RayCast(worldPtr,fixturePtr,pointX,pointY,normalX,normalY,fraction)}var _llvm_floor_f32=Math_floor;function _llvm_trap(){abort("trap!")}function _emscripten_memcpy_big(dest,src,num){HEAPU8.set(HEAPU8.subarray(src,src+num),dest);return dest}var PTHREAD_SPECIFIC={};function _pthread_getspecific(key){return PTHREAD_SPECIFIC[key]||0}var PTHREAD_SPECIFIC_NEXT_KEY=1;var ERRNO_CODES={EPERM:1,ENOENT:2,ESRCH:3,EINTR:4,EIO:5,ENXIO:6,E2BIG:7,ENOEXEC:8,EBADF:9,ECHILD:10,EAGAIN:11,EWOULDBLOCK:11,ENOMEM:12,EACCES:13,EFAULT:14,ENOTBLK:15,EBUSY:16,EEXIST:17,EXDEV:18,ENODEV:19,ENOTDIR:20,EISDIR:21,EINVAL:22,ENFILE:23,EMFILE:24,ENOTTY:25,ETXTBSY:26,EFBIG:27,ENOSPC:28,ESPIPE:29,EROFS:30,EMLINK:31,EPIPE:32,EDOM:33,ERANGE:34,ENOMSG:42,EIDRM:43,ECHRNG:44,EL2NSYNC:45,EL3HLT:46,EL3RST:47,ELNRNG:48,EUNATCH:49,ENOCSI:50,EL2HLT:51,EDEADLK:35,ENOLCK:37,EBADE:52,EBADR:53,EXFULL:54,ENOANO:55,EBADRQC:56,EBADSLT:57,EDEADLOCK:35,EBFONT:59,ENOSTR:60,ENODATA:61,ETIME:62,ENOSR:63,ENONET:64,ENOPKG:65,EREMOTE:66,ENOLINK:67,EADV:68,ESRMNT:69,ECOMM:70,EPROTO:71,EMULTIHOP:72,EDOTDOT:73,EBADMSG:74,ENOTUNIQ:76,EBADFD:77,EREMCHG:78,ELIBACC:79,ELIBBAD:80,ELIBSCN:81,ELIBMAX:82,ELIBEXEC:83,ENOSYS:38,ENOTEMPTY:39,ENAMETOOLONG:36,ELOOP:40,EOPNOTSUPP:95,EPFNOSUPPORT:96,ECONNRESET:104,ENOBUFS:105,EAFNOSUPPORT:97,EPROTOTYPE:91,ENOTSOCK:88,ENOPROTOOPT:92,ESHUTDOWN:108,ECONNREFUSED:111,EADDRINUSE:98,ECONNABORTED:103,ENETUNREACH:101,ENETDOWN:100,ETIMEDOUT:110,EHOSTDOWN:112,EHOSTUNREACH:113,EINPROGRESS:115,EALREADY:114,EDESTADDRREQ:89,EMSGSIZE:90,EPROTONOSUPPORT:93,ESOCKTNOSUPPORT:94,EADDRNOTAVAIL:99,ENETRESET:102,EISCONN:106,ENOTCONN:107,ETOOMANYREFS:109,EUSERS:87,EDQUOT:122,ESTALE:116,ENOTSUP:95,ENOMEDIUM:123,EILSEQ:84,EOVERFLOW:75,ECANCELED:125,ENOTRECOVERABLE:131,EOWNERDEAD:130,ESTRPIPE:86};function _pthread_key_create(key,destructor){if(key==0){return ERRNO_CODES.EINVAL}HEAP32[key>>2]=PTHREAD_SPECIFIC_NEXT_KEY;PTHREAD_SPECIFIC[PTHREAD_SPECIFIC_NEXT_KEY]=0;PTHREAD_SPECIFIC_NEXT_KEY++;return 0}function _pthread_once(ptr,func){if(!_pthread_once.seen)_pthread_once.seen={};if(ptr in _pthread_once.seen)return;Module["dynCall_v"](func);_pthread_once.seen[ptr]=1}function _pthread_setspecific(key,value){if(!(key in PTHREAD_SPECIFIC)){return ERRNO_CODES.EINVAL}PTHREAD_SPECIFIC[key]=value;return 0}function ___setErrNo(value){if(Module["___errno_location"])HEAP32[Module["___errno_location"]()>>2]=value;return value}DYNAMICTOP_PTR=staticAlloc(4);STACK_BASE=STACKTOP=alignMemory(STATICTOP);STACK_MAX=STACK_BASE+TOTAL_STACK;DYNAMIC_BASE=alignMemory(STACK_MAX);HEAP32[DYNAMICTOP_PTR>>2]=DYNAMIC_BASE;staticSealed=true;var ASSERTIONS=false;Module["wasmTableSize"]=292;Module["wasmMaxTableSize"]=292;function invoke_fif(index,a1,a2){try{return Module["dynCall_fif"](index,a1,a2)}catch(e){if(typeof e!=="number"&&e!=="longjmp")throw e;Module["setThrew"](1,0)}}function invoke_fiiiif(index,a1,a2,a3,a4,a5){try{return Module["dynCall_fiiiif"](index,a1,a2,a3,a4,a5)}catch(e){if(typeof e!=="number"&&e!=="longjmp")throw e;Module["setThrew"](1,0)}}function invoke_fiiiiif(index,a1,a2,a3,a4,a5,a6){try{return Module["dynCall_fiiiiif"](index,a1,a2,a3,a4,a5,a6)}catch(e){if(typeof e!=="number"&&e!=="longjmp")throw e;Module["setThrew"](1,0)}}function invoke_ii(index,a1){try{return Module["dynCall_ii"](index,a1)}catch(e){if(typeof e!=="number"&&e!=="longjmp")throw e;Module["setThrew"](1,0)}}function invoke_iii(index,a1,a2){try{return Module["dynCall_iii"](index,a1,a2)}catch(e){if(typeof e!=="number"&&e!=="longjmp")throw e;Module["setThrew"](1,0)}}function invoke_iiii(index,a1,a2,a3){try{return Module["dynCall_iiii"](index,a1,a2,a3)}catch(e){if(typeof e!=="number"&&e!=="longjmp")throw e;Module["setThrew"](1,0)}}function invoke_iiiii(index,a1,a2,a3,a4){try{return Module["dynCall_iiiii"](index,a1,a2,a3,a4)}catch(e){if(typeof e!=="number"&&e!=="longjmp")throw e;Module["setThrew"](1,0)}}function invoke_iiiiii(index,a1,a2,a3,a4,a5){try{return Module["dynCall_iiiiii"](index,a1,a2,a3,a4,a5)}catch(e){if(typeof e!=="number"&&e!=="longjmp")throw e;Module["setThrew"](1,0)}}function invoke_v(index){try{Module["dynCall_v"](index)}catch(e){if(typeof e!=="number"&&e!=="longjmp")throw e;Module["setThrew"](1,0)}}function invoke_vi(index,a1){try{Module["dynCall_vi"](index,a1)}catch(e){if(typeof e!=="number"&&e!=="longjmp")throw e;Module["setThrew"](1,0)}}function invoke_vii(index,a1,a2){try{Module["dynCall_vii"](index,a1,a2)}catch(e){if(typeof e!=="number"&&e!=="longjmp")throw e;Module["setThrew"](1,0)}}function invoke_viif(index,a1,a2,a3){try{Module["dynCall_viif"](index,a1,a2,a3)}catch(e){if(typeof e!=="number"&&e!=="longjmp")throw e;Module["setThrew"](1,0)}}function invoke_viii(index,a1,a2,a3){try{Module["dynCall_viii"](index,a1,a2,a3)}catch(e){if(typeof e!=="number"&&e!=="longjmp")throw e;Module["setThrew"](1,0)}}function invoke_viiii(index,a1,a2,a3,a4){try{Module["dynCall_viiii"](index,a1,a2,a3,a4)}catch(e){if(typeof e!=="number"&&e!=="longjmp")throw e;Module["setThrew"](1,0)}}function invoke_viiiii(index,a1,a2,a3,a4,a5){try{Module["dynCall_viiiii"](index,a1,a2,a3,a4,a5)}catch(e){if(typeof e!=="number"&&e!=="longjmp")throw e;Module["setThrew"](1,0)}}function invoke_viiiiii(index,a1,a2,a3,a4,a5,a6){try{Module["dynCall_viiiiii"](index,a1,a2,a3,a4,a5,a6)}catch(e){if(typeof e!=="number"&&e!=="longjmp")throw e;Module["setThrew"](1,0)}}Module.asmGlobalArg={};Module.asmLibraryArg={"abort":abort,"assert":assert,"enlargeMemory":enlargeMemory,"getTotalMemory":getTotalMemory,"abortOnCannotGrowMemory":abortOnCannotGrowMemory,"invoke_fif":invoke_fif,"invoke_fiiiif":invoke_fiiiif,"invoke_fiiiiif":invoke_fiiiiif,"invoke_ii":invoke_ii,"invoke_iii":invoke_iii,"invoke_iiii":invoke_iiii,"invoke_iiiii":invoke_iiiii,"invoke_iiiiii":invoke_iiiiii,"invoke_v":invoke_v,"invoke_vi":invoke_vi,"invoke_vii":invoke_vii,"invoke_viif":invoke_viif,"invoke_viii":invoke_viii,"invoke_viiii":invoke_viiii,"invoke_viiiii":invoke_viiiii,"invoke_viiiiii":invoke_viiiiii,"__ZSt18uncaught_exceptionv":__ZSt18uncaught_exceptionv,"___cxa_begin_catch":___cxa_begin_catch,"___cxa_find_matching_catch":___cxa_find_matching_catch,"___cxa_pure_virtual":___cxa_pure_virtual,"___gxx_personality_v0":___gxx_personality_v0,"___resumeException":___resumeException,"___setErrNo":___setErrNo,"___syscall140":___syscall140,"___syscall146":___syscall146,"___syscall6":___syscall6,"_abort":_abort,"_b2WorldBeginContactBody":_b2WorldBeginContactBody,"_b2WorldEndContactBody":_b2WorldEndContactBody,"_b2WorldPostSolve":_b2WorldPostSolve,"_b2WorldPreSolve":_b2WorldPreSolve,"_b2WorldQueryAABB":_b2WorldQueryAABB,"_b2WorldRayCastCallback":_b2WorldRayCastCallback,"_emscripten_memcpy_big":_emscripten_memcpy_big,"_llvm_floor_f32":_llvm_floor_f32,"_llvm_trap":_llvm_trap,"_pthread_getspecific":_pthread_getspecific,"_pthread_key_create":_pthread_key_create,"_pthread_once":_pthread_once,"_pthread_setspecific":_pthread_setspecific,"flush_NO_FILESYSTEM":flush_NO_FILESYSTEM,"DYNAMICTOP_PTR":DYNAMICTOP_PTR,"tempDoublePtr":tempDoublePtr,"ABORT":ABORT,"STACKTOP":STACKTOP,"STACK_MAX":STACK_MAX};var asm=Module["asm"](Module.asmGlobalArg,Module.asmLibraryArg,buffer);Module["asm"]=asm;var ___cxa_can_catch=Module["___cxa_can_catch"]=(function(){return Module["asm"]["___cxa_can_catch"].apply(null,arguments)});var ___cxa_is_pointer_type=Module["___cxa_is_pointer_type"]=(function(){return Module["asm"]["___cxa_is_pointer_type"].apply(null,arguments)});var ___errno_location=Module["___errno_location"]=(function(){return Module["asm"]["___errno_location"].apply(null,arguments)});var _b2Body_ApplyAngularImpulse=Module["_b2Body_ApplyAngularImpulse"]=(function(){return Module["asm"]["_b2Body_ApplyAngularImpulse"].apply(null,arguments)});var _b2Body_ApplyForce=Module["_b2Body_ApplyForce"]=(function(){return Module["asm"]["_b2Body_ApplyForce"].apply(null,arguments)});var _b2Body_ApplyForceToCenter=Module["_b2Body_ApplyForceToCenter"]=(function(){return Module["asm"]["_b2Body_ApplyForceToCenter"].apply(null,arguments)});var _b2Body_ApplyLinearImpulse=Module["_b2Body_ApplyLinearImpulse"]=(function(){return Module["asm"]["_b2Body_ApplyLinearImpulse"].apply(null,arguments)});var _b2Body_ApplyTorque=Module["_b2Body_ApplyTorque"]=(function(){return Module["asm"]["_b2Body_ApplyTorque"].apply(null,arguments)});var _b2Body_DestroyFixture=Module["_b2Body_DestroyFixture"]=(function(){return Module["asm"]["_b2Body_DestroyFixture"].apply(null,arguments)});var _b2Body_GetAngle=Module["_b2Body_GetAngle"]=(function(){return Module["asm"]["_b2Body_GetAngle"].apply(null,arguments)});var _b2Body_GetAngularVelocity=Module["_b2Body_GetAngularVelocity"]=(function(){return Module["asm"]["_b2Body_GetAngularVelocity"].apply(null,arguments)});var _b2Body_GetInertia=Module["_b2Body_GetInertia"]=(function(){return Module["asm"]["_b2Body_GetInertia"].apply(null,arguments)});var _b2Body_GetLinearVelocity=Module["_b2Body_GetLinearVelocity"]=(function(){return Module["asm"]["_b2Body_GetLinearVelocity"].apply(null,arguments)});var _b2Body_GetLocalPoint=Module["_b2Body_GetLocalPoint"]=(function(){return Module["asm"]["_b2Body_GetLocalPoint"].apply(null,arguments)});var _b2Body_GetLocalVector=Module["_b2Body_GetLocalVector"]=(function(){return Module["asm"]["_b2Body_GetLocalVector"].apply(null,arguments)});var _b2Body_GetMass=Module["_b2Body_GetMass"]=(function(){return Module["asm"]["_b2Body_GetMass"].apply(null,arguments)});var _b2Body_GetPosition=Module["_b2Body_GetPosition"]=(function(){return Module["asm"]["_b2Body_GetPosition"].apply(null,arguments)});var _b2Body_GetTransform=Module["_b2Body_GetTransform"]=(function(){return Module["asm"]["_b2Body_GetTransform"].apply(null,arguments)});var _b2Body_GetType=Module["_b2Body_GetType"]=(function(){return Module["asm"]["_b2Body_GetType"].apply(null,arguments)});var _b2Body_GetWorldCenter=Module["_b2Body_GetWorldCenter"]=(function(){return Module["asm"]["_b2Body_GetWorldCenter"].apply(null,arguments)});var _b2Body_GetWorldPoint=Module["_b2Body_GetWorldPoint"]=(function(){return Module["asm"]["_b2Body_GetWorldPoint"].apply(null,arguments)});var _b2Body_GetWorldVector=Module["_b2Body_GetWorldVector"]=(function(){return Module["asm"]["_b2Body_GetWorldVector"].apply(null,arguments)});var _b2Body_SetAngularVelocity=Module["_b2Body_SetAngularVelocity"]=(function(){return Module["asm"]["_b2Body_SetAngularVelocity"].apply(null,arguments)});var _b2Body_SetAwake=Module["_b2Body_SetAwake"]=(function(){return Module["asm"]["_b2Body_SetAwake"].apply(null,arguments)});var _b2Body_SetFixedRotation=Module["_b2Body_SetFixedRotation"]=(function(){return Module["asm"]["_b2Body_SetFixedRotation"].apply(null,arguments)});var _b2Body_SetLinearVelocity=Module["_b2Body_SetLinearVelocity"]=(function(){return Module["asm"]["_b2Body_SetLinearVelocity"].apply(null,arguments)});var _b2Body_SetMassData=Module["_b2Body_SetMassData"]=(function(){return Module["asm"]["_b2Body_SetMassData"].apply(null,arguments)});var _b2Body_SetTransform=Module["_b2Body_SetTransform"]=(function(){return Module["asm"]["_b2Body_SetTransform"].apply(null,arguments)});var _b2Body_SetType=Module["_b2Body_SetType"]=(function(){return Module["asm"]["_b2Body_SetType"].apply(null,arguments)});var _b2ChainShape_CreateFixture=Module["_b2ChainShape_CreateFixture"]=(function(){return Module["asm"]["_b2ChainShape_CreateFixture"].apply(null,arguments)});var _b2CircleShape_CreateFixture=Module["_b2CircleShape_CreateFixture"]=(function(){return Module["asm"]["_b2CircleShape_CreateFixture"].apply(null,arguments)});var _b2CircleShape_CreateParticleGroup=Module["_b2CircleShape_CreateParticleGroup"]=(function(){return Module["asm"]["_b2CircleShape_CreateParticleGroup"].apply(null,arguments)});var _b2CircleShape_DestroyParticlesInShape=Module["_b2CircleShape_DestroyParticlesInShape"]=(function(){return Module["asm"]["_b2CircleShape_DestroyParticlesInShape"].apply(null,arguments)});var _b2Contact_GetManifold=Module["_b2Contact_GetManifold"]=(function(){return Module["asm"]["_b2Contact_GetManifold"].apply(null,arguments)});var _b2Contact_GetWorldManifold=Module["_b2Contact_GetWorldManifold"]=(function(){return Module["asm"]["_b2Contact_GetWorldManifold"].apply(null,arguments)});var _b2DistanceJointDef_Create=Module["_b2DistanceJointDef_Create"]=(function(){return Module["asm"]["_b2DistanceJointDef_Create"].apply(null,arguments)});var _b2EdgeShape_CreateFixture=Module["_b2EdgeShape_CreateFixture"]=(function(){return Module["asm"]["_b2EdgeShape_CreateFixture"].apply(null,arguments)});var _b2Fixture_TestPoint=Module["_b2Fixture_TestPoint"]=(function(){return Module["asm"]["_b2Fixture_TestPoint"].apply(null,arguments)});var _b2FrictionJointDef_Create=Module["_b2FrictionJointDef_Create"]=(function(){return Module["asm"]["_b2FrictionJointDef_Create"].apply(null,arguments)});var _b2GearJointDef_Create=Module["_b2GearJointDef_Create"]=(function(){return Module["asm"]["_b2GearJointDef_Create"].apply(null,arguments)});var _b2GearJoint_GetRatio=Module["_b2GearJoint_GetRatio"]=(function(){return Module["asm"]["_b2GearJoint_GetRatio"].apply(null,arguments)});var _b2Joint_GetBodyA=Module["_b2Joint_GetBodyA"]=(function(){return Module["asm"]["_b2Joint_GetBodyA"].apply(null,arguments)});var _b2Joint_GetBodyB=Module["_b2Joint_GetBodyB"]=(function(){return Module["asm"]["_b2Joint_GetBodyB"].apply(null,arguments)});var _b2Manifold_GetPointCount=Module["_b2Manifold_GetPointCount"]=(function(){return Module["asm"]["_b2Manifold_GetPointCount"].apply(null,arguments)});var _b2MotorJointDef_Create=Module["_b2MotorJointDef_Create"]=(function(){return Module["asm"]["_b2MotorJointDef_Create"].apply(null,arguments)});var _b2MotorJointDef_InitializeAndCreate=Module["_b2MotorJointDef_InitializeAndCreate"]=(function(){return Module["asm"]["_b2MotorJointDef_InitializeAndCreate"].apply(null,arguments)});var _b2MotorJoint_SetAngularOffset=Module["_b2MotorJoint_SetAngularOffset"]=(function(){return Module["asm"]["_b2MotorJoint_SetAngularOffset"].apply(null,arguments)});var _b2MotorJoint_SetLinearOffset=Module["_b2MotorJoint_SetLinearOffset"]=(function(){return Module["asm"]["_b2MotorJoint_SetLinearOffset"].apply(null,arguments)});var _b2MouseJointDef_Create=Module["_b2MouseJointDef_Create"]=(function(){return Module["asm"]["_b2MouseJointDef_Create"].apply(null,arguments)});var _b2MouseJoint_SetTarget=Module["_b2MouseJoint_SetTarget"]=(function(){return Module["asm"]["_b2MouseJoint_SetTarget"].apply(null,arguments)});var _b2ParticleGroup_ApplyForce=Module["_b2ParticleGroup_ApplyForce"]=(function(){return Module["asm"]["_b2ParticleGroup_ApplyForce"].apply(null,arguments)});var _b2ParticleGroup_ApplyLinearImpulse=Module["_b2ParticleGroup_ApplyLinearImpulse"]=(function(){return Module["asm"]["_b2ParticleGroup_ApplyLinearImpulse"].apply(null,arguments)});var _b2ParticleGroup_DestroyParticles=Module["_b2ParticleGroup_DestroyParticles"]=(function(){return Module["asm"]["_b2ParticleGroup_DestroyParticles"].apply(null,arguments)});var _b2ParticleGroup_GetBufferIndex=Module["_b2ParticleGroup_GetBufferIndex"]=(function(){return Module["asm"]["_b2ParticleGroup_GetBufferIndex"].apply(null,arguments)});var _b2ParticleGroup_GetParticleCount=Module["_b2ParticleGroup_GetParticleCount"]=(function(){return Module["asm"]["_b2ParticleGroup_GetParticleCount"].apply(null,arguments)});var _b2ParticleSystem_CreateParticle=Module["_b2ParticleSystem_CreateParticle"]=(function(){return Module["asm"]["_b2ParticleSystem_CreateParticle"].apply(null,arguments)});var _b2ParticleSystem_GetColorBuffer=Module["_b2ParticleSystem_GetColorBuffer"]=(function(){return Module["asm"]["_b2ParticleSystem_GetColorBuffer"].apply(null,arguments)});var _b2ParticleSystem_GetParticleCount=Module["_b2ParticleSystem_GetParticleCount"]=(function(){return Module["asm"]["_b2ParticleSystem_GetParticleCount"].apply(null,arguments)});var _b2ParticleSystem_GetParticleLifetime=Module["_b2ParticleSystem_GetParticleLifetime"]=(function(){return Module["asm"]["_b2ParticleSystem_GetParticleLifetime"].apply(null,arguments)});var _b2ParticleSystem_GetPositionBuffer=Module["_b2ParticleSystem_GetPositionBuffer"]=(function(){return Module["asm"]["_b2ParticleSystem_GetPositionBuffer"].apply(null,arguments)});var _b2ParticleSystem_GetVelocityBuffer=Module["_b2ParticleSystem_GetVelocityBuffer"]=(function(){return Module["asm"]["_b2ParticleSystem_GetVelocityBuffer"].apply(null,arguments)});var _b2ParticleSystem_SetDamping=Module["_b2ParticleSystem_SetDamping"]=(function(){return Module["asm"]["_b2ParticleSystem_SetDamping"].apply(null,arguments)});var _b2ParticleSystem_SetDensity=Module["_b2ParticleSystem_SetDensity"]=(function(){return Module["asm"]["_b2ParticleSystem_SetDensity"].apply(null,arguments)});var _b2ParticleSystem_SetGravityScale=Module["_b2ParticleSystem_SetGravityScale"]=(function(){return Module["asm"]["_b2ParticleSystem_SetGravityScale"].apply(null,arguments)});var _b2ParticleSystem_SetMaxParticleCount=Module["_b2ParticleSystem_SetMaxParticleCount"]=(function(){return Module["asm"]["_b2ParticleSystem_SetMaxParticleCount"].apply(null,arguments)});var _b2ParticleSystem_SetParticleLifetime=Module["_b2ParticleSystem_SetParticleLifetime"]=(function(){return Module["asm"]["_b2ParticleSystem_SetParticleLifetime"].apply(null,arguments)});var _b2ParticleSystem_SetRadius=Module["_b2ParticleSystem_SetRadius"]=(function(){return Module["asm"]["_b2ParticleSystem_SetRadius"].apply(null,arguments)});var _b2PolygonShape_CreateFixture_3=Module["_b2PolygonShape_CreateFixture_3"]=(function(){return Module["asm"]["_b2PolygonShape_CreateFixture_3"].apply(null,arguments)});var _b2PolygonShape_CreateFixture_4=Module["_b2PolygonShape_CreateFixture_4"]=(function(){return Module["asm"]["_b2PolygonShape_CreateFixture_4"].apply(null,arguments)});var _b2PolygonShape_CreateFixture_5=Module["_b2PolygonShape_CreateFixture_5"]=(function(){return Module["asm"]["_b2PolygonShape_CreateFixture_5"].apply(null,arguments)});var _b2PolygonShape_CreateFixture_6=Module["_b2PolygonShape_CreateFixture_6"]=(function(){return Module["asm"]["_b2PolygonShape_CreateFixture_6"].apply(null,arguments)});var _b2PolygonShape_CreateFixture_7=Module["_b2PolygonShape_CreateFixture_7"]=(function(){return Module["asm"]["_b2PolygonShape_CreateFixture_7"].apply(null,arguments)});var _b2PolygonShape_CreateFixture_8=Module["_b2PolygonShape_CreateFixture_8"]=(function(){return Module["asm"]["_b2PolygonShape_CreateFixture_8"].apply(null,arguments)});var _b2PolygonShape_CreateParticleGroup_4=Module["_b2PolygonShape_CreateParticleGroup_4"]=(function(){return Module["asm"]["_b2PolygonShape_CreateParticleGroup_4"].apply(null,arguments)});var _b2PolygonShape_DestroyParticlesInShape_4=Module["_b2PolygonShape_DestroyParticlesInShape_4"]=(function(){return Module["asm"]["_b2PolygonShape_DestroyParticlesInShape_4"].apply(null,arguments)});var _b2PrismaticJointDef_Create=Module["_b2PrismaticJointDef_Create"]=(function(){return Module["asm"]["_b2PrismaticJointDef_Create"].apply(null,arguments)});var _b2PrismaticJoint_EnableLimit=Module["_b2PrismaticJoint_EnableLimit"]=(function(){return Module["asm"]["_b2PrismaticJoint_EnableLimit"].apply(null,arguments)});var _b2PrismaticJoint_EnableMotor=Module["_b2PrismaticJoint_EnableMotor"]=(function(){return Module["asm"]["_b2PrismaticJoint_EnableMotor"].apply(null,arguments)});var _b2PrismaticJoint_GetJointTranslation=Module["_b2PrismaticJoint_GetJointTranslation"]=(function(){return Module["asm"]["_b2PrismaticJoint_GetJointTranslation"].apply(null,arguments)});var _b2PrismaticJoint_GetMotorForce=Module["_b2PrismaticJoint_GetMotorForce"]=(function(){return Module["asm"]["_b2PrismaticJoint_GetMotorForce"].apply(null,arguments)});var _b2PrismaticJoint_GetMotorSpeed=Module["_b2PrismaticJoint_GetMotorSpeed"]=(function(){return Module["asm"]["_b2PrismaticJoint_GetMotorSpeed"].apply(null,arguments)});var _b2PrismaticJoint_IsLimitEnabled=Module["_b2PrismaticJoint_IsLimitEnabled"]=(function(){return Module["asm"]["_b2PrismaticJoint_IsLimitEnabled"].apply(null,arguments)});var _b2PrismaticJoint_IsMotorEnabled=Module["_b2PrismaticJoint_IsMotorEnabled"]=(function(){return Module["asm"]["_b2PrismaticJoint_IsMotorEnabled"].apply(null,arguments)});var _b2PrismaticJoint_SetMotorSpeed=Module["_b2PrismaticJoint_SetMotorSpeed"]=(function(){return Module["asm"]["_b2PrismaticJoint_SetMotorSpeed"].apply(null,arguments)});var _b2PulleyJointDef_Create=Module["_b2PulleyJointDef_Create"]=(function(){return Module["asm"]["_b2PulleyJointDef_Create"].apply(null,arguments)});var _b2RevoluteJointDef_Create=Module["_b2RevoluteJointDef_Create"]=(function(){return Module["asm"]["_b2RevoluteJointDef_Create"].apply(null,arguments)});var _b2RevoluteJointDef_InitializeAndCreate=Module["_b2RevoluteJointDef_InitializeAndCreate"]=(function(){return Module["asm"]["_b2RevoluteJointDef_InitializeAndCreate"].apply(null,arguments)});var _b2RevoluteJoint_EnableLimit=Module["_b2RevoluteJoint_EnableLimit"]=(function(){return Module["asm"]["_b2RevoluteJoint_EnableLimit"].apply(null,arguments)});var _b2RevoluteJoint_EnableMotor=Module["_b2RevoluteJoint_EnableMotor"]=(function(){return Module["asm"]["_b2RevoluteJoint_EnableMotor"].apply(null,arguments)});var _b2RevoluteJoint_GetJointAngle=Module["_b2RevoluteJoint_GetJointAngle"]=(function(){return Module["asm"]["_b2RevoluteJoint_GetJointAngle"].apply(null,arguments)});var _b2RevoluteJoint_IsLimitEnabled=Module["_b2RevoluteJoint_IsLimitEnabled"]=(function(){return Module["asm"]["_b2RevoluteJoint_IsLimitEnabled"].apply(null,arguments)});var _b2RevoluteJoint_IsMotorEnabled=Module["_b2RevoluteJoint_IsMotorEnabled"]=(function(){return Module["asm"]["_b2RevoluteJoint_IsMotorEnabled"].apply(null,arguments)});var _b2RevoluteJoint_SetMotorSpeed=Module["_b2RevoluteJoint_SetMotorSpeed"]=(function(){return Module["asm"]["_b2RevoluteJoint_SetMotorSpeed"].apply(null,arguments)});var _b2RopeJointDef_Create=Module["_b2RopeJointDef_Create"]=(function(){return Module["asm"]["_b2RopeJointDef_Create"].apply(null,arguments)});var _b2WeldJointDef_Create=Module["_b2WeldJointDef_Create"]=(function(){return Module["asm"]["_b2WeldJointDef_Create"].apply(null,arguments)});var _b2WheelJointDef_Create=Module["_b2WheelJointDef_Create"]=(function(){return Module["asm"]["_b2WheelJointDef_Create"].apply(null,arguments)});var _b2WheelJoint_SetMotorSpeed=Module["_b2WheelJoint_SetMotorSpeed"]=(function(){return Module["asm"]["_b2WheelJoint_SetMotorSpeed"].apply(null,arguments)});var _b2WheelJoint_SetSpringFrequencyHz=Module["_b2WheelJoint_SetSpringFrequencyHz"]=(function(){return Module["asm"]["_b2WheelJoint_SetSpringFrequencyHz"].apply(null,arguments)});var _b2World_Create=Module["_b2World_Create"]=(function(){return Module["asm"]["_b2World_Create"].apply(null,arguments)});var _b2World_CreateBody=Module["_b2World_CreateBody"]=(function(){return Module["asm"]["_b2World_CreateBody"].apply(null,arguments)});var _b2World_CreateParticleSystem=Module["_b2World_CreateParticleSystem"]=(function(){return Module["asm"]["_b2World_CreateParticleSystem"].apply(null,arguments)});var _b2World_Delete=Module["_b2World_Delete"]=(function(){return Module["asm"]["_b2World_Delete"].apply(null,arguments)});var _b2World_DestroyBody=Module["_b2World_DestroyBody"]=(function(){return Module["asm"]["_b2World_DestroyBody"].apply(null,arguments)});var _b2World_DestroyJoint=Module["_b2World_DestroyJoint"]=(function(){return Module["asm"]["_b2World_DestroyJoint"].apply(null,arguments)});var _b2World_DestroyParticleSystem=Module["_b2World_DestroyParticleSystem"]=(function(){return Module["asm"]["_b2World_DestroyParticleSystem"].apply(null,arguments)});var _b2World_QueryAABB=Module["_b2World_QueryAABB"]=(function(){return Module["asm"]["_b2World_QueryAABB"].apply(null,arguments)});var _b2World_RayCast=Module["_b2World_RayCast"]=(function(){return Module["asm"]["_b2World_RayCast"].apply(null,arguments)});var _b2World_SetContactListener=Module["_b2World_SetContactListener"]=(function(){return Module["asm"]["_b2World_SetContactListener"].apply(null,arguments)});var _b2World_SetGravity=Module["_b2World_SetGravity"]=(function(){return Module["asm"]["_b2World_SetGravity"].apply(null,arguments)});var _free=Module["_free"]=(function(){return Module["asm"]["_free"].apply(null,arguments)});var _llvm_bswap_i32=Module["_llvm_bswap_i32"]=(function(){return Module["asm"]["_llvm_bswap_i32"].apply(null,arguments)});var _malloc=Module["_malloc"]=(function(){return Module["asm"]["_malloc"].apply(null,arguments)});var _memcpy=Module["_memcpy"]=(function(){return Module["asm"]["_memcpy"].apply(null,arguments)});var _memmove=Module["_memmove"]=(function(){return Module["asm"]["_memmove"].apply(null,arguments)});var _memset=Module["_memset"]=(function(){return Module["asm"]["_memset"].apply(null,arguments)});var _sbrk=Module["_sbrk"]=(function(){return Module["asm"]["_sbrk"].apply(null,arguments)});var establishStackSpace=Module["establishStackSpace"]=(function(){return Module["asm"]["establishStackSpace"].apply(null,arguments)});var getTempRet0=Module["getTempRet0"]=(function(){return Module["asm"]["getTempRet0"].apply(null,arguments)});var runPostSets=Module["runPostSets"]=(function(){return Module["asm"]["runPostSets"].apply(null,arguments)});var setTempRet0=Module["setTempRet0"]=(function(){return Module["asm"]["setTempRet0"].apply(null,arguments)});var setThrew=Module["setThrew"]=(function(){return Module["asm"]["setThrew"].apply(null,arguments)});var stackAlloc=Module["stackAlloc"]=(function(){return Module["asm"]["stackAlloc"].apply(null,arguments)});var stackRestore=Module["stackRestore"]=(function(){return Module["asm"]["stackRestore"].apply(null,arguments)});var stackSave=Module["stackSave"]=(function(){return Module["asm"]["stackSave"].apply(null,arguments)});var dynCall_fif=Module["dynCall_fif"]=(function(){return Module["asm"]["dynCall_fif"].apply(null,arguments)});var dynCall_fiiiif=Module["dynCall_fiiiif"]=(function(){return Module["asm"]["dynCall_fiiiif"].apply(null,arguments)});var dynCall_fiiiiif=Module["dynCall_fiiiiif"]=(function(){return Module["asm"]["dynCall_fiiiiif"].apply(null,arguments)});var dynCall_ii=Module["dynCall_ii"]=(function(){return Module["asm"]["dynCall_ii"].apply(null,arguments)});var dynCall_iii=Module["dynCall_iii"]=(function(){return Module["asm"]["dynCall_iii"].apply(null,arguments)});var dynCall_iiii=Module["dynCall_iiii"]=(function(){return Module["asm"]["dynCall_iiii"].apply(null,arguments)});var dynCall_iiiii=Module["dynCall_iiiii"]=(function(){return Module["asm"]["dynCall_iiiii"].apply(null,arguments)});var dynCall_iiiiii=Module["dynCall_iiiiii"]=(function(){return Module["asm"]["dynCall_iiiiii"].apply(null,arguments)});var dynCall_v=Module["dynCall_v"]=(function(){return Module["asm"]["dynCall_v"].apply(null,arguments)});var dynCall_vi=Module["dynCall_vi"]=(function(){return Module["asm"]["dynCall_vi"].apply(null,arguments)});var dynCall_vii=Module["dynCall_vii"]=(function(){return Module["asm"]["dynCall_vii"].apply(null,arguments)});var dynCall_viif=Module["dynCall_viif"]=(function(){return Module["asm"]["dynCall_viif"].apply(null,arguments)});var dynCall_viii=Module["dynCall_viii"]=(function(){return Module["asm"]["dynCall_viii"].apply(null,arguments)});var dynCall_viiii=Module["dynCall_viiii"]=(function(){return Module["asm"]["dynCall_viiii"].apply(null,arguments)});var dynCall_viiiii=Module["dynCall_viiiii"]=(function(){return Module["asm"]["dynCall_viiiii"].apply(null,arguments)});var dynCall_viiiiii=Module["dynCall_viiiiii"]=(function(){return Module["asm"]["dynCall_viiiiii"].apply(null,arguments)});Module["asm"]=asm;function ExitStatus(status){this.name="ExitStatus";this.message="Program terminated with exit("+status+")";this.status=status}ExitStatus.prototype=new Error;ExitStatus.prototype.constructor=ExitStatus;var initialStackTop;dependenciesFulfilled=function runCaller(){if(!Module["calledRun"])run();if(!Module["calledRun"])dependenciesFulfilled=runCaller};function run(args){args=args||Module["arguments"];if(runDependencies>0){return}preRun();if(runDependencies>0)return;if(Module["calledRun"])return;function doRun(){if(Module["calledRun"])return;Module["calledRun"]=true;if(ABORT)return;ensureInitRuntime();preMain();if(Module["onRuntimeInitialized"])Module["onRuntimeInitialized"]();postRun()}if(Module["setStatus"]){Module["setStatus"]("Running...");setTimeout((function(){setTimeout((function(){Module["setStatus"]("")}),1);doRun()}),1)}else{doRun()}}Module["run"]=run;function exit(status,implicit){if(implicit&&Module["noExitRuntime"]&&status===0){return}if(Module["noExitRuntime"]){}else{ABORT=true;EXITSTATUS=status;STACKTOP=initialStackTop;exitRuntime();if(Module["onExit"])Module["onExit"](status)}if(ENVIRONMENT_IS_NODE){process["exit"](status)}Module["quit"](status,new ExitStatus(status))}Module["exit"]=exit;function abort(what){if(Module["onAbort"]){Module["onAbort"](what)}if(what!==undefined){Module.print(what);Module.printErr(what);what=JSON.stringify(what)}else{what=""}ABORT=true;EXITSTATUS=1;throw"abort("+what+"). Build with -s ASSERTIONS=1 for more info."}Module["abort"]=abort;if(Module["preInit"]){if(typeof Module["preInit"]=="function")Module["preInit"]=[Module["preInit"]];while(Module["preInit"].length>0){Module["preInit"].pop()()}}Module["noExitRuntime"]=true;run()



/*
  TODO: Make this a fully automated process
  this semi automatically generated file is used for optimizations.
  Please profile first whenever you want to use it, somethings end up costing more.
  Things which weren't faster with offsets:
  navigating bodys list was MANY ORDERS OF MAGNITUDE slower
 */

var Offsets = {
  b2Body: {
    type: 0,
    islandIndex: 8,
    xf: 12,
    xf0: 28,
    sweep: 44,
    linearVelocity: 80,
    angularVelocity: 88,
    force: 92,
    torque: 100,
    world: 104,
    prev: 108,
    next: 112,
    fixtureList: 116,
    fixtureCount: 120,
    jointList: 124,
    contactList: 128,
    mass: 132,
    invMass: 136,
    I: 140,
    invI: 144,
    linearDamping: 148,
    angularDamping: 152,
    gravityScale: 156,
    sleepTime: 160,
    userData: 164
  },
  b2Contact: {
    flags: 4,
    prev: 8,
    next: 12,
    nodeA: 16,
    nodeB: 32,
    fixtureA: 48,
    fixtureB: 52,
    indexA: 56,
    indexB: 60,
    manifold: 64,
    toiCount: 128,
    toi: 132,
    friction: 136,
    restitution: 140,
    tangentSpeed: 144
  },
  b2Fixture: {
    density: 0,
    next: 4,
    body: 8,
    shape: 12,
    friction: 16,
    restitution: 20,
    proxies: 24,
    proxyCount: 28,
    filter: 32,
    filterCategoryBits: 32,
    filterMaskBits: 34,
    filterGroupIndex: 36,
    isSensor: 38,
    userData: 40
  },
  b2ParticleGroup: {
    system: 0,
    firstIndex: 4,
    lastIndex: 8,
    groupFlags: 12,
    strength: 16,
    prev: 20,
    next: 24,
    timestamp: 28,
    mass: 32,
    inertia: 36,
    center: 40,
    linearVelocity: 48,
    angularVelocity: 56,
    transform: 60,
    userData: 76
  },
  b2WorldManifold: {
    normal: 0,
    points: 8,
    separations: 24
  },
  b2World: {
    bodyList: 102960
  }
};var FLT_EPSILON = 1.19209290E-07;

export function b2Max(a ,b) {
  return new b2Vec2(Math.max(a.x, b.x), Math.max(a.y, b.y));
}

export function b2Min(a, b) {
  return new b2Vec2(Math.min(a.x, b.x), Math.min(a.y, b.y));
}

export function b2Clamp(a, low, high) {
  return b2Max(low, b2Min(a, high));
}


/** @constructor */
export function b2Vec2(x, y) {
  if (x === undefined) {
    x = 0;
  }
  if (y === undefined) {
    y = 0;
  }
  this.x = x;
  this.y = y;
}

// static functions on b2Vec2
b2Vec2.Add = function(out, a, b) {
  out.x = a.x + b.x;
  out.y = a.y + b.y;
};

b2Vec2.CrossScalar = function(output, input, scalar) {
  output.x = -scalar * input.y;
  output.y =  scalar * input.x;
};

b2Vec2.Cross = function(a, b) {
  return a.x * b.y - a.y * b.x;
};

b2Vec2.MulScalar = function(out, input, scalar) {
  out.x = input.x * scalar;
  out.y = input.y * scalar;
};

b2Vec2.Mul = function(out, T, v) {
  var Tp = T.p;
  var Tqc = T.q.c;
  var Tqs = T.q.s;

  var x = v.x;
  var y = v.y;

  out.x = (Tqc * x - Tqs * y) + Tp.x;
  out.y = (Tqs * x + Tqc * y) + Tp.y;
};

b2Vec2.Normalize = function(out, input) {
  var length = input.Length();
  if (length < FLT_EPSILON) {
    out.x = 0;
    out.y = 0;
    return;
  }
  var invLength = 1.0 / length;
  out.x = input.x * invLength;
  out.y = input.y * invLength;
};

b2Vec2.Sub = function(out, input, subtract) {
  out.x = input.x - subtract.x;
  out.y = input.y - subtract.y;
};

b2Vec2.prototype.Clone = function() {
  return new b2Vec2(this.x, this.y);
};

b2Vec2.prototype.Set = function(x, y) {
  this.x = x;
  this.y = y;
};

b2Vec2.prototype.Length = function() {
  var x = this.x;
  var y = this.y;
  return Math.sqrt(x * x + y * y);
};

b2Vec2.prototype.LengthSquared = function() {
  var x = this.x;
  var y = this.y;
  return x * x + y * y;
};

/** @constructor */
export function b2Rot(radians) {
  if (radians === undefined) {
    radians = 0;
  }
  this.s = Math.sin(radians);
  this.c = Math.cos(radians);
}

b2Rot.prototype.Set = function(radians) {
  this.s = Math.sin(radians);
  this.c = Math.cos(radians);
};

b2Rot.prototype.SetIdentity = function() {
  this.s = 0;
  this.c = 1;
};

b2Rot.prototype.GetXAxis = function() {
  return new b2Vec2(this.c, this.s);
};

/** @constructor */
export function b2Transform(position, rotation) {
  if (position === undefined) {
    position = new b2Vec2();
  }
  if (rotation === undefined) {
    rotation = new b2Rot();
  }
  this.p = position;
  this.q = rotation;
}

b2Transform.prototype.FromFloat64Array = function(arr) {
  var p = this.p;
  var q = this.q;
  p.x = arr[0];
  p.y = arr[1];
  q.s = arr[2];
  q.c = arr[3];
};

b2Transform.prototype.SetIdentity = function() {
  this.p.Set(0, 0);
  this.q.SetIdentity();
};/**@constructor*/
export function b2AABB() {
  this.lowerBound = new b2Vec2();
  this.upperBound = new b2Vec2();
}

b2AABB.prototype.GetCenter = function() {
  var sum = new b2Vec2();
  b2Vec2.Add(sum, this.lowerBound, this.upperBound);
  b2Vec2.MulScalar(sum, sum, 0.5);
};

// todo use just the pointer and offsets to get this data directly from the heap
var b2Manifold_GetPointCount =
  Module.cwrap('b2Manifold_GetPointCount', 'number', ['number']);

/**@constructor*/
export function b2Manifold(ptr) {
  this.ptr = ptr;
}

b2Manifold.prototype.GetPointCount = function() {
  return b2Manifold_GetPointCount(this.ptr);
};

var b2WorldManifold_points_offset = Offsets.b2WorldManifold.points;
/**@constructor*/
export function b2WorldManifold(ptr) {
  this.buffer = new DataView(Module.HEAPU8.buffer, ptr);
  this.ptr = ptr;
}

b2WorldManifold.prototype.GetPoint = function(i) {
  var point = new b2Vec2();
  point.x = this.buffer.getFloat32((i * 8) + b2WorldManifold_points_offset, true);
  point.y = this.buffer.getFloat32((i * 8) + 4 + b2WorldManifold_points_offset, true);
  return point;
};var b2EdgeShape_CreateFixture =
  Module.cwrap('b2EdgeShape_CreateFixture', 'number',
    ['number',
      // Fixture defs
      'number', 'number', 'number',
      'number', 'number',
      // edge data
      'number', 'number',
      'number', 'number',
      'number', 'number',
      'number', 'number',
      'number', 'number']);

/** @constructor */
export function b2EdgeShape() {
  this.hasVertex0 = false;
  this.hasVertex3 = false;
  this.vertex0 = new b2Vec2();
  this.vertex1 = new b2Vec2();
  this.vertex2 = new b2Vec2();
  this.vertex3 = new b2Vec2();
  this.type = b2Shape_Type_e_edge;
}

b2EdgeShape.prototype.Set = function(v1, v2) {
  this.vertex1 = v1;
  this.vertex2 = v2;
  this.hasVertex0 = false;
  this.hasVertex3 = false;
};

b2EdgeShape.prototype._CreateFixture = function(body, fixtureDef) {
  return b2EdgeShape_CreateFixture(body.ptr,
    // fixture Def
    fixtureDef.density, fixtureDef.friction, fixtureDef.isSensor,
    fixtureDef.restitution, fixtureDef.userData,
    // filter def
    fixtureDef.filter.categoryBits, fixtureDef.filter.groupIndex, fixtureDef.filter.maskBits,
    // edge data
    this.hasVertex0, this.hasVertex3,
    this.vertex0.x, this.vertex0.y,
    this.vertex1.x, this.vertex1.y,
    this.vertex2.x, this.vertex2.y,
    this.vertex3.x, this.vertex3.y);
};// fixture creation wrappers
var b2PolygonShape_CreateFixture_3 =
  Module.cwrap('b2PolygonShape_CreateFixture_3', 'number',
    ['number',
      // Fixture defs
      'number', 'number', 'number',
      'number', 'number',
      // vertices
      'number', 'number',
      'number', 'number',
      'number', 'number']);

var b2PolygonShape_CreateFixture_4 =
  Module.cwrap('b2PolygonShape_CreateFixture_4', 'number',
    ['number',
      // Fixture defs
      'number', 'number', 'number',
      'number', 'number',
      // b2Vec2
      'number', 'number',
      'number', 'number',
      'number', 'number',
      'number', 'number']);

var b2PolygonShape_CreateFixture_5 =
  Module.cwrap('b2PolygonShape_CreateFixture_5', 'number',
    ['number',
      // Fixture defs
      'number', 'number', 'number',
      'number', 'number',
      // b2Vec2
      'number', 'number',
      'number', 'number',
      'number', 'number',
      'number', 'number',
      'number', 'number']);

var b2PolygonShape_CreateFixture_6 =
  Module.cwrap('b2PolygonShape_CreateFixture_6', 'number',
    ['number',
      // Fixture defs
      'number', 'number', 'number',
      'number', 'number',
      // b2Vec2
      'number', 'number',
      'number', 'number',
      'number', 'number',
      'number', 'number',
      'number', 'number',
      'number', 'number']);

var b2PolygonShape_CreateFixture_7 =
  Module.cwrap('b2PolygonShape_CreateFixture_7', 'number',
    ['number',
      // Fixture defs
      'number', 'number', 'number',
      'number', 'number',
      // b2Vec2
      'number', 'number',
      'number', 'number',
      'number', 'number',
      'number', 'number',
      'number', 'number',
      'number', 'number',
      'number', 'number']);

var b2PolygonShape_CreateFixture_8 =
  Module.cwrap('b2PolygonShape_CreateFixture_8', 'number',
    ['number',
      // Fixture defs
      'number', 'number', 'number',
      'number', 'number',
      // b2Vec2
      'number', 'number',
      'number', 'number',
      'number', 'number',
      'number', 'number',
      'number', 'number',
      'number', 'number',
      'number', 'number',
      'number', 'number']);

// particle group creation wrappers
var b2PolygonShape_CreateParticleGroup_4 =
  Module.cwrap('b2PolygonShape_CreateParticleGroup_4', 'number',
    ['number',
      // particleGroupDef
      'number', 'number', 'number',
      'number', 'number', 'number',
      'number', 'number', 'number',
      'number', 'number', 'number',
      'number', 'number', 'number',
      'number', 'number', 'number',
      'number',
      // polygon
      'number', 'number',
      'number', 'number',
      'number', 'number',
      'number', 'number'
    ]);

// particle group destruction wrappers
var b2PolygonShape_DestroyParticlesInShape_4 =
  Module.cwrap('b2PolygonShape_DestroyParticlesInShape_4', 'number',
    ['number',
     //polygon shape
     'number', 'number',
     'number', 'number',
     'number', 'number',
     'number', 'number',
     // xf
     'number', 'number', 'number',
     'number']);

/** @constructor */
export function b2PolygonShape() {
  this.position = new b2Vec2();
  this.vertices = [];
  this.type = b2Shape_Type_e_polygon;
}

b2PolygonShape.prototype.SetAsBoxXY = function(hx, hy) {
  this.vertices[0] = new b2Vec2(-hx, -hy);
  this.vertices[1] = new b2Vec2( hx, -hy);
  this.vertices[2] = new b2Vec2( hx,  hy);
  this.vertices[3] = new b2Vec2(-hx,  hy);
};

b2PolygonShape.prototype.SetAsBoxXYCenterAngle = function(hx, hy, center, angle) {
  this.vertices[0] = new b2Vec2(-hx, -hy);
  this.vertices[1] = new b2Vec2( hx, -hy);
  this.vertices[2] = new b2Vec2( hx,  hy);
  this.vertices[3] = new b2Vec2(-hx,  hy);

  var xf = new b2Transform();
  xf.p = center;
  xf.q.Set(angle);

  for (var i = 0; i < 4; i++) {
    b2Vec2.Mul(this.vertices[i], xf, this.vertices[i]);
  }
};

b2PolygonShape.prototype._CreateFixture = function(body, fixtureDef) {
  var vertices = this.vertices;
  switch (vertices.length) {
    case 3:
      var v0 = vertices[0];
      var v1 = vertices[1];
      var v2 = vertices[2];
      return b2PolygonShape_CreateFixture_3(body.ptr,
        // fixture Def
        fixtureDef.density, fixtureDef.friction, fixtureDef.isSensor,
        fixtureDef.restitution, fixtureDef.userData,
        // filter def
        fixtureDef.filter.categoryBits, fixtureDef.filter.groupIndex, fixtureDef.filter.maskBits,
        // points
        v0.x, v0.y,
        v1.x, v1.y,
        v2.x, v2.y);
      break;
    case 4:
      var v0 = vertices[0];
      var v1 = vertices[1];
      var v2 = vertices[2];
      var v3 = vertices[3];
      return b2PolygonShape_CreateFixture_4(body.ptr,
        // fixture Def
        fixtureDef.density, fixtureDef.friction, fixtureDef.isSensor,
        fixtureDef.restitution, fixtureDef.userData,
        // filter def
        fixtureDef.filter.categoryBits, fixtureDef.filter.groupIndex, fixtureDef.filter.maskBits,
        // points
        v0.x, v0.y,
        v1.x, v1.y,
        v2.x, v2.y,
        v3.x, v3.y);
      break;
    case 5:
      var v0 = vertices[0];
      var v1 = vertices[1];
      var v2 = vertices[2];
      var v3 = vertices[3];
      var v4 = vertices[4];
      return b2PolygonShape_CreateFixture_5(body.ptr,
        // fixture Def
        fixtureDef.density, fixtureDef.friction, fixtureDef.isSensor,
        fixtureDef.restitution, fixtureDef.userData,
        // filter def
        fixtureDef.filter.categoryBits, fixtureDef.filter.groupIndex, fixtureDef.filter.maskBits,
        // points
        v0.x, v0.y,
        v1.x, v1.y,
        v2.x, v2.y,
        v3.x, v3.y,
        v4.x, v4.y);
      break;
    case 6:
      var v0 = vertices[0];
      var v1 = vertices[1];
      var v2 = vertices[2];
      var v3 = vertices[3];
      var v4 = vertices[4];
      var v5 = vertices[5];
      return b2PolygonShape_CreateFixture_6(body.ptr,
        // fixture Def
        fixtureDef.density, fixtureDef.friction, fixtureDef.isSensor,
        fixtureDef.restitution, fixtureDef.userData,
        // filter def
        fixtureDef.filter.categoryBits, fixtureDef.filter.groupIndex, fixtureDef.filter.maskBits,
        // points
        v0.x, v0.y,
        v1.x, v1.y,
        v2.x, v2.y,
        v3.x, v3.y,
        v4.x, v4.y,
        v5.x, v5.y);
      break;
    case 7:
      var v0 = vertices[0];
      var v1 = vertices[1];
      var v2 = vertices[2];
      var v3 = vertices[3];
      var v4 = vertices[4];
      var v5 = vertices[5];
      var v6 = vertices[6];
      return b2PolygonShape_CreateFixture_7(body.ptr,
        // fixture Def
        fixtureDef.density, fixtureDef.friction, fixtureDef.isSensor,
        fixtureDef.restitution, fixtureDef.userData,
        // filter def
        fixtureDef.filter.categoryBits, fixtureDef.filter.groupIndex, fixtureDef.filter.maskBits,
        // points
        v0.x, v0.y,
        v1.x, v1.y,
        v2.x, v2.y,
        v3.x, v3.y,
        v4.x, v4.y,
        v5.x, v5.y,
        v6.x, v6.y);
      break;
    case 8:
      var v0 = vertices[0];
      var v1 = vertices[1];
      var v2 = vertices[2];
      var v3 = vertices[3];
      var v4 = vertices[4];
      var v5 = vertices[5];
      var v6 = vertices[6];
      var v7 = vertices[7];
      return b2PolygonShape_CreateFixture_8(body.ptr,
        // fixture Def
        fixtureDef.density, fixtureDef.friction, fixtureDef.isSensor,
        fixtureDef.restitution, fixtureDef.userData,
        // filter def
        fixtureDef.filter.categoryBits, fixtureDef.filter.groupIndex, fixtureDef.filter.maskBits,
        // points
        v0.x, v0.y,
        v1.x, v1.y,
        v2.x, v2.y,
        v3.x, v3.y,
        v4.x, v4.y,
        v5.x, v5.y,
        v6.x, v6.y,
        v6.x, v7.y);
      break;

  }
};

b2PolygonShape.prototype._CreateParticleGroup = function(particleSystem, pgd) {
  var v = this.vertices;
  switch (v.length) {
    case 3:
      break;
    case 4:
      return b2PolygonShape_CreateParticleGroup_4(
        particleSystem.ptr,
        // particle group def
        pgd.angle,  pgd.angularVelocity, pgd.color.r,
        pgd.color.g, pgd.color.b, pgd.color.a,
        pgd.flags, pgd.group.ptr, pgd.groupFlags,
        pgd.lifetime, pgd.linearVelocity.x, pgd.linearVelocity.y,
        pgd.position.x, pgd.position.y, pgd.positionData,
        pgd.particleCount,  pgd.strength, pgd.stride,
        pgd.userData,
        // polygon
        v[0].x, v[0].y,
        v[1].x, v[1].y,
        v[2].x, v[2].y,
        v[3].x, v[3].y);
      break;
  }
};

b2PolygonShape.prototype._DestroyParticlesInShape = function(ps, xf) {
  var v = this.vertices;
  switch (v.length) {
    case 3:
      break;
    case 4:
      return b2PolygonShape_DestroyParticlesInShape_4(
        ps.ptr,
        // polygon
        v[0].x, v[0].y,
        v[1].x, v[1].y,
        v[2].x, v[2].y,
        v[3].x, v[3].y,
        // xf
        xf.p.x, xf.p.y,
        xf.q.s, xf.q.c);
      break;
  }
};

/**@return bool*/
b2PolygonShape.prototype.Validate = function() {
  for (var i = 0, max = this.vertices.length; i < max; ++i) {
    var i1 = i;
    var i2 = i < max - 1 ? i1 + 1 : 0;
    var p = this.vertices[i1];
    var e = this.vertices[i2];
    var eSubP = new b2Vec2();
    b2Vec2.Sub(eSubP, e, p);

    for (var j = 0; j < max; ++j) {
      if (j == i1 || j == i2) {
        continue;
      }

      var v = new b2Vec2();
      b2Vec2.Sub(v, this.vertices[j], p);
      var c = b2Vec2.Cross(eSubP, v);
      if (c < 0.0) {
        return false;
      }
    }
  }

  return true;
}// Shape constants
export var b2Shape_Type_e_circle = 0;
export var b2Shape_Type_e_edge = 1;
export var b2Shape_Type_e_polygon = 2;
export var b2Shape_Type_e_chain = 3;
export var b2Shape_Type_e_typeCount = 4;
export var b2_linearSlop = 0.005;
export var b2_polygonRadius = 2 * b2_linearSlop;
export var b2_maxPolygonVertices = 8;

export function b2MassData(mass, center, I) {
  this.mass = mass;
  this.center = center;
  this.I = I;
}var b2ChainShape_CreateFixture =
  Module.cwrap('b2ChainShape_CreateFixture', 'number',
    ['number',
      // Fixture defs
      'number', 'number', 'number',
      'number', 'number',
      // Chain vertices and count
      'number', 'number', 'number']);

/**@constructor*/
export function b2ChainShape() {
  this.radius = b2_polygonRadius;
  this.vertices = [];
  this.hasGhostVertices = false;
  this.isLoop = false;
  this.type = b2Shape_Type_e_chain;
}

b2ChainShape.prototype.CreateLoop = function() {
   this.isLoop = true;
};

// TODO Optimize this
b2ChainShape.prototype._CreateFixture = function(body, fixtureDef) {
  var vertices = this.vertices;
  var chainLength = vertices.length;
  var dataLength = chainLength * 2;
  var data = new Float32Array(dataLength);

  for (var i = 0, j = 0; i < dataLength; i += 2, j++) {
    data[i] = vertices[j].x;
    data[i+1] = vertices[j].y;
  }

  // Get data byte size, allocate memory on Emscripten heap, and get pointer
  var nDataBytes = data.length * data.BYTES_PER_ELEMENT;
  var dataPtr = Module._malloc(nDataBytes);

  // Copy data to Emscripten heap (directly accessed from Module.HEAPU8)
  var dataHeap = new Uint8Array(Module.HEAPU8.buffer, dataPtr, nDataBytes);
  dataHeap.set(new Uint8Array(data.buffer));

  // Call function and get result
  var fixture = b2ChainShape_CreateFixture(body.ptr,
    // fixture def
    fixtureDef.density, fixtureDef.friction, fixtureDef.isSensor,
    fixtureDef.restitution, fixtureDef.userData,
    // filter def
    fixtureDef.filter.categoryBits, fixtureDef.filter.groupIndex, fixtureDef.filter.maskBits,
    // vertices and length
    dataHeap.byteOffset, data.length, this.hasGhostVertices, this.isLoop);

  // Free memory
  Module._free(dataHeap.byteOffset);
  return fixture;
};var b2CircleShape_CreateFixture =
  Module.cwrap('b2CircleShape_CreateFixture', 'number',
    ['number',
      // Fixture defs
      'number', 'number', 'number',
      'number', 'number',
      // Circle members
      'number', 'number',
      'number']);

var b2CircleShape_CreateParticleGroup =
  Module.cwrap('b2CircleShape_CreateParticleGroup', 'number',
    ['number',
      // particleGroupDef
      'number', 'number', 'number',
      'number', 'number', 'number',
      'number', 'number', 'number',
      'number', 'number', 'number',
      'number', 'number', 'number',
      'number', 'number', 'number',
      'number',
      //Circle
      'number', 'number', 'number'
    ]);

var b2CircleShape_DestroyParticlesInShape =
  Module.cwrap('b2CircleShape_DestroyParticlesInShape', 'number',
    ['number',
    //circle
     'number', 'number', 'number',
     // transform
     'number', 'number', 'number', 'number']);

/**@constructor*/
export function b2CircleShape() {
  this.position = new b2Vec2();
  this.radius = 0;
  this.type = b2Shape_Type_e_circle;
}

b2CircleShape.prototype._CreateFixture = function(body, fixtureDef) {
  return b2CircleShape_CreateFixture(body.ptr,
    // fixture Def
    fixtureDef.density, fixtureDef.friction, fixtureDef.isSensor,
    fixtureDef.restitution, fixtureDef.userData,
    // filter def
    fixtureDef.filter.categoryBits, fixtureDef.filter.groupIndex, fixtureDef.filter.maskBits,
    // circle data
    this.position.x, this.position.y, this.radius);
};

b2CircleShape.prototype._CreateParticleGroup = function(particleSystem, pgd) {
  return b2CircleShape_CreateParticleGroup(
    particleSystem.ptr,
    // particle group def
    pgd.angle,  pgd.angularVelocity, pgd.color.r,
    pgd.color.g, pgd.color.b, pgd.color.a,
    pgd.flags, pgd.group.ptr, pgd.groupFlags,
    pgd.lifetime, pgd.linearVelocity.x, pgd.linearVelocity.y,
    pgd.position.x, pgd.position.y, pgd.positionData,
    pgd.particleCount, pgd.strength, pgd.stride,
    pgd.userData,
    // circle
    this.position.x, this.position.y, this.radius);
};

b2CircleShape.prototype._DestroyParticlesInShape = function(ps, xf) {
  return b2CircleShape_DestroyParticlesInShape(ps.ptr,
    // circle
    this.position.x, this.position.y, this.radius,
    // transform
    xf.p.x, xf.p.y, xf.q.s, xf.q.c);
};// b2Body Globals
var b2Body_ApplyAngularImpulse = Module.cwrap('b2Body_ApplyAngularImpulse', 'null',
  ['number', 'number', 'number']);

var b2Body_ApplyLinearImpulse = Module.cwrap('b2Body_ApplyLinearImpulse', 'null',
  ['number', 'number', 'number', 'number', 'number', 'number']);

var b2Body_ApplyForce = Module.cwrap('b2Body_ApplyForce', 'number',
  ['number', 'number', 'number', 'number', 'number', 'number']);

var b2Body_ApplyForceToCenter = Module.cwrap('b2Body_ApplyForceToCenter', 'number',
  ['number', 'number', 'number', 'number']);

var b2Body_ApplyTorque = Module.cwrap('b2Body_ApplyTorque', 'number',
  ['number', 'number', 'number']);

var b2Body_DestroyFixture = Module.cwrap('b2Body_DestroyFixture', 'null',
  ['number', 'number']);

var b2Body_GetAngle = Module.cwrap('b2Body_GetAngle', 'number', ['number']);

var b2Body_GetAngularVelocity =
  Module.cwrap('b2Body_GetAngularVelocity', 'number', ['number']);

var b2Body_GetInertia = Module.cwrap('b2Body_GetInertia', 'number', ['number']);

var b2Body_GetLinearVelocity =
  Module.cwrap('b2Body_GetLinearVelocity', 'null', ['number', 'number']);

var b2Body_GetLocalPoint = Module.cwrap('b2Body_GetLocalPoint', 'null',
  ['number', 'number', 'number', 'number']);

var b2Body_GetLocalVector = Module.cwrap('b2Body_GetLocalVector', 'null',
  ['number', 'number', 'number', 'number']);

var b2Body_GetMass = Module.cwrap('b2Body_GetMass', 'number', ['number']);

var b2Body_GetPosition = Module.cwrap('b2Body_GetPosition', 'null', ['number', 'number']);

var b2Body_GetTransform = Module.cwrap('b2Body_GetTransform', 'null',
  ['number', 'number']);

var b2Body_GetType = Module.cwrap('b2Body_GetType', 'number', ['number']);

var b2Body_GetWorldCenter = Module.cwrap('b2Body_GetWorldCenter', 'null',
  ['number', 'number']);

var b2Body_GetWorldPoint = Module.cwrap('b2Body_GetWorldPoint', 'null',
  ['number', 'number', 'number', 'number']);

var b2Body_GetWorldVector = Module.cwrap('b2Body_GetWorldVector', 'null',
  ['number', 'number', 'number', 'number']);

var b2Body_SetAngularVelocity = Module.cwrap('b2Body_SetAngularVelocity', 'null',
  ['number', 'number']);

var b2Body_SetAwake =
  Module.cwrap('b2Body_SetAwake', 'number',['number', 'number']);

var b2Body_SetFixedRotation =
  Module.cwrap('b2Body_SetFixedRotation', 'number',['number', 'number']);

var b2Body_SetLinearVelocity = Module.cwrap('b2Body_SetLinearVelocity', 'null',
  ['number', 'number', 'number']);

var b2Body_SetMassData = Module.cwrap('b2Body_SetMassData', 'null',
  ['number', 'number', 'number',
   'number', 'number']);

var b2Body_SetTransform =
  Module.cwrap('b2Body_SetTransform', 'null', ['number', 'number', 'number']);

var b2Body_SetType =
  Module.cwrap('b2Body_SetType', 'null', ['number', 'number']);


// memory offsets
var b2Body_xf_offset = Offsets.b2Body.xf;
var b2Body_userData_offset = Offsets.b2Body.userData;
/**@constructor*/
export function b2Body(ptr) {
  this.buffer = new DataView(Module.HEAPU8.buffer, ptr);
  this.ptr = ptr;
  this.fixtures = [];
  this.world = null;
}

b2Body.prototype.ApplyAngularImpulse = function(impulse, wake) {
  b2Body_ApplyAngularImpulse(this.ptr, impulse, wake);
};

b2Body.prototype.ApplyLinearImpulse = function(impulse, point, wake) {
  b2Body_ApplyLinearImpulse(this.ptr, impulse.x, impulse.y, point.x, point.y, wake);
};

b2Body.prototype.ApplyForce = function(force, point, wake) {
  b2Body_ApplyForce(this.ptr, force.x, force.y, point.x, point.y, wake);
};

b2Body.prototype.ApplyForceToCenter = function(force, wake) {
  b2Body_ApplyForceToCenter(this.ptr, force.x, force.y, wake);
};

b2Body.prototype.ApplyTorque = function(force, wake) {
  b2Body_ApplyTorque(this.ptr, force, wake);
};

b2Body.prototype.CreateFixtureFromDef = function(fixtureDef) {
  var fixture = new b2Fixture();
  fixture.FromFixtureDef(fixtureDef);
  fixture._SetPtr(fixtureDef.shape._CreateFixture(this, fixtureDef));
  fixture.body = this;
  b2World._Push(fixture, this.fixtures);
  this.world.fixturesLookup[fixture.ptr] = fixture;
  fixture.SetFilterData(fixtureDef.filter);
  return fixture;
};

b2Body.prototype.GetWorld = function () {
    return this.world;
}

b2Body.prototype.CreateFixtureFromShape = function(shape, density) {
  var fixtureDef = new b2FixtureDef();
  fixtureDef.shape = shape;
  fixtureDef.density = density;
  return this.CreateFixtureFromDef(fixtureDef);
};

b2Body.prototype.DestroyFixture = function(fixture) {
  b2Body_DestroyFixture(this.ptr, fixture.ptr);
  b2World._RemoveItem(fixture, this.fixtures);
};

b2Body.prototype.GetAngle = function() {
  return b2Body_GetAngle(this.ptr);
};

b2Body.prototype.GetAngularVelocity = function() {
  return b2Body_GetAngularVelocity(this.ptr);
};

b2Body.prototype.GetInertia = function() {
  return b2Body_GetInertia(this.ptr);
};

b2Body.prototype.GetMass = function() {
  return b2Body_GetMass(this.ptr);
};

b2Body.prototype.GetLinearVelocity = function() {
  b2Body_GetLinearVelocity(this.ptr, _vec2Buf.byteOffset);
  var result = new Float32Array(_vec2Buf.buffer, _vec2Buf.byteOffset, _vec2Buf.length);
  return new b2Vec2(result[0], result[1]);
};

b2Body.prototype.GetLocalPoint = function(vec) {
  b2Body_GetLocalPoint(this.ptr, vec.x, vec.y, _vec2Buf.byteOffset);
  var result = new Float32Array(_vec2Buf.buffer, _vec2Buf.byteOffset, _vec2Buf.length);
  return new b2Vec2(result[0], result[1]);
};

b2Body.prototype.GetLocalVector = function(vec) {
  b2Body_GetLocalVector(this.ptr, vec.x, vec.y, _vec2Buf.byteOffset);
  var result = new Float32Array(_vec2Buf.buffer, _vec2Buf.byteOffset, _vec2Buf.length);
  return new b2Vec2(result[0], result[1]);
};


b2Body.prototype.GetPosition = function() {
  b2Body_GetPosition(this.ptr, _vec2Buf.byteOffset);
  var result = new Float32Array(_vec2Buf.buffer, _vec2Buf.byteOffset, _vec2Buf.length);
  return  new b2Vec2(result[0], result[1]);
};

b2Body.prototype.GetTransform = function() {
  var transform = new b2Transform();
  transform.p.x = this.buffer.getFloat32(b2Body_xf_offset, true);
  transform.p.y = this.buffer.getFloat32(b2Body_xf_offset+4, true);
  transform.q.s = this.buffer.getFloat32(b2Body_xf_offset+8, true);
  transform.q.c = this.buffer.getFloat32(b2Body_xf_offset+12, true);
  return transform;
};

b2Body.prototype.GetType = function() {
  return b2Body_GetType(this.ptr);
};

b2Body.prototype.GetUserData = function() {
  return this.buffer.getUint32(b2Body_userData_offset, true);
};

b2Body.prototype.GetWorldCenter = function() {
  b2Body_GetWorldCenter(this.ptr, _vec2Buf.byteOffset);
  var result = new Float32Array(_vec2Buf.buffer, _vec2Buf.byteOffset, _vec2Buf.length);
  return new b2Vec2(result[0], result[1]);
};

b2Body.prototype.GetWorldPoint = function(vec) {
  b2Body_GetWorldPoint(this.ptr, vec.x, vec.y, _vec2Buf.byteOffset);
  var result = new Float32Array(_vec2Buf.buffer, _vec2Buf.byteOffset, _vec2Buf.length);
  return new b2Vec2(result[0], result[1]);
};

b2Body.prototype.GetWorldVector = function(vec) {
  b2Body_GetWorldVector(this.ptr, vec.x, vec.y, _vec2Buf.byteOffset);
  var result = new Float32Array(_vec2Buf.buffer, _vec2Buf.byteOffset, _vec2Buf.length);
  return new b2Vec2(result[0], result[1]);
};

b2Body.prototype.SetAngularVelocity = function(angle) {
  b2Body_SetAngularVelocity(this.ptr, angle);
};

b2Body.prototype.SetAwake = function(flag) {
  b2Body_SetAwake(this.ptr, flag);
};

b2Body.prototype.SetFixedRotation = function(flag) {
  b2Body_SetFixedRotation(this.ptr, flag);
};

b2Body.prototype.SetLinearVelocity = function(v) {
  b2Body_SetLinearVelocity(this.ptr, v.x, v.y);
};

b2Body.prototype.SetMassData = function(massData) {
  b2Body_SetMassData(this.ptr, massData.mass, massData.center.x, massData.center.y, massData.I);
};

b2Body.prototype.SetTransform = function(v, angle) {
  b2Body_SetTransform(this.ptr, v.x, v.y, angle);
};

b2Body.prototype.SetType = function(type) {
  b2Body_SetType(this.ptr, type);
};

// General body globals
export var b2_staticBody = 0;
export var b2_kinematicBody = 1;
export var b2_dynamicBody = 2;

/** @constructor */
export function b2BodyDef() {
  this.active = true;
  this.allowSleep = true;
  this.angle = 0;
  this.angularVelocity = 0;
  this.angularDamping = 0;
  this.awake = true;
  this.bullet = false;
  this.fixedRotation = false;
  this.gravityScale = 1.0;
  this.linearDamping = 0;
  this.linearVelocity = new b2Vec2();
  this.position = new b2Vec2();
  this.type = b2_staticBody;
  this.userData = null;
}

// global call back functions
var worlds = new Map();

b2World.BeginContactBody = function (worldPtr, contactPtr)
{
  var world = worlds.get(worldPtr);
  if (world.listener.BeginContactBody === undefined) {
    return;
  }
  var contact = new b2Contact(worldPtr, contactPtr);
  world.listener.BeginContactBody(contact);
};

b2World.EndContactBody = function (worldPtr, contactPtr) {
  var world = worlds.get(worldPtr);
  if (world.listener.EndContactBody === undefined) {
    return;
  }
  var contact = new b2Contact(contactPtr);
  world.listener.EndContactBody(contact);
};

b2World.PreSolve = function (worldPtr, contactPtr, oldManifoldPtr) {
  var world = worlds.get(worldPtr);
  if (world.listener.PreSolve === undefined) {
    return;
  }
  world.listener.PreSolve(new b2Contact(contactPtr), new b2Manifold(oldManifoldPtr));
};

b2World.PostSolve = function (worldPtr, contactPtr, impulsePtr) {
  var world = worlds.get(worldPtr);
  if (world.listener.PostSolve === undefined) {
    return;
  }
  world.listener.PostSolve(new b2Contact(contactPtr),
    new b2ContactImpulse(impulsePtr));
};

b2World.QueryAABB = function (worldPtr, fixturePtr) {
  var world = worlds.get(worldPtr);
  return world.queryAABBCallback.ReportFixture(world.fixturesLookup[fixturePtr]);
};

b2World.RayCast = function (worldPtr, fixturePtr, pointX, pointY, normalX, normalY, fraction) {
  var world = worlds.get(worldPtr);
  return world.rayCastCallback.ReportFixture(world.fixturesLookup[fixturePtr],
    new b2Vec2(pointX, pointY), new b2Vec2(normalX, normalY), fraction);
};

// Emscripten exports
var b2World_Create = Module.cwrap('b2World_Create', 'number', ['number', 'number']);
var b2World_Delete = Module.cwrap('b2World_Delete', 'null', ['number']);
var b2World_CreateBody =
  Module.cwrap('b2World_CreateBody', 'number',
    ['number', 'number', 'number',
     'number', 'number', 'number',
     'number', 'number', 'number',
     'number', 'number', 'number',
     'number', 'number', 'number',
     'number', 'number']);

var b2World_CreateParticleSystem =
  Module.cwrap('b2World_CreateParticleSystem', 'number',
    ['number', 'number', 'number',
     'number', 'number', 'number',
     'number', 'number', 'number',
     'number', 'number', 'number',
     'number', 'number', 'number',
     'number', 'number', 'number',
     'number', 'number', 'number']);

var b2World_DestroyBody =
  Module.cwrap('b2World_DestroyBody', 'null', ['number', 'number']);

var b2World_DestroyJoint =
  Module.cwrap('b2World_DestroyJoint', 'null', ['number', 'number']);

var b2World_DestroyParticleSystem =
  Module.cwrap('b2World_DestroyParticleSystem', 'null', ['number', 'number']);

var b2World_QueryAABB =
  Module.cwrap('b2World_QueryAABB', 'null',
    ['number', 'number', 'number' ,'number' ,'number']);

var b2World_RayCast =
  Module.cwrap('b2World_RayCast', 'null',
    ['number', 'number', 'number' ,'number' ,'number']);

var b2World_SetContactListener = Module.cwrap('b2World_SetContactListener', 'null', ['number']);
var b2World_SetGravity = Module.cwrap('b2World_SetGravity', 'null',
  ['number', 'number', 'number']);
var b2World_Step = Module.cwrap('b2World_Step', 'null', ['number', 'number', 'number']);
var b2World_ClearForces = Module.cwrap('b2World_ClearForces', 'null', ['number']);
var b2World_SetAutoClearForces = Module.cwrap('b2World_SetAutoClearForces', 'null', ['number', 'number']);

var _transBuf = null;
var _vec2Buf = null;

// Todo move the buffers to native access
/** @constructor */
export function b2World(gravity)
{
  this.bodies = [];
  this.bodiesLookup = {};
  this.fixturesLookup = {};
  this.joints = [];
  this.listener = null;
  this.particleSystems = [];
  this.ptr = b2World_Create(gravity.x, gravity.y);
  worlds.set(this.ptr, this);
  this.queryAABBCallback = null;
  this.rayCastCallback = null;

  this.buffer = new DataView(Module.HEAPU8.buffer, this.ptr);

  // preallocate some buffers to prevent having to constantly reuse
  var nDataBytes = 4 * Float32Array.BYTES_PER_ELEMENT;
  var dataPtr = Module._malloc(nDataBytes);
  _transBuf = new Uint8Array(Module.HEAPU8.buffer, dataPtr, nDataBytes);

  nDataBytes = 2 * Float32Array.BYTES_PER_ELEMENT;
  dataPtr = Module._malloc(nDataBytes);
  _vec2Buf = new Uint8Array(Module.HEAPU8.buffer, dataPtr, nDataBytes);
}

b2World.prototype.Delete = function () {
    worlds.delete(this.ptr);
    b2World_Delete(this.ptr);
}

b2World._Push = function(item, list) {
  item.lindex = list.length;
  list.push(item);
};

b2World._RemoveItem = function(item, list) {
  var length = list.length;
  var lindex = item.lindex;
  if (length > 1) {
    list[lindex] = list[length - 1];
    list[lindex].lindex = lindex;
  }
  list.pop();
};

b2World.prototype.CreateBody = function(bodyDef) {
  var body = new b2Body(b2World_CreateBody(
    this.ptr, bodyDef.active, bodyDef.allowSleep,
    bodyDef.angle, bodyDef.angularVelocity, bodyDef.angularDamping,
    bodyDef.awake, bodyDef.bullet, bodyDef.fixedRotation,
    bodyDef.gravityScale, bodyDef.linearDamping, bodyDef.linearVelocity.x,
    bodyDef.linearVelocity.y, bodyDef.position.x, bodyDef.position.y,
    bodyDef.type, bodyDef.userData));
  b2World._Push(body, this.bodies);
  body.world = this;
  this.bodiesLookup[body.ptr] = body;
  return body;
};

b2World.prototype.CreateJoint = function(jointDef) {
  var joint = jointDef.Create(this);
  b2World._Push(joint, this.joints);
  return joint;
};

b2World.prototype.CreateParticleSystem = function(psd) {
  var ps = new b2ParticleSystem(b2World_CreateParticleSystem(
    this.ptr, psd.colorMixingStrength,
    psd.dampingStrength, psd.destroyByAge, psd.ejectionStrength,
    psd.elasticStrength, psd.lifetimeGranularity, psd.powderStrength,
    psd.pressureStrength, psd.radius, psd.repulsiveStrength,
    psd.springStrength, psd.staticPressureIterations, psd.staticPressureRelaxation,
    psd.staticPressureStrength, psd.surfaceTensionNormalStrength, psd.surfaceTensionPressureStrength,
    psd.viscousStrength, psd.filter.categoryBits, psd.filter.groupIndex, psd.filter.maskBits));
  b2World._Push(ps, this.particleSystems);
  ps.dampingStrength = psd.dampingStrength;
  ps.radius = psd.radius;
  return ps;
};

b2World.prototype.DestroyBody = function(body) {
  b2World_DestroyBody(this.ptr, body.ptr);
  b2World._RemoveItem(body, this.bodies);
};

b2World.prototype.DestroyJoint = function(joint) {
  b2World_DestroyJoint(this.ptr, joint.ptr);
  b2World._RemoveItem(joint, this.joints);
};

b2World.prototype.DestroyParticleSystem = function(particleSystem) {
  b2World_DestroyParticleSystem(this.ptr, particleSystem.ptr);
  b2World._RemoveItem(particleSystem, this.particleSystems);
};

b2World.prototype.QueryAABB = function(callback, aabb) {
  this.queryAABBCallback = callback;
  b2World_QueryAABB(this.ptr, aabb.lowerBound.x, aabb.lowerBound.y,
      aabb.upperBound.x, aabb.upperBound.y);
  this.queryAABBCallback = null;
};

b2World.prototype.RayCast = function(callback, point1, point2) {
  this.rayCastCallback = callback;
  b2World_RayCast(this.ptr, point1.x, point1.y, point2.x, point2.y);
  this.rayCastCallback = null;
};

b2World.prototype.SetContactListener = function(listener) {
  this.listener = listener;
  b2World_SetContactListener(this.ptr);
};

b2World.prototype.SetGravity = function(gravity) {
  b2World_SetGravity(this.ptr, gravity.x, gravity.y);
};

b2World.prototype.Step = function(steps, vIterations, pIterations) {
  b2World_Step(this.ptr, steps, vIterations, pIterations);
};

b2World.prototype.ClearForces = function ()
{
    b2World_ClearForces(this.ptr);
}

b2World.prototype.SetAutoClearForces = function (autoClear)
{
    b2World_SetAutoClearForces(this.ptr, autoClear);
}// wheel joint globals
var b2WheelJoint_SetMotorSpeed =
  Module.cwrap('b2WheelJoint_SetMotorSpeed', 'null', ['number', 'number']);
var b2WheelJoint_SetSpringFrequencyHz =
  Module.cwrap('b2WheelJoint_SetSpringFrequencyHz', 'null', ['number', 'number']);

/**@constructor*/
export function b2WheelJoint(def) {
  this.next = null;
  this.ptr = null;
}

b2WheelJoint.prototype.SetMotorSpeed = function(speed) {
  b2WheelJoint_SetMotorSpeed(this.ptr, speed);
};

b2WheelJoint.prototype.SetSpringFrequencyHz = function(hz) {
  b2WheelJoint_SetSpringFrequencyHz(this.ptr, hz);
};

// wheeljoint def
var b2WheelJointDef_Create = Module.cwrap("b2WheelJointDef_Create",
  'number',
  ['number',
    // joint Def
    'number', 'number', 'number',
    // wheel joint def
    'number', 'number', 'number',
    'number', 'number', 'number',
    'number', 'number', 'number',
    'number', 'number']);

var b2WheelJointDef_InitializeAndCreate = Module.cwrap("b2WheelJointDef_InitializeAndCreate",
  'number',
  ['number',
    // initialize args
    'number', 'number', 'number',
    'number', 'number', 'number',
    // joint def
    'number',
    // wheel joint def
    'number', 'number', 'number',
    'number', 'number']);

/** @constructor*/
export function b2WheelJointDef() {
  // joint def
  this.bodyA = null;
  this.bodyB = null;
  this.collideConnected = false;

  // wheel joint def
  this.dampingRatio = 0.7;
  this.enableMotor = false;
  this.frequencyHz = 2;
  this.localAnchorA = new b2Vec2();
  this.localAnchorB = new b2Vec2();
  this.localAxisA = new b2Vec2(1, 0);
  this.maxMotorTorque = 0;
  this.motorSpeed = 0;
}

b2WheelJointDef.prototype.Create = function(world) {
  var wheelJoint = new b2WheelJoint(this);
  wheelJoint.ptr = b2WheelJointDef_Create(
    world.ptr,
    // joint def
    this.bodyA.ptr, this.bodyB.ptr, this.collideConnected,
    //wheel joint def
    this.dampingRatio, this.enableMotor, this.frequencyHz,
    this.localAnchorA.x, this.localAnchorA.y, this.localAnchorB.x,
    this.localAnchorB.y, this.localAxisA.x, this.localAxisA.y,
    this.maxMotorTorque, this.motorSpeed);
  return wheelJoint;
};

b2WheelJointDef.prototype.InitializeAndCreate  = function(bodyA, bodyB, anchor, axis) {
  this.bodyA = bodyA;
  this.bodyB = bodyB;
  var wheelJoint = new b2WheelJoint(this);
  wheelJoint.ptr = b2WheelJointDef_InitializeAndCreate(
    world.ptr,
    // InitializeArgs
    this.bodyA.ptr, this.bodyB.ptr, anchor.x,
    anchor.y, axis.x, axis.y,
    // joint def
    this.collideConnected,
    // wheel joint def
    this.dampingRatio, this.enableMotor, this.frequencyHz,
    this.maxMotorTorque, this.motorSpeed);
  b2World._Push(wheelJoint, world.joints);
  return wheelJoint;
};
var b2WeldJointDef_Create = Module.cwrap("b2WeldJointDef_Create",
  'number',
  ['number',
    // joint Def
    'number', 'number', 'number',
    // weld joint def
    'number', 'number', 'number',
    'number', 'number', 'number']);

var b2WeldJointDef_InitializeAndCreate = Module.cwrap("b2WeldJointDef_InitializeAndCreate",
  'number',
  ['number',
    // initialize args
    'number', 'number', 'number',
    'number',
    // joint def
    'number',
    // weld joint def
    'number', 'number']);

/** @constructor */
export function b2WeldJointDef() {
  // joint def
  this.bodyA = null;
  this.bodyB = null;
  this.collideConnected = false;

  // Weld joint def
  this.dampingRatio = 0;
  this.frequencyHz = 0;
  this.localAnchorA = new b2Vec2();
  this.localAnchorB = new b2Vec2();
  this.referenceAngle = 0;
}

b2WeldJointDef.prototype.Create = function(world) {
  var weldJoint = new b2WeldJoint(this);
  weldJoint.ptr = b2WeldJointDef_Create(
    world.ptr,
    // joint def
    this.bodyA.ptr, this.bodyB.ptr, this.collideConnected,
    //Weld joint def
    this.dampingRatio, this.frequencyHz, this.localAnchorA.x,
    this.localAnchorA.y, this.localAnchorB.x, this.localAnchorB.y,
    this.referenceAngle);
  return weldJoint;
};

b2WeldJointDef.prototype.InitializeAndCreate  = function(bodyA, bodyB, anchor) {
  this.bodyA = bodyA;
  this.bodyB = bodyB;
  var weldJoint = new b2WeldJoint(this);
  weldJoint.ptr = b2WeldJointDef_InitializeAndCreate(
    world.ptr,
    // InitializeArgs
    this.bodyA.ptr, this.bodyB.ptr, anchor.x,
    anchor.y,
    // joint def
    this.collideConnected,
    //Weld joint def
    this.dampingRatio, this.frequencyHz);
  b2World._Push(weldJoint, world.joints);
  return weldJoint;
};

/** @constructor */
export function b2WeldJoint(def) {
  this.bodyA = def.bodyA;
  this.bodyB = def.bodyB;
  this.next = null;
  this.ptr = null;
}var b2GearJoint_GetRatio = Module.cwrap("b2GearJoint_GetRatio", 'number',
  ['number']);

export function b2GearJoint(def) {
  this.ptr = null;
  this.next = null;
}

b2GearJoint.prototype.GetRatio = function() {
  return b2GearJoint_GetRatio(this.ptr);
};

var b2GearJointDef_Create = Module.cwrap("b2GearJointDef_Create",
  'number',
  ['number',
    // joint Def
    'number', 'number', 'number',
    // gear joint def
    'number', 'number', 'number']);

/**@constructor*/
export function b2GearJointDef() {
  this.bodyA = null;
  this.bodyB = null;
  this.collideConnected = false;
  this.joint1 = null;
  this.joint2 = null;
  this.ratio = 0;
}

b2GearJointDef.prototype.Create = function(world) {
  var gearJoint = new b2GearJoint(this);
  gearJoint.ptr = b2GearJointDef_Create(
    world.ptr,
    // joint def
    this.bodyA.ptr, this.bodyB.ptr, this.collideConnected,
    //gear joint def
    this.joint1.ptr, this.joint2.ptr, this.ratio);
  return gearJoint;
};
export var e_unknownJoint = 0;
export var e_revoluteJoint = 1;
export var e_prismaticJoint = 2;
export var e_distanceJoint = 3;
export var e_pulleyJoint = 4;
export var e_mouseJoint = 5;
export var e_gearJoint = 6;
export var e_wheelJoint = 7;
export var e_weldJoint = 8;
export var e_frictionJoint = 9;
export var e_ropeJoint = 10;
export var e_motorJoint = 11;

var b2Joint_GetBodyA = Module.cwrap('b2Joint_GetBodyA', 'number', ['number']);
var b2Joint_GetBodyB = Module.cwrap('b2Joint_GetBodyB', 'number', ['number']);

/**@constructor*/
export function b2Joint() {}

b2Joint.prototype.GetBodyA = function() {
  return world.bodiesLookup[b2Joint_GetBodyA(this.ptr)];
};

b2Joint.prototype.GetBodyB = function() {
  return world.bodiesLookup[b2Joint_GetBodyB(this.ptr)];
};var b2FrictionJointDef_Create = Module.cwrap("b2FrictionJointDef_Create",
  'number',
  ['number',
   // joint Def
   'number', 'number', 'number',
   // friction joint def
   'number', 'number', 'number',
   'number', 'number', 'number']);

var b2FrictionJointDef_InitializeAndCreate = Module.cwrap("b2FrictionJointDef_InitializeAndCreate",
  'number',
  ['number',
    // initialize args
    'number', 'number', 'number',
    'number',
    // friction joint def
    'number', 'number', 'number']);

export function b2FrictionJointDef() {
  // joint def
  this.bodyA = null;
  this.bodyB = null;
  this.collideConnected = false;

  // friction joint def
  this.localAnchorA = new b2Vec2();
  this.localAnchorB = new b2Vec2();
  this.maxForce = 0;
  this.maxTorque = 0;
  this.userData = null;
}

b2FrictionJointDef.prototype.Create = function(world) {
  var frictionJoint = new b2FrictionJoint(this);
  frictionJoint.ptr = b2FrictionJointDef_Create(
    world.ptr,
    // joint def
    this.bodyA.ptr, this.bodyB.ptr, this.collideConnected,
    //friction joint def
    this.localAnchorA.x, this.localAnchorA.y, this.localAnchorB.x,
    this.localAnchorB.y, this.maxForce, this.maxTorque);
  return frictionJoint;
};

b2FrictionJointDef.prototype.InitializeAndCreate  = function(bodyA, bodyB, anchor) {
  this.bodyA = bodyA;
  this.bodyB = bodyB;
  var frictionJoint = new b2FrictionJoint(this);
  frictionJoint.ptr = b2FrictionJointDef_InitializeAndCreate(
    world.ptr,
    // InitializeArgs
    this.bodyA.ptr, this.bodyB.ptr, anchor.x,
    anchor.y,
    // joint def
    this.collideConnected,
    // friction joint def
    this.maxForce, this.maxTorque);
  b2World._Push(frictionJoint, world.joints);
  return frictionJoint;
};

export function b2FrictionJoint(def) {
  this.bodyA = def.bodyA;
  this.bodyB = def.bodyB;
  this.ptr = null;
  this.next = null;
}var b2RevoluteJoint_EnableLimit =
  Module.cwrap('b2RevoluteJoint_EnableLimit', 'number',
    ['number', 'number']);

var b2RevoluteJoint_EnableMotor =
  Module.cwrap('b2RevoluteJoint_EnableMotor', 'number',
    ['number', 'number']);

var b2RevoluteJoint_GetJointAngle =
  Module.cwrap('b2RevoluteJoint_GetJointAngle', 'number',
    ['number']);

var b2RevoluteJoint_IsLimitEnabled =
  Module.cwrap('b2RevoluteJoint_IsLimitEnabled', 'number',
    ['number']);

var b2RevoluteJoint_IsMotorEnabled =
  Module.cwrap('b2RevoluteJoint_IsMotorEnabled', 'number',
    ['number']);

var b2RevoluteJoint_SetMotorSpeed =
  Module.cwrap('b2RevoluteJoint_SetMotorSpeed', 'number',
    ['number', 'number']);

/** @constructor */
export function b2RevoluteJoint(revoluteJointDef) {
  this.collideConnected = revoluteJointDef.collideConnected;
  this.enableLimit = revoluteJointDef.enableLimit;
  this.enableMotor = revoluteJointDef.enableMotor;
  this.lowerAngle = revoluteJointDef.lowerAngle;
  this.maxMotorTorque = revoluteJointDef.maxMotorTorque;
  this.motorSpeed = revoluteJointDef.motorSpeed;
  this.next = null;
  this.ptr = null;
  this.upperAngle = revoluteJointDef.upperAngle;
  this.userData = revoluteJointDef.userData;
}

b2RevoluteJoint.prototype = new b2Joint;

b2RevoluteJoint.prototype.EnableLimit = function(flag) {
  b2RevoluteJoint_EnableLimit(this.ptr, flag);
};

b2RevoluteJoint.prototype.EnableMotor = function(flag) {
  b2RevoluteJoint_EnableMotor(this.ptr, flag);
};

b2RevoluteJoint.prototype.GetJointAngle = function(flag) {
  return b2RevoluteJoint_GetJointAngle(this.ptr);
};

b2RevoluteJoint.prototype.IsLimitEnabled = function() {
  return b2RevoluteJoint_IsLimitEnabled(this.ptr);
};

b2RevoluteJoint.prototype.IsMotorEnabled = function() {
  return b2RevoluteJoint_IsMotorEnabled(this.ptr);
};

b2RevoluteJoint.prototype.SetMotorSpeed = function(speed) {
  b2RevoluteJoint_SetMotorSpeed(this.ptr, speed);
  this.motorSpeed = speed;
};


var b2RevoluteJointDef_Create =
  Module.cwrap('b2RevoluteJointDef_Create', 'number',
    ['number',
    //joint def
    'number', 'number', 'number',
    // revolute joint def
    'number', 'number', 'number',
    'number', 'number', 'number',
    'number', 'number', 'number',
    'number', 'number']);

var b2RevoluteJointDef_InitializeAndCreate =
  Module.cwrap('b2RevoluteJointDef_InitializeAndCreate', 'number',
    ['number',
      //initialize args
     'number', 'number', 'number',
     'number',
      //revoluteJointDef
     'number', 'number', 'number',
     'number', 'number', 'number',
     'number']);

/** @constructor */
export function b2RevoluteJointDef() {
  this.collideConnected = false;
  this.enableLimit = false;
  this.enableMotor = false;
  this.localAnchorA = new b2Vec2();
  this.localAnchorB = new b2Vec2();
  this.lowerAngle = 0;
  this.maxMotorTorque = 0;
  this.motorSpeed = 0;
  this.referenceAngle = 0;
  this.upperAngle = 0;
  this.userData = null;
}

b2RevoluteJointDef.prototype.Create = function(world) {
  var revoluteJoint = new b2RevoluteJoint(this);
  revoluteJoint.ptr = b2RevoluteJointDef_Create(
    world.ptr,
    // joint def
    this.bodyA.ptr, this.bodyB.ptr, this.collideConnected,
    //revoluteJointDef
    this.enableLimit, this.enableMotor, this.lowerAngle,
    this.localAnchorA.x, this.localAnchorA.y, this.localAnchorB.x,
    this.localAnchorB.y, this.maxMotorTorque, this.motorSpeed,
    this.referenceAngle, this.upperAngle);
  return revoluteJoint;
};

// todo Initialize and create probably shouldnt use the global world ptr
b2RevoluteJointDef.prototype.InitializeAndCreate = function(bodyA, bodyB, anchor) {
  this.bodyA = bodyA;
  this.bodyB = bodyB;
  var revoluteJoint = new b2RevoluteJoint(this);
  revoluteJoint.ptr =
    b2RevoluteJointDef_InitializeAndCreate(world.ptr,
      // initialize args
      bodyA.ptr, bodyB.ptr, anchor.x,
      anchor.y,
      // joint def
      this.collideConnected,
      // revloute joint def
      this.enableLimit, this.enableMotor, this.lowerAngle,
      this.maxMotorTorque, this.motorSpeed, this.upperAngle);
  b2World._Push(revoluteJoint, world.joints);
  return revoluteJoint;
};var b2MotorJoint_SetAngularOffset =
  Module.cwrap('b2MotorJoint_SetAngularOffset', 'null', ['number', 'number']);

var b2MotorJoint_SetLinearOffset =
  Module.cwrap('b2MotorJoint_SetLinearOffset', 'null',
    ['number', 'number', 'number']);

/**@constructor*/
export function b2MotorJoint(def) {
  this.bodyA = def.bodyA;
  this.bodyB = def.bodyB;
  this.ptr = null;
  this.next = null;
}

b2MotorJoint.prototype.SetAngularOffset = function(angle) {
  b2MotorJoint_SetAngularOffset(this.ptr, angle);
};

b2MotorJoint.prototype.SetLinearOffset = function(v) {
  b2MotorJoint_SetLinearOffset(this.ptr, v.x, v.y);
};

var b2MotorJointDef_Create = Module.cwrap("b2MotorJointDef_Create",
  'number',
  ['number',
    // joint Def
    'number', 'number', 'number',
    // motor joint def
    'number', 'number', 'number',
    'number', 'number', 'number']);

var b2MotorJointDef_InitializeAndCreate = Module.cwrap("b2MotorJointDef_InitializeAndCreate",
  'number',
  ['number',
    // initialize args
    'number', 'number', 'number',
    'number',
    // motor joint def
    'number', 'number', 'number']);

/**@constructor*/
export function b2MotorJointDef() {
  // joint def
  this.bodyA = null;
  this.bodyB = null;
  this.collideConnected = false;

  // motor joint def
  this.angularOffset = 0;
  this.correctionFactor = 0.3;
  this.linearOffset = new b2Vec2();
  this.maxForce = 0;
  this.maxTorque = 0;
}

b2MotorJointDef.prototype.Create = function(world) {
  var motorJoint = new b2MotorJoint(this);
  motorJoint.ptr = b2MotorJointDef_Create(
    world.ptr,
    // joint def
    this.bodyA.ptr, this.bodyB.ptr, this.collideConnected,
    //motor joint def
    this.angularOffset, this.correctionFactor, this.linearOffset.x,
    this.linearOffset.y, this.maxForce, this.maxTorque);
  return motorJoint;
};

b2MotorJointDef.prototype.InitializeAndCreate  = function(bodyA, bodyB) {
  this.bodyA = bodyA;
  this.bodyB = bodyB;
  var motorJoint = new b2MotorJoint(this);
  motorJoint.ptr = b2MotorJointDef_InitializeAndCreate(
    world.ptr,
    // InitializeArgs
    this.bodyA.ptr, this.bodyB.ptr,
    // joint def
    this.collideConnected,
    //motor joint def
    this.correctionFactor, this.maxForce, this.maxTorque);
  b2World._Push(motorJoint, world.joints);
  return motorJoint;
};
/**@constructor*/
export function b2PulleyJoint(def) {
  this.ptr = null;
  this.next = null;
}

var b2PulleyJointDef_Create = Module.cwrap("b2PulleyJointDef_Create",
  'number',
  ['number',
    // joint Def
    'number', 'number', 'number',
    // pulley joint def
    'number', 'number', 'number',
    'number', 'number', 'number',
    'number', 'number', 'number',
    'number', 'number']);

var b2PulleyJointDef_InitializeAndCreate = Module.cwrap("b2PulleyJointDef_InitializeAndCreate",
  'number',
  ['number',
    // initialize args
    'number', 'number', 'number',
    'number', 'number', 'number',
    // joint def
    'number',
    // pulley joint def
    'number', 'number', 'number',
    'number', 'number', 'number']);

/**@constructor*/
export function b2PulleyJointDef() {
  // joint def
  this.bodyA = null;
  this.bodyB = null;
  this.collideConnected = true;

  // pulley joint def
  this.groundAnchorA = new b2Vec2();
  this.groundAnchorB = new b2Vec2();
  this.localAnchorA = new b2Vec2();
  this.localAnchorB = new b2Vec2();
  this.lengthA = 0;
  this.lengthB = 0;
  this.ratio = 1;
}

b2PulleyJointDef.prototype.Create = function(world) {
  var pulleyJoint = new b2PulleyJoint(this);
  pulleyJoint.ptr = b2PulleyJointDef_Create(
    world.ptr,
    // joint def
    this.bodyA.ptr, this.bodyB.ptr, this.collideConnected,
    // pulley joint def
    this.groundAnchorA.x, this.groundAnchorA.y, this.groundAnchorB.x,
    this.groundAnchorB.y, this.lengthA, this.lengthB,
    this.localAnchorA.x, this.localAnchorA.y, this.localAnchorB.x,
    this.localAnchorB.y, this.ratio);
  return pulleyJoint;
};

b2PulleyJointDef.prototype.InitializeAndCreate  = function(bodyA, bodyB, groundAnchorA,
                                                           groundAnchorB, anchorA, anchorB,
                                                           ratio) {
  this.bodyA = bodyA;
  this.bodyB = bodyB;
  var pulleyJoint = new b2PulleyJoint(this);
  pulleyJoint.ptr = b2PulleyJointDef_InitializeAndCreate(
    world.ptr,
    // InitializeArgs
    this.bodyA.ptr, this.bodyB.ptr, anchorA.x,
    anchorA.y, anchorB.x, anchorB.y,
    groundAnchorA.x, groundAnchorA.y, groundAnchorB.x,
    groundAnchorB.y, ratio,
    // joint def
    this.collideConnected);
  b2World._Push(pulleyJoint, world.joints);
  return pulleyJoint;
};
/**@constructor*/
export function b2DistanceJoint(def) {
  this.bodyA = def.bodyA;
  this.bodyB = def.bodyB;
  this.ptr = null;
  this.next = null;
}

var b2DistanceJointDef_Create = Module.cwrap("b2DistanceJointDef_Create",
  'number',
  ['number',
    // joint Def
    'number', 'number', 'number',
    // distance joint def
    'number', 'number', 'number',
    'number', 'number', 'number',
    'number']);

var b2DistanceJointDef_InitializeAndCreate = Module.cwrap("b2DistanceJointDef_InitializeAndCreate",
  'number',
  ['number',
    // initialize args
    'number', 'number',
    'number', 'number',
    'number', 'number',
    // distance joint def
    'number', 'number', 'number']);

/**@constructor*/
export function b2DistanceJointDef() {
  this.bodyA = null;
  this.bodyB = null;
  this.collideConnected = false;
  this.dampingRatio = 0;
  this.length = 1;
  this.localAnchorA = new b2Vec2();
  this.localAnchorB = new b2Vec2();
  this.frequencyHz = 0;
}

b2DistanceJointDef.prototype.Create = function(world) {
  var distanceJoint = new b2DistanceJoint(this);
  distanceJoint.ptr = b2DistanceJointDef_Create(
    world.ptr,
    // joint def
    this.bodyA.ptr, this.bodyB.ptr, this.collideConnected,
    //distance joint def
    this.dampingRatio, this.frequencyHz, this.length,
    this.localAnchorA.x, this.localAnchorA.y,
    this.localAnchorB.x, this.localAnchorB.y);
  return distanceJoint;
};

b2DistanceJointDef.prototype.InitializeAndCreate  = function(bodyA, bodyB, anchorA, anchorB) {
  this.bodyA = bodyA;
  this.bodyB = bodyB;
  var distanceJoint = new b2DistanceJoint(this);
  distanceJoint.ptr = b2DistanceJointDef_InitializeAndCreate(
    world.ptr,
    // InitializeArgs
    this.bodyA.ptr, this.bodyB.ptr,
    anchorA.x, anchorA.y,
    anchorB.x, anchorB.y,
    // joint def
    this.collideConnected,
    //distance joint def
    this.dampingRatio, this.frequencyHz);
  b2World._Push(distanceJoint, world.joints);
  return distanceJoint;
};var b2PrismaticJoint_EnableLimit =
  Module.cwrap('b2PrismaticJoint_EnableLimit', 'number', ['number', 'number']);
var b2PrismaticJoint_EnableMotor =
  Module.cwrap('b2PrismaticJoint_EnableMotor', 'number', ['number', 'number']);
var b2PrismaticJoint_GetJointTranslation =
  Module.cwrap('b2PrismaticJoint_GetJointTranslation', 'number', ['number']);
var b2PrismaticJoint_GetMotorSpeed =
  Module.cwrap('b2PrismaticJoint_GetMotorSpeed', 'number', ['number']);
var b2PrismaticJoint_GetMotorForce =
  Module.cwrap('b2PrismaticJoint_GetMotorForce', 'number', ['number', 'number']);
var b2PrismaticJoint_IsLimitEnabled =
  Module.cwrap('b2PrismaticJoint_IsLimitEnabled', 'number', ['number']);
var b2PrismaticJoint_IsMotorEnabled =
  Module.cwrap('b2PrismaticJoint_IsMotorEnabled', 'number', ['number']);
var b2PrismaticJoint_SetMotorSpeed =
  Module.cwrap('b2PrismaticJoint_SetMotorSpeed', 'number', ['number', 'number']);

/**@constructor*/
export function b2PrismaticJoint(def) {
  this.ptr = null;
  this.next = null;
}

b2PrismaticJoint.prototype = new b2Joint;

b2PrismaticJoint.prototype.EnableLimit = function(flag) {
  return b2PrismaticJoint_EnableLimit(this.ptr, flag);
};

b2PrismaticJoint.prototype.EnableMotor = function(flag) {
  return b2PrismaticJoint_EnableMotor(this.ptr, flag);
};

b2PrismaticJoint.prototype.GetJointTranslation = function() {
  return b2PrismaticJoint_GetJointTranslation(this.ptr);
};

b2PrismaticJoint.prototype.GetMotorSpeed = function() {
  return b2PrismaticJoint_GetMotorSpeed(this.ptr);
};

b2PrismaticJoint.prototype.GetMotorForce = function(hz) {
  return b2PrismaticJoint_GetMotorForce(this.ptr, hz);
};

b2PrismaticJoint.prototype.IsLimitEnabled = function() {
  return b2PrismaticJoint_IsLimitEnabled(this.ptr);
};

b2PrismaticJoint.prototype.IsMotorEnabled = function() {
  return b2PrismaticJoint_IsMotorEnabled(this.ptr);
};

b2PrismaticJoint.prototype.GetMotorEnabled = function() {
  return b2PrismaticJoint_IsMotorEnabled(this.ptr);
};

b2PrismaticJoint.prototype.SetMotorSpeed = function(speed) {
  return b2PrismaticJoint_SetMotorSpeed(this.ptr, speed);
};


var b2PrismaticJointDef_Create = Module.cwrap("b2PrismaticJointDef_Create",
  'number',
  ['number',
    // joint Def
    'number', 'number', 'number',
    // prismatic joint def
    'number', 'number', 'number',
    'number', 'number', 'number',
    'number', 'number', 'number',
    'number', 'number', 'number',
    'number']);

var b2PrismaticJointDef_InitializeAndCreate = Module.cwrap("b2PrismaticJointDef_InitializeAndCreate",
  'number',
  ['number',
    // initialize args
    'number', 'number', 'number',
    'number', 'number', 'number',
    // joint def
    'number',
    // prismatic joint def
    'number', 'number', 'number',
    'number', 'number', 'number']);

/**@constructor*/
export function b2PrismaticJointDef() {
  // joint def
  this.bodyA = null;
  this.bodyB = null;
  this.collideConnected = false;

  // prismatic joint def
  this.enableLimit = false;
  this.enableMotor = false;
  this.localAnchorA = new b2Vec2();
  this.localAnchorB = new b2Vec2();
  this.localAxisA = new b2Vec2(1, 0);
  this.lowerTranslation = 0;
  this.maxMotorForce = 0;
  this.motorSpeed = 0;
  this.referenceAngle = 0;
  this.upperTranslation = 0;
}

b2PrismaticJointDef.prototype.Create = function(world) {
  var prismaticJoint = new b2PrismaticJoint(this);
  prismaticJoint.ptr = b2PrismaticJointDef_Create(
    world.ptr,
    // joint def
    this.bodyA.ptr, this.bodyB.ptr, this.collideConnected,
    //prismatic joint def
    this.enableLimit, this.enableMotor, this.localAnchorA.x,
    this.localAnchorA.y, this.localAnchorB.x, this.localAnchorB.y,
    this.localAxisA.x, this.localAxisA.y, this.lowerTranslation,
    this.maxMotorForce, this.motorSpeed, this.referenceAngle,
    this.upperTranslation);
  return prismaticJoint;
};

b2PrismaticJointDef.prototype.InitializeAndCreate  = function(bodyA, bodyB, anchor, axis) {
  this.bodyA = bodyA;
  this.bodyB = bodyB;
  var prismaticJoint = new b2PrismaticJoint(this);
  prismaticJoint.ptr = b2PrismaticJointDef_InitializeAndCreate(
    world.ptr,
    // InitializeArgs
    this.bodyA.ptr, this.bodyB.ptr, anchor.x,
    anchor.y, axis.x, axis.y,
    // joint def
    this.collideConnected,
    // prismatic joint def
    this.enableLimit, this.enableMotor, this.lowerTranslation,
    this.maxMotorForce, this.motorSpeed, this.upperTranslation);
  b2World._Push(prismaticJoint, world.joints);
  return prismaticJoint;
};/**@constructor*/
export function b2RopeJoint(def) {
  this.next = null;
  this.ptr = null;
}

var b2RopeJointDef_Create = Module.cwrap("b2RopeJointDef_Create",
  'number',
  ['number',
    // joint Def
    'number', 'number', 'number',
    // rope joint def
    'number', 'number', 'number',
    'number', 'number']);

/**@constructor*/
export function b2RopeJointDef() {
  // joint def
  this.bodyA = null;
  this.bodyB = null;
  this.collideConnected = false;

  // mouse joint def
  this.localAnchorA = new b2Vec2();
  this.localAnchorB = new b2Vec2();
  this.maxLength = 0;
}

b2RopeJointDef.prototype.Create = function(world) {
  var ropeJoint = new b2RopeJoint(this);
  ropeJoint.ptr = b2RopeJointDef_Create(
    world.ptr,
    // joint def
    this.bodyA.ptr, this.bodyB.ptr, this.collideConnected,
    //rope joint def
    this.localAnchorA.x, this.localAnchorA.y, this.localAnchorB.x,
    this.localAnchorB.y, this.maxLength);
  return ropeJoint;
};
var b2MouseJoint_SetTarget =
  Module.cwrap('b2MouseJoint_SetTarget', 'null',
    ['number', 'number', 'number']);

/**@constructor*/
export function b2MouseJoint(def) {
  this.ptr = null;
  this.next = null;
}

b2MouseJoint.prototype.SetTarget = function(p) {
  b2MouseJoint_SetTarget(this.ptr, p.x, p.y);
};

var b2MouseJointDef_Create = Module.cwrap("b2MouseJointDef_Create",
  'number',
  ['number',
    // joint Def
    'number', 'number', 'number',
    // mouse joint def
    'number', 'number', 'number',
    'number', 'number']);

/**@constructor*/
export function b2MouseJointDef() {
  // joint def
  this.bodyA = null;
  this.bodyB = null;
  this.collideConnected = false;

  // mouse joint def
  this.dampingRatio = 0.7;
  this.frequencyHz = 5;
  this.maxForce = 0;
  this.target = new b2Vec2();
}

b2MouseJointDef.prototype.Create = function(world) {
  var mouseJoint = new b2MouseJoint(this);
  mouseJoint.ptr = b2MouseJointDef_Create(
    world.ptr,
    // joint def
    this.bodyA.ptr, this.bodyB.ptr, this.collideConnected,
    //mouse joint def
    this.dampingRatio, this.frequencyHz, this.maxForce,
    this.target.x, this.target.y);
  return mouseJoint;
};// TODO this can all be done better, wayyy too manyy calls between asm and js
// a b2contact looks like: (actually this is wrong because of the vtable, I will get a nice one later
/*
uint32 m_flags; // 0
b2Contact* m_prev; // 4
b2Contact* m_next; // 8
b2ContactEdge m_nodeA; // 12 // each of these is 16 bytes, 4 ptrs
b2ContactEdge m_nodeB; // 28
b2Fixture* m_fixtureA; //44
b2Fixture* m_fixtureB; //48
int32 m_indexA;
int32 m_indexB;
b2Manifold m_manifold; a manifold is 20 bytes
int32 m_toiCount;
float32 m_toi;
float32 m_friction;
float32 m_restitution;
float32 m_tangentSpeed;*/

var b2Contact_flags_offset = Offsets.b2Contact.flags;
var b2Contact_fixtureA_offset = Offsets.b2Contact.fixtureA;
var b2Contact_fixtureB_offset = Offsets.b2Contact.fixtureB;
var b2Contact_tangentSpeed_offset = Offsets.b2Contact.tangentSpeed;

var e_enabledFlag = 4;

var b2Contact_GetManifold = Module.cwrap('b2Contact_GetManifold', 'number', ['number']);
var b2Contact_GetWorldManifold = Module.cwrap('b2Contact_GetWorldManifold', 'number', ['number']);
/**@constructor*/
export function b2Contact(ptr) {
  this.buffer = new DataView(Module.HEAPU8.buffer, ptr);
  this.ptr = ptr;
}

b2Contact.prototype.GetFixtureA = function() {
  var fixAPtr = this.buffer.getUint32(b2Contact_fixtureA_offset, true);
  return world.fixturesLookup[fixAPtr];
};

b2Contact.prototype.GetFixtureB = function() {
  var fixBPtr = this.buffer.getUint32(b2Contact_fixtureB_offset, true);
  return world.fixturesLookup[fixBPtr];
};

b2Contact.prototype.GetManifold = function() {
  return new b2Manifold(b2Contact_GetManifold(this.ptr));
};

b2Contact.prototype.GetWorldManifold = function() {
  return new b2WorldManifold(b2Contact_GetWorldManifold(this.ptr));
};

b2Contact.prototype.SetTangentSpeed = function(speed) {
  this.buffer.setFloat32(b2Contact_tangentSpeed_offset, speed, true);
};

b2Contact.prototype.SetEnabled = function(enable) {
  var flags = this.buffer.getUint32(b2Contact_flags_offset, true);
  if(enable) {
	  flags = flags | e_enabledFlag;
  } else {
	  flags = flags & ~e_enabledFlag;
  }
  this.buffer.setUint32(b2Contact_flags_offset, flags, true);
};

b2Contact.prototype.IsEnabled = function() {
  var flags = this.buffer.getUint32(b2Contact_flags_offset, true);
  return flags & e_enabledFlag;
};/**@constructor*/
function b2Filter() {
  this.categoryBits = 0x0001;
  this.maskBits = 0xFFFF;
  this.groupIndex = 0;
}

// fixture globals
var b2Fixture_isSensor_offset = Offsets.b2Fixture.isSensor;
var b2Fixture_userData_offset = Offsets.b2Fixture.userData;
var b2Fixture_filter_categoryBits_offset = Offsets.b2Fixture.filterCategoryBits;
var b2Fixture_filter_maskBits_offset = Offsets.b2Fixture.filterMaskBits;
var b2Fixture_filter_groupIndex_offset = Offsets.b2Fixture.filterGroupIndex;
/**@constructor*/

export function b2Fixture() {
  this.body = null;
  this.buffer = null;
  this.ptr = null;
  this.shape = null;
}

var b2Fixture_TestPoint =
  Module.cwrap('b2Fixture_TestPoint', 'number', ['number', 'number', 'number']);
var b2Fixture_Refilter =
  Module.cwrap('b2Fixture_Refilter', 'null', ['number']);

b2Fixture.prototype._SetPtr = function(ptr) {
  this.ptr = ptr;
  this.buffer = new DataView(Module.HEAPU8.buffer, ptr);
};

b2Fixture.prototype.FromFixtureDef = function(fixtureDef) {
  this.density = fixtureDef.density;
  this.friction = fixtureDef.friction;
  this.isSensor = fixtureDef.isSensor;
  this.restitution = fixtureDef.restitution;
  this.shape = fixtureDef.shape;
  this.userData = fixtureDef.userData;
  this.vertices = [];
};

b2Fixture.prototype.GetUserData = function() {
  return this.buffer.getUint32(b2Fixture_userData_offset, true);
};

b2Fixture.prototype.SetFilterData = function(filter) {
  this.buffer.setUint16(b2Fixture_filter_categoryBits_offset, filter.categoryBits, true);
  this.buffer.setUint16(b2Fixture_filter_maskBits_offset, filter.maskBits, true);
  this.buffer.setUint16(b2Fixture_filter_groupIndex_offset, filter.groupIndex, true);
  this.Refilter();
};

b2Fixture.prototype.SetSensor = function(flag) {
  this.buffer.setUint32(b2Fixture_isSensor_offset, flag, true);
};

b2Fixture.prototype.Refilter = function() {
  b2Fixture_Refilter(this.ptr);
};

b2Fixture.prototype.TestPoint = function(p) {
  return b2Fixture_TestPoint(this.ptr, p.x, p.y);
};

/**@constructor*/
export function b2FixtureDef() {
  this.density = 0.0;
  this.friction = 0.2;
  this.isSensor = false;
  this.restitution = 0.0;
  this.shape = null;
  this.userData = null;
  this.filter = new b2Filter();
}
// in memory a contact impulse looks like
// float normalImpulse[0]
// float normalImpulse[1]
// float tangentImpulse[0]
// float tangentImpulse[1]
// int count
// TODO update with offsets table
/** @constructor */
function b2ContactImpulse(ptr) {
  this.ptr = ptr;
  this.buffer = new DataView(Module.HEAPU8.buffer, ptr);
}

b2ContactImpulse.prototype.GetNormalImpulse = function(i) {
  return this.buffer.getFloat32(i * 4, true);
};

b2ContactImpulse.prototype.GetTangentImpulse = function(i) {
  return this.buffer.getFloat32(i * 4 + 8, true);
};

b2ContactImpulse.prototype.GetCount = function(i) {
  console.log(this.buffer.getInt32(16, true));
};/**@constructor*/
export function b2ParticleSystemDef() {
  // Initialize physical coefficients to the maximum values that
  // maintain numerical stability.
  this.colorMixingStrength = 0.5;
  this.dampingStrength = 1.0;
  this.destroyByAge = true;
  this.ejectionStrength = 0.5;
  this.elasticStrength = 0.25;
  this.lifetimeGranularity = 1.0 / 60.0;
  this.powderStrength = 0.5;
  this.pressureStrength = 0.05;
  this.radius = 1.0;
  this.repulsiveStrength = 1.0;
  this.springStrength = 0.25;
  this.staticPressureIterations = 8;
  this.staticPressureRelaxation = 0.2;
  this.staticPressureStrength = 0.2;
  this.surfaceTensionNormalStrength = 0.2;
  this.surfaceTensionPressureStrength = 0.2;
  this.viscousStrength = 0.25;
  this.filter = new b2Filter();
}

var b2ParticleSystem_CreateParticle =
  Module.cwrap('b2ParticleSystem_CreateParticle', 'number',
  ['number',
    //particle def
    'number', 'number', 'number',
    'number', 'number', 'number',
    'number', 'number', 'number',
    'number', 'number', 'number'
  ]);

var b2ParticleSystem_GetColorBuffer =
  Module.cwrap('b2ParticleSystem_GetColorBuffer', 'number', ['number']);

var b2ParticleSystem_GetParticleCount =
  Module.cwrap('b2ParticleSystem_GetParticleCount', 'number', ['number']);

var b2ParticleSystem_GetParticleLifetime =
  Module.cwrap('b2ParticleSystem_GetParticleLifetime', 'number', ['number', 'number']);

var b2ParticleSystem_GetPositionBuffer =
  Module.cwrap('b2ParticleSystem_GetPositionBuffer', 'number', ['number']);

var b2ParticleSystem_GetVelocityBuffer =
  Module.cwrap('b2ParticleSystem_GetVelocityBuffer', 'number', ['number']);

var b2ParticleSystem_SetDamping =
  Module.cwrap('b2ParticleSystem_SetDamping', 'null', ['number', 'number']);

var b2ParticleSystem_SetDensity =
  Module.cwrap('b2ParticleSystem_SetDensity', 'null', ['number', 'number']);

var b2ParticleSystem_SetGravityScale =
  Module.cwrap('b2ParticleSystem_SetGravityScale', 'null', ['number', 'number']);

var b2ParticleSystem_SetMaxParticleCount =
  Module.cwrap('b2ParticleSystem_SetMaxParticleCount', 'null', ['number', 'number']);

var b2ParticleSystem_SetParticleLifetime =
  Module.cwrap('b2ParticleSystem_SetParticleLifetime', 'null', ['number', 'number', 'number']);

var b2ParticleSystem_SetRadius =
  Module.cwrap('b2ParticleSystem_SetRadius', 'null', ['number', 'number']);

/** @constructor */
export function b2ParticleSystem(ptr) {
  this.dampingStrength = 1.0;
  // is this a sane default for density?
  this.density = 1.0;
  this.ptr = ptr;
  this.particleGroups = [];
  this.radius = 1.0;
  this.gravityScale = 1.0;
}

b2ParticleSystem.prototype.CreateParticle = function(pd) {
  return b2ParticleSystem_CreateParticle(this.ptr,
    pd.color.r, pd.color.g, pd.color.b,
    pd.color.a, pd.flags, pd.group,
    pd.lifetime, pd.position.x, pd.position.y,
    pd.velocity.x, pd.velocity.y, pd.userData);
};

b2ParticleSystem.prototype.CreateParticleGroup = function(pgd) {
  var particleGroup = new b2ParticleGroup(pgd.shape._CreateParticleGroup(this, pgd));
  this.particleGroups.push(particleGroup);
  return particleGroup;
};

b2ParticleSystem.prototype.DestroyParticlesInShape = function(shape, xf) {
  return shape._DestroyParticlesInShape(this, xf);
};

b2ParticleSystem.prototype.GetColorBuffer = function() {
  var count = b2ParticleSystem_GetParticleCount(this.ptr) * 4;
  var offset = b2ParticleSystem_GetColorBuffer(this.ptr);
  return new Uint8Array(Module.HEAPU8.buffer, offset, count);
};

b2ParticleSystem.prototype.GetParticleLifetime = function(index) {
  return b2ParticleSystem_GetParticleLifetime(this.ptr, index);
}

/**@return number*/
b2ParticleSystem.prototype.GetParticleCount = function() {
  return b2ParticleSystem_GetParticleCount(this.ptr);
};

b2ParticleSystem.prototype.GetPositionBuffer = function() {
  var count = b2ParticleSystem_GetParticleCount(this.ptr) * 2;
  var offset = b2ParticleSystem_GetPositionBuffer(this.ptr);
  return new Float32Array(Module.HEAPU8.buffer, offset, count);
};

b2ParticleSystem.prototype.GetVelocityBuffer = function() {
  var count = b2ParticleSystem_GetParticleCount(this.ptr) * 2;
  var offset = b2ParticleSystem_GetVelocityBuffer(this.ptr);
  return new Float32Array(Module.HEAPU8.buffer, offset, count);
};

b2ParticleSystem.prototype.SetDamping = function(damping) {
  this.dampingStrength = damping;
  b2ParticleSystem_SetDamping(this.ptr, damping);
};

b2ParticleSystem.prototype.SetDensity = function(density) {
  this.density = density;
  b2ParticleSystem_SetDensity(this.ptr, density);
};

b2ParticleSystem.prototype.SetGravityScale = function(gravityScale) {
  this.gravityScale = gravityScale;
  b2ParticleSystem_SetGravityScale(this.ptr, gravityScale);
};

b2ParticleSystem.prototype.SetMaxParticleCount = function(count) {
  b2ParticleSystem_SetMaxParticleCount(this.ptr, count);
};

b2ParticleSystem.prototype.SetParticleLifetime = function(index, lifetime) {
  b2ParticleSystem_SetParticleLifetime(this.ptr, index, lifetime);
};

b2ParticleSystem.prototype.SetRadius = function(radius) {
  this.radius = radius;
  b2ParticleSystem_SetRadius(this.ptr, radius);
};
/// Prevents overlapping or leaking.
export var b2_solidParticleGroup = 1 << 0;
/// Keeps its shape.
export var b2_rigidParticleGroup = 1 << 1;
/// Won't be destroyed if it gets empty.
export var b2_particleGroupCanBeEmpty = 1 << 2;
/// Will be destroyed on next simulation step.
export var b2_particleGroupWillBeDestroyed = 1 << 3;
/// Updates depth data on next simulation step.
export var b2_particleGroupNeedsUpdateDepth = 1 << 4;
var b2_particleGroupInternalMask =
    b2_particleGroupWillBeDestroyed |
    b2_particleGroupNeedsUpdateDepth;

var b2ParticleGroup_ApplyForce =
  Module.cwrap('b2ParticleGroup_ApplyForce', 'null',
    ['number', 'number', 'number']);
var b2ParticleGroup_ApplyLinearImpulse =
  Module.cwrap('b2ParticleGroup_ApplyLinearImpulse', 'null',
    ['number', 'number', 'number']);
var b2ParticleGroup_DestroyParticles =
  Module.cwrap('b2ParticleGroup_DestroyParticles', 'null',
    ['number', 'number']);
var b2ParticleGroup_GetBufferIndex =
  Module.cwrap('b2ParticleGroup_GetBufferIndex', 'number',
    ['number']);
var b2ParticleGroup_GetParticleCount =
  Module.cwrap('b2ParticleGroup_GetParticleCount', 'number',
    ['number']);

var b2ParticleGroup_groupFlags_offset = Offsets.b2ParticleGroup.groupFlags;

/** @constructor */
export function b2ParticleGroup(ptr) {
  this.buffer = new DataView(Module.HEAPU8.buffer, ptr);
  this.ptr = ptr;
}

b2ParticleGroup.prototype.ApplyForce = function(force) {
  b2ParticleGroup_ApplyForce(this.ptr, force.x, force.y);
};

b2ParticleGroup.prototype.ApplyLinearImpulse = function(impulse) {
  b2ParticleGroup_ApplyLinearImpulse(this.ptr, impulse.x, impulse.y);
};

b2ParticleGroup.prototype.DestroyParticles = function(flag) {
  b2ParticleGroup_DestroyParticles(this.ptr, flag);
};

b2ParticleGroup.prototype.GetBufferIndex = function() {
  return b2ParticleGroup_GetBufferIndex(this.ptr);
};

b2ParticleGroup.prototype.GetGroupFlags = function() {
  return this.buffer.getUint32(b2ParticleGroup_groupFlags_offset, true);
};

b2ParticleGroup.prototype.GetParticleCount = function() {
  return b2ParticleGroup_GetParticleCount(this.ptr);
};

b2ParticleGroup.prototype.SetGroupFlags = function(flags) {
  this.buffer.setUint32(b2ParticleGroup_groupFlags_offset, flags, true);
};

/**@constructor*/
export function b2ParticleGroupDef() {
  this.angle = 0;
  this.angularVelocity = 0;
  this.color = new b2ParticleColor(0, 0, 0, 0);
  this.flags = 0;
  this.group = new b2ParticleGroup(null);
  this.groupFlags = 0;
  this.lifetime = 0.0;
  this.linearVelocity = new b2Vec2();
  this.position = new b2Vec2();
  this.positionData = null;
  this.particleCount = 0;
  this.shape = null;
  //this.shapeCount = 0;
  //this.shapes = null; // not supported currently
  this.strength = 1;
  this.stride = 0;
  this.userData = null;
}
/// Water particle.
export var b2_waterParticle = 0;
/// Removed after next simulation step.
export var b2_zombieParticle = 1 << 1;
/// Zero velocity.
export var b2_wallParticle = 1 << 2;
/// With restitution from stretching.
export var b2_springParticle = 1 << 3;
/// With restitution from deformation.
export var b2_elasticParticle = 1 << 4;
/// With viscosity.
export var b2_viscousParticle = 1 << 5;
/// Without isotropic pressure.
export var b2_powderParticle = 1 << 6;
/// With surface tension.
export var b2_tensileParticle = 1 << 7;
/// Mix color between contacting particles.
export var b2_colorMixingParticle = 1 << 8;
/// Call b2DestructionListener on destruction.
export var b2_destructionListenerParticle = 1 << 9;
/// Prevents other particles from leaking.
export var b2_barrierParticle = 1 << 10;
/// Less compressibility.
export var b2_staticPressureParticle = 1 << 11;
/// Makes pairs or triads with other particles.
export var b2_reactiveParticle = 1 << 12;
/// With high repulsive force.
export var b2_repulsiveParticle = 1 << 13;
/// Call b2ContactListener when this particle is about to interact with
/// a rigid body or stops interacting with a rigid body.
/// This results in an expensive operation compared to using
/// b2_fixtureContactFilterParticle to detect collisions between
/// particles.
export var b2_fixtureContactListenerParticle = 1 << 14;
/// Call b2ContactListener when this particle is about to interact with
/// another particle or stops interacting with another particle.
/// This results in an expensive operation compared to using
/// b2_particleContactFilterParticle to detect collisions between
/// particles.
export var b2_particleContactListenerParticle = 1 << 15;
/// Call b2ContactFilter when this particle interacts with rigid bodies.
export var b2_fixtureContactFilterParticle = 1 << 16;
/// Call b2ContactFilter when this particle interacts with other
/// particles.
export var b2_particleContactFilterParticle = 1 << 17;

/** @constructor */
export function b2ParticleColor(r, g, b, a) {
  if (r === undefined) {
    r = 0;
  }
  if (g === undefined) {
    g = 0;
  }
  if (b === undefined) {
    b = 0;
  }
  if (a === undefined) {
    a = 0;
  }
  this.r = r;
  this.g = g;
  this.b = b;
  this.a = a;
}

b2ParticleColor.prototype.Set = function(r, g, b, a) {
  this.r = r;
  this.g = g;
  this.b = b;
  this.a = a;
};

/**@constructor*/
export function b2ParticleDef() {
  this.color = new b2ParticleColor(0, 0, 0, 0);
  this.flags = 0;
  this.group = 0;
  this.lifetime = 0.0;
  this.position = new b2Vec2();
  this.userData = 0;
  this.velocity = new b2Vec2();
}