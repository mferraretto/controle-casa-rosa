evento. waitUntil (
   caches. aberto ( CACHE_NAME ). então ( cache => cache. addAll ( STATIC_ASSETS ))
  );
});

self.addEventListener ( "ativar" , evento = > {
  evento. waitUntil (
    caches. chaves (). então ( chaves =>
      Promessa . all (chaves. filtro ( k => k !== NOME_DO_CACHE ). mapa ( k => caches. excluir (k)))
    )
  );
});

self.addEventListener ( "buscar" , evento = >
 {
  se (evento. solicitação . método !== "GET" ) retornar ;

  const requestURL = nova URL (evento. solicitação . url );
 

  se ( requestURL.origem === localização.origem ) {
    // Estratégia de cache-first para recursos estáticos
    evento. respondWith (
      caches. correspondência (evento. solicitação ). então ( cached => {
        se (em cache) retornar em cache;
        retornar buscar (evento. solicitação ). então ( resposta => {
 
          const respClone = resposta. clone ();
          se (evento. solicitação . url . começaCom ( 'http' )) {
            caches. aberto ( NOME_DO_CACHE ). então ( cache => cache. put (evento. solicitação , respClone));
          }
          retornar resposta;
        });
      })
    );
  } outro {
    // Rede de fallback para solicitações dinâmicas/de origem cruzada
    evento. respondWith (
      buscar (evento. solicitação )
        . então ( resposta => {
          const respClone = resposta. clone ();
          se (evento. solicitação . url . começaCom ( 'http' )) {
            caches. aberto ( NOME_DO_CACHE ). então ( cache => cache. put (evento. solicitação , respClone));
          }
          retornar resposta;
        })
        . catch ( () => caches. match (evento. solicitação ))
    );
  }
});
