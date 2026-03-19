const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./casino.db');

db.serialize(() => {
  // Sentencia corregida para coincidir con el esquema de la tabla 'users'
  const stmt = db.prepare("INSERT INTO users (username, password, role, balance) VALUES (?, ?, ?, ?)");

  for (let i = 1; i <= 40; i++) {
    const userNumber = i.toString().padStart(2, '0');
    const username = `user${userNumber}`;
    const password = `pass${userNumber}`;
    const role = 'user'; // Rol asignado a los usuarios generados
    const balance = Math.floor(Math.random() * 9000) + 1000; // Saldo aleatorio entre 1000 y 10000

    stmt.run(username, password, role, balance);
  }

  stmt.finalize();

  console.log('40 nuevos usuarios se han añadido correctamente a la base de datos.');
});

db.close();
