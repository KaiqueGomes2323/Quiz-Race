const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  databaseURL: "https://SEU_PROJETO-default-rtdb.firebaseio.com/",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.firebasestorage.app",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const dbFirestore = firebase.firestore();
const auth = firebase.auth();

const AES_SECRET_PASSPHRASE = 'TROQUE_ESTA_FRASE_SECRETA_AQUI';