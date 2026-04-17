import fetch from 'node-fetch';
import fs from 'fs';

const CREDENTIALS = "?username=m&password=m";
const BASE_URL = `http://tv.m3uts.xyz/player_api.php${CREDENTIALS}`;

// EL TRUCO: Nos disfrazamos del celular Android que nos indicaste
const opcionesFetch = {
    headers: {
        "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 16; 24090RA29G Build/BP2A.250605.031.A3)",
        "Accept-Encoding": "gzip",
        "Connection": "Keep-Alive"
    }
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function generarJSON() {
    console.log("Iniciando extracción de datos con disfraz de Android...");
    try {
        console.log("Descargando lista de películas...");
        // Agregamos las opcionesFetch a la petición principal
        const resPeliculas = await fetch(`${BASE_URL}&action=get_vod_streams`, opcionesFetch);

        const textPeliculas = await resPeliculas.text();
        
        // Verificamos si el servidor nos bloqueó a pesar del disfraz
        if(!textPeliculas.startsWith('[') && !textPeliculas.startsWith('{')) {
             throw new Error(`El servidor bloqueó la IP. Respuesta recibida: ${textPeliculas.substring(0, 100)}...`);
        }

        const peliculasRaw = JSON.parse(textPeliculas);
        const peliculasFiltradas = [];

        console.log(`Analizando ${peliculasRaw.length} películas...`);
        
        for (let i = 0; i < peliculasRaw.length; i++) {
            const p = peliculasRaw[i];
            
            try {
                // Agregamos las opcionesFetch a la petición individual
                const resLinks = await fetch(`${BASE_URL}&action=get_vod_links&vod_id=${p.stream_id}`, opcionesFetch);
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
            } catch (err) {
                // Si falla una película individual, no detenemos todo, solo avisamos
            }

            await delay(50);
            if (i % 500 === 0 && i !== 0) console.log(`Procesadas ${i} películas...`);
        }

        fs.writeFileSync('peliculas.json', JSON.stringify(peliculasFiltradas, null, 2));
        console.log(`¡Éxito! Se guardaron ${peliculasFiltradas.length} películas en peliculas.json`);

        fs.writeFileSync('series.json', JSON.stringify([], null, 2));

    } catch (error) {
        console.error("Error crítico:", error.message);
        process.exit(1); 
    }
}

generarJSON();
