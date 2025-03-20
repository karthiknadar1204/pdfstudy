"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/p-timeout";
exports.ids = ["vendor-chunks/p-timeout"];
exports.modules = {

/***/ "(action-browser)/./node_modules/p-timeout/index.js":
/*!*****************************************!*\
  !*** ./node_modules/p-timeout/index.js ***!
  \*****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

eval("\n\nconst pFinally = __webpack_require__(/*! p-finally */ \"(action-browser)/./node_modules/p-finally/index.js\");\n\nclass TimeoutError extends Error {\n\tconstructor(message) {\n\t\tsuper(message);\n\t\tthis.name = 'TimeoutError';\n\t}\n}\n\nconst pTimeout = (promise, milliseconds, fallback) => new Promise((resolve, reject) => {\n\tif (typeof milliseconds !== 'number' || milliseconds < 0) {\n\t\tthrow new TypeError('Expected `milliseconds` to be a positive number');\n\t}\n\n\tif (milliseconds === Infinity) {\n\t\tresolve(promise);\n\t\treturn;\n\t}\n\n\tconst timer = setTimeout(() => {\n\t\tif (typeof fallback === 'function') {\n\t\t\ttry {\n\t\t\t\tresolve(fallback());\n\t\t\t} catch (error) {\n\t\t\t\treject(error);\n\t\t\t}\n\n\t\t\treturn;\n\t\t}\n\n\t\tconst message = typeof fallback === 'string' ? fallback : `Promise timed out after ${milliseconds} milliseconds`;\n\t\tconst timeoutError = fallback instanceof Error ? fallback : new TimeoutError(message);\n\n\t\tif (typeof promise.cancel === 'function') {\n\t\t\tpromise.cancel();\n\t\t}\n\n\t\treject(timeoutError);\n\t}, milliseconds);\n\n\t// TODO: Use native `finally` keyword when targeting Node.js 10\n\tpFinally(\n\t\t// eslint-disable-next-line promise/prefer-await-to-then\n\t\tpromise.then(resolve, reject),\n\t\t() => {\n\t\t\tclearTimeout(timer);\n\t\t}\n\t);\n});\n\nmodule.exports = pTimeout;\n// TODO: Remove this for the next major release\nmodule.exports[\"default\"] = pTimeout;\n\nmodule.exports.TimeoutError = TimeoutError;\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKGFjdGlvbi1icm93c2VyKS8uL25vZGVfbW9kdWxlcy9wLXRpbWVvdXQvaW5kZXguanMiLCJtYXBwaW5ncyI6IkFBQWE7O0FBRWIsaUJBQWlCLG1CQUFPLENBQUMscUVBQVc7O0FBRXBDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBOztBQUVBO0FBQ0E7O0FBRUEsdUZBQXVGLGNBQWM7QUFDckc7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0EsRUFBRTs7QUFFRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7QUFFRDtBQUNBO0FBQ0EseUJBQXNCOztBQUV0QiwyQkFBMkIiLCJzb3VyY2VzIjpbIi9Vc2Vycy9rYXJ0aGlrbmFkYXIvRGVza3RvcC9wZGZzdC9ub2RlX21vZHVsZXMvcC10aW1lb3V0L2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcblxuY29uc3QgcEZpbmFsbHkgPSByZXF1aXJlKCdwLWZpbmFsbHknKTtcblxuY2xhc3MgVGltZW91dEVycm9yIGV4dGVuZHMgRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihtZXNzYWdlKSB7XG5cdFx0c3VwZXIobWVzc2FnZSk7XG5cdFx0dGhpcy5uYW1lID0gJ1RpbWVvdXRFcnJvcic7XG5cdH1cbn1cblxuY29uc3QgcFRpbWVvdXQgPSAocHJvbWlzZSwgbWlsbGlzZWNvbmRzLCBmYWxsYmFjaykgPT4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRpZiAodHlwZW9mIG1pbGxpc2Vjb25kcyAhPT0gJ251bWJlcicgfHwgbWlsbGlzZWNvbmRzIDwgMCkge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ0V4cGVjdGVkIGBtaWxsaXNlY29uZHNgIHRvIGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG5cdH1cblxuXHRpZiAobWlsbGlzZWNvbmRzID09PSBJbmZpbml0eSkge1xuXHRcdHJlc29sdmUocHJvbWlzZSk7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Y29uc3QgdGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRpZiAodHlwZW9mIGZhbGxiYWNrID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRyZXNvbHZlKGZhbGxiYWNrKCkpO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0cmVqZWN0KGVycm9yKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1lc3NhZ2UgPSB0eXBlb2YgZmFsbGJhY2sgPT09ICdzdHJpbmcnID8gZmFsbGJhY2sgOiBgUHJvbWlzZSB0aW1lZCBvdXQgYWZ0ZXIgJHttaWxsaXNlY29uZHN9IG1pbGxpc2Vjb25kc2A7XG5cdFx0Y29uc3QgdGltZW91dEVycm9yID0gZmFsbGJhY2sgaW5zdGFuY2VvZiBFcnJvciA/IGZhbGxiYWNrIDogbmV3IFRpbWVvdXRFcnJvcihtZXNzYWdlKTtcblxuXHRcdGlmICh0eXBlb2YgcHJvbWlzZS5jYW5jZWwgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdHByb21pc2UuY2FuY2VsKCk7XG5cdFx0fVxuXG5cdFx0cmVqZWN0KHRpbWVvdXRFcnJvcik7XG5cdH0sIG1pbGxpc2Vjb25kcyk7XG5cblx0Ly8gVE9ETzogVXNlIG5hdGl2ZSBgZmluYWxseWAga2V5d29yZCB3aGVuIHRhcmdldGluZyBOb2RlLmpzIDEwXG5cdHBGaW5hbGx5KFxuXHRcdC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBwcm9taXNlL3ByZWZlci1hd2FpdC10by10aGVuXG5cdFx0cHJvbWlzZS50aGVuKHJlc29sdmUsIHJlamVjdCksXG5cdFx0KCkgPT4ge1xuXHRcdFx0Y2xlYXJUaW1lb3V0KHRpbWVyKTtcblx0XHR9XG5cdCk7XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBwVGltZW91dDtcbi8vIFRPRE86IFJlbW92ZSB0aGlzIGZvciB0aGUgbmV4dCBtYWpvciByZWxlYXNlXG5tb2R1bGUuZXhwb3J0cy5kZWZhdWx0ID0gcFRpbWVvdXQ7XG5cbm1vZHVsZS5leHBvcnRzLlRpbWVvdXRFcnJvciA9IFRpbWVvdXRFcnJvcjtcbiJdLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOlswXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(action-browser)/./node_modules/p-timeout/index.js\n");

/***/ })

};
;