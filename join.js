const inputCode = document.getElementById('roomCode');
const inputName = document.getElementById('playerName');
const btnEntrar = document.getElementById('btnEntrar');
const erroEl = document.getElementById('erro');

inputCode.addEventListener('input', () => {
  inputCode.value = inputCode.value.toUpperCase();
});

function mostrarErro(msg){
  erroEl.textContent = msg;
  erroEl.style.display = 'block';
}

btnEntrar.addEventListener('click', async () => {
  const roomCode = inputCode.value.trim().toUpperCase();
  const playerName = inputName.value.trim();

  erroEl.style.display = 'none';

  if(roomCode.length !== 5){ mostrarErro('O código da sala deve ter 5 caracteres.'); return; }
  if(!playerName){ mostrarErro('Digite seu nome.'); return; }

  btnEntrar.disabled = true;
  btnEntrar.textContent = 'Entrando...';

  try{
    const snap = await db.ref(`rooms/${roomCode}`).get();
    if(!snap.exists()){
      mostrarErro('Sala não encontrada. Confira o código com o host.');
      btnEntrar.disabled = false;
      btnEntrar.textContent = 'Entrar na sala →';
      return;
    }

    const room = snap.val();

    if(room.status === 'finished'){
      mostrarErro('Essa corrida já acabou.');
      btnEntrar.disabled = false;
      btnEntrar.textContent = 'Entrar na sala →';
      return;
    }

    const teamIds = Object.keys(room.teams || {});
    let teamId = null;
    const updates = {};

    if(room.mode === 'individual'){
      if(teamIds.length >= MAX_JOGADORES_INDIVIDUAL){
        mostrarErro(`A sala já está cheia (máximo de ${MAX_JOGADORES_INDIVIDUAL} jogadores).`);
        btnEntrar.disabled = false;
        btnEntrar.textContent = 'Entrar na sala →';
        return;
      }

      const playerId = gerarIdJogador();
      teamId = 'ti_' + playerId;

      // Escreve o time primeiro e espera confirmar, para que a regra
      // "players/$playerId/teamId" (que exige o time já existir) passe.
      await db.ref(`rooms/${roomCode}/teams/${teamId}`).set({
        name: playerName,
        colorIndex: corIndexDeterministico(playerId, TEAM_COLORS_HEX.length),
        position: 0,
        players: { [playerId]: playerName }
      });
      await db.ref(`rooms/${roomCode}/players/${playerId}`).set({ name: playerName, teamId });

      salvarSessaoJogador(roomCode, playerId, playerName, teamId);
      window.location.href = `player.html?room=${roomCode}`;
      return;
    }

    if(teamIds.length === 0){
      mostrarErro('O host ainda não criou os times.');
      btnEntrar.disabled = false;
      btnEntrar.textContent = 'Entrar na sala →';
      return;
    }

    let menorQtd = Infinity;
    teamIds.forEach(tid => {
      const qtd = Object.keys(room.teams[tid].players || {}).length;
      if(qtd < MAX_JOGADORES_POR_GRUPO && qtd < menorQtd){ menorQtd = qtd; teamId = tid; }
    });

    if(!teamId){
      mostrarErro(`Todos os grupos já estão cheios (máximo de ${MAX_JOGADORES_POR_GRUPO} pessoas por grupo).`);
      btnEntrar.disabled = false;
      btnEntrar.textContent = 'Entrar na sala →';
      return;
    }

    const playerId = gerarIdJogador();
    updates[`rooms/${roomCode}/teams/${teamId}/players/${playerId}`] = playerName;
    updates[`rooms/${roomCode}/players/${playerId}`] = { name: playerName, teamId };
    await db.ref().update(updates);

    salvarSessaoJogador(roomCode, playerId, playerName, teamId);
    window.location.href = `player.html?room=${roomCode}`;

  }catch(err){
    console.error(err);
    mostrarErro('Erro ao entrar. Confira sua conexão e a configuração do Firebase.');
    btnEntrar.disabled = false;
    btnEntrar.textContent = 'Entrar na sala →';
  }
});

inputName.addEventListener('keydown', e => { if(e.key === 'Enter') btnEntrar.click(); });