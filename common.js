// 18 cores espaçadas uniformemente em matiz (passo de 20°) para ficarem
// claramente diferentes entre si mesmo lado a lado — cobre exatamente o
// MAX_GRUPOS (18), então nenhuma equipe deveria repetir cor/nome no uso normal.
const TEAM_COLORS = ['var(--team-1)','var(--team-2)','var(--team-3)','var(--team-4)','var(--team-5)','var(--team-6)','var(--team-7)','var(--team-8)','var(--team-9)','var(--team-10)','var(--team-11)','var(--team-12)','var(--team-13)','var(--team-14)','var(--team-15)','var(--team-16)','var(--team-17)','var(--team-18)'];
const TEAM_COLORS_HEX = ['#ea3232','#ea7032','#e8a620','#eaea32','#adea32','#70ea32','#32ea32','#32ea70','#32eaad','#32eaea','#4eb8ed','#4e83ed','#4e4eed','#834eed','#ad32ea','#ea32ea','#ea32ad','#ea3270'];
const TEAM_NAMES = ['Equipe Vermelha','Equipe Laranja','Equipe Dourada','Equipe Amarela','Equipe Lima','Equipe Verde','Equipe Esmeralda','Equipe Menta','Equipe Turquesa','Equipe Ciano','Equipe Azul','Equipe Anil','Equipe Índigo','Equipe Violeta','Equipe Roxa','Equipe Magenta','Equipe Rosa','Equipe Coral'];
const CAR_EMOJI = ['🏎️','🚗','🚙','🚓','🚐','🚕','🚘','🚖','🛻','🚔','🏍️','🚛','🚚','🚜','🚲','🛵','🚂','🚁'];
// Animações por equipe (mesmo índice de TEAM_NAMES/TEAM_COLORS). null = usa o emoji.
// Índice 0 = Equipe Vermelha (mp4), índice 10 = Equipe Azul (gif).
// Aceita .mp4/.webm (vídeo) ou .gif/.webp/.png (imagem).
const CAR_ANIMATIONS = ['Animacoes/Ambulancia.mp4', null, null, null, null, null, null, null, null, null, 'Animacoes/Ambulancia.gif', null, null, null, null, null, null, null];

const MAX_JOGADORES_POR_GRUPO_PADRAO = 10;
// Temporariamente limitado a 90 (era 5000): no plano Spark do Firebase o
// Realtime Database tem um teto fixo de 100 conexões simultâneas, e host +
// telão já ocupam 2 — 90 deixa uma margem de segurança confortável sem
// depender de contar jogador por jogador.
const MAX_JOGADORES_POR_GRUPO_LIMITE = 90;
const MAX_GRUPOS = 18;
const MAX_JOGADORES_INDIVIDUAL = 40;

// No modo "Em grupos (padrão)" o total de jogadores é fixo em
// MAX_JOGADORES_POR_GRUPO_LIMITE (90), então o limite por grupo é sempre
// recalculado a partir da quantidade de grupos: 18 grupos -> 5 por grupo,
// 10 grupos -> 9 por grupo, 5 grupos -> 18 por grupo, e assim por diante.
function calcMaxPorGrupoPadrao(quantidadeGrupos){
  return Math.max(1, Math.floor(MAX_JOGADORES_POR_GRUPO_LIMITE / quantidadeGrupos));
}

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
      name: nomeGrupoDinamico(i),
      colorIndex: i % TEAM_COLORS_HEX.length,
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