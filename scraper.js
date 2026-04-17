import fetch from 'node-fetch';
import fs from 'fs';

const CREDENTIALS = "?username=m&password=m";
const BASE_URL = `http://tv.m3uts.xyz/player_api.php${CREDENTIALS}`;

const opcionesFetch = {
    headers: {
        "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 16; 24090RA29G Build/BP2A.250605.031.A3)",
        "Accept-Encoding": "gzip",
        "Connection": "Keep-Alive"
    }
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function detectarIdioma(nombre) {
    const n = nombre.toLowerCase();
    if (n.includes('latino') || n.includes('lat')) return 'Latino';
    if (n.includes('castellano') || n.includes('españa') || n.includes('spa')) return 'Castellano';
    if (n.includes('sub') || n.includes('vose')) return 'Subtitulado';
    if (n.includes('ing') || n.includes('eng')) return 'Inglés';
    return 'Desconocido';
}

async function procesarPeliculas() {
    console.log("--- INICIANDO PELÍCULAS ---");
    const res = await fetch(`${BASE_URL}&action=get_vod_streams`, opcionesFetch);
    const data = JSON.parse(await res.text());
    const filtradas = [];

    console.log(`Se encontraron ${data.length} películas. Analizando enlaces...`);

    for (let i = 0; i < data.length; i++) {
        const p = data[i];
        try {
            const resLinks = await fetch(`${BASE_URL}&action=get_vod_links&vod_id=${p.stream_id}`, opcionesFetch);
            const links = await resLinks.json();
            
            const servidores = [];
            if (links && typeof links === 'object') {
                for (const key in links) {
                    const item = links[key];
                    const url = item.url || item;
                    const nombreServidor = item.name || "Servidor";

                    if (typeof url === 'string' && (url.includes('vidhide') || url.includes('streamwish'))) {
                        servidores.push({
                            nombre: nombreServidor,
                            url: url,
                            idioma: detectarIdioma(nombreServidor)
                        });
                    }
                }
            }

            if (servidores.length > 0) {
                filtradas.push({
                    id: p.stream_id,
                    nombre: p.name,
                    poster: p.stream_icon,
                    banner: p.backdrop_path ? p.backdrop_path[0] : p.stream_icon,
                    rating: p.rating,
                    año: p.year,
                    servidores: servidores
                });
            }
        } catch (e) {}
        if (i % 500 === 0 && i !== 0) console.log(`Películas analizadas: ${i}/${data.length}`);
        await delay(30);
    }
    return filtradas;
}

async function procesarSeries() {
    console.log("--- INICIANDO SERIES ---");
    const res = await fetch(`${BASE_URL}&action=get_series`, opcionesFetch);
    const data = JSON.parse(await res.text());
    const filtradas = [];

    console.log(`Se encontraron ${data.length} series. Analizando temporadas y capítulos...`);

    for (let i = 0; i < data.length; i++) {
        const s = data[i];
        try {
            // 1. Pedir información completa de la serie (incluye temporadas)
            const resInfo = await fetch(`${BASE_URL}&action=get_series_info&series_id=${s.series_id}`, opcionesFetch);
            const serieData = await resInfo.json();
            const episodiosData = serieData.episodes; // Objeto con temporadas

            if (!episodiosData || typeof episodiosData !== 'object') continue;

            const temporadasValidas = [];

            // 2. Recorrer cada temporada
            for (const numTemporada in episodiosData) {
                const capitulosOriginales = episodiosData[numTemporada];
                const capitulosValidos = [];

                // 3. Recorrer cada capítulo de la temporada
                for (const cap of capitulosOriginales) {
                    const capId = cap.id;
                    
                    // 4. Pedir los enlaces (servidores) de este capítulo específico
                    const resLinks = await fetch(`${BASE_URL}&action=get_vod_links&vod_id=${capId}`, opcionesFetch);
                    const links = await resLinks.json();

                    const servidores = [];
                    if (links && typeof links === 'object') {
                        for (const key in links) {
                            const item = links[key];
                            const url = item.url || item;
                            const nombreServidor = item.name || "Servidor";

                            if (typeof url === 'string' && (url.includes('vidhide') || url.includes('streamwish'))) {
                                servidores.push({
                                    nombre: nombreServidor,
                                    url: url,
                                    idioma: detectarIdioma(nombreServidor)
                                });
                            }
                        }
                    }

                    // Si el capítulo tiene los servidores correctos, lo guardamos
                    if (servidores.length > 0) {
                        capitulosValidos.push({
                            id: capId,
                            numero: cap.episode_num || cap.title || "0",
                            titulo: cap.info?.name || cap.title || `Capítulo ${cap.episode_num}`,
                            servidores: servidores
                        });
                    }
                    await delay(20); // Pausa pequeñita entre capítulos
                }

                // Si la temporada tiene capítulos con enlaces válidos, la guardamos
                if (capitulosValidos.length > 0) {
                    temporadasValidas.push({
                        numero: numTemporada,
                        capitulos: capitulosValidos
                    });
                }
            }

            // 5. Finalmente, si la serie tiene temporadas válidas, guardamos la serie entera
            if (temporadasValidas.length > 0) {
                const info = serieData.info || {};
                let banner = info.backdrop_path ? info.backdrop_path[0] : (s.backdrop_path ? s.backdrop_path[0] : null);
                
                filtradas.push({
                    id: s.series_id,
                    nombre: s.name,
                    poster: info.cover || s.cover,
                    banner: banner || info.cover || s.cover,
                    rating: info.rating || s.rating,
                    año: info.releaseDate || s.releaseDate,
                    temporadas: temporadasValidas
                });
            }

        } catch (e) {}
        
        if (i % 100 === 0 && i !== 0) console.log(`Series analizadas: ${i}/${data.length}`);
        await delay(30); // Pausa entre series
    }
    return filtradas;
}

async function iniciar() {
    try {
        const peliculas = await procesarPeliculas();
        fs.writeFileSync('peliculas.json', JSON.stringify(peliculas, null, 2));
        console.log(`✅ ¡Películas guardadas! Total filtradas: ${peliculas.length}`);

        const series = await procesarSeries();
        fs.writeFileSync('series.json', JSON.stringify(series, null, 2));
        console.log(`✅ ¡Series guardadas! Total filtradas: ${series.length}`);

        console.log("🚀 Sincronización completada con éxito.");
    } catch (error) {
        console.error("❌ Error crítico en el script:", error.message);
        process.exit(1); 
    }
}

iniciar();
