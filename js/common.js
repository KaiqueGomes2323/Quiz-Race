const TEAM_COLORS = ['var(--team-1)','var(--team-2)','var(--team-3)','var(--team-4)','var(--team-5)','var(--team-6)','var(--team-7)','var(--team-8)','var(--team-9)','var(--team-10)','var(--team-11)','var(--team-12)'];
const TEAM_COLORS_HEX = ['#ff4d6a','#3ad4ff','#3dffb0','#ffe14d','#c26bff','#ff9a47','#ff6ec7','#6effc0','#ffde59','#7a8cff','#ff8a5c','#9dff5c'];
const TEAM_NAMES = ['Equipe Vermelha','Equipe Ciano','Equipe Verde','Equipe Amarela','Equipe Roxa','Equipe Laranja','Equipe Rosa','Equipe Menta','Equipe Dourada','Equipe Índigo','Equipe Coral','Equipe Lima'];
const CAR_EMOJI = ['🏎️','🚗','🚙','🚓','🚐','🚕','🚘','🚖','🛻','🚔','🏍️','🚛'];
const CAR_ANIMATIONS = ['Animacoes/Ambulancia.mp4', null, null, null, null, null, null, null, null, null, null, null];

const MAX_JOGADORES_POR_GRUPO_PADRAO = 10;
const MAX_JOGADORES_POR_GRUPO_LIMITE = 5000;
const MAX_GRUPOS = 12;
const MAX_JOGADORES_INDIVIDUAL = 40;

// Quanto tempo esperar depois que o host cai (aba fechada, internet caiu,
// notebook travou) antes de considerar a sala "abandonada" e limpável.
// Precisa ser folgado o bastante pra sobreviver a um F5 normal do host
// (que dispara um disconnect/reconnect rapidinho) sem apagar a sala à toa.
const SALA_INATIVA_TIMEOUT_MS = 45 * 1000;

// Não há Cloud Functions/cron nesse projeto (ficaria fora do plano Spark
// gratuito do Firebase), então a limpeza é feita "na unha": o host marca
// hostAtivo/hostSaiuEm via onDisconnect(), e qualquer cliente que topar
// com uma sala parada por tempo demais (um jogador tentando entrar, o
// telão, ou o próprio host) apaga ela. Uma sala só some de fato quando
// alguém a visita de novo depois do timeout — não existe varredura em
// segundo plano sem servidor.
function salaEstaInativa(room){
  if(!room) return false;
  if(room.hostAtivo !== false) return false; // undefined = sala antiga/sem tracking, ainda não mexe
  if(!room.hostSaiuEm) return false;
  return (Date.now() - room.hostSaiuEm) > SALA_INATIVA_TIMEOUT_MS;
}

// Remove uma sala já confirmada como abandonada. Chamada "best effort":
// se outro cliente já limpou ou o host voltou nesse meio-tempo, o pior
// caso é uma escrita a mais (ou uma tentativa de remover algo que já
// não existe), nunca um estado inconsistente.
function limparSalaInativa(roomCode){
  return db.ref(`rooms/${roomCode}`).remove().catch(() => {});
}

function gerarGrupos(quantidade){
  const teams = {};
  for(let i = 0; i < quantidade; i++){
    const tid = 't' + i;
    teams[tid] = {
      name: TEAM_NAMES[i % TEAM_NAMES.length],
      colorIndex: i,
      position: 0,
      players: {}
    };
  }
  return teams;
}

function nomeGrupoDinamico(indice){
  const volta = Math.floor(indice / TEAM_NAMES.length) + 1;
  const base = TEAM_NAMES[indice % TEAM_NAMES.length];
  return volta > 1 ? `${base} ${volta}` : base;
}

function criarGrupoDinamico(indice){
  return {
    name: nomeGrupoDinamico(indice),
    colorIndex: indice % TEAM_COLORS_HEX.length,
    position: 0,
    players: {}
  };
}

function gerarCodigoSala(){
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; 
  let code = '';
  for(let i=0;i<5;i++) code += chars[Math.floor(Math.random()*chars.length)];
  return code;
}

function corIndexDeterministico(id, tamanho){
  let hash = 0;
  for(let i = 0; i < id.length; i++){
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash % tamanho;
}

function gerarIdJogador(){
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for(let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return 'p_' + id;
}

function salvarSessaoJogador(roomCode, playerId, playerName, teamId){
  localStorage.setItem('quizCorrida_session', JSON.stringify({roomCode, playerId, playerName, teamId}));
}

function lerSessaoJogador(){
  try{
    return JSON.parse(localStorage.getItem('quizCorrida_session'));
  }catch(e){ return null; }
}

function limparSessaoJogador(){
  localStorage.removeItem('quizCorrida_session');
}

function getParam(name){
  return new URLSearchParams(window.location.search).get(name);
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function confirmModal(message, options = {}){
  const {
    title = 'Confirmar',
    confirmText = 'Continuar',
    cancelText = 'Cancelar',
    danger = false
  } = options;

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card glass" role="alertdialog" aria-modal="true" aria-labelledby="modalConfirmTitle" aria-describedby="modalConfirmMsg">
        <h3 id="modalConfirmTitle">${escapeHtml(title)}</h3>
        <p id="modalConfirmMsg">${escapeHtml(message)}</p>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-action="cancel">${escapeHtml(cancelText)}</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="confirm">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const confirmBtn = overlay.querySelector('[data-action="confirm"]');
    const cancelBtn = overlay.querySelector('[data-action="cancel"]');

    function close(result){
      overlay.classList.remove('is-open');
      document.removeEventListener('keydown', onKeyDown);
      setTimeout(() => overlay.remove(), 180);
      resolve(result);
    }

    function onKeyDown(e){
      if(e.key === 'Escape') close(false);
      if(e.key === 'Enter') close(true);
    }

    overlay.addEventListener('click', (e) => {
      if(e.target === overlay) close(false);
    });
    cancelBtn.addEventListener('click', () => close(false));
    confirmBtn.addEventListener('click', () => close(true));
    document.addEventListener('keydown', onKeyDown);

    requestAnimationFrame(() => {
      overlay.classList.add('is-open');
      confirmBtn.focus();
    });
  });
}