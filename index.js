import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import cron from 'node-cron';

const app = express();
const PORT = process.env.PORT || 8080;

// Habilitar CORS para que Lovable pueda leer los datos sin bloqueos
app.use(cors());

const CREDENTIALS = "?username=m&password=m";
const BASE_URL = `http://tv.m3uts.xyz/player_api.php${CREDENTIALS}`;

// Aquí guardaremos los datos en la memoria RAM ultra rápida del servidor
let cachePeliculas = [];
let cacheSeries = [];
let ultimaActualizacion = "Nunca";

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function actualizarDatos() {
    console.log("Iniciando escaneo silencioso en segundo plano...");
    try {
        // --- 1. PROCESAR PELÍCULAS ---
        const resPeliculas = await fetch(`${BASE_URL}&action=get_vod_streams`);
        const peliculasRaw = await resPeliculas.json();
        const peliculasFiltradas = [];

        console.log(`Se encontraron ${peliculasRaw.length} películas. Filtrando servidores...`);
        
        for (let i = 0; i < peliculasRaw.length; i++) {
            const p = peliculasRaw[i];
            const resLinks = await fetch(`${BASE_URL}&action=get_vod_links&vod_id=${p.stream_id}`);
            const linksData = await resLinks.json();
            
            const servidoresValidos = [];
            if (linksData && typeof linksData === 'object') {
                for (const key in linksData) {
                    const urlServidor = linksData[key].url || linksData[key] || "";
                    if (typeof urlServidor === 'string' && (urlServidor.includes('vidhide') || urlServidor.includes('streamwish'))) {
                        servidoresValidos.push(urlServidor);
                    }
                }
            }

            if (servidoresValidos.length > 0) {
                peliculasFiltradas.push({
                    id: p.stream_id,
                    nombre: p.name,
                    imagen: p.stream_icon,
                    servidores: servidoresValidos
                });
            }

            await delay(50); // Pausa pequeñita para no tumbar la API original
        }

        // Actualizar la RAM con los nuevos datos limpios
        cachePeliculas = peliculasFiltradas;
        ultimaActualizacion = new Date().toLocaleString();
        console.log(`¡Películas actualizadas! Total filtradas: ${cachePeliculas.length}`);

        // --- NOTA: Aquí puedes agregar el mismo ciclo pero para series (action=get_series) ---

    } catch (error) {
        console.error("Error al actualizar datos:", error);
    }
}

// ==========================================
// RUTAS DE TU NUEVA API (Para usar en Lovable)
// ==========================================

app.get('/', (req, res) => {
    res.json({ mensaje: "API Perucho TV funcionando", ultimaActualizacion, peliculasDisponibles: cachePeliculas.length });
});

app.get('/peliculas', (req, res) => {
    res.json(cachePeliculas); // Esto responde en MILISEGUNDOS
});

app.get('/series', (req, res) => {
    res.json(cacheSeries);
});

// Arrancar el servidor
app.listen(PORT, () => {
    console.log(`Servidor volando en el puerto ${PORT}`);
    // Ejecutar la actualización nada más prender el servidor (sin esperar a que alguien lo pida)
    actualizarDatos();
});

// Programar la actualización automática todos los días a las 4:00 AM
cron.schedule('0 4 * * *', () => {
    console.log("Ejecutando actualización diaria programada...");
    actualizarDatos();
});