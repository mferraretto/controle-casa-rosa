const CACHE_NAME = 'casa-rosa-cache-v3' ;
 
const ATIVOS_ESTÁTICOS = [
 
  './' ,
  './index.html' ,
  './manifest.json' ,
  './icon-192.png' ,
  './icon-512.png'
];

self.addEventListener ( 'instalar' , evento = >
 {
  evento. waitUntil (
    caches. aberto ( CACHE_NAME ). então ( cache => cache. addAll ( STATIC_ASSETS ))
  );
});

self.addEventListener ( 'ativar '
 , evento = > {
  evento .waitUntil​(
    caches. chaves (). então ( chave s =>
      Prom ise . all (chaves. filtro ( k => k !== CACHE_NAME ). mapa ( k => caches. excluir(k)))
    )
  );
});

self.addEventListener ( 'buscar' , evento = >
 {
  se ( requestURL.origem === localização.origem ) {
    evento. respondWith (
      caches. correspondência (evento. solicitação ). então ( cached => {
        se (em cache) retornar em cache;
        retornar buscar (evento. solicitação ). então ( resposta => {
 
          const respClone = resposta. clone ();
          se (evento. solicitação . url . começaCom ( 'http' )) {
            caches. aberto ( NOME_DO_CACHE ). então ( cache => cache. put (evento. solicitação , respClone));
          }
          retornar resposta ;
        });
      })
    );
  } outro {
    evento. respondWith (
      buscar (evento. solicitação )
        . então ( resposta => {
          const respClone = resposta. clone ();
          se (evento. solicitação . url . começaCom ( 'http' )) {
            caches. aberto ( NOME_DO_CACHE ). então ( cache => cache. put (evento. solicitação , respClone));
          }
          retornar resposta ;
​
        })
        . catch ( () => caches. match (evento. solicitação))
    );
  }
});
