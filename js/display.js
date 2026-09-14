const roomCode = getParam('room');
const root = document.getElementById('root');
let tickInterval = null;

function iniciarBarraTempo(phaseEndsAt, totalSeconds){
  clearInterval(tickInterval);
  const tick = () => {
    const fill = document.getElementById('timerFill');
    const num = document.getElementById('timerNum');
    if(!fill || !num){ clearInterval(tickInterval); return; }
    const restanteMs = Math.max(0, phaseEndsAt - Date.now());
    const pct = totalSeconds > 0 ? (restanteMs / (totalSeconds*1000)) * 100 : 0;
    fill.style.width = pct + '%';
    num.textContent = Math.ceil(restanteMs/1000) + 's';
  };
  tick();
  tickInterval = setInterval(tick, 200);
}

if(!roomCode){
  root.innerHTML = `
    <div class="glass waiting-box">
      <p>Adicione <strong>?room=CODIGO</strong> na URL, ou abra pelo painel do host.</p>
    </div>
  `;
} else {
  document.getElementById('roomCodeDisplay').textContent = roomCode;

  db.ref(`rooms/${roomCode}`).on('value', async snap => {
    const room = snap.val();
    if(!room){
      root.innerHTML = `<div class="glass waiting-box"><p>Sala não encontrada.</p></div>`;
      return;
    }

    if(room.status === 'lobby'){
      renderLobby(room);
    } else if(room.status === 'racing'){
      await renderRace(room);
    } else if(room.status === 'finished'){
      renderFinished(room);
    }
  });
}

function renderLobby(room){
  const teams = room.teams || {};
  const teamIds = Object.keys(teams);
  const totalPlayers = teamIds.reduce((s,tid) => s + Object.keys(teams[tid].players||{}).length, 0);

  root.innerHTML = `
    <div class="glass waiting-box">
      <div style="font-size:clamp(13px,3vw,15px); color:var(--text-mid);">Aguardando o início...</div>
      <div style="font-family:var(--font-display); font-size:clamp(24px,7vw,40px); font-weight:800; margin:14px 0; overflow-wrap:anywhere;">
        ${totalPlayers} jogador${totalPlayers===1?'':'es'} · ${teamIds.length} time${teamIds.length===1?'':'s'}
      </div>
      <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap; margin-top:16px;">
        ${teamIds.map(tid => {
          const t = teams[tid];
          const qtd = Object.keys(t.players||{}).length;
          return `<span class="tag" style="border-color:${TEAM_COLORS_HEX[t.colorIndex % TEAM_COLORS_HEX.length]}44;">${escapeHtml(t.name)} · ${qtd}</span>`;
        }).join('')}
      </div>
    </div>
  `;
}

async function renderRace(room){
  const teams = room.teams || {};
  const teamIds = Object.keys(teams).sort((a,b) => (teams[b].position||0) - (teams[a].position||0));
  const total = room.questionOrder.length;
  const qid = room.questionOrder[room.currentIndex];
  const q = room.questions[qid];

  let questionHtml = '';
  if(room.phase === 'question'){
    questionHtml = `
      <div class="glass qbox">
        <div class="label">PERGUNTA ${room.currentIndex+1} DE ${total}</div>
        <div class="text">${escapeHtml(q.text)}</div>
        <div class="timer-bar-bg"><div class="timer-bar-fill" id="timerFill" style="width:100%;"></div></div>
        <div class="timer-num" id="timerNum">-</div>
      </div>
    `;
  } else if(room.phase === 'reveal'){
    const reveal = room.lastReveal || {};
    const correctIdx = await aesDecryptInt(q.correctEnc);
    const correctText = correctIdx === null ? '⚠️ erro ao decifrar' : q.options[correctIdx];
    questionHtml = `
      <div class="glass qbox">
        <div class="label">RESPOSTA CERTA</div>
        <div class="text" style="color:var(--flag-yellow);">${escapeHtml(correctText)}</div>
        <div class="reveal-strip">
          ${teamIds.map(tid => {
            const r = reveal[tid];
            const color = TEAM_COLORS_HEX[teams[tid].colorIndex % TEAM_COLORS_HEX.length];
            const label = r ? (r.correct ? 'avançou' : 'não avançou') : 'não respondeu';
            return `<span class="reveal-chip" style="border-color:${color};">${escapeHtml(teams[tid].name)} — ${label}</span>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  const tracksHtml = teamIds.map(tid => {
    const t = teams[tid];
    const pct = Math.min(96, ((t.position||0) / total) * 96);
    const color = TEAM_COLORS_HEX[t.colorIndex % TEAM_COLORS_HEX.length];
    const car = CAR_EMOJI[t.colorIndex % CAR_EMOJI.length];
    return `
      <div class="track-row">
        <div class="track-label">
          <span style="color:${color}; text-shadow:0 0 10px ${color}77;">${escapeHtml(t.name)}</span>
          <span class="status">${t.position||0}/${total}</span>
        </div>
        <div class="track">
          <div class="finish-flag"></div>
          <div class="car" style="left:${pct}%;">${car}</div>
        </div>
      </div>
    `;
  }).join('');

  root.innerHTML = questionHtml + tracksHtml;

  if(room.phase === 'question'){
    iniciarBarraTempo(room.phaseEndsAt, room.questionSeconds);
  } else {
    clearInterval(tickInterval);
  }
}

function renderFinished(room){
  const teams = room.teams || {};
  const ranked = Object.values(teams).sort((a,b) => (b.position||0) - (a.position||0));
  const winner = ranked[0];
  const color = TEAM_COLORS_HEX[winner.colorIndex % TEAM_COLORS_HEX.length];

  root.innerHTML = `
    <div class="glass finish-box">
      <div class="big">🏆</div>
      <div style="font-family:var(--font-display); font-size:clamp(24px,6vw,38px); font-weight:800; color:${color}; overflow-wrap:anywhere;">
        ${escapeHtml(winner.name)}
      </div>
      <p style="margin-top:8px;">venceu a corrida com ${winner.position} pontos!</p>
      <div class="reveal-strip">
        ${ranked.slice(1).map(t => {
          const c = TEAM_COLORS_HEX[t.colorIndex % TEAM_COLORS_HEX.length];
          return `<span class="reveal-chip" style="border-color:${c};">${escapeHtml(t.name)} — ${t.position}</span>`;
        }).join('')}
      </div>
    </div>
  `;
}