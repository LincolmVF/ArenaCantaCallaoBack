require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origen no permitido por CORS: ${origin}`));
    },
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor Arena Canta Callao corriendo en http://0.0.0.0:${PORT}`);
});
