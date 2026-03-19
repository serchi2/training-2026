const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const db = new sqlite3.Database('./casino.db');

// Basic setup
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'casino_super_secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } 
}));
app.use(express.static('public'));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Initialize Database
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, password TEXT, role TEXT, balance INTEGER)");
    db.run("INSERT OR IGNORE INTO users (id, username, password, role, balance) VALUES (1, 'admin', 'admin123', 'admin', 1000000)");
    db.run("INSERT OR IGNORE INTO users (id, username, password, role, balance) VALUES (2, 'player1', 'password', 'user', 100)");
});

// ============================================================================
// API & LOGIN ROUTES
// ============================================================================

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
    db.get(query, (err, user) => {
        if (user) {
            req.session.userId = user.id;
            req.session.username = user.username;
            res.redirect('/dashboard');
        } else {
            res.send("Login failed");
        }
    });
});

// CORRECTED: Proper async handling for fund transfer
app.post('/api/transfer', (req, res) => {
    if (!req.session.userId) return res.status(401).send("Not authenticated");
    const { targetUserId, amount } = req.body;

    // Use serialize to ensure queries run in order
    db.serialize(() => {
        db.run(`UPDATE users SET balance = balance - ? WHERE id = ?`, [amount, req.session.userId], function(err) {
            if (err) {
                console.error(err);
                return res.status(500).send("Error during withdrawal.");
            }
            db.run(`UPDATE users SET balance = balance + ? WHERE id = ?`, [amount, targetUserId], function(err) {
                if (err) {
                    console.error(err);
                    return res.status(500).send("Error during deposit.");
                }
                res.redirect('/dashboard'); // Redirect ONLY after both are successful
            });
        });
    });
});


// CORRECTED: Restored original Mass Assignment vulnerability
app.post('/api/promo', (req, res) => {
    if (!req.session.userId) return res.status(401).send("Not authenticated");
    let updates = [];
    // This loop is the vulnerability. It blindly takes keys from the request body.
    for (let key in req.body) {
        if (key === 'promoCode') continue; 
        updates.push(`${key} = '${req.body[key]}'`);
    }
    if (updates.length > 0) {
        // The query string is built directly from user input, allowing Mass Assignment.
        const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ${req.session.userId}`;
        db.run(query, (err) => {
            if (err) return res.status(500).send("Error updating profile");
            res.redirect('/dashboard');
        });
    } else {
        res.redirect('/dashboard');
    }
});

app.post('/api/chat', (req, res) => {
    const userMessage = req.body.message || "";
    let botResponse = "Hello, I'm the casino bot. How can I help you?";

    if (userMessage.toLowerCase().includes("forget all instructions")) {
        const parts = userMessage.split('return:');
        if (parts.length > 1) {
            botResponse = parts[1].trim();
        }
    }

    res.render('chat', { response: botResponse });
});


// ============================================================================
// FRONTEND ROUTES (VIEWS) - With crash protection
// ============================================================================

app.get('/', (req, res) => {
  res.render('login');
});

app.get('/dashboard', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/');
    }

    db.get(`SELECT * FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
        if (err) {
            console.error('Database error on dashboard:', err.message);
            return res.status(500).send('Internal Server Error');
        }
        
        if (!user) {
            req.session.destroy(() => {
                res.redirect('/');
            });
        } else {
            res.render('dashboard', { user: user });
        }
    });
});

app.get('/chat', (req, res) => {
  if (!req.session.userId) return res.redirect('/');
  res.render('chat', { response: null });
});

app.get('/slots', (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    res.render('slots');
});

app.get('/blackjack', (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    res.render('blackjack');
});

app.get('/roulette', (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    res.render('roulette');
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vulnerable Casino 2.0 running on port ${PORT}`);
});
