// Sandbox bridges injected into srcdoc iframes.
// Each returns a self-executing <script> string.
// Adapted from Open Design apps/web/src/runtime/srcdoc.ts

/**
 * Polyfill localStorage / sessionStorage with in-memory stores.
 * sandbox="allow-scripts" (without allow-same-origin) causes Web Storage
 * access to throw — this shim prevents crashes in artifacts that touch storage.
 */
export function injectSandboxShim(): string {
  return `<script>(function(){
function makeStore(){
  var data={};
  return {
    getItem:function(k){return Object.prototype.hasOwnProperty.call(data,k)?data[k]:null},
    setItem:function(k,v){data[k]=String(v)},
    removeItem:function(k){delete data[k]},
    clear:function(){data={}},
    key:function(i){return Object.keys(data)[i]||null},
    get length(){return Object.keys(data).length}
  }
}
function tryShim(name){
  var works=false;
  try{works=!!window[name]&&typeof window[name].getItem==='function';void window[name].length}
  catch(_){works=false}
  if(works)return;
  try{Object.defineProperty(window,name,{configurable:true,value:makeStore()})}
  catch(_){try{window[name]=makeStore()}catch(__){}}
}
tryShim('localStorage');
tryShim('sessionStorage');
document.addEventListener('click',function(e){
  if(!e.target||!(e.target instanceof Element))return;
  var link=e.target.closest('a[href]');
  if(!link)return;
  var href=link.getAttribute('href');
  if(href===null)return;
  if(href.startsWith('#')||href===''){
    e.preventDefault();
    if(href===''||href==='#'){
      window.scrollTo({top:0});
      history.replaceState(null,'',' ');
    }else{
      var target=document.getElementById(href.slice(1));
      if(target){target.scrollIntoView();location.hash===href&&history.replaceState(null,'',' ');location.hash=href}
    }
  }else if(link.getAttribute('target')==='_blank'){
    e.preventDefault();
    var safe=false;
    try{var url=new URL(href,location.href);safe=url.protocol==='http:'||url.protocol==='https:'||url.protocol==='mailto:'}catch(_){}
    safe&&window.open(href,'_blank','noopener,noreferrer')
  }
})
})()</script>`
}

/**
 * Defang window.focus() and HTMLElement.focus() so artifact content
 * cannot steal keyboard focus from the host page.
 * Only allows .focus() within 1 second of a trusted user interaction.
 */
export function injectPreviewFocusGuard(): string {
  return `<script>(function(){
var lastTrustedInputAt=0;
function userActivated(){return Date.now()-lastTrustedInputAt<1000}
function markTrustedInput(event){if(event&&event.isTrusted)lastTrustedInputAt=Date.now()}
document.addEventListener('pointerdown',function(e){markTrustedInput(e)},true);
document.addEventListener('keydown',function(e){markTrustedInput(e)},true);
try{
  var nativeWindowFocus=window.focus&&window.focus.bind(window);
  Object.defineProperty(window,'focus',{configurable:true,writable:true,value:function(){
    if(userActivated()&&nativeWindowFocus)return nativeWindowFocus()
  }})
}catch(_){}
try{
  var nativeElementFocus=HTMLElement.prototype.focus;
  Object.defineProperty(HTMLElement.prototype,'focus',{configurable:true,writable:true,value:function(options){
    if(userActivated())return nativeElementFocus.call(this,options)
  }})
}catch(_){}
})()</script>`
}

/**
 * Theme bridge: listens for theme change messages from the host page
 * and applies CSS variables matching journal's dark/light palette.
 */
export function injectThemeBridge(initialTheme: 'light' | 'dark'): string {
  const initialDark = initialTheme === 'dark'
  return `<script>(function(){
var isDark=${initialDark};
var styleEl=document.getElementById('__journal_theme');
if(!styleEl){
  styleEl=document.createElement('style');
  styleEl.id='__journal_theme';
  document.head.appendChild(styleEl)
}
function applyTheme(){
  if(isDark){
    styleEl.textContent=':root{color-scheme:dark;--bg:#0f0f0f;--text:#e8e8e8;--text-secondary:#a2a6ae;--text-tertiary:#727780;--accent:#c8933b;--border:#2a2a2e;--font-body:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;--font-mono:"IBM Plex Mono",ui-monospace,monospace;--color-background-primary:#1c1c1e;--color-background-success:#123326;--color-text-primary:var(--text);--color-text-secondary:var(--text-secondary);--color-text-tertiary:var(--text-tertiary);--color-text-success:#95d5b2;--color-border-tertiary:var(--border);--color-border-success:#2f7d5c;--border-radius-lg:8px;--border-radius-md:6px}body{background:var(--bg);color:var(--text);font-family:var(--font-body)}'
  }else{
    styleEl.textContent=':root{color-scheme:light;--bg:#f5f6f7;--text:#1c1c1e;--text-secondary:#6a7278;--text-tertiary:#a0a8ad;--accent:#b8782a;--border:#d8dce0;--font-body:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;--font-mono:"IBM Plex Mono",ui-monospace,monospace;--color-background-primary:#ffffff;--color-background-success:#edf7f0;--color-text-primary:var(--text);--color-text-secondary:var(--text-secondary);--color-text-tertiary:var(--text-tertiary);--color-text-success:#24734e;--color-border-tertiary:var(--border);--color-border-success:#b7dbc4;--border-radius-lg:8px;--border-radius-md:6px}body{background:var(--bg);color:var(--text);font-family:var(--font-body)}'
  }
}
applyTheme();
window.addEventListener('message',function(ev){
  var data=ev&&ev.data;
  if(!data||data.type!=='journal:theme')return;
  isDark=data.theme==='dark';
  applyTheme()
})
})()</script>`
}
