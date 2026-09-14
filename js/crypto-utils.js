const AES_SALT = 'quiz-corrida-salt-v1';

let _aesKeyPromise = null;

function _getAesKey(){
  if(_aesKeyPromise) return _aesKeyPromise;

  if(typeof AES_SECRET_PASSPHRASE !== 'string' || !AES_SECRET_PASSPHRASE){
    throw new Error('AES_SECRET_PASSPHRASE não definida — confira js/firebase-config.js');
  }

  _aesKeyPromise = (async () => {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(AES_SECRET_PASSPHRASE),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: enc.encode(AES_SALT),
        iterations: 100000,
        hash: 'SHA-256'
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  })();

  return _aesKeyPromise;
}

function _bufParaBase64(buf){
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function _base64ParaBuf(b64){
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

async function aesEncrypt(valor){
  const key = await _getAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); 
  const enc = new TextEncoder();
  const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(String(valor)));
  return `${_bufParaBase64(iv)}.${_bufParaBase64(cifrado)}`;
}

async function aesDecrypt(valorCifrado){
  if(valorCifrado === undefined || valorCifrado === null || valorCifrado === '') return null;

  const partes = String(valorCifrado).split('.');
  if(partes.length !== 2) return null;
  const [ivB64, dadosB64] = partes;

  try{
    const key = await _getAesKey();
    const iv = _base64ParaBuf(ivB64);
    const dados = _base64ParaBuf(dadosB64);
    const decifrado = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, dados);
    return new TextDecoder().decode(decifrado);
  }catch(e){
    console.error('Falha ao decifrar (chave errada ou dado corrompido):', e);
    return null;
  }
}

async function aesDecryptInt(valorCifrado){
  const texto = await aesDecrypt(valorCifrado);
  return texto === null ? null : parseInt(texto, 10);
}
