const CACHE="toeic-terminator-v5";

const QUESTION_FILES = [
  "data/questions-001-050.json",
  "data/questions-051-100.json",
  "data/questions-101-150.json",
  "data/questions-151-200.json",
  "data/questions-201-250.json",
  "data/questions-251-300.json",
  "data/questions-301-325.json",
  "data/questions-326-350.json",
  "data/questions-351-400.json",
  "data/questions-401-450.json",
  "data/questions-451-475.json",
  "data/questions-476-500.json",
  "data/questions-501-550.json",
  "data/questions-551-600.json",
  "data/questions-601-650.json",
  "data/questions-651-700.json",
  "data/questions-701-750.json",
  "data/questions-751-800.json"
];

const PUBLISHED_LESSONS = [
  "data/analysis-001-050.json",
  "data/analysis-051-100.json",
  "data/analysis-101-150.json",
  "data/analysis-151-200.json",
  "data/analysis-201-250.json",
  "data/lesson-251-300.json",
  "data/lesson-301-350.json",
  "data/lesson-351-400.json",
  "data/lesson-401-450.json",
  "data/lesson-451-500.json",
  "data/lesson-501-550.json",
  "data/lesson-551-600.json",
  "data/lesson-601-650.json",
  "data/lesson-651-700.json",
  "data/lesson-701-750.json",
  "data/lesson-751-800.json"
];

const LOCAL_ANALYSIS_FALLBACKS = [
  "data/analysis-251-300.json",
  "data/analysis-301-350.json",
  "data/analysis-351-400.json",
  "data/analysis-401-450.json",
  "data/analysis-451-500.json",
  "data/analysis-501-550.json",
  "data/analysis-551-600.json",
  "data/analysis-601-650.json",
  "data/analysis-651-700.json",
  "data/analysis-701-750.json",
  "data/analysis-751-800.json"
];

const CORE=[
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  ...QUESTION_FILES,
  ...PUBLISHED_LESSONS,
  ...LOCAL_ANALYSIS_FALLBACKS
];

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>Promise.allSettled(CORE.map(url=>cache.add(url))))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET") return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached=>{
      if(cached) return cached;
      return fetch(event.request).then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
        return response;
      }).catch(()=>{
        if(event.request.mode==="navigate") return caches.match("./");
        return Response.error();
      });
    })
  );
});
