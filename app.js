'use strict';
const STORAGE_KEY = 'wall-of-substack.v1';
const ARTICLE = 'https://imayeshab.substack.com/p/why-constant-communication-creates';
const ARTICLE_TITLE = 'Why Constant Communication Creates a False Sense of Intimacy';
const canvas = document.querySelector('#canvas');
const dialog = document.querySelector('#editor');
const form = document.querySelector('#clip-form');
const trash = document.querySelector('#trash');
const trashLabel = document.querySelector('#trash-label');
const dragStatus = document.querySelector('#drag-status');
const searchToggle = document.querySelector('#search-toggle');
const searchPanel = document.querySelector('#search-panel');
const searchInput = document.querySelector('#search');
const searchResults = document.querySelector('#search-results');
const searchEnabled = !searchToggle.hidden;
let cancelActiveDrag = null;
let currentMatch = -1;
const colors = ['cream', 'pink', 'sage', 'blue'];
const initial = [
  {id:'first-connection', quote:'Texting gives you closeness, but being with someone gives you connection. One fills the silence; the other fills the space between you.',url:ARTICLE,title:ARTICLE_TITLE,author:'Imayeshab',color:'cream',x:76,y:56,rotation:-4,z:1},
  {id:'first-intention',quote:'Don’t confuse attention for intention.',url:ARTICLE,title:ARTICLE_TITLE,author:'Imayeshab',color:'pink',x:520,y:108,rotation:4,z:2}
];
let clippings = structuredClone(initial);
let editing = null;
let topZ = 2;
let toastTimer;
let storageAvailable = true;

function safeUrl(value) {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch { return null; }
}
function validClipping(c) {
  return c && typeof c.id === 'string' && c.id.length <= 150 && typeof c.quote === 'string' && c.quote.trim() && c.quote.length <= 3000 && typeof c.title === 'string' && c.title.trim() && c.title.length <= 250 && typeof c.author === 'string' && c.author.length <= 100 && typeof c.url === 'string' && safeUrl(c.url) && colors.includes(c.color) && ['x','y','rotation','z'].every(k => Number.isFinite(c[k])) && c.x >= 0 && c.y >= 0 && Math.abs(c.rotation) <= 10;
}
function notify(message, action) {
  clearTimeout(toastTimer);
  const toast = document.querySelector('#toast');
  toast.replaceChildren(document.createTextNode(message));
  if (action) {
    const button = document.createElement('button');
    button.textContent = 'Undo';
    button.style.cssText = 'margin-left:15px;border:0;background:none;color:inherit;text-decoration:underline';
    button.onclick = () => { action(); toast.classList.remove('visible'); };
    toast.append(button);
  }
  toast.classList.add('visible');
  toastTimer = setTimeout(() => toast.classList.remove('visible'), action ? 10000 : 4200);
}
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clippings));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
    notify('Browser storage is unavailable. Changes will only last for this session.');
  }
}
try {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null) {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length > 500 || !parsed.every(validClipping) || new Set(parsed.map(c => c.id)).size !== parsed.length) throw Error('Invalid collection');
    clippings = parsed;
  }
} catch {
  storageAvailable = false;
  notify('Could not load your saved wall.');
}

function showEditor(clip = null) {
  editing = clip?.id || null;
  form.reset();
  document.querySelector('#url').setCustomValidity('');
  if (clip) {
    for (const key of ['quote','url','title','author']) document.querySelector('#' + key).value = clip[key];
    form.elements.color.value = clip.color;
  }
  document.querySelector('#editor-title').textContent = clip ? 'Edit clipping' : 'Pin a clipping';
  document.querySelector('.submit').textContent = clip ? 'Save clipping' : '＋ Pin to my wall';
  dialog.showModal();
}
document.querySelector('#add').onclick = () => showEditor();
document.querySelector('#close').onclick = () => dialog.close();
dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
document.querySelector('#url').addEventListener('input', e => e.target.setCustomValidity(''));
form.addEventListener('submit', e => {
  e.preventDefault();
  const quote = document.querySelector('#quote').value.trim();
  const title = document.querySelector('#title').value.trim();
  const url = safeUrl(document.querySelector('#url').value.trim());
  if (!url) { const field = document.querySelector('#url'); field.setCustomValidity('Use an http:// or https:// article link.'); field.reportValidity(); return; }
  if (!quote || !title) { notify('Add a quote and an article title first.'); return; }
  const values = {quote, title, url, author:document.querySelector('#author').value.trim(), color:form.elements.color.value};
  if (editing) Object.assign(clippings.find(c => c.id === editing), values);
  else {
    if (clippings.length >= 500) { notify('This wall has reached its 500-clipping limit.'); return; }
    const clipping = {
      id: globalThis.crypto?.randomUUID?.() || `clip-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ...values, rotation: Math.random() * 7 - 3.5, z: ++topZ
    };
    Object.assign(clipping, findOpenSpot(clipping));
    clippings.push(clipping);
  }
  save(); render(); dialog.close();
  const last = document.getElementById(clippings.find(c => c.id === editing)?.id || clippings.at(-1)?.id);
  last?.scrollIntoView({behavior:'smooth',block:'nearest'});
});

function makeText(tag, className, value) {
  const node = document.createElement(tag); node.className = className; node.textContent = value; return node;
}
function bringForward(clip, node) {
  clip.z = ++topZ; node.style.zIndex = clip.z;
}
function openArticle(clip) { window.open(clip.url, '_blank', 'noopener,noreferrer'); }
function searchClippings() {
  if (!searchEnabled) return [];
  const query = searchInput.value.trim().toLowerCase();
  const matches = [];
  for (const clip of clippings) {
    const node = document.getElementById(clip.id);
    if (!node) continue;
    const matched = Boolean(query && `${clip.quote} ${clip.title} ${clip.author}`.toLowerCase().includes(query));
    node.classList.toggle('search-match', matched);
    node.classList.toggle('search-muted', Boolean(query && !matched));
    node.classList.remove('search-current');
    if (matched) matches.push(node);
  }
  const selected = matches[currentMatch];
  selected?.classList.add('search-current');
  searchResults.textContent = !query ? '' : !matches.length ? 'No matches' :
    selected ? `${currentMatch + 1} of ${matches.length}` : `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}`;
  return matches;
}
function toggleSearch(open) {
  searchPanel.hidden = !open;
  searchToggle.setAttribute('aria-expanded', String(open));
  if (open) { searchInput.focus(); return; }
  searchInput.value = '';
  currentMatch = -1;
  searchClippings();
  searchToggle.focus();
}
if (searchEnabled) {
  searchToggle.onclick = () => toggleSearch(searchPanel.hidden);
  document.querySelector('#search-close').onclick = () => toggleSearch(false);
  searchInput.addEventListener('input', () => { currentMatch = -1; searchClippings(); });
  searchPanel.addEventListener('submit', event => {
    event.preventDefault();
    const matches = searchClippings();
    if (!matches.length) return;
    currentMatch = (currentMatch + 1) % matches.length;
    searchClippings();
    matches[currentMatch].scrollIntoView({block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
  });
}

function updateTrash(x, y, node) {
  trash.classList.add('visible');
  trash.setAttribute('aria-hidden', 'false');
  const rect = trash.getBoundingClientRect();
  const horizontalDistance = rect.left + rect.width / 2 - x;
  const distance = Math.hypot(horizontalDistance, y - (rect.top + rect.height / 2));
  const ready = distance <= 62;
  trash.classList.toggle('near', distance <= 145);
  trash.classList.toggle('ready', ready);
  node.classList.toggle('drop-ready', ready);
  const tilt = distance <= 145 ? Math.min(8, Math.max(-8, horizontalDistance / 10)) : -1;
  node.style.setProperty('--drag-tilt', `${tilt}deg`);
  const label = ready ? 'Release to delete' : 'Drop to delete';
  if (trashLabel.textContent !== label) trashLabel.textContent = label;
  const announcement = ready ? 'Release to delete this clipping.' : 'Drag to the dustbin to delete. Release elsewhere to keep.';
  if (dragStatus.textContent !== announcement) dragStatus.textContent = announcement;
  return ready;
}
function hideTrash(node) {
  trash.classList.remove('visible', 'near', 'ready');
  trash.setAttribute('aria-hidden', 'true');
  node.classList.remove('drop-ready');
  dragStatus.textContent = '';
  cancelActiveDrag = null;
}
function removeClipping(clip, discardedNode = null) {
  const originalIndex = clippings.indexOf(clip);
  if (originalIndex < 0) return;
  clippings.splice(originalIndex, 1);
  save();
  if (discardedNode) {
    const rect = discardedNode.getBoundingClientRect();
    const target = trash.getBoundingClientRect();
    const dx = target.left + target.width / 2 - rect.left - rect.width / 2;
    const dy = target.top + target.height / 2 - rect.top - rect.height / 2;
    discardedNode.classList.add('discarding');
    const animation = discardedNode.animate([
      {transform:getComputedStyle(discardedNode).transform, opacity:1},
      {transform:`translate(${dx}px, ${dy}px) rotate(14deg) scale(.08)`, opacity:0}
    ], {duration:matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 260, easing:'cubic-bezier(.4,0,.7,1)', fill:'forwards'});
    const finish = () => { discardedNode.remove(); layout(); };
    animation.finished.then(finish, finish);
    searchClippings();
  } else render();
  notify('Clipping deleted.', () => {
    clippings.splice(Math.min(originalIndex, clippings.length), 0, clip);
    save(); render();
  });
}
window.addEventListener('keydown', e => {
  if (dialog.open) return;
  if (e.key === 'Escape' && cancelActiveDrag) { e.preventDefault(); cancelActiveDrag(); return; }
  if (!searchEnabled) return;
  if (e.key === 'Escape' && !searchPanel.hidden) { e.preventDefault(); toggleSearch(false); }
  if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.target.closest('input, textarea, [contenteditable]')) {
    e.preventDefault(); toggleSearch(true);
  }
});
window.addEventListener('blur', () => cancelActiveDrag?.());
function createClipping(clip) {
  const node = document.createElement('article');
  node.className = 'clipping'; node.id = clip.id; node.dataset.color = clip.color;
  node.classList.toggle('short-quote', clip.quote.length <= 70);
  node.style.setProperty('--rotation', clip.rotation + 'deg'); node.style.zIndex = clip.z;
  node.tabIndex = 0;
  node.setAttribute('aria-label', clip.quote + '. Click to read ' + clip.title + '. Use arrow keys to move.');
  node.setAttribute('aria-keyshortcuts','ArrowUp ArrowDown ArrowLeft ArrowRight Enter');
  const paperclip = makeText('span','paperclip',''); paperclip.setAttribute('aria-hidden','true'); node.append(paperclip);
  const head = makeText('div','clip-top','');
  const controls = makeText('div','clip-tools','');
  const download = makeText('button', '', '↓');
  download.title = 'Download quote image';
  download.setAttribute('aria-label', download.title);
  download.onclick = async () => {
    download.disabled = true;
    try { await downloadQuoteImage(clip); notify('Quote image downloaded.'); }
    catch { notify('Could not download the image. Please try again.'); }
    finally { download.disabled = false; }
  };
  const edit = makeText('button','','✎'); edit.title = 'Edit clipping'; edit.setAttribute('aria-label','Edit clipping'); edit.onclick = () => showEditor(clip);
  const remove = makeText('button','','×'); remove.title = 'Remove clipping'; remove.setAttribute('aria-label','Remove clipping');
  remove.onclick = () => removeClipping(clip);
  controls.append(download,edit,remove);head.append(controls);node.append(head);
  const quote = makeText('blockquote','','');
  // A subtle highlighter stroke on the opening clipping; all text stays literal.
  const phrase = 'being with someone gives you connection.';
  if (clip.quote.includes(phrase)) {
    const at = clip.quote.indexOf(phrase);
    quote.append(document.createTextNode(clip.quote.slice(0,at)),makeText('mark','',phrase),document.createTextNode(clip.quote.slice(at + phrase.length)));
  } else quote.textContent = clip.quote;
  node.append(quote);
  const source = document.createElement('a');source.className='source';source.href=clip.url;source.target='_blank';source.rel='noopener noreferrer';
  source.setAttribute('aria-label','Read article: ' + clip.title);
  source.title = clip.title;
  const info = makeText('span','source-info','');
  info.append(makeText('span','source-title',clip.title));
  if (clip.author) info.append(makeText('span','source-author',clip.author));
  source.append(info);node.append(source);
  let drag = null; let suppressClick = false;
  node.addEventListener('pointerdown', e => {
    if (!e.isPrimary || e.button !== 0 || drag || cancelActiveDrag || node.classList.contains('discarding') || e.target.closest('button')) return;
    suppressClick = false;
    drag = {id:e.pointerId,startX:e.clientX,startY:e.clientY,x:parseFloat(node.style.left),y:parseFloat(node.style.top),moved:false};
    bringForward(clip,node);
  });
  node.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;
    if (!drag.moved && Math.hypot(dx,dy) < 6) return;
    if (!drag.moved) {
      node.setPointerCapture(e.pointerId); node.classList.add('dragging'); drag.moved = true;
      cancelActiveDrag = () => endDrag({pointerId:drag.id, type:'pointercancel'});
    }
    node.style.left = Math.max(15,Math.min(canvas.clientWidth-node.offsetWidth-15,drag.x+dx))+'px';
    node.style.top = Math.max(boardTop(),drag.y+dy)+'px';
    growCanvas(node);
    updateTrash(e.clientX, e.clientY, node);
  });
  function endDrag(e) {
    if (!drag || drag.id !== e.pointerId) return;
    const moved = drag.moved;
    const shouldDelete = moved && e.type === 'pointerup' && updateTrash(e.clientX, e.clientY, node);
    suppressClick = moved;
    if (moved && !shouldDelete && e.type === 'pointerup') { clip.x=parseFloat(node.style.left); clip.y=parseFloat(node.style.top); save(); }
    if (moved && e.type !== 'pointerup') { node.style.left=drag.x+'px'; node.style.top=drag.y+'px'; }
    if (!shouldDelete) node.classList.remove('dragging');
    drag=null;
    hideTrash(node);
    if (node.hasPointerCapture(e.pointerId)) node.releasePointerCapture(e.pointerId);
    if (shouldDelete) {
      removeClipping(clip, node);
      node.classList.remove('dragging');
    } else if (moved && e.type !== 'pointerup') layout();
  }
  node.addEventListener('pointerup',endDrag);
  node.addEventListener('pointercancel',endDrag);
  node.addEventListener('lostpointercapture', e => { if (drag) endDrag({pointerId:e.pointerId, type:'pointercancel'}); });
  node.addEventListener('dragstart',e=>e.preventDefault());
  node.addEventListener('click',e => {
    if (node.classList.contains('discarding')) { e.preventDefault(); return; }
    if (suppressClick) {e.preventDefault();suppressClick=false;return;}
    if (e.target.closest('button,a')) return;
    openArticle(clip);
  });
  node.addEventListener('keydown',e=>{
    if(e.target!==node || node.classList.contains('discarding'))return;
    if(e.key==='Enter'||e.key===' '){e.preventDefault();openArticle(clip);return;}
    const move={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
    if(!move)return;
    e.preventDefault();const step=e.shiftKey?40:10;
    clip.x=Math.max(15,Math.min(canvas.clientWidth-node.offsetWidth-15,parseFloat(node.style.left)+move[0]*step));
    clip.y=Math.max(boardTop(),parseFloat(node.style.top)+move[1]*step);
    node.style.left=clip.x+'px';node.style.top=clip.y+'px';bringForward(clip,node);growCanvas(node);save();
  });
  return node;
}
function boardTop() { return parseFloat(getComputedStyle(canvas).getPropertyValue('--board-top')); }
function findOpenSpot(clip) {
  const existing = [...canvas.querySelectorAll('.clipping:not(.discarding)')];
  const canvasRect = canvas.getBoundingClientRect();
  const avoid = existing.map(node => {
    const rect = node.getBoundingClientRect();
    return {left: rect.left - canvasRect.left, right: rect.right - canvasRect.left,
      top: rect.top - canvasRect.top, bottom: rect.bottom - canvasRect.top};
  }).sort((a, b) => a.top - b.top);
  const sample = createClipping(clip);
  sample.style.visibility = 'hidden';
  canvas.append(sample);
  const width = sample.offsetWidth;
  const height = sample.offsetHeight;
  sample.remove();
  const gap = 35;
  const maxX = Math.max(22, canvas.clientWidth - width - 22);
  if (canvas.clientWidth < 600) {
    const bottom = Math.max(boardTop() - gap, ...avoid.map(rect => rect.bottom));
    return {x: Math.max(22, (canvas.clientWidth - width) / 2), y: Math.ceil(bottom + gap)};
  }
  const columns = [30, maxX, ...avoid.map(rect => Math.ceil(rect.right + gap)).filter(x => x <= maxX)];
  for (let x = 30 + width + gap; x < maxX; x += width + gap) columns.push(x);
  let best = {x: 30, y: Infinity};
  for (const x of new Set(columns)) {
    let y = boardTop();
    for (const rect of avoid) {
      if (x + width + gap <= rect.left || x >= rect.right + gap || y >= rect.bottom + gap) continue;
      if (y + height + gap <= rect.top) break;
      y = Math.ceil(rect.bottom + gap);
    }
    if (y < best.y || (y === best.y && x < best.x)) best = {x, y};
  }
  return best;
}
function growCanvas(node) {
  const needed=parseFloat(node.style.top)+node.offsetHeight+60;
  if(needed>canvas.clientHeight)canvas.style.height=needed+'px';
}
function layout() {
  if (cancelActiveDrag) return;
  canvas.style.height='';
  const mobile=canvas.clientWidth<600;
  const top = boardTop();
  let nextY=top;
  clippings.forEach(clip=>{
    const node = document.getElementById(clip.id);
    if (!node) return;
    node.style.left=Math.max(20,Math.min(canvas.clientWidth-node.offsetWidth-20,clip.x))+'px';
    // Reflow overlapping desktop columns into a readable single column on phones.
    node.style.top=(mobile?Math.max(nextY,clip.y):Math.max(top,clip.y))+'px';
    nextY=parseFloat(node.style.top)+node.offsetHeight+35;
    growCanvas(node);
  });
}
function render() {
  cancelActiveDrag?.();
  canvas.querySelectorAll('.clipping').forEach(n=>n.remove());
  topZ=Math.max(2,...clippings.map(c=>c.z));
  clippings.forEach(clip=>canvas.append(createClipping(clip)));
  layout();
  searchClippings();
}
let resizeTimer;
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(layout,120);});
document.fonts?.ready.then(layout);
render();
if (storageAvailable) save();
