## Recomendo que abra esse arquivo no Visual Studio Code (VS Code) ou mude para o modo de `Código` na visualização do GitHub!!

## Estrutura

```
index.html      → tela de entrada (nome + código da sala)
host.html        → painel do host: cria a sala, cadastra as perguntas, controla o ritmo
player.html      → tela do jogador, recebe as perguntas
display.html      → telão com a pista e os carrinhos (abrir num TV/projetor)
```

## Crie uma pasta "css" dentro da pasta principal do projeto e adicione o arquivo abaixo nela:
```
css/style.css      → design system (tema pista noturna)
```

## Crie uma pasta "js" dentro da pasta principal do projeto e adicione os arquivos arquivos abaixo nela:
```
js/firebase-config.js → configuração do Firebase (NÃO sobe pro Git — veja "1. Configurar o Firebase")
js/firebase-config.example.js → modelo público, sem segredos, usado como base pro arquivo acima
js/common.js      → helpers compartilhados
js/join.js, host.js, player.js, display.js → lógica de cada tela
js/crypto-utils.js  → criptografia AES-256 (cifra a resposta correta antes de salvar no Firebase)
```

## 1. Configurar o Firebase

1. No [Firebase Console](https://console.firebase.google.com), abra (ou crie) um projeto.

2. Vá em **Visão geral do projeto → + Adicionar app → Escolha a opção `Web`, → Escolha e adicione o nome do projeto → Marque a opção `Configure também o Firebase Hosting para este app` → Clique em `Registrar app` → Clique em `Avançar` → Clique em `Avançar` novamente → e por último clique em `Continuar no console`.**

3. Vá em **Bancos de dados → Realtime Database → Criar banco de dados → Deixe o local do Realtime Database como Estados Unidos `(us-central1)` → Escolha iniciar no modo `bloqueado`**.

4. Em **Configurações do projeto → Seus apps**, copie as chaves do app Web, algo como o exemplo abaixo.

const firebaseConfig = {
  apiKey: "AIzaSyAI5lJ9m0AeJnv-N_m3W4X3ZeO47UeJcOM",
  authDomain: "fusion-fitflow.firebaseapp.com",
  projectId: "fusion-fitflow",
  storageBucket: "fusion-fitflow.firebasestorage.app",
  messagingSenderId: "118361424687",
  appId: "1:118361424687:web:0c463e2154539a552757da"
};

5. Cole em `js/firebase-config.example.js`, no lugar dos placeholders (`SUA_API_KEY_AQUI`, etc). Adicione o campo `databaseURL: "https://SEU_PROJETO-default-rtdb.firebaseio.com/",` — precisa ser logo abaixo do campo `authDomain: "SEU_PROJETO.firebaseapp.com",` — mas `atenção`, essa chave será preenchida com o link que aparecer no `Realtime Database`. Por fim, renomeie o arquivo para `firebase-config.js`.

6. Em **Realtime Database → Regras**, use essas regras abaixo (somente o código entre as chaves {}) e publique (Ctrl + S):

```json

{
  "rules": {
    ".read": false,
    ".write": false,

    "rooms": {
      ".read": false,
      ".write": false,

      "$roomCode": {
        ".read": true,
        ".write": "$roomCode.matches(/^[A-HJKMNP-Z2-9]{5}$/)",

        "status": {
          ".validate": "newData.isString() && (newData.val() == 'lobby' || newData.val() == 'racing' || newData.val() == 'finished')"
        },
        "phase": {
          ".validate": "newData.isString() && (newData.val() == 'lobby' || newData.val() == 'question' || newData.val() == 'reveal' || newData.val() == 'finished')"
        },
        "currentIndex": {
          ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() < 1000"
        },
        "questionSeconds": {
          ".validate": "newData.isNumber() && newData.val() >= 5 && newData.val() <= 600"
        },
        "createdAt": {
          ".validate": "newData.isNumber()"
        },
        "phaseEndsAt": {
          ".validate": "newData.isNumber()"
        },

        "questionOrder": {
          "$idx": {
            ".validate": "newData.isString() && newData.val().length <= 40 && root.child('rooms/' + $roomCode + '/questions/' + newData.val()).exists()"
          }
        },

        "lastReveal": {
          "$teamId": {
            ".validate": "newData.hasChildren(['correct','acertos','total']) && root.child('rooms/' + $roomCode + '/teams/' + $teamId).exists()",
            "correct": { ".validate": "newData.isBoolean()" },
            "acertos": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 1000" },
            "total":   { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 1000" },
            "$other":  { ".validate": false }
          }
        },

        "teams": {
          "$teamId": {
            ".validate": "$teamId.matches(/^t[0-9]{1,2}$/)",
            "name": {
              ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 40"
            },
            "colorIndex": {
              ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 11"
            },
            "position": {
              ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 1000"
            },
            "players": {
              "$playerId": {
                ".validate": "$playerId.matches(/^p_[a-z0-9]{5,12}$/) && newData.isString() && newData.val().length > 0 && newData.val().length <= 30"
              }
            },
            "$other": { ".validate": false }
          }
        },

        "players": {
          "$playerId": {
            ".validate": "$playerId.matches(/^p_[a-z0-9]{5,12}$/)",
            "name": {
              ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 30"
            },
            "teamId": {
              ".validate": "newData.isString() && root.child('rooms/' + $roomCode + '/teams/' + newData.val()).exists()"
            },
            "$other": { ".validate": false }
          }
        },

        "questions": {
          "$questionId": {
            ".validate": "$questionId.matches(/^q[0-9]{10,20}$/)",
            "text": {
              ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 300"
            },
            "options": {
              ".validate": "newData.hasChildren(['0','1','2','3'])",
              "$i": {
                ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 120"
              }
            },
            "correctEnc": {
              ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 500"
            },
            "$other": { ".validate": false }
          }
        },

        "answers": {
          "$questionId": {
            ".validate": "root.child('rooms/' + $roomCode + '/questions/' + $questionId).exists()",
            "$teamId": {
              ".validate": "root.child('rooms/' + $roomCode + '/teams/' + $teamId).exists()",
              "$playerId": {
                ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 3"
              }
            }
          }
        },

        "$other": { ".validate": false }
      }
    }
  }
}

```

## 2. Rodar local

Como é tudo estático, basta servir a pasta. Exemplo com o `serve` do Node ou a extensão Live Server do VS Code. Não abra os arquivos direto com `file://` — o Firebase SDK pode reclamar de CORS.

```bash
npx serve .
```

## 3. Como jogar

1. O host abre `host.html`, clica em **Criar sala** → recebe um código de 5 caracteres.
2. O host cadastra as **perguntas** (texto → 4 alternativas → marca a correta). Os **grupos** já vêm prontos (4 por padrão, dá pra mudar de 2 a 12), não precisa criar time nenhum.
3. O host abre o **telão** (`display.html?room=CODIGO`) numa TV/projetor.
4. Os jogadores acessam `index.html`, digitam o código + nome, e são distribuídos automaticamente entre os grupos, equilibrando quem tem menos gente.
5. O host clica em **Iniciar corrida**. Cada jogador responde no próprio dispositivo; quando a maioria do time acerta, o carrinho do time avança uma casa na pista.
6. O host clica em **Revelar respostas** → mostra quem acertou → **Próxima pergunta** → segue até a última.
7. Ao final, o telão e as telas dos jogadores mostram o time vencedor.
