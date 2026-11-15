require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json({ limit: '5mb' }));

app.use('/api', routes);

// Manejador global de errores (incluye errores de Multer)
app.use((err, _req, res, _next) => {
  console.error('Error no controlado:', err);
  res.status(400).json({ error: err.message || 'Error en la solicitud.' });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor Arena Canta Callao corriendo en http://localhost:${PORT}`);
});
