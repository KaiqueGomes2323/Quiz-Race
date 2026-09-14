# Ideias para evoluir o projeto

Seis frentes de melhoria para o jogo.

## 1. Gameplay e mecânicas
Deixar a corrida mais estratégica e dinâmica, não só "acertou, anda".

- Power-ups: acerto em sequência dá "nitro" (2 casas), erro dá "pane" (perde a vez)
- Perguntas com dificuldade/pontuação variável (fácil = 1 casa, difícil = 2 casas)
- Modo "roubo de casa": time que erra pode perder posição para quem acertou mais rápido
- Ranking individual dentro do time, além do placar por time

## 2. Conteúdo e perguntas
Tornar a criação e os tipos de pergunta mais ricos para o host.

- Importar perguntas em massa via CSV/planilha
- Suporte a imagem/vídeo na pergunta (ex: identificar algo visualmente)
- Banco de perguntas reutilizável entre salas (biblioteca salva no Firestore)
- Perguntas de múltipla resposta ou verdadeiro/falso, além de 4 alternativas

## 3. Experiência do telão (display.html)
Tornar a pista mais viva e envolvente para quem assiste em TV/projetor.

- Animação de largada e linha de chegada com confete no fim
- Efeitos sonoros (largada, acerto, erro, vitória)
- Mostrar histórico de acertos por pergunta em um mini-gráfico ao vivo
- Modo "replay" com o caminho percorrido por cada time

## 4. Social e engajamento
Aumentar a competitividade e a diversão entre os jogadores.

- Chat/reações rápidas (emojis) entre jogadores do mesmo time
- Sistema de avatares/carrinhos personalizáveis por time
- Modo espectador para quem não está jogando acompanhar pelo celular
- Certificado ou tela de resumo pós-jogo (MVP, time campeão, % de acerto)

## 5. Infraestrutura e robustez
Deixar o sistema mais confiável e fácil de apresentar no seminário.

- Reconexão automática se o jogador cair no meio de uma pergunta
- Modo offline/local (sem Firebase) usando apenas WebSocket ou localStorage, para demo sem internet
- Painel de host com estatísticas (tempo médio de resposta, taxa de acerto por pergunta)
- Exportar resultado final da sala em PDF/CSV ao término

## 6. Acessibilidade e polish visual
Refinar a interface, já que vocês têm um design system de tema neon.

- Modo daltônico (cores dos times com padrões/ícones além de cor)
- Suporte a leitura de tela / navegação por teclado
- Animações de transição entre fases (pergunta → revelação)
- Responsividade extra para tablets no papel de segundo telão
