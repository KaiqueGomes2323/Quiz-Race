const session = lerSessaoJogador();
const contentEl = document.getElementById('content');

if(!session || session.roomCode !== (getParam('room') || session.roomCode)){
}
if(!session){
  window.location.href = 'index.html';
}

const { roomCode, playerId, playerName, teamId } = session;
document.getElementById('playerNameLabel').textContent = playerName;

let lastRenderedKey = null;
let tickInterval = null;

function timerPillHtml(phaseEndsAt){
  return `<div class="timer-pill">⏱ <span id="timerNum">--</span>s</div>`;
}

function iniciarCronometro(phaseEndsAt){
  clearInterval(tickInterval);
  const el = document.getElementById('timerNum');
  if(!el) return;
  const tick = () => {
    const numEl = document.getElementById('timerNum');
    if(!numEl){ clearInterval(tickInterval); return; }
    const restante = Math.max(0, Math.ceil((phaseEndsAt - Date.now()) / 1000));
    numEl.textContent = restante;
  };
  tick();
  tickInterval = setInterval(tick, 250);
}

db.ref(`rooms/${roomCode}`).on('value', snap => {
  const room = snap.val();
  if(!room){
    contentEl.innerHTML = '<div class="big">😕</div><p>Essa sala não existe mais.</p>';
    return;
  }

  const team = room.teams && room.teams[teamId];
  if(!team){
    contentEl.innerHTML = '<div class="big">😕</div><p>Seu time foi removido da sala.</p>';
    return;
  }

  document.getElementById('teamNameLabel').textContent = team.name;
  document.getElementById('teamDot').style.background = TEAM_COLORS_HEX[team.colorIndex % TEAM_COLORS_HEX.length];

  if(room.status === 'lobby'){
    renderLobby(team);
  } else if(room.status === 'racing'){
    renderRacing(room, team);
  } else if(room.status === 'finished'){
    renderFinished(room, team);
  }
});

function renderLobby(team){
  contentEl.innerHTML = `
    <div class="big">🚦</div>
    <p>Você está no time <strong style="color:var(--text-hi);">${escapeHtml(team.name)}</strong>.</p>
    <p>Aguardando o host começar a corrida...</p>
  `;
}

function renderRacing(room, team){
  const qid = room.questionOrder[room.currentIndex];
  const q = room.questions[qid];
  const total = room.questionOrder.length;

  const myAnswerPath = `answers/${qid}/${teamId}/${playerId}`;
  const myAnswer = getDeep(room, myAnswerPath);

  if(room.phase === 'question'){
    if(myAnswer !== undefined && myAnswer !== null){
      contentEl.innerHTML = `
        <div class="big">✅</div>
        ${timerPillHtml()}
        <p>Resposta enviada! Aguardando o resto do time e das outras equipes...</p>
      `;
      iniciarCronometro(room.phaseEndsAt);
      return;
    }

    contentEl.innerHTML = `
      <div style="width:100%;">
        <div class="row" style="justify-content:space-between; margin-bottom:6px;">
          <div class="q-number" style="margin-bottom:0;">PERGUNTA ${room.currentIndex+1} DE ${total}</div>
          ${timerPillHtml()}
        </div>
        <div class="q-text">${escapeHtml(q.text)}</div>
        <div id="optsBox"></div>
      </div>
    `;
    iniciarCronometro(room.phaseEndsAt);
    const optsBox = document.getElementById('optsBox');
    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'opt-btn';
      btn.textContent = opt;
      btn.addEventListener('click', async () => {
        optsBox.querySelectorAll('.opt-btn').forEach(b => b.disabled = true);
        btn.classList.add('selected');
        await db.ref(`rooms/${roomCode}/answers/${qid}/${teamId}/${playerId}`).set(i);
      });
      optsBox.appendChild(btn);
    });

  } else if(room.phase === 'reveal'){
    const reveal = room.lastReveal && room.lastReveal[teamId];
    if(!reveal){
      contentEl.innerHTML = `
        <div class="big">⏱️</div>
        ${timerPillHtml()}
        <p>Seu time não respondeu a tempo.</p>
      `;
      iniciarCronometro(room.phaseEndsAt);
      return;
    }
    contentEl.innerHTML = `
      <div class="big">${reveal.correct ? '🟢' : '🔴'}</div>
      ${timerPillHtml()}
      <p style="font-size:17px; font-weight:700; color:var(--text-hi);">${reveal.correct ? 'Seu time acertou e avançou!' : 'Seu time errou dessa vez.'}</p>
      <p>${reveal.acertos}/${reveal.total} do time marcaram a resposta certa.</p>
      <p>Posição atual: ${team.position}/${total}</p>
    `;
    iniciarCronometro(room.phaseEndsAt);
  }
}

function renderFinished(room, team){
  const teams = room.teams || {};
  const ranked = Object.values(teams).sort((a,b) => b.position - a.position);
  const winner = ranked[0];
  const souVencedor = winner.name === team.name && winner.position === team.position;

  contentEl.innerHTML = `
    <div class="big">${souVencedor ? '🏆' : '🏁'}</div>
    <p style="font-size:18px; font-weight:700; color:var(--text-hi);">
      ${souVencedor ? 'Seu time venceu a corrida!' : `${escapeHtml(winner.name)} venceu a corrida.`}
    </p>
    <p>Seu time terminou com ${team.position} pontos.</p>
  `;
}

function getDeep(obj, path){
  return path.split('/').reduce((o,k) => (o && o[k] !== undefined) ? o[k] : undefined, obj);
}