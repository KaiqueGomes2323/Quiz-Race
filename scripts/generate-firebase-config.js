const fs = require('fs');
const path = require('path');

const REQUIRED_VARS = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_DATABASE_URL',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
  'AES_SECRET_PASSPHRASE',
];

const missing = REQUIRED_VARS.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(
    `Faltam variáveis de ambiente: ${missing.join(', ')}\n` +
    'Configure-as em Netlify > Site configuration > Environment variables.'
  );
  process.exit(1);
}

const content = `const firebaseConfig = {
  apiKey: "${process.env.FIREBASE_API_KEY}",
  authDomain: "${process.env.FIREBASE_AUTH_DOMAIN}",
  databaseURL: "${process.env.FIREBASE_DATABASE_URL}",
  projectId: "${process.env.FIREBASE_PROJECT_ID}",
  storageBucket: "${process.env.FIREBASE_STORAGE_BUCKET}",
  messagingSenderId: "${process.env.FIREBASE_MESSAGING_SENDER_ID}",
  appId: "${process.env.FIREBASE_APP_ID}"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const dbFirestore = firebase.firestore();
const auth = firebase.auth();

const AES_SECRET_PASSPHRASE = '${process.env.AES_SECRET_PASSPHRASE}';
`;

const outputPath = path.join(__dirname, '..', 'js', 'firebase-config.js');
fs.writeFileSync(outputPath, content, 'utf8');
console.log(`Gerado: ${outputPath}`);
