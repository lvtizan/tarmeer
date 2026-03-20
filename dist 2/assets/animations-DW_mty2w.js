import{r as c,g as R}from"./vendor-j2mp3VYR.js";function d(n,u){for(var o=0;o<u.length;o++){const t=u[o];if(typeof t!="string"&&!Array.isArray(t)){for(const r in t)if(r!=="default"&&!(r in n)){const e=Object.getOwnPropertyDescriptor(t,r);e&&Object.defineProperty(n,r,e.get?e:{enumerable:!0,get:()=>t[r]})}}}return Object.freeze(Object.defineProperty(n,Symbol.toStringTag,{value:"Module"}))}var f={exports:{}},s={};/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var l;function v(){if(l)return s;l=1;var n=Symbol.for("react.transitional.element"),u=Symbol.for("react.fragment");function o(t,r,e){var i=null;if(e!==void 0&&(i=""+e),r.key!==void 0&&(i=""+r.key),"key"in r){e={};for(var a in r)a!=="key"&&(e[a]=r[a])}else e=r;return r=e.ref,{$$typeof:n,type:t,key:i,ref:r!==void 0?r:null,props:e}}return s.Fragment=u,s.jsx=o,s.jsxs=o,s}var p;function _(){return p||(p=1,f.exports=v()),f.exports}var m=_(),x=c();const j=R(x),k=d({__proto__:null,default:j},[x]);export{k as R,m as j,x as r};
