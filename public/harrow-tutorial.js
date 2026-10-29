// Harrow tutorial interaction contract v1. Mirrored in the QA repository.
export function clampGuidePosition(position,panel,viewport,gutter=12){
 const left=viewport.left||0,top=viewport.top||0;
 return {x:Math.max(left+gutter,Math.min(position.x,left+Math.max(gutter,viewport.width-panel.width-gutter))),y:Math.max(top+gutter,Math.min(position.y,top+Math.max(gutter,viewport.height-panel.height-gutter)))};
}
export function attachGuideMovement(panel){
 const abort=new AbortController(),signal=abort.signal;let position=null,drag=null;
 const viewport=()=>({left:window.visualViewport?.offsetLeft||0,top:window.visualViewport?.offsetTop||0,width:window.visualViewport?.width||window.innerWidth,height:window.visualViewport?.height||window.innerHeight});
 const apply=next=>{position=clampGuidePosition(next,panel.getBoundingClientRect(),viewport());Object.assign(panel.style,{position:'fixed',left:position.x+'px',top:position.y+'px',right:'auto',bottom:'auto',margin:'0',transform:'none'});panel.classList.add('guide-is-moved')};
 const reset=()=>{drag=null;position=null;for(const key of ['position','left','top','right','bottom','margin','transform'])panel.style.removeProperty(key);panel.classList.remove('guide-is-moved','guide-is-dragging')};
 const constrain=()=>{if(position&&panel.isConnected)apply(position)};
 const stop=()=>{if(drag){try{drag.handle.releasePointerCapture(drag.id)}catch{}}drag=null;panel.classList.remove('guide-is-dragging')};
 panel.addEventListener('pointerdown',event=>{const handle=event.target.closest('[data-guide-drag]');if(!handle||event.button!==0)return;const rect=panel.getBoundingClientRect();drag={handle,id:event.pointerId,x:event.clientX,y:event.clientY,left:rect.left,top:rect.top};handle.focus({preventScroll:true});handle.setPointerCapture(event.pointerId);panel.classList.add('guide-is-dragging');event.preventDefault()},{signal});
 panel.addEventListener('pointermove',event=>{if(drag&&event.pointerId===drag.id){event.preventDefault();apply({x:drag.left+event.clientX-drag.x,y:drag.top+event.clientY-drag.y})}},{signal});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])panel.addEventListener(event,stop,{signal});
 panel.addEventListener('keydown',event=>{if(!event.target.closest('[data-guide-drag]'))return;const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(event.key==='Home'){event.preventDefault();reset();return}const delta=moves[event.key];if(!delta)return;event.preventDefault();const rect=panel.getBoundingClientRect(),distance=event.shiftKey?40:10;apply({x:rect.left+delta[0]*distance,y:rect.top+delta[1]*distance})},{signal});
 panel.addEventListener('click',event=>{if(event.target.closest('[data-guide-reset]'))reset()},{signal});
 window.addEventListener('resize',constrain,{signal});window.visualViewport?.addEventListener('resize',constrain,{signal});window.visualViewport?.addEventListener('scroll',constrain,{signal});
 const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(constrain);observer?.observe(panel);
 return {reset,constrain,destroy(){stop();abort.abort();observer?.disconnect();reset()}};
}
