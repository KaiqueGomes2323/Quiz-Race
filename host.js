const REVEAL_SECONDS = 6;

let roomCode = null;
let roomRef = null;
let currentRoom = null;
let scheduledKey = null; 
let phaseTimeout = null;
let tickInterval = null;

const stepCreate = document.getElementById('stepCreate');
const stepConfig = document.getElementById('stepConfig');
const stepRace = document.getElementById('stepRace');
const stepFinish = document.getElementById('stepFinish');
const roomCodeBox = document.getElementById('roomCodeBox');
const roomCodeDisplay = document.getElementById('roomCodeDisplay');

document.getElementById('btnCriarSala').addEventListener('click', async () => {
  const code = gerarCodigoSala();
  const initialRoom = {
    status: 'lobby',
    phase: 'lobby',
    currentIndex: 0,
    questionSeconds: 20,
    createdAt: Date.now(),
    teams: gerarGrupos(4),
    players: {},
    questions: {}
  };
  await db.ref(`rooms/${code}`).set(initialRoom);
  localStorage.setItem('quizCorrida_hostRoom', code);
  entrarComoHost(code);
});

function entrarComoHost(code){
  roomCode = code;
  roomRef = db.ref(`rooms/${code}`);
  history.replaceState(null, '', `host.html?room=${code}`);

  roomCodeBox.classList.remove('hidden');
  document.getElementById('btnTrocarSala').classList.remove('hidden');
  roomCodeDisplay.textContent = code;
  stepCreate.classList.add('hidden');

  document.getElementById('linkTelao').href = `display.html?room=${code}`;
  document.getElementById('linkTelao2').href = `display.html?room=${code}`;

  roomRef.on('value', async snap => {
    currentRoom = snap.val();
    if(!currentRoom) return;
    await render();
    if(currentRoom.status === 'racing') agendarProximaTransicao();
  });
}

(function tryReconnect(){
  const urlRoom = getParam('room');
  const savedRoom = localStorage.getItem('quizCorrida_hostRoom');
  const code = urlRoom || savedRoom;
  if(code) entrarComoHost(code);
})();

async function render(){
  if(currentRoom.status === 'lobby'){
    stepConfig.classList.remove('hidden');
    stepRace.classList.add('hidden');
    stepFinish.classList.add('hidden');
    renderTeams();
    await renderQuestions();
  } else if(currentRoom.status === 'racing'){
    stepConfig.classList.add('hidden');
    stepRace.classList.remove('hidden');
    stepFinish.classList.add('hidden');
    await renderRace();
  } else if(currentRoom.status === 'finished'){
    stepConfig.classList.add('hidden');
    stepRace.classList.add('hidden');
    stepFinish.classList.remove('hidden');
    clearInterval(tickInterval);
    clearTimeout(phaseTimeout);
    renderFinish();
  }
}

function renderTeams(){
  const teams = currentRoom.teams || {};
  const box = document.getElementById('teamList');
  const ids = Object.keys(teams).sort();
  const numInput = document.getElementById('numGruposInput');
  if(document.activeElement !== numInput) numInput.value = ids.length || 4;

  box.innerHTML = ids.length ? '' : '<p style="font-size:13px;">Nenhum grupo ainda — clique em "Atualizar grupos".</p>';
  ids.forEach((tid) => {
    const t = teams[tid];
    const qtd = Object.keys(t.players || {}).length;
    const el = document.createElement('div');
    el.className = 'list-item';
    el.innerHTML = `
      <div class="swatch" style="background:${TEAM_COLORS_HEX[t.colorIndex % TEAM_COLORS_HEX.length]}; box-shadow:0 0 8px ${TEAM_COLORS_HEX[t.colorIndex % TEAM_COLORS_HEX.length]}99;"></div>
      <div class="grow"><strong>${escapeHtml(t.name)}</strong><span>${qtd}/${MAX_JOGADORES_POR_GRUPO} jogador${qtd===1?'':'es'}</span></div>
    `;
    box.appendChild(el);
  });
}

document.getElementById('btnAtualizarGrupos').addEventListener('click', async () => {
  const n = Math.min(MAX_GRUPOS, Math.max(2, parseInt(document.getElementById('numGruposInput').value, 10) || 4));

  const teams = currentRoom.teams || {};
  const jaTemJogador = Object.values(teams).some(t => Object.keys(t.players || {}).length > 0);
  if(jaTemJogador && !(await confirmModal('Já tem gente nos grupos. Atualizar a quantidade vai tirar todo mundo — eles precisam entrar de novo com o código.', { title:'Atualizar grupos', confirmText:'Continuar', danger:true }))){
    return;
  }

  await db.ref(`rooms/${roomCode}`).update({
    teams: gerarGrupos(n),
    players: null
  });
});

async function renderQuestions(){
  const questions = currentRoom.questions || {};
  const box = document.getElementById('questionList');
  const keys = Object.keys(questions);
  box.innerHTML = keys.length ? '' : '<p style="font-size:13px;">Nenhuma pergunta ainda.</p>';

  const linhas = await Promise.all(keys.map(async (qid, i) => {
    const q = questions[qid];
    const correctIdx = await aesDecryptInt(q.correctEnc);
    return { qid, i, q, correctIdx };
  }));

  linhas.forEach(({ qid, i, q, correctIdx }) => {
    const el = document.createElement('div');
    el.className = 'list-item';
    const correctLabel = correctIdx === null ? '⚠️ não foi possível decifrar' : escapeHtml(q.options[correctIdx]);
    el.innerHTML = `
      <div class="grow"><strong>${i+1}. ${escapeHtml(q.text)}</strong><span>correta: ${correctLabel}</span></div>
      <button class="del" data-qid="${qid}">remover</button>
    `;
    box.appendChild(el);
  });
  box.querySelectorAll('.del').forEach(btn => {
    btn.addEventListener('click', () => {
      db.ref(`rooms/${roomCode}/questions/${btn.dataset.qid}`).remove();
    });
  });
}

document.getElementById('btnAddQuestion').addEventListener('click', async () => {
  const text = document.getElementById('qTextInput').value.trim();
  const opts = [0,1,2,3].map(i => document.getElementById('opt'+i).value.trim());
  const correct = parseInt(document.querySelector('input[name="qCorrect"]:checked').value, 10);

  if(!text || opts.some(o => !o)){ alert('Preencha a pergunta e as 4 alternativas.'); return; }

  const correctEnc = await aesEncrypt(correct);

  const qid = 'q' + Date.now();
  try{
    await db.ref(`rooms/${roomCode}/questions/${qid}`).set({ text, options: opts, correctEnc });
  }catch(err){
    console.error(err);
    alert('Não foi possível salvar a pergunta. Confira o tamanho do texto (máx. 300) e das alternativas (máx. 120 cada).');
    return;
  }

  document.getElementById('qTextInput').value = '';
  [0,1,2,3].forEach(i => document.getElementById('opt'+i).value = '');
  document.querySelector('input[name="qCorrect"][value="0"]').checked = true;
});

const inputSegundos = document.getElementById('segundosPorPergunta');
inputSegundos.addEventListener('input', () => {
  if(inputSegundos.value === '') return; 
  const n = parseInt(inputSegundos.value, 10);
  if(!isNaN(n) && n > 60) inputSegundos.value = 60;
});

document.getElementById('btnIniciar').addEventListener('click', async () => {
  const questions = currentRoom.questions || {};
  if(Object.keys(questions).length < 1){ alert('Adicione pelo menos 1 pergunta.'); return; }

  const segundos = Math.min(60, Math.max(5, parseInt(inputSegundos.value, 10) || 20));
  const orderedIds = Object.keys(questions);

  await db.ref(`rooms/${roomCode}`).update({
    status: 'racing',
    phase: 'question',
    currentIndex: 0,
    questionOrder: orderedIds,
    questionSeconds: segundos,
    phaseEndsAt: Date.now() + segundos * 1000
  });
});

function questaoAtual(){
  const idx = currentRoom.currentIndex;
  const qid = currentRoom.questionOrder[idx];
  return { qid, q: currentRoom.questions[qid], idx, total: currentRoom.questionOrder.length };
}

function agendarProximaTransicao(){
  if(currentRoom.phase === 'finished') return;

  const { qid } = questaoAtual();
  const key = `${currentRoom.phase}-${currentRoom.currentIndex}-${currentRoom.phaseEndsAt}`;

  if(currentRoom.phase === 'question'){
    const teams = currentRoom.teams || {};
    const teamIds = Object.keys(teams);
    const answers = (currentRoom.answers && currentRoom.answers[qid]) || {};
    const responderam = teamIds.filter(tid => answers[tid] && Object.keys(answers[tid]).length > 0).length;
    if(teamIds.length > 0 && responderam >= teamIds.length){
      clearTimeout(phaseTimeout);
      scheduledKey = null;
      revelarRespostas();
      return;
    }
  }

  if(scheduledKey === key) return;
  scheduledKey = key;

  clearTimeout(phaseTimeout);
  const delay = Math.max(0, currentRoom.phaseEndsAt - Date.now());
  phaseTimeout = setTimeout(() => {
    if(currentRoom.phase === 'question') revelarRespostas();
    else if(currentRoom.phase === 'reveal') avancarPergunta();
  }, delay);
}

async function revelarRespostas(){
  const { qid, q } = questaoAtual();
  const teams = currentRoom.teams || {};
  const answers = (currentRoom.answers && currentRoom.answers[qid]) || {};

  const correctIdx = await aesDecryptInt(q.correctEnc);

  const reveal = {};
  const updates = {};

  Object.keys(teams).forEach(tid => {
    const teamAnswers = answers[tid] || {};
    const votes = Object.values(teamAnswers);
    if(votes.length === 0) return;

    const acertos = votes.filter(v => v === correctIdx).length;
    const correct = acertos > votes.length / 2;

    reveal[tid] = { correct, acertos, total: votes.length };
    if(correct){
      updates[`teams/${tid}/position`] = (teams[tid].position || 0) + 1;
    }
  });

  updates['lastReveal'] = reveal;
  updates['phase'] = 'reveal';
  updates['phaseEndsAt'] = Date.now() + REVEAL_SECONDS * 1000;

  await db.ref(`rooms/${roomCode}`).update(updates);
}

async function avancarPergunta(){
  const { idx, total } = questaoAtual();
  const nextIdx = idx + 1;

  if(nextIdx >= total){
    await db.ref(`rooms/${roomCode}`).update({ status: 'finished', phase: 'finished' });
  } else {
    await db.ref(`rooms/${roomCode}`).update({
      currentIndex: nextIdx,
      phase: 'question',
      lastReveal: null,
      phaseEndsAt: Date.now() + currentRoom.questionSeconds * 1000
    });
  }
}

document.getElementById('btnPular').addEventListener('click', () => {
  clearTimeout(phaseTimeout);
  scheduledKey = null;
  if(currentRoom.phase === 'question') revelarRespostas();
  else if(currentRoom.phase === 'reveal') avancarPergunta();
});

document.getElementById('btnEncerrar').addEventListener('click', async () => {
  if(!(await confirmModal('Encerrar a corrida agora?', { title:'Encerrar corrida', confirmText:'Encerrar', danger:true }))) return;
  clearTimeout(phaseTimeout);
  await db.ref(`rooms/${roomCode}`).update({ status: 'finished', phase: 'finished' });
});

async function renderRace(){
  const { q, idx, total, qid } = questaoAtual();
  document.getElementById('statIndex').textContent = `${idx+1}/${total}`;
  document.getElementById('currentQText').textContent = q.text;

  const teams = currentRoom.teams || {};
  const teamIds = Object.keys(teams);
  const answers = (currentRoom.answers && currentRoom.answers[qid]) || {};
  const answeredTeams = teamIds.filter(tid => answers[tid] && Object.keys(answers[tid]).length > 0).length;
  document.getElementById('statAnswered').textContent = `${answeredTeams}/${teamIds.length}`;

  const revealBox = document.getElementById('revealBox');
  const qBoxLabel = document.getElementById('qBoxLabel');

  if(currentRoom.phase === 'question'){
    qBoxLabel.textContent = 'PERGUNTA ATUAL';
    revealBox.innerHTML = '';
  } else if(currentRoom.phase === 'reveal'){
    const correctIdx = await aesDecryptInt(q.correctEnc);
    qBoxLabel.textContent = 'RESPOSTA CERTA: ' + (correctIdx === null ? '⚠️ erro ao decifrar' : q.options[correctIdx]);
    const reveal = currentRoom.lastReveal || {};
    revealBox.innerHTML = teamIds.map(tid => {
      const r = reveal[tid];
      if(!r) return `<div style="font-size:13px; color:var(--text-low);">${escapeHtml(teams[tid].name)}: não respondeu</div>`;
      const icon = r.correct ? '✅' : '❌';
      return `<div style="font-size:13px; margin-bottom:4px;">${icon} <strong>${escapeHtml(teams[tid].name)}</strong> ${r.correct ? 'acertou e avançou!' : 'errou.'}</div>`;
    }).join('');
  }

  atualizarCronometro();
  renderProgress();
}

function atualizarCronometro(){
  clearInterval(tickInterval);
  const label = document.getElementById('statTimerLabel');
  label.textContent = currentRoom.phase === 'question' ? 'TEMPO' : 'PRÓXIMA EM';

  const tick = () => {
    const restante = Math.max(0, Math.ceil((currentRoom.phaseEndsAt - Date.now()) / 1000));
    document.getElementById('statTimer').textContent = restante + 's';
  };
  tick();
  tickInterval = setInterval(tick, 250);
}

function renderProgress(){
  const teams = currentRoom.teams || {};
  const total = currentRoom.questionOrder.length;
  const box = document.getElementById('raceProgress');
  box.innerHTML = '';
  Object.keys(teams).sort((a,b) => teams[b].position - teams[a].position).forEach(tid => {
    const t = teams[tid];
    const pct = Math.min(100, (t.position / total) * 100);
    const color = TEAM_COLORS_HEX[t.colorIndex % TEAM_COLORS_HEX.length];
    const row = document.createElement('div');
    row.className = 'team-progress';
    row.innerHTML = `
      <div class="name">${escapeHtml(t.name)}</div>
      <div class="bar-bg"><div class="bar-fill" style="width:${pct}%; background:${color}; box-shadow:0 0 10px ${color}aa;"></div></div>
      <div class="badge">${t.position}/${total}</div>
    `;
    box.appendChild(row);
  });
}

function renderFinish(){
  const teams = currentRoom.teams || {};
  const ranked = Object.values(teams).sort((a,b) => b.position - a.position);
  const winner = ranked[0];
  const rest = ranked.slice(1).map(t => `${escapeHtml(t.name)} (${t.position})`).join(' · ');
  document.getElementById('finishText').innerHTML = `
    <strong style="color:var(--flag-yellow); font-size:18px;">${escapeHtml(winner.name)}</strong> venceu a corrida!
    ${rest ? '<br><span style="font-size:13px;">' + rest + '</span>' : ''}
  `;
}

document.getElementById('btnTrocarSala').addEventListener('click', async () => {
  if(!(await confirmModal('A sala atual vai ser encerrada de vez pra todo mundo (jogadores e telão). Essa ação não pode ser desfeita.', { title:'Sair dessa sala e criar uma nova?', confirmText:'Encerrar e criar nova', danger:true }))) return;
  await sairDaSalaAtual();
});

document.getElementById('btnNovaSala').addEventListener('click', async () => {
  if(!(await confirmModal('A sala atual vai ser encerrada de vez pra todo mundo (jogadores e telão). Essa ação não pode ser desfeita.', { title:'Encerrar sala e criar uma nova?', confirmText:'Encerrar e criar nova', danger:true }))) return;
  await sairDaSalaAtual();
});

document.getElementById('btnJogarNovamente').addEventListener('click', async () => {
  const teams = currentRoom.teams || {};
  const updates = {
    status: 'lobby',
    phase: 'lobby',
    currentIndex: 0,
    lastReveal: null,
    answers: null,
    questionOrder: null,
    phaseEndsAt: null
  };
  Object.keys(teams).forEach(tid => {
    updates[`teams/${tid}/position`] = 0;
  });
  await db.ref(`rooms/${roomCode}`).update(updates);
});

async function sairDaSalaAtual(){
  if(roomRef) roomRef.off();
  clearTimeout(phaseTimeout);
  clearInterval(tickInterval);
  const codigoEncerrado = roomCode;
  localStorage.removeItem('quizCorrida_hostRoom');
  if(codigoEncerrado){
    await db.ref(`rooms/${codigoEncerrado}`).remove();
  }
  window.location.href = 'host.html';
}