(this["webpackJsonpdemo-frontend"]=this["webpackJsonpdemo-frontend"]||[]).push([[0],{63:function(e,t,a){e.exports=a(92)},68:function(e,t,a){},92:function(e,t,a){"use strict";a.r(t);var n=a(0),r=a.n(n),c=a(8),o=a.n(c),l=(a(68),a(21)),i=a.n(l),s=a(30),u=a(24),m=a(31),f=a.n(m),d=a(118),E=a(123),p=a(124),b=a(126),h=a(121),g=a(125),v=a(127),w=Object(d.a)((function(e){return{root:{display:"flex",flexWrap:"wrap",justifyContent:"space-around",overflow:"hidden"},cardRoot:{maxWidth:275},gridList:{flexWrap:"nowrap",transform:"translateZ(0)"}}}));var k=function(){var e=w(),t=Object(n.useState)({outcome:[]}),a=Object(u.a)(t,2),c=a[0],o=a[1];return Object(n.useEffect)((function(){(function(){var e=Object(s.a)(i.a.mark((function e(){var t;return i.a.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return e.next=2,f()("{backend-ingress ADDRESS}/services/all");case 2:t=e.sent,o(t.data);case 4:case"end":return e.stop()}}),e)})));return function(){return e.apply(this,arguments)}})()()}),[]),r.a.createElement("div",{className:e.root},r.a.createElement(h.a,{cellHeight:300,className:e.gridList,cols:2},c.outcome.map((function(t){return r.a.createElement("div",null,r.a.createElement(E.a,{className:e.cardRoot},r.a.createElement(p.a,null,r.a.createElement(g.a,{color:"textSecondary",gutterBottom:!0},t.name),r.a.createElement(g.a,{variant:"body2",component:"p"},r.a.createElement("img",{style:{display:"block",margin:"0px auto"},src:t.url,height:"120",alt:t.name}),r.a.createElement("br",null),t.value)),r.a.createElement(b.a,null,r.a.createElement("a",{href:t.link},r.a.createElement(v.a,{size:"small"}," See More ")))))}))))},y=a(128),j=a(129),x=a(130),O=a(53),S=a.n(O),B=a(131),N=Object(d.a)((function(e){return{root:{flexGrow:1},searchRoot:{"& > *":{margin:e.spacing(1),width:"25ch"}},bullet:{display:"inline-block",margin:"0 2px",transform:"scale(0.8)"},menuButton:{marginRight:e.spacing(2)},title:{flexGrow:1}}}));var R=function(e){var t=N(),a=Object(n.useState)({outcome:[]}),c=Object(u.a)(a,2),o=c[0],l=c[1],m=Object(n.useState)("aws"),d=Object(u.a)(m,2),E=d[0],p=d[1],b=Object(n.useState)("aws"),h=Object(u.a)(b,2),w=h[0],O=h[1],R="{backend-ingress ADDRESS}/contents/".concat(w);return Object(n.useEffect)((function(){(function(){var e=Object(s.a)(i.a.mark((function e(){var t;return i.a.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return e.next=2,f()(R);case 2:t=e.sent,l(t.data);case 4:case"end":return e.stop()}}),e)})));return function(){return e.apply(this,arguments)}})()()}),[w]),r.a.createElement("div",{className:t.root},r.a.createElement(y.a,{position:"static",style:{background:"#2E3B55"}},r.a.createElement(j.a,null,r.a.createElement(x.a,{edge:"start",className:t.menuButton,color:"inherit","aria-label":"menu"},r.a.createElement(S.a,null)),r.a.createElement(g.a,{variant:"h6",align:"center",className:t.title},"EKS DEMO Blog"),(new Date).toLocaleTimeString())),r.a.createElement("br",null),r.a.createElement(k,{key:1}),r.a.createElement("br",null),r.a.createElement("form",{className:t.searchRoot,noValidate:!0,autoComplete:"off"},r.a.createElement(B.a,{id:"standard-basic",label:"Enter your keyword to search",type:"text",value:E,onChange:function(e){return p(e.target.value)}}),r.a.createElement(v.a,{onClick:function(){return O(E)}}," Click ")),r.a.createElement("ul",null,o.outcome.map((function(e){return r.a.createElement("li",{key:e.url},r.a.createElement("a",{href:e.url},e.title),r.a.createElement("br",null))}))))};Boolean("localhost"===window.location.hostname||"[::1]"===window.location.hostname||window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/));o.a.render(r.a.createElement(r.a.StrictMode,null,r.a.createElement(R,null)),document.getElementById("root")),"serviceWorker"in navigator&&navigator.serviceWorker.ready.then((function(e){e.unregister()})).catch((function(e){console.error(e.message)}))}},[[63,1,2]]]);
//# sourceMappingURL=main.7e9534f6.chunk.js.map