// Verifica se js/firebase-config.js realmente carregou.
// Se ele faltar (build da Netlify sem as variáveis de ambiente, por exemplo),
// as globais db / dbFirestore / auth não existem e cada script da página
// estouraria um "ReferenceError: db is not defined" diferente no console.
// Aqui a falha aparece uma vez só, na tela, com o motivo.

(function firebaseGuard(){
  const faltando = [];
  if(typeof firebase === 'undefined')      faltando.push('SDK do Firebase');
  if(typeof db === 'undefined')            faltando.push('db (Realtime Database)');
  if(typeof dbFirestore === 'undefined')   faltando.push('dbFirestore (Firestore)');
  if(typeof auth === 'undefined')          faltando.push('auth (Authentication)');

  window.__firebaseOk = faltando.length === 0;
  if(window.__firebaseOk) return;

  window.__firebaseFaltando = faltando;
  console.error('Firebase não inicializado. Faltando: ' + faltando.join(', ') +
    '. Confira se js/firebase-config.js foi gerado no build.');

  function mostrarAviso(){
    if(document.getElementById('firebaseGuardBanner')) return;
    const el = document.createElement('div');
    el.id = 'firebaseGuardBanner';
    el.setAttribute('role', 'alert');
    el.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:99999',
      'display:flex', 'align-items:center', 'justify-content:center',
      'padding:24px', 'background:rgba(8,8,16,0.94)',
      'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
      'color:#fff', 'text-align:center'
    ].join(';');
    el.innerHTML =
      '<div style="max-width:520px">' +
        '<div style="font-size:48px;line-height:1;margin-bottom:16px">&#9888;&#65039;</div>' +
        '<h2 style="margin:0 0 12px;font-size:20px">Configuração do Firebase não carregou</h2>' +
        '<p style="margin:0 0 12px;opacity:.85;font-size:15px;line-height:1.5">' +
          'O arquivo <code>js/firebase-config.js</code> não foi encontrado, então o jogo ' +
          'não consegue se conectar ao banco de dados.' +
        '</p>' +
        '<p style="margin:0;opacity:.6;font-size:13px;line-height:1.5">' +
          'Se você é o responsável pelo site: confira as variáveis de ambiente na Netlify ' +
          'e o log do último deploy.' +
        '</p>' +
      '</div>';
    document.body.appendChild(el);
  }

  if(document.body){
    mostrarAviso();
  }else{
    document.addEventListener('DOMContentLoaded', mostrarAviso);
  }
})();
