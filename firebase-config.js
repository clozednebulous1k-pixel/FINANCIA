// Configurações do seu projeto Firebase.
// Substitua os valores abaixo pelos dados obtidos no console do Firebase (https://console.firebase.google.com/)
const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "SEU_PROJECT_ID.firebaseapp.com",
  projectId: "SEU_PROJECT_ID_AQUI",
  storageBucket: "SEU_PROJECT_ID.appspot.com",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID_AQUI",
  appId: "SUA_APP_ID_AQUI"
};

// Função auxiliar para verificar se as configurações foram preenchidas corretamente
const isFirebaseConfigured = 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== "SUA_API_KEY_AQUI" && 
  firebaseConfig.projectId && 
  firebaseConfig.projectId !== "SEU_PROJECT_ID_AQUI";

// Exporta globalmente para o navegador
window.firebaseConfig = firebaseConfig;
window.isFirebaseConfigured = isFirebaseConfigured;
