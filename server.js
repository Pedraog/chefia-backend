const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 🗄️ CONFIGURAÇÃO DA BASE DE DADOS
// Altera o utilizador, password ou base de dados se as tuas credenciais forem diferentes
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', 
    database: 'chefia' 
});

db.connect((err) => {
    if (err) {
        console.error('❌ Erro crítico ao ligar ao MySQL:', err);
        return;
    }
    console.log('✅ Ligado com sucesso à base de dados MySQL!');
});

// 💾 MEMÓRIA TEMPORÁRIA: Códigos de recuperação de password
const codigosRecuperacao = {}; 


// ==========================================
// 🔑 ROTAS DE AUTENTICAÇÃO (AUTH)
// ==========================================

// 📝 Registo de Utilizador
app.post('/registo', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ erro: 'Por favor, preenche todos os campos.' });

    db.query("SELECT * FROM utilizadores WHERE email = ?", [email], (err, results) => {
        if (err) return res.status(500).json({ erro: 'Erro ao verificar utilizador no banco.' });
        if (results.length > 0) return res.status(400).json({ erro: 'Este e-mail já se encontra registado.' });

        db.query("INSERT INTO utilizadores (email, password) VALUES (?, ?)", [email, password], (err) => {
            if (err) return res.status(500).json({ erro: 'Erro ao criar a conta no servidor.' });
            res.json({ mensagem: 'Conta criada com sucesso!' });
        });
    });
});

// 🔓 Iniciar Sessão (Login)
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    db.query("SELECT * FROM utilizadores WHERE email = ? AND password = ?", [email, password], (err, results) => {
        if (err) return res.status(500).json({ erro: 'Erro interno do servidor.' });
        if (results.length === 0) return res.status(401).json({ erro: 'E-mail ou palavra-passe incorretos.' });
        
        res.json({ utilizador: results[0].email });
    });
});

// ✉️ Pedir Código de Recuperação
app.post('/esqueci-senha', (req, res) => {
    const { email } = req.body;
    db.query("SELECT * FROM utilizadores WHERE email = ?", [email], (err, results) => {
        if (err) return res.status(500).json({ erro: 'Erro ao processar pedido.' });
        if (results.length === 0) return res.status(404).json({ erro: 'Este e-mail não está associado a nenhuma conta.' });

        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        codigosRecuperacao[email] = codigo;

        console.log(`\n🔑 [chefIA SECURITY] Código de recuperação para ${email}: ${codigo} \n`);
        res.json({ mensagem: 'Código de validação gerado! Consulta o terminal do teu Backend.' });
    });
});

// 🔄 Redefinir Palavra-passe
app.post('/redefinir-senha', (req, res) => {
    const { email, codigo, novaPassword } = req.body;
    if (codigosRecuperacao[email] !== codigo) {
        return res.status(400).json({ erro: 'O código inserido está incorreto ou expirou.' });
    }

    db.query("UPDATE utilizadores SET password = ? WHERE email = ?", [novaPassword, email], (err) => {
        if (err) return res.status(500).json({ erro: 'Erro ao atualizar a palavra-passe.' });
        delete codigosRecuperacao[email]; 
        res.json({ mensagem: 'Palavra-passe redefinida com sucesso!' });
    });
});


// ==========================================
// 🕒 ROTAS DO HISTÓRICO DE RECEITAS
// ==========================================

// 📥 Buscar Histórico (Afixados no topo, seguidos dos mais recentes)
app.get('/historico/:email', (req, res) => {
    const query = "SELECT * FROM historico WHERE email = ? ORDER BY fixado DESC, data_criacao DESC";
    db.query(query, [req.params.email], (err, results) => {
        if (err) {
            console.error('❌ Erro na query do histórico:', err);
            return res.status(500).json({ 
                erro: 'Erro ao carregar histórico.', 
                detalhe: 'Garante que correste o comando ALTER TABLE no teu MySQL para adicionar a coluna "fixado".' 
            });
        }
        res.json(results);
    });
});

// 💾 Guardar Nova Receita no Histórico
app.post('/historico', (req, res) => {
    const { email, ingredientes, receita } = req.body;
    const query = "INSERT INTO historico (email, ingredientes, receita, fixado) VALUES (?, ?, ?, 0)";
    
    db.query(query, [email, ingredientes, receita], (err, result) => {
        if (err) return res.status(500).json({ erro: 'Erro ao guardar a receita no histórico.' });
        res.json({ mensagem: 'Receita armazenada com sucesso!', id: result.insertId });
    });
});

// 📌 Alternar Estado de Afixação (Pin / Unpin)
app.put('/historico/fixar/:id', (req, res) => {
    const { fixado } = req.body; // Espera receber 1 ou 0
    const query = "UPDATE historico SET fixado = ? WHERE id = ?";
    
    db.query(query, [fixado, req.params.id], (err) => {
        if (err) return res.status(500).json({ erro: 'Erro ao alterar o estado de afixação da receita.' });
        res.json({ mensagem: 'Estado de afixação atualizado com sucesso!' });
    });
});


// ==========================================
// 🌍 ROTA PÚBLICA DE PARTILHA
// ==========================================

// 👀 Ver Receita Partilhada de forma anónima (Sem exigir Login)
app.get('/publico/receita/:id', (req, res) => {
    const query = "SELECT ingredientes, receita, data_criacao FROM historico WHERE id = ?";
    db.query(query, [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ erro: 'Erro ao obter receita pública.' });
        if (results.length === 0) return res.status(404).json({ erro: 'A receita pretendida não existe ou foi eliminada.' });
        res.json(results[0]);
    });
});


// ==========================================
// 🚀 INICIALIZAÇÃO DO SERVIDOR
// ==========================================
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`🚀 Servidor do chefIA totalmente operacional na porta ${PORT}`);
});