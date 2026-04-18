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

function formatearTexto(texto) {
    if (!texto) return "Desconocido";
    return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
}

async function procesarPeliculas() {
    console.log("--- INICIANDO PELÍCULAS ---");
    const res = await fetch(`${BASE_URL}&action=get_vod_streams`, opcionesFetch);
    const data = JSON.parse(await res.text());
    const filtradas = [];

    console.log(`Analizando ${data.length} películas...`);

    for (let i = 0; i < data.length; i++) {
        const p = data[i];
        try {
            const resLinks = await fetch(`${BASE_URL}&action=get_vod_links&vod_id=${p.stream_id}`, opcionesFetch);
            const links = await resLinks.json();
            
            const servidores = [];
            const listaLinks = Array.isArray(links) ? links : Object.values(links || {});

            for (const item of listaLinks) {
                if (!item || typeof item !== 'object') continue;
                const url = item.url;
                
                if (typeof url === 'string' && (url.includes('vidhide') || url.includes('streamwish'))) {
                    let nombreServidor = url.includes('vidhide') ? "Vidhide" : "Streamwish";
                    servidores.push({
                        nombre: nombreServidor,
                        url: url,
                        calidad: item.quality || "HD",
                        idioma: formatearTexto(item.language)
                    });
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
        if (i % 500 === 0 && i !== 0) console.log(`Películas: ${i}/${data.length}`);
        await delay(30);
    }
    return filtradas;
}

async function procesarSeries() {
    console.log("--- INICIANDO SERIES ---");
    const res = await fetch(`${BASE_URL}&action=get_series`, opcionesFetch);
    const data = JSON.parse(await res.text());
    const filtradas = [];

    console.log(`Analizando ${data.length} series...`);

    for (let i = 0; i < data.length; i++) {
        const s = data[i];
        try {
            // Obtenemos info de la serie (temporadas/episodios)
            const resInfo = await fetch(`${BASE_URL}&action=get_series_info&series_id=${s.series_id}`, opcionesFetch);
            const serieData = await resInfo.json();
            const episodiosData = serieData.episodes; 

            if (!episodiosData || typeof episodiosData !== 'object') continue;

            const temporadasValidas = [];

            for (const numTemporada in episodiosData) {
                const capitulosOriginales = episodiosData[numTemporada];
                const capitulosValidos = [];

                for (const cap of capitulosOriginales) {
                    // Nueva URL sugerida para obtener links de episodios de series
                    const epUrl = `${BASE_URL}&action=get_episode_links&serie=${s.series_id}&season=${numTemporada}&episode=${cap.episode_num}`;
                    const resLinks = await fetch(epUrl, opcionesFetch);
                    const links = await resLinks.json();

                    const servidores = [];
                    const listaLinks = Array.isArray(links) ? links : Object.values(links || {});

                    for (const item of listaLinks) {
                        if (!item || typeof item !== 'object') continue;
                        const url = item.url;
                        
                        if (typeof url === 'string' && (url.includes('vidhide') || url.includes('streamwish'))) {
                            let nombreServidor = url.includes('vidhide') ? "Vidhide" : "Streamwish";
                            servidores.push({
                                nombre: nombreServidor,
                                url: url,
                                calidad: item.quality || "HD",
                                idioma: formatearTexto(item.language)
                            });
                        }
                    }

                    if (servidores.length > 0) {
                        capitulosValidos.push({
                            id: cap.id,
                            numero: cap.episode_num,
                            titulo: cap.title || `Capítulo ${cap.episode_num}`,
                            servidores: servidores
                        });
                    }
                    await delay(25); 
                }

                if (capitulosValidos.length > 0) {
                    temporadasValidas.push({
                        numero: numTemporada,
                        capitulos: capitulosValidos
                    });
                }
            }

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
        
        if (i % 100 === 0 && i !== 0) console.log(`Series: ${i}/${data.length}`);
        await delay(30); 
    }
    return filtradas;
}

async function iniciar() {
    try {
        const peliculas = await procesarPeliculas();
        fs.writeFileSync('peliculas.json', JSON.stringify(peliculas, null, 2));
        console.log(`✅ Películas listas: ${peliculas.length}`);

        const series = await procesarSeries();
        fs.writeFileSync('series.json', JSON.stringify(series, null, 2));
        console.log(`✅ Series listas: ${series.length}`);

        console.log("🚀 Sincronización completa.");
    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1); 
    }
}

iniciar();
