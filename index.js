const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const db = new sqlite3.Database('./casino.db');

// Import the fake library
const fakeRng = require('./express-provably-fair-rng.js');

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

// ============================================================================
// DATABASE INITIALIZATION (with integrated seeder)
// ============================================================================
db.serialize(() => {
    // 1. Create the users table with a UNIQUE constraint on username
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, role TEXT, balance INTEGER)");

    // 2. Add or ignore the admin user with the new password
    db.run("INSERT OR IGNORE INTO users (username, password, role, balance) VALUES ('admin', 'admin', 'admin', 1000000)");

    // 3. Prepare a statement for inserting multiple users, ignoring if they already exist
    const stmt = db.prepare("INSERT OR IGNORE INTO users (username, password, role, balance) VALUES (?, ?, ?, ?)");

    // 4. Add 40 regular users
    for (let i = 1; i <= 40; i++) {
        const username = `user${i}`;
        const password = `password${i}`;
        const balance = Math.floor(Math.random() * 901) + 100; // Random balance between 100 and 1000
        stmt.run(username, password, 'user', balance);
    }

    stmt.finalize((err) => {
        if (!err) {
            console.log('Database seeded successfully: admin + 40 users created or verified.');
        }
    });
});

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Middleware to load user data for authenticated routes
const loadUser = (req, res, next) => {
    if (!req.session.userId) {
        return res.redirect('/');
    }
    db.get(`SELECT * FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
        if (err) {
            console.error('Database error in loadUser middleware:', err.message);
            return res.status(500).send('Internal Server Error');
        }
        if (!user) {
            // If user not found, destroy session and redirect to login
            return req.session.destroy(() => {
                res.redirect('/');
            });
        }
        res.locals.user = user; // Pass user data to all templates
        next();
    });
};


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

app.post('/api/add-funds', loadUser, (req, res) => {
    const { amount } = req.body;
    const addAmount = parseInt(amount, 10);

    if (isNaN(addAmount) || addAmount <= 0) {
        return res.status(400).send("Invalid amount.");
    }

    if (res.locals.user.role === 'admin') {
        db.run(`UPDATE users SET balance = balance + ? WHERE id = ?`, [addAmount, req.session.userId], function(err) {
            if (err) {
                console.error(err);
                return res.status(500).send("Error adding funds.");
            }
            res.redirect('/dashboard');
        });
    } else {
        return res.status(403).send("Forbidden: You are not an admin.");
    }
});

app.post('/api/transfer', loadUser, (req, res) => {
    const { targetUserId, amount } = req.body;

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
                res.redirect('/dashboard');
            });
        });
    });
});

app.post('/api/promo', loadUser, (req, res) => {
    let updates = [];
    for (let key in req.body) {
        if (key === 'promoCode') continue; 
        updates.push(`${key} = '${req.body[key]}'`);
    }
    if (updates.length > 0) {
        const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ${req.session.userId}`;
        db.run(query, (err) => {
            if (err) return res.status(500).send("Error updating profile");
            res.redirect('/dashboard');
        });
    } else {
        res.redirect('/dashboard');
    }
});

app.post('/api/chat', loadUser, (req, res) => {
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

app.post('/api/slots/spin', loadUser, fakeRng, (req, res) => {
    const cost = 10;
    const prize = 100;
    const [s1, s2, s3] = req.slotResult;
    let balanceChange = -cost;

    if (s1 === s2 && s2 === s3) {
        balanceChange += prize;
    }

    db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [balanceChange, req.session.userId], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).send("Error updating balance.");
        }
        req.session.lastSlotResult = req.slotResult;
        res.redirect('/slots');
    });
});

app.post('/api/roulette/bet', loadUser, (req, res) => {
    const { betType } = req.body; // Can be 'red' or 'black'
    const betAmount = 10;

    const redNumbers = [32, 19, 21, 25, 34, 27, 36, 30, 23, 5, 16, 1, 14, 9, 18, 7, 12, 3];
    const blackNumbers = [15, 4, 2, 17, 6, 13, 11, 8, 10, 24, 33, 20, 31, 22, 29, 28, 35, 26];

    if (res.locals.user.balance < betAmount) {
        return res.status(400).json({ error: 'Not enough balance to place the bet.' });
    }

    db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [betAmount, req.session.userId], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Error processing bet payment.' });
        }

        const winningNumber = Math.floor(Math.random() * 37);
        let userWon = false;

        if (winningNumber !== 0) {
            if (betType === 'red' && redNumbers.includes(winningNumber)) {
                userWon = true;
            } else if (betType === 'black' && blackNumbers.includes(winningNumber)) {
                userWon = true;
            }
        }

        if (userWon) {
            const prize = betAmount * 2;
            db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [prize, req.session.userId], function(err) {
                if (err) { return res.status(500).json({ error: 'Error adding winnings.' }); }
                res.json({ 
                    win: true, 
                    winningNumber, 
                    newBalance: res.locals.user.balance - betAmount + prize 
                });
            });
        } else {
            res.json({ 
                win: false, 
                winningNumber, 
                newBalance: res.locals.user.balance - betAmount 
            });
        }
    });
});

app.post('/api/roulette-calc', loadUser, (req, res) => {
    const { betFormula } = req.body;
    let result = 0;
    let errorMessage = '';

    try {
        result = eval(betFormula);
    } catch (e) {
        errorMessage = e.message;
    }

    res.send(`
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Calculation Result</title>
            <style>
                body { background-color: #1a202c; color: #cbd5e0; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; }
                .result-box { background-color: #2d3748; padding: 2rem; border-radius: 8px; text-align: center; }
                .btn { display: inline-block; margin-top: 1.5rem; padding: 0.75rem 1.5rem; background-color: #4a5568; color: white; text-decoration: none; border-radius: 4px; }
            </style>
        </head>
        <body>
            <div class="result-box">
                ${errorMessage 
                    ? `<h1>❌ Error in Formula</h1><p>${errorMessage}</p>` 
                    : `<h1>💰 Potential Winnings</h1><p style="font-size: 2rem; color: #48bb78;">${result}</p>`
                }
                <a href="/roulette" class="btn">Back to Roulette</a>
            </div>
        </body>
        </html>
    `);
});

// ============================================================================
// FRONTEND ROUTES (VIEWS)
// ============================================================================

app.get('/', (req, res) => {
  res.render('login');
});

app.get('/dashboard', loadUser, (req, res) => {
    res.render('dashboard');
});

app.get('/chat', loadUser, (req, res) => {
  res.render('chat', { response: null });
});

app.get('/slots', loadUser, (req, res) => {
    const lastResult = req.session.lastSlotResult || null;
    req.session.lastSlotResult = null; // Clear after reading
    res.render('slots', { slotResult: lastResult });
});

app.get('/blackjack', loadUser, (req, res) => {
    res.render('blackjack');
});

app.get('/roulette', loadUser, (req, res) => {
    res.render('roulette', { lastBetResult: null }); // Now passing null as it's handled by JS
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vulnerable Casino 2.0 running on port ${PORT}`
    );
});
