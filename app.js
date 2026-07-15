// Import Firebase SDK v10 modules from CDN dynamically
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// Database Instance variables
let db = null;
let auth = null;
let isFirebaseActive = false;

// Async function to load config and initialize Firebase Firestore
async function loadConfigAndInitialize() {
  let finalConfig = null;
  
  // 1. Tenta carregar as variáveis de ambiente da Vercel (/api/config)
  try {
    const response = await fetch('/api/config');
    if (response.ok) {
      const data = await response.json();
      if (data.isFirebaseConfigured) {
        finalConfig = data.config;
        isFirebaseActive = true;
        console.log("✅ Configurações carregadas do endpoint Vercel.");
      }
    }
  } catch (e) {
    console.log("ℹ️ Endpoint de API (/api/config) não disponível localmente. Usando fallback...");
  }

  // 2. Se a Vercel não retornar chaves, tenta ler do arquivo local (firebase-config.js)
  if (!isFirebaseActive && window.isFirebaseConfigured) {
    finalConfig = window.firebaseConfig;
    isFirebaseActive = true;
    console.log("✅ Configurações locais carregadas (firebase-config.js).");
  }

  // 3. Inicializa o Firebase se alguma configuração for válida
  if (isFirebaseActive && finalConfig) {
    try {
      const app = initializeApp(finalConfig);
      db = getFirestore(app);
      auth = getAuth(app);
      console.log("🔥 Firebase inicializado com sucesso!");
    } catch (error) {
      console.error("Erro ao inicializar o Firebase. Ativando fallback local:", error);
      isFirebaseActive = false;
    }
  } else {
    console.log("ℹ️ Usando Banco de Dados Local (localStorage). Para ativar Firebase, configure o arquivo 'firebase-config.js' ou o painel da Vercel.");
  }
}

// ==========================================
// INTERFACE DE BANCO DE DADOS (FIREBASE OU LOCALSTORAGE)
// ==========================================
let localListeners = [];

const dbInterface = {
  saveProposal: async (proposal) => {
    if (isFirebaseActive && db) {
      try {
        await addDoc(collection(db, "proposals"), proposal);
      } catch (e) {
        console.error("Erro ao salvar no Firestore, usando fallback local:", e);
        fallbackInterface.saveProposal(proposal);
      }
    } else {
      fallbackInterface.saveProposal(proposal);
    }
  },
  listenToProposals: (callback) => {
    if (isFirebaseActive && db) {
      const q = query(collection(db, "proposals"), orderBy("date", "desc"));
      return onSnapshot(q, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        callback(list);
      }, (error) => {
        console.error("Erro no listener do Firebase, usando fallback local:", error);
        fallbackInterface.listenToProposals(callback);
      });
    } else {
      return fallbackInterface.listenToProposals(callback);
    }
  },
  updateProposalStatus: async (id, status) => {
    if (isFirebaseActive && db) {
      try {
        const docRef = doc(db, "proposals", id);
        await updateDoc(docRef, { status });
      } catch (e) {
        console.error("Erro ao atualizar status no Firestore, usando fallback local:", e);
        fallbackInterface.updateProposalStatus(id, status);
      }
    } else {
      fallbackInterface.updateProposalStatus(id, status);
    }
  }
};

// Fallback LocalStorage Implementation
const STORAGE_KEY = 'sales_financing_proposals';
const USER_SESSION_KEY = 'sales_financing_session';

const fallbackInterface = {
  saveProposal: (proposal) => {
    const list = fallbackInterface.getProposals();
    list.unshift(proposal);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    // Trigger local listeners
    localListeners.forEach(cb => cb(list));
  },
  getProposals: () => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      const mockInitial = [
        {
          id: 'prop_1',
          fullName: 'Carlos Henrique Silva',
          cpf: '123.456.789-00',
          phone: '(11) 98765-4321',
          birthDate: '1988-04-12',
          cnhActive: 'sim',
          cleanName: 'sim',
          status: 'aprovado',
          date: '2026-07-14T14:30:00.000Z'
        },
        {
          id: 'prop_2',
          fullName: 'Mariana Costa Ferreira',
          cpf: '987.654.321-11',
          phone: '(21) 99888-7777',
          birthDate: '2001-09-22',
          cnhActive: 'sim',
          cleanName: 'sim',
          status: 'pendente',
          date: '2026-07-15T00:15:00.000Z'
        },
        {
          id: 'prop_3',
          fullName: 'Roberto de Souza',
          cpf: '456.789.123-22',
          phone: '(31) 98877-6655',
          birthDate: '2005-11-05',
          cnhActive: 'nao',
          cleanName: 'nao',
          status: 'recusado',
          date: '2026-07-13T10:45:00.000Z'
        }
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mockInitial));
      return mockInitial;
    }
    return JSON.parse(data);
  },
  listenToProposals: (callback) => {
    localListeners.push(callback);
    callback(fallbackInterface.getProposals());
    return () => {
      localListeners = localListeners.filter(cb => cb !== callback);
    };
  },
  updateProposalStatus: (id, status) => {
    const list = fallbackInterface.getProposals();
    const index = list.findIndex(p => p.id === id);
    if (index !== -1) {
      list[index].status = status;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      localListeners.forEach(cb => cb(list));
    }
  }
};

// ==========================================
// AUXILIARES DE FORMATAÇÃO E VALIDAÇÃO
// ==========================================
function formatCPF(value) {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    .substring(0, 14);
}

function formatPhone(value) {
  const clean = value.replace(/\D/g, '');
  if (clean.length <= 10) {
    return clean
      .replace(/^(\d{2})(\d)/g, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .substring(0, 14);
  } else {
    return clean
      .replace(/^(\d{2})(\d)/g, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .substring(0, 15);
  }
}

function isValidCPF(cpf) {
  const cleanCPF = cpf.replace(/\D/g, '');
  if (cleanCPF.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

  let sum = 0;
  let remainder;

  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) return false;

  return true;
}

function getAge(birthDateString) {
  const today = new Date();
  const birthDate = new Date(birthDateString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function showToast(message, icon = '✓') {
  const toast = document.getElementById('toast');
  toast.innerHTML = `<span>${icon}</span> ${message}`;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ==========================================
// LÓGICA DE INTERFACE PRINCIPAL
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  // Carrega as configurações de forma assíncrona primeiro
  await loadConfigAndInitialize();

  let activeProposals = [];
  let currentProposalId = null;
  let unsubscribeDb = null;

  // DOM Elements - Switch Views
  const btnSellerAccess = document.getElementById('btn-seller-access');
  const btnBackToForm = document.getElementById('btn-back-to-form');
  const btnLogout = document.getElementById('btn-logout');
  const userBadge = document.getElementById('user-badge');

  const viewForm = document.getElementById('view-form');
  const viewLogin = document.getElementById('view-login');
  const viewDashboard = document.getElementById('view-dashboard');
  const successPanel = document.getElementById('success-panel');
  const formPanel = document.getElementById('form-panel');

  // Forms
  const clientForm = document.getElementById('financing-form');
  const loginForm = document.getElementById('login-form');

  // Input fields
  const cpfInput = document.getElementById('cpf');
  const phoneInput = document.getElementById('phone');
  const birthDateInput = document.getElementById('birthdate');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const loginError = document.getElementById('login-error');

  // Dashboard details
  const searchInput = document.getElementById('search-input');
  const submissionList = document.getElementById('submission-list');
  const detailEmpty = document.getElementById('detail-empty');
  const detailPanel = document.getElementById('detail-panel');

  // Configure Multi-Selection Cards
  setupSelectionCards('cnh-group', 'cnhActive');
  setupSelectionCards('clean-name-group', 'cleanName');

  function setupSelectionCards(groupId, hiddenInputId) {
    const group = document.getElementById(groupId);
    const hiddenInput = document.getElementById(hiddenInputId);
    if (!group) return;
    
    const cards = group.querySelectorAll('.selection-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        cards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        hiddenInput.value = card.dataset.value;
        hiddenInput.classList.remove('invalid');
        const errSpan = group.querySelector('.validation-error');
        if (errSpan) errSpan.textContent = '';
      });
    });
  }

  // Format Inputs on input
  cpfInput.addEventListener('input', (e) => { e.target.value = formatCPF(e.target.value); });
  phoneInput.addEventListener('input', (e) => { e.target.value = formatPhone(e.target.value); });

  // Routing navigation logic
  function showView(viewName) {
    viewForm.classList.remove('active');
    viewLogin.classList.remove('active');
    viewDashboard.classList.remove('active');
    
    // Hide header helper buttons
    btnSellerAccess.style.display = 'none';
    btnBackToForm.style.display = 'none';
    btnLogout.style.display = 'none';
    userBadge.style.display = 'none';

    // Verify if seller is logged in (via Firebase Auth or Local fallback)
    const isFirebaseUserLoggedIn = isFirebaseActive && auth && auth.currentUser;
    const isLocalUserLoggedIn = !isFirebaseActive && localStorage.getItem(USER_SESSION_KEY);
    const isLoggedIn = isFirebaseUserLoggedIn || isLocalUserLoggedIn;
    
    let loggedInUsername = '';
    if (isFirebaseUserLoggedIn) {
      const emailPrefix = auth.currentUser.email.split('@')[0];
      loggedInUsername = emailPrefix.toLowerCase() === 'alessandro' ? 'Alessandro' : emailPrefix;
    } else if (isLocalUserLoggedIn) {
      loggedInUsername = JSON.parse(localStorage.getItem(USER_SESSION_KEY)).username;
    }

    if (viewName === 'form') {
      viewForm.classList.add('active');
      formPanel.style.display = 'block';
      successPanel.style.display = 'none';
      
      if (isLoggedIn) {
        userBadge.textContent = `Olá, ${loggedInUsername}`;
        userBadge.style.display = 'block';
        btnLogout.style.display = 'block';
        // Show button to go to dashboard
        btnBackToForm.textContent = 'Ver Dashboard';
        btnBackToForm.style.display = 'block';
      } else {
        btnSellerAccess.style.display = 'block';
      }
    } else if (viewName === 'login') {
      viewLogin.classList.add('active');
      btnBackToForm.textContent = 'Voltar para Simulação';
      btnBackToForm.style.display = 'block';
    } else if (viewName === 'dashboard') {
      if (!isLoggedIn) {
        showView('login');
        return;
      }
      userBadge.textContent = `Olá, ${loggedInUsername}`;
      userBadge.style.display = 'block';
      
      viewDashboard.classList.add('active');
      btnLogout.style.display = 'block';
      btnBackToForm.textContent = 'Nova Simulação';
      btnBackToForm.style.display = 'block';

      // Connect database listener
      if (unsubscribeDb) unsubscribeDb();
      unsubscribeDb = dbInterface.listenToProposals((proposals) => {
        activeProposals = proposals;
        renderDashboardList();
        if (currentProposalId) {
          renderProposalDetails(currentProposalId);
        }
      });
    }
  }

  // Header Nav Actions
  btnSellerAccess.addEventListener('click', () => showView('login'));
  btnBackToForm.addEventListener('click', () => {
    const isDashboardActive = viewDashboard.classList.contains('active');
    const isFirebaseUserLoggedIn = isFirebaseActive && auth && auth.currentUser;
    const isLocalUserLoggedIn = !isFirebaseActive && localStorage.getItem(USER_SESSION_KEY);
    const isLoggedIn = isFirebaseUserLoggedIn || isLocalUserLoggedIn;
    
    if (isDashboardActive || viewLogin.classList.contains('active')) {
      showView('form');
    } else if (isLoggedIn) {
      showView('dashboard');
    }
  });

  btnLogout.addEventListener('click', async () => {
    if (isFirebaseActive && auth) {
      try {
        await signOut(auth);
      } catch (err) {
        console.error("Erro no signOut do Firebase:", err);
      }
    }
    localStorage.removeItem(USER_SESSION_KEY);
    if (unsubscribeDb) {
      unsubscribeDb();
      unsubscribeDb = null;
    }
    showView('form');
    showToast('Sessão encerrada.', 'ℹ');
  });

  // Client Simulation Form Submit
  clientForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    let isFormValid = true;

    // Reset validations
    document.querySelectorAll('.validation-error').forEach(el => el.textContent = '');
    document.querySelectorAll('.form-input').forEach(el => el.classList.remove('invalid'));

    const fullName = document.getElementById('fullname').value.trim();
    if (!fullName || fullName.split(' ').length < 2) {
      setError('fullname', 'Por favor, insira o nome completo.');
      isFormValid = false;
    }

    const cpf = cpfInput.value;
    if (!cpf || !isValidCPF(cpf)) {
      setError('cpf', 'Por favor, insira um CPF válido.');
      isFormValid = false;
    }

    const birthDate = birthDateInput.value;
    if (!birthDate) {
      setError('birthdate', 'Data de nascimento é obrigatória.');
      isFormValid = false;
    } else if (getAge(birthDate) < 18) {
      setError('birthdate', 'O cliente deve ter mais de 18 anos.');
      isFormValid = false;
    }

    const phone = phoneInput.value.trim();
    const cleanPhone = phone.replace(/\D/g, '');
    if (!phone || cleanPhone.length < 10) {
      setError('phone', 'Insira um telefone válido.');
      isFormValid = false;
    }

    const cnhActive = document.getElementById('cnhActive').value;
    if (!cnhActive) {
      const errEl = document.querySelector('#cnh-group .validation-error');
      if (errEl) errEl.textContent = 'Selecione uma opção.';
      isFormValid = false;
    }

    const cleanName = document.getElementById('cleanName').value;
    if (!cleanName) {
      const errEl = document.querySelector('#clean-name-group .validation-error');
      if (errEl) errEl.textContent = 'Selecione uma opção.';
      isFormValid = false;
    }

    if (!isFormValid) {
      showToast('Preencha os campos em vermelho.', '✗');
      return;
    }

    const newProposal = {
      fullName,
      cpf,
      phone,
      birthDate,
      cnhActive,
      cleanName,
      status: 'pendente',
      date: new Date().toISOString()
    };

    // Save using database interface (Firebase or fallback LocalStorage)
    await dbInterface.saveProposal(newProposal);

    formPanel.style.display = 'none';
    successPanel.style.display = 'block';
    showToast('Simulação enviada!');
  });

  document.getElementById('btn-new-simulation').addEventListener('click', () => {
    clientForm.reset();
    document.querySelectorAll('.selection-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('cnhActive').value = '';
    document.getElementById('cleanName').value = '';
    showView('form');
  });

  // Seller Login Submit
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    // Checagem de Rate Limit / Bloqueio Ativo
    const now = Date.now();
    const lockoutUntil = parseInt(localStorage.getItem('login_lockout_until') || '0');
    if (lockoutUntil && now < lockoutUntil) {
      const secondsLeft = Math.ceil((lockoutUntil - now) / 1000);
      loginError.textContent = `Muitas tentativas incorretas. Login bloqueado temporariamente por mais ${secondsLeft} segundos.`;
      showToast('Login temporariamente bloqueado.', '✗');
      return;
    }

    function handleLoginFailure() {
      let attempts = parseInt(localStorage.getItem('login_failed_attempts') || '0');
      attempts++;
      
      if (attempts >= 3) {
        // Bloqueia por 60 segundos
        const blockUntil = Date.now() + 60000;
        localStorage.setItem('login_lockout_until', blockUntil.toString());
        localStorage.setItem('login_failed_attempts', '0');
        loginError.textContent = 'Muitas tentativas incorretas. Login bloqueado por 1 minuto.';
        showToast('Login bloqueado por 1 minuto.', '✗');
      } else {
        localStorage.setItem('login_failed_attempts', attempts.toString());
        loginError.textContent = `Usuário ou senha incorretos. Restam ${3 - attempts} tentativas.`;
        showToast('Credenciais incorretas.', '✗');
      }
    }

    function handleLoginSuccess() {
      // Limpa os estados de falha e bloqueio
      localStorage.removeItem('login_failed_attempts');
      localStorage.removeItem('login_lockout_until');
      loginError.textContent = '';
      showToast('Login realizado!');
      loginForm.reset();
      showView('dashboard');
    }

    if (isFirebaseActive && auth) {
      let email = username;
      if (!username.includes('@')) {
        email = `${username.toLowerCase()}@portalfinancie.com`;
      }
      
      try {
        loginError.textContent = '';
        showToast('Validando credenciais...', 'ℹ');
        await signInWithEmailAndPassword(auth, email, password);
        handleLoginSuccess();
      } catch (error) {
        console.error("Erro de Autenticação Firebase: ", error);
        handleLoginFailure();
      }
    } else {
      // Fallback local caso Firebase esteja inativo
      if (username.toLowerCase() === 'alessandro' && password === 'Slkt@2024') {
        handleLoginSuccess();
      } else {
        handleLoginFailure();
      }
    }
  });

  // Dashboard Sidebar Search
  searchInput.addEventListener('input', () => renderDashboardList());

  function renderDashboardList() {
    const queryStr = searchInput.value.toLowerCase().trim();
    submissionList.innerHTML = '';

    const filtered = activeProposals.filter(p => 
      p.fullName.toLowerCase().includes(queryStr) || p.cpf.includes(queryStr)
    );

    if (filtered.length === 0) {
      submissionList.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px; font-size: 0.9rem;">Nenhuma simulação encontrada</div>';
      return;
    }

    filtered.forEach(p => {
      const item = document.createElement('div');
      item.className = `list-item ${p.id === currentProposalId ? 'active' : ''}`;
      item.dataset.id = p.id;

      const dateObj = new Date(p.date);
      const formattedDate = dateObj.toLocaleDateString('pt-BR') + ' ' + dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      item.innerHTML = `
        <div class="list-item-header">
          <div class="list-item-name" title="${p.fullName}">${p.fullName}</div>
          <span class="badge badge-${p.status}">${p.status === 'pendente' ? 'Pendente' : p.status === 'aprovado' ? 'Aprovado' : 'Recusado'}</span>
        </div>
        <div class="list-item-meta">
          <span>CPF: ${p.cpf}</span>
          <span>${formattedDate}</span>
        </div>
      `;

      item.addEventListener('click', () => selectProposal(p.id));
      submissionList.appendChild(item);
    });
  }

  function selectProposal(id) {
    currentProposalId = id;
    document.querySelectorAll('.list-item').forEach(item => {
      item.classList.toggle('active', item.dataset.id === id);
    });
    renderProposalDetails(id);
  }

  function renderProposalDetails(id) {
    const proposal = activeProposals.find(p => p.id === id);
    if (!proposal) {
      detailEmpty.style.display = 'flex';
      detailPanel.style.display = 'none';
      return;
    }

    detailEmpty.style.display = 'none';
    detailPanel.style.display = 'flex';

    document.getElementById('detail-fullname').textContent = proposal.fullName;
    document.getElementById('detail-cpf').textContent = proposal.cpf;
    document.getElementById('detail-phone').textContent = proposal.phone || '---';

    const dateObj = new Date(proposal.birthDate);
    const formattedBirthDate = dateObj.toLocaleDateString('pt-BR');
    document.getElementById('detail-birthdate').textContent = `${formattedBirthDate} (${getAge(proposal.birthDate)} anos)`;
    
    document.getElementById('detail-cnh').textContent = proposal.cnhActive === 'sim' ? 'ATIVA' : 'INATIVA';
    document.getElementById('detail-clean-name').textContent = proposal.cleanName === 'sim' ? 'NOME LIMPO (SEM RESTRIÇÃO)' : 'COM RESTRIÇÃO NO CPF';

    const statusSelect = document.getElementById('detail-status-select');
    statusSelect.value = proposal.status;

    // Reset select listener by cloning
    const newSelect = statusSelect.cloneNode(true);
    statusSelect.parentNode.replaceChild(newSelect, statusSelect);
    newSelect.addEventListener('change', async (e) => {
      const newStatus = e.target.value;
      await dbInterface.updateProposalStatus(proposal.id, newStatus);
      showToast(`Status alterado!`);
    });

    // Copy text format
    const formattedText = getFormattedProposalText(proposal);
    const exportTextarea = document.getElementById('export-textarea');
    exportTextarea.value = formattedText;

    const copyBtn = document.getElementById('copy-details-btn');
    const newCopyBtn = copyBtn.cloneNode(true);
    copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);
    newCopyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(formattedText).then(() => {
        showToast('Respostas copiadas!');
      }).catch(() => {
        showToast('Erro ao copiar respostas.', '✗');
      });
    });
  }

  function getFormattedProposalText(p) {
    const ageVal = getAge(p.birthDate);
    return `PROPOSTA DE FINANCIAMENTO
----------------------------------
CLIENTE: ${p.fullName}
CPF: ${p.cpf}
TELEFONE: ${p.phone || 'NÃO INFORMADO'}
NASCIMENTO: ${p.birthDate} (IDADE: ${ageVal} ANOS)
CNH ATIVA: ${p.cnhActive.toUpperCase()}
NOME LIMPO: ${p.cleanName.toUpperCase()}`;
  }

  function setError(inputId, message) {
    const input = document.getElementById(inputId);
    input.classList.add('invalid');
    const container = input.closest('.form-group');
    const errSpan = container.querySelector('.validation-error');
    if (errSpan) errSpan.textContent = message;
  }

  // Set up Firebase Auth State Listener
  if (isFirebaseActive && auth) {
    onAuthStateChanged(auth, (user) => {
      console.log("🔒 Estado do Auth alterado:", user ? "Vendedor Logado" : "Deslogado");
      if (!user && viewDashboard.classList.contains('active')) {
        showView('form');
      } else {
        const currentView = viewDashboard.classList.contains('active') 
          ? 'dashboard' 
          : (viewLogin.classList.contains('active') ? 'login' : 'form');
        showView(currentView);
      }
    });
  } else {
    // Initial check for local session on load
    showView('form');
  }
});
