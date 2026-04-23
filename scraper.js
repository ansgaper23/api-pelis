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

// NUEVA FUNCIÓN: Lee el archivo JSON si existe, o devuelve un array vacío si es la primera vez
function cargarCatalogoExistente(rutaArchivo) {
    if (fs.existsSync(rutaArchivo)) {
        try {
            return JSON.parse(fs.readFileSync(rutaArchivo, 'utf8'));
        } catch (error) {
            console.error(`⚠️ Error leyendo ${rutaArchivo}. Se asumirá que está vacío.`);
            return [];
        }
    }
    return [];
}

async function procesarPeliculas() {
    console.log("--- INICIANDO PELÍCULAS ---");
    
    // 1. Cargamos lo que ya tenemos
    const peliculasGuardadas = cargarCatalogoExistente('peliculas.json');
    // Creamos un "Set" con los IDs existentes para que la búsqueda sea instantánea
    const idsExistentes = new Set(peliculasGuardadas.map(p => p.id));

    const res = await fetch(`${BASE_URL}&action=get_vod_streams`, opcionesFetch);
    const data = JSON.parse(await res.text());
    const nuevasPeliculas = [];

    console.log(`Encontradas ${data.length} películas en el proveedor.`);
    console.log(`Ya tienes ${idsExistentes.size} guardadas. Buscando novedades...`);

    for (let i = 0; i < data.length; i++) {
        const p = data[i];

        // 2. FILTRO: Si ya tenemos esta película, saltamos al siguiente ciclo
        if (idsExistentes.has(p.stream_id)) continue;

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
                nuevasPeliculas.push({
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
        
        // Mensaje de progreso solo si estamos procesando nuevas
        if (nuevasPeliculas.length % 50 === 0 && nuevasPeliculas.length !== 0) {
            console.log(`Procesadas ${nuevasPeliculas.length} nuevas películas...`);
        }
        await delay(30);
    }
    
    return { nuevas: nuevasPeliculas, todas: [...peliculasGuardadas, ...nuevasPeliculas] };
}

async function procesarSeries() {
    console.log("--- INICIANDO SERIES ---");
    
    // 1. Cargamos lo que ya tenemos
    const seriesGuardadas = cargarCatalogoExistente('series.json');
    const idsExistentes = new Set(seriesGuardadas.map(s => s.id));

    const res = await fetch(`${BASE_URL}&action=get_series`, opcionesFetch);
    const data = JSON.parse(await res.text());
    const nuevasSeries = [];

    console.log(`Encontradas ${data.length} series en el proveedor.`);
    console.log(`Ya tienes ${idsExistentes.size} guardadas. Buscando novedades...`);

    for (let i = 0; i < data.length; i++) {
        const s = data[i];

        // 2. FILTRO: Si ya tenemos esta serie, la ignoramos
        if (idsExistentes.has(s.series_id)) continue;

        try {
            const resInfo = await fetch(`${BASE_URL}&action=get_series_info&series_id=${s.series_id}`, opcionesFetch);
            const serieData = await resInfo.json();
            const episodiosData = serieData.episodes; 

            if (!episodiosData || typeof episodiosData !== 'object') continue;

            const temporadasValidas = [];

            for (const numTemporada in episodiosData) {
                const capitulosOriginales = episodiosData[numTemporada];
                const capitulosValidos = [];

                for (const cap of capitulosOriginales) {
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
                
                nuevasSeries.push({
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
        
        if (nuevasSeries.length % 10 === 0 && nuevasSeries.length !== 0) {
            console.log(`Procesadas ${nuevasSeries.length} nuevas series...`);
        }
        await delay(30); 
    }
    
    return { nuevas: nuevasSeries, todas: [...seriesGuardadas, ...nuevasSeries] };
}

async function iniciar() {
    try {
        // --- PROCESAR PELÍCULAS ---
        const { nuevas: nuevasPelis, todas: todasPelis } = await procesarPeliculas();
        
        // Actualizamos el maestro con todo (antiguas + nuevas)
        fs.writeFileSync('peliculas.json', JSON.stringify(todasPelis, null, 2));
        
        // Guardamos las nuevas en un archivo separado para tu control
        if (nuevasPelis.length > 0) {
            fs.writeFileSync('nuevas_peliculas.json', JSON.stringify(nuevasPelis, null, 2));
            console.log(`✅ ¡Se agregaron ${nuevasPelis.length} PELÍCULAS NUEVAS! Guardadas en 'nuevas_peliculas.json'`);
        } else {
            console.log(`✅ No hay películas nuevas hoy. Total en catálogo: ${todasPelis.length}`);
        }

        console.log("\n-----------------------------------\n");

        // --- PROCESAR SERIES ---
        const { nuevas: nuevasSeries, todas: todasSeries } = await procesarSeries();
        
        // Actualizamos el maestro con todo
        fs.writeFileSync('series.json', JSON.stringify(todasSeries, null, 2));
        
        // Guardamos las nuevas series
        if (nuevasSeries.length > 0) {
            fs.writeFileSync('nuevas_series.json', JSON.stringify(nuevasSeries, null, 2));
            console.log(`✅ ¡Se agregaron ${nuevasSeries.length} SERIES NUEVAS! Guardadas en 'nuevas_series.json'`);
        } else {
            console.log(`✅ No hay series nuevas hoy. Total en catálogo: ${todasSeries.length}`);
        }

        console.log("\n🚀 Sincronización completa.");
    } catch (error) {
        console.error("❌ Error general:", error.message);
        process.exit(1); 
    }
}

iniciar();
