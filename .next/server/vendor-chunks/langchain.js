"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/langchain";
exports.ids = ["vendor-chunks/langchain"];
exports.modules = {

/***/ "(action-browser)/./node_modules/langchain/dist/document_loaders/base.js":
/*!**************************************************************!*\
  !*** ./node_modules/langchain/dist/document_loaders/base.js ***!
  \**************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   BaseDocumentLoader: () => (/* reexport safe */ _langchain_core_document_loaders_base__WEBPACK_IMPORTED_MODULE_0__.BaseDocumentLoader)\n/* harmony export */ });\n/* harmony import */ var _langchain_core_document_loaders_base__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @langchain/core/document_loaders/base */ \"(action-browser)/./node_modules/@langchain/core/document_loaders/base.js\");\n\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKGFjdGlvbi1icm93c2VyKS8uL25vZGVfbW9kdWxlcy9sYW5nY2hhaW4vZGlzdC9kb2N1bWVudF9sb2FkZXJzL2Jhc2UuanMiLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBc0QiLCJzb3VyY2VzIjpbIi9Vc2Vycy9rYXJ0aGlrbmFkYXIvRGVza3RvcC9wZGZzdC9ub2RlX21vZHVsZXMvbGFuZ2NoYWluL2Rpc3QvZG9jdW1lbnRfbG9hZGVycy9iYXNlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCAqIGZyb20gXCJAbGFuZ2NoYWluL2NvcmUvZG9jdW1lbnRfbG9hZGVycy9iYXNlXCI7XG4iXSwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbMF0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(action-browser)/./node_modules/langchain/dist/document_loaders/base.js\n");

/***/ }),

/***/ "(action-browser)/./node_modules/langchain/dist/document_loaders/fs/buffer.js":
/*!*******************************************************************!*\
  !*** ./node_modules/langchain/dist/document_loaders/fs/buffer.js ***!
  \*******************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   BufferLoader: () => (/* binding */ BufferLoader)\n/* harmony export */ });\n/* harmony import */ var _langchain_core_utils_env__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @langchain/core/utils/env */ \"(action-browser)/./node_modules/@langchain/core/utils/env.js\");\n/* harmony import */ var _base_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../base.js */ \"(action-browser)/./node_modules/langchain/dist/document_loaders/base.js\");\n\n\n/**\n * Abstract class that extends the `BaseDocumentLoader` class. It\n * represents a document loader that loads documents from a buffer. The\n * `load()` method is implemented to read the buffer contents and metadata\n * based on the type of `filePathOrBlob`, and then calls the `parse()`\n * method to parse the buffer and return the documents.\n */\nclass BufferLoader extends _base_js__WEBPACK_IMPORTED_MODULE_1__.BaseDocumentLoader {\n    constructor(filePathOrBlob) {\n        super();\n        Object.defineProperty(this, \"filePathOrBlob\", {\n            enumerable: true,\n            configurable: true,\n            writable: true,\n            value: filePathOrBlob\n        });\n    }\n    /**\n     * Method that reads the buffer contents and metadata based on the type of\n     * `filePathOrBlob`, and then calls the `parse()` method to parse the\n     * buffer and return the documents.\n     * @returns Promise that resolves with an array of `Document` objects.\n     */\n    async load() {\n        let buffer;\n        let metadata;\n        if (typeof this.filePathOrBlob === \"string\") {\n            const { readFile } = await BufferLoader.imports();\n            buffer = await readFile(this.filePathOrBlob);\n            metadata = { source: this.filePathOrBlob };\n        }\n        else {\n            buffer = await this.filePathOrBlob\n                .arrayBuffer()\n                .then((ab) => Buffer.from(ab));\n            metadata = { source: \"blob\", blobType: this.filePathOrBlob.type };\n        }\n        return this.parse(buffer, metadata);\n    }\n    /**\n     * Static method that imports the `readFile` function from the\n     * `fs/promises` module in Node.js. It is used to dynamically import the\n     * function when needed. If the import fails, it throws an error\n     * indicating that the `fs/promises` module is not available in the\n     * current environment.\n     * @returns Promise that resolves with an object containing the `readFile` function.\n     */\n    static async imports() {\n        try {\n            const { readFile } = await Promise.resolve(/*! import() */).then(__webpack_require__.t.bind(__webpack_require__, /*! node:fs/promises */ \"node:fs/promises\", 19));\n            return { readFile };\n        }\n        catch (e) {\n            console.error(e);\n            throw new Error(`Failed to load fs/promises. TextLoader available only on environment 'node'. It appears you are running environment '${(0,_langchain_core_utils_env__WEBPACK_IMPORTED_MODULE_0__.getEnv)()}'. See https://<link to docs> for alternatives.`);\n        }\n    }\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKGFjdGlvbi1icm93c2VyKS8uL25vZGVfbW9kdWxlcy9sYW5nY2hhaW4vZGlzdC9kb2N1bWVudF9sb2FkZXJzL2ZzL2J1ZmZlci5qcyIsIm1hcHBpbmdzIjoiOzs7Ozs7QUFBbUQ7QUFDSDtBQUNoRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLDJCQUEyQix3REFBa0I7QUFDcEQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLG9CQUFvQixXQUFXO0FBQy9CO0FBQ0EseUJBQXlCO0FBQ3pCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSx5QkFBeUI7QUFDekI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxvQkFBb0IsV0FBVyxRQUFRLHNJQUEwQjtBQUNqRSxxQkFBcUI7QUFDckI7QUFDQTtBQUNBO0FBQ0Esb0pBQW9KLGlFQUFNLEdBQUc7QUFDN0o7QUFDQTtBQUNBIiwic291cmNlcyI6WyIvVXNlcnMva2FydGhpa25hZGFyL0Rlc2t0b3AvcGRmc3Qvbm9kZV9tb2R1bGVzL2xhbmdjaGFpbi9kaXN0L2RvY3VtZW50X2xvYWRlcnMvZnMvYnVmZmVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGdldEVudiB9IGZyb20gXCJAbGFuZ2NoYWluL2NvcmUvdXRpbHMvZW52XCI7XG5pbXBvcnQgeyBCYXNlRG9jdW1lbnRMb2FkZXIgfSBmcm9tIFwiLi4vYmFzZS5qc1wiO1xuLyoqXG4gKiBBYnN0cmFjdCBjbGFzcyB0aGF0IGV4dGVuZHMgdGhlIGBCYXNlRG9jdW1lbnRMb2FkZXJgIGNsYXNzLiBJdFxuICogcmVwcmVzZW50cyBhIGRvY3VtZW50IGxvYWRlciB0aGF0IGxvYWRzIGRvY3VtZW50cyBmcm9tIGEgYnVmZmVyLiBUaGVcbiAqIGBsb2FkKClgIG1ldGhvZCBpcyBpbXBsZW1lbnRlZCB0byByZWFkIHRoZSBidWZmZXIgY29udGVudHMgYW5kIG1ldGFkYXRhXG4gKiBiYXNlZCBvbiB0aGUgdHlwZSBvZiBgZmlsZVBhdGhPckJsb2JgLCBhbmQgdGhlbiBjYWxscyB0aGUgYHBhcnNlKClgXG4gKiBtZXRob2QgdG8gcGFyc2UgdGhlIGJ1ZmZlciBhbmQgcmV0dXJuIHRoZSBkb2N1bWVudHMuXG4gKi9cbmV4cG9ydCBjbGFzcyBCdWZmZXJMb2FkZXIgZXh0ZW5kcyBCYXNlRG9jdW1lbnRMb2FkZXIge1xuICAgIGNvbnN0cnVjdG9yKGZpbGVQYXRoT3JCbG9iKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcImZpbGVQYXRoT3JCbG9iXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiBmaWxlUGF0aE9yQmxvYlxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogTWV0aG9kIHRoYXQgcmVhZHMgdGhlIGJ1ZmZlciBjb250ZW50cyBhbmQgbWV0YWRhdGEgYmFzZWQgb24gdGhlIHR5cGUgb2ZcbiAgICAgKiBgZmlsZVBhdGhPckJsb2JgLCBhbmQgdGhlbiBjYWxscyB0aGUgYHBhcnNlKClgIG1ldGhvZCB0byBwYXJzZSB0aGVcbiAgICAgKiBidWZmZXIgYW5kIHJldHVybiB0aGUgZG9jdW1lbnRzLlxuICAgICAqIEByZXR1cm5zIFByb21pc2UgdGhhdCByZXNvbHZlcyB3aXRoIGFuIGFycmF5IG9mIGBEb2N1bWVudGAgb2JqZWN0cy5cbiAgICAgKi9cbiAgICBhc3luYyBsb2FkKCkge1xuICAgICAgICBsZXQgYnVmZmVyO1xuICAgICAgICBsZXQgbWV0YWRhdGE7XG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy5maWxlUGF0aE9yQmxvYiA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgY29uc3QgeyByZWFkRmlsZSB9ID0gYXdhaXQgQnVmZmVyTG9hZGVyLmltcG9ydHMoKTtcbiAgICAgICAgICAgIGJ1ZmZlciA9IGF3YWl0IHJlYWRGaWxlKHRoaXMuZmlsZVBhdGhPckJsb2IpO1xuICAgICAgICAgICAgbWV0YWRhdGEgPSB7IHNvdXJjZTogdGhpcy5maWxlUGF0aE9yQmxvYiB9O1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgYnVmZmVyID0gYXdhaXQgdGhpcy5maWxlUGF0aE9yQmxvYlxuICAgICAgICAgICAgICAgIC5hcnJheUJ1ZmZlcigpXG4gICAgICAgICAgICAgICAgLnRoZW4oKGFiKSA9PiBCdWZmZXIuZnJvbShhYikpO1xuICAgICAgICAgICAgbWV0YWRhdGEgPSB7IHNvdXJjZTogXCJibG9iXCIsIGJsb2JUeXBlOiB0aGlzLmZpbGVQYXRoT3JCbG9iLnR5cGUgfTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5wYXJzZShidWZmZXIsIG1ldGFkYXRhKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogU3RhdGljIG1ldGhvZCB0aGF0IGltcG9ydHMgdGhlIGByZWFkRmlsZWAgZnVuY3Rpb24gZnJvbSB0aGVcbiAgICAgKiBgZnMvcHJvbWlzZXNgIG1vZHVsZSBpbiBOb2RlLmpzLiBJdCBpcyB1c2VkIHRvIGR5bmFtaWNhbGx5IGltcG9ydCB0aGVcbiAgICAgKiBmdW5jdGlvbiB3aGVuIG5lZWRlZC4gSWYgdGhlIGltcG9ydCBmYWlscywgaXQgdGhyb3dzIGFuIGVycm9yXG4gICAgICogaW5kaWNhdGluZyB0aGF0IHRoZSBgZnMvcHJvbWlzZXNgIG1vZHVsZSBpcyBub3QgYXZhaWxhYmxlIGluIHRoZVxuICAgICAqIGN1cnJlbnQgZW52aXJvbm1lbnQuXG4gICAgICogQHJldHVybnMgUHJvbWlzZSB0aGF0IHJlc29sdmVzIHdpdGggYW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIGByZWFkRmlsZWAgZnVuY3Rpb24uXG4gICAgICovXG4gICAgc3RhdGljIGFzeW5jIGltcG9ydHMoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IHJlYWRGaWxlIH0gPSBhd2FpdCBpbXBvcnQoXCJub2RlOmZzL3Byb21pc2VzXCIpO1xuICAgICAgICAgICAgcmV0dXJuIHsgcmVhZEZpbGUgfTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihlKTtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGxvYWQgZnMvcHJvbWlzZXMuIFRleHRMb2FkZXIgYXZhaWxhYmxlIG9ubHkgb24gZW52aXJvbm1lbnQgJ25vZGUnLiBJdCBhcHBlYXJzIHlvdSBhcmUgcnVubmluZyBlbnZpcm9ubWVudCAnJHtnZXRFbnYoKX0nLiBTZWUgaHR0cHM6Ly88bGluayB0byBkb2NzPiBmb3IgYWx0ZXJuYXRpdmVzLmApO1xuICAgICAgICB9XG4gICAgfVxufVxuIl0sIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6WzBdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(action-browser)/./node_modules/langchain/dist/document_loaders/fs/buffer.js\n");

/***/ }),

/***/ "(action-browser)/./node_modules/langchain/dist/text_splitter.js":
/*!******************************************************!*\
  !*** ./node_modules/langchain/dist/text_splitter.js ***!
  \******************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   CharacterTextSplitter: () => (/* reexport safe */ _langchain_textsplitters__WEBPACK_IMPORTED_MODULE_0__.CharacterTextSplitter),\n/* harmony export */   LatexTextSplitter: () => (/* reexport safe */ _langchain_textsplitters__WEBPACK_IMPORTED_MODULE_0__.LatexTextSplitter),\n/* harmony export */   MarkdownTextSplitter: () => (/* reexport safe */ _langchain_textsplitters__WEBPACK_IMPORTED_MODULE_0__.MarkdownTextSplitter),\n/* harmony export */   RecursiveCharacterTextSplitter: () => (/* reexport safe */ _langchain_textsplitters__WEBPACK_IMPORTED_MODULE_0__.RecursiveCharacterTextSplitter),\n/* harmony export */   SupportedTextSplitterLanguages: () => (/* reexport safe */ _langchain_textsplitters__WEBPACK_IMPORTED_MODULE_0__.SupportedTextSplitterLanguages),\n/* harmony export */   TextSplitter: () => (/* reexport safe */ _langchain_textsplitters__WEBPACK_IMPORTED_MODULE_0__.TextSplitter),\n/* harmony export */   TokenTextSplitter: () => (/* reexport safe */ _langchain_textsplitters__WEBPACK_IMPORTED_MODULE_0__.TokenTextSplitter)\n/* harmony export */ });\n/* harmony import */ var _langchain_textsplitters__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @langchain/textsplitters */ \"(action-browser)/./node_modules/@langchain/textsplitters/index.js\");\n\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKGFjdGlvbi1icm93c2VyKS8uL25vZGVfbW9kdWxlcy9sYW5nY2hhaW4vZGlzdC90ZXh0X3NwbGl0dGVyLmpzIiwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBQXlDIiwic291cmNlcyI6WyIvVXNlcnMva2FydGhpa25hZGFyL0Rlc2t0b3AvcGRmc3Qvbm9kZV9tb2R1bGVzL2xhbmdjaGFpbi9kaXN0L3RleHRfc3BsaXR0ZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0ICogZnJvbSBcIkBsYW5nY2hhaW4vdGV4dHNwbGl0dGVyc1wiO1xuIl0sIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6WzBdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(action-browser)/./node_modules/langchain/dist/text_splitter.js\n");

/***/ }),

/***/ "(action-browser)/./node_modules/langchain/document_loaders/fs/buffer.js":
/*!**************************************************************!*\
  !*** ./node_modules/langchain/document_loaders/fs/buffer.js ***!
  \**************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   BufferLoader: () => (/* reexport safe */ _dist_document_loaders_fs_buffer_js__WEBPACK_IMPORTED_MODULE_0__.BufferLoader)
/* harmony export */ });
/* harmony import */ var _dist_document_loaders_fs_buffer_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../dist/document_loaders/fs/buffer.js */ "(action-browser)/./node_modules/langchain/dist/document_loaders/fs/buffer.js");


/***/ }),

/***/ "(action-browser)/./node_modules/langchain/text_splitter.js":
/*!*************************************************!*\
  !*** ./node_modules/langchain/text_splitter.js ***!
  \*************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CharacterTextSplitter: () => (/* reexport safe */ _dist_text_splitter_js__WEBPACK_IMPORTED_MODULE_0__.CharacterTextSplitter),
/* harmony export */   LatexTextSplitter: () => (/* reexport safe */ _dist_text_splitter_js__WEBPACK_IMPORTED_MODULE_0__.LatexTextSplitter),
/* harmony export */   MarkdownTextSplitter: () => (/* reexport safe */ _dist_text_splitter_js__WEBPACK_IMPORTED_MODULE_0__.MarkdownTextSplitter),
/* harmony export */   RecursiveCharacterTextSplitter: () => (/* reexport safe */ _dist_text_splitter_js__WEBPACK_IMPORTED_MODULE_0__.RecursiveCharacterTextSplitter),
/* harmony export */   SupportedTextSplitterLanguages: () => (/* reexport safe */ _dist_text_splitter_js__WEBPACK_IMPORTED_MODULE_0__.SupportedTextSplitterLanguages),
/* harmony export */   TextSplitter: () => (/* reexport safe */ _dist_text_splitter_js__WEBPACK_IMPORTED_MODULE_0__.TextSplitter),
/* harmony export */   TokenTextSplitter: () => (/* reexport safe */ _dist_text_splitter_js__WEBPACK_IMPORTED_MODULE_0__.TokenTextSplitter)
/* harmony export */ });
/* harmony import */ var _dist_text_splitter_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./dist/text_splitter.js */ "(action-browser)/./node_modules/langchain/dist/text_splitter.js");


/***/ })

};
;