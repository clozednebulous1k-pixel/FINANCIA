module.exports = (req, res) => {
  // Configuração de cabeçalhos de CORS (caso acesse de outro domínio durante testes)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Captura as variáveis de ambiente cadastradas no painel da Vercel
  const config = {
    apiKey: process.env.FIREBASE_API_KEY || "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.FIREBASE_APP_ID || ""
  };

  // Verifica se as chaves principais do Firebase foram cadastradas
  const isFirebaseConfigured = 
    config.apiKey && 
    config.apiKey !== "" && 
    config.projectId && 
    config.projectId !== "";

  // Retorna a configuração como JSON
  res.status(200).json({
    config,
    isFirebaseConfigured
  });
};
