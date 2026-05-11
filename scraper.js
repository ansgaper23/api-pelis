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

function obtenerNombreServidor(urlTexto) {
    try {
        const urlObj = new URL(urlTexto);
        const partes = urlObj.hostname.split('.');
        const nombreBase = partes.length >= 2 ? partes[partes.length - 2] : partes[0];
        return formatearTexto(nombreBase);
    } catch (e) {
        return "Servidor Web";
    }
}

async function procesarPeliculas() {
    console.log("--- INICIANDO EXTRACCIÓN TOTAL DE PELÍCULAS ---");
    
    const res = await fetch(`${BASE_URL}&action=get_vod_streams`, opcionesFetch);
    const data = JSON.parse(await res.text());
    const catalogoCompleto = [];

    console.log(`Encontradas ${data.length} películas en el proveedor. Procesando todas...`);

    for (let i = 0; i < data.length; i++) {
        const p = data[i];

        try {
            const urlPelicula = `${BASE_URL}&action=get_vod_links&vod_id=${p.stream_id}`;
            const resLinks = await fetch(urlPelicula, opcionesFetch);
            
            if (!resLinks.ok) continue;

            const textoRespuesta = await resLinks.text();
            let links;
            try {
                links = JSON.parse(textoRespuesta);
            } catch (errParse) {
                continue;
            }
            
            const servidores = [];
            const listaLinks = Array.isArray(links) ? links : Object.values(links || {});

            for (const item of listaLinks) {
                if (!item || typeof item !== 'object') continue;
                const url = item.url;
                
                if (typeof url === 'string') {
                    const urlMin = url.toLowerCase();
                    // FILTRO DE LISTA NEGRA
                    if (!urlMin.includes('do7go') && !urlMin.includes('josephseveralconcern')) {
                        servidores.push({
                            nombre: obtenerNombreServidor(url),
                            url: url,
                            calidad: item.quality || "HD",
                            idioma: formatearTexto(item.language)
                        });
                    }
                }
            }

            if (servidores.length > 0) {
                catalogoCompleto.push({
                    id: p.stream_id,
                    nombre: p.name,
                    poster: p.stream_icon,
                    banner: p.backdrop_path ? p.backdrop_path[0] : p.stream_icon,
                    rating: p.rating,
                    año: p.year,
                    servidores: servidores
                });
            }
        } catch (e) {
             // Silenciar errores para no saturar consola en procesamiento masivo
        }
        
        if (catalogoCompleto.length % 500 === 0 && catalogoCompleto.length !== 0) {
            console.log(`Procesadas ${catalogoCompleto.length} películas con links válidos...`);
        }
        await delay(50); // Reducido ligeramente porque procesar todo tomará tiempo
    }
    
    return catalogoCompleto;
}

async function procesarSeries() {
    console.log("\n--- INICIANDO EXTRACCIÓN TOTAL DE SERIES ---");
    
    const res = await fetch(`${BASE_URL}&action=get_series`, opcionesFetch);
    const data = JSON.parse(await res.text());
    const catalogoCompleto = [];

    console.log(`Encontradas ${data.length} series en el proveedor. Procesando todas...`);

    for (let i = 0; i < data.length; i++) {
        const s = data[i];

        try {
            const resInfo = await fetch(`${BASE_URL}&action=get_series_info&series_id=${s.series_id}`, opcionesFetch);
            if (!resInfo.ok) continue;

            const serieData = await resInfo.json();
            const episodiosData = serieData.episodes; 

            if (!episodiosData || typeof episodiosData !== 'object') continue;

            const temporadasValidas = [];

            for (const numTemporada in episodiosData) {
                const capitulosOriginales = episodiosData[numTemporada];
                const capitulosValidos = [];

                for (const cap of capitulosOriginales) {
                    try {
                        const epUrl = `${BASE_URL}&action=get_episode_links&serie=${s.series_id}&season=${numTemporada}&episode=${cap.episode_num}`;
                        const resLinks = await fetch(epUrl, opcionesFetch);
                        if (!resLinks.ok) continue;

                        const textoRespuesta = await resLinks.text();
                        let links;
                        try {
                            links = JSON.parse(textoRespuesta);
                        } catch (errParse) { continue; }

                        const servidores = [];
                        const listaLinks = Array.isArray(links) ? links : Object.values(links || {});

                        for (const item of listaLinks) {
                            if (!item || typeof item !== 'object') continue;
                            const url = item.url;
                            if (typeof url === 'string') {
                                const urlMin = url.toLowerCase();
                                if (!urlMin.includes('do7go') && !urlMin.includes('josephseveralconcern')) {
                                    servidores.push({
                                        nombre: obtenerNombreServidor(url),
                                        url: url,
                                        calidad: item.quality || "HD",
                                        idioma: formatearTexto(item.language)
                                    });
                                }
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
                    } catch (e) {}
                    await delay(50); 
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
                
                catalogoCompleto.push({
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
        
        if (catalogoCompleto.length % 100 === 0 && catalogoCompleto.length !== 0) {
            console.log(`Procesadas ${catalogoCompleto.length} series con links válidos...`);
        }
        await delay(50); 
    }
    
    return catalogoCompleto;
}

async function iniciar() {
    try {
        const todasPelis = await procesarPeliculas();
        fs.writeFileSync('peliculas.json', JSON.stringify(todasPelis, null, 2));
        console.log(`✅ ¡Proceso de películas terminado! Total guardado: ${todasPelis.length}`);

        console.log("\n-----------------------------------\n");

        const todasSeries = await procesarSeries();
        fs.writeFileSync('series.json', JSON.stringify(todasSeries, null, 2));
        console.log(`✅ ¡Proceso de series terminado! Total guardado: ${todasSeries.length}`);

        console.log("\n🚀 Sincronización completa.");
    } catch (error) {
        console.error("❌ Error general:", error.message);
        process.exit(1); 
    }
}

iniciar();
