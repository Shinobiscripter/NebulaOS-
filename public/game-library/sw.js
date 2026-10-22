// Only controls /game-library/. The Anura OS service worker keeps its own scope.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith('/game-library/games/'))return;
 event.respondWith((async()=>{
  for(const name of await caches.keys())if(name.startsWith('nebula-game-')){const hit=await(await caches.open(name)).match(event.request);if(hit)return hit;}
  return fetch(event.request);
 })());
});
