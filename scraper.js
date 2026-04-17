import fetch from 'node-fetch';
import fs from 'fs';

const CREDENTIALS = "?username=m&password=m";
const BASE_URL = `http://tv.m3uts.xyz/player_api.php${CREDENTIALS}`;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function obtenerDatos() {
    try {
        console.log("Iniciando descarga de películas...");
        const resPeliculas = await fetch(`${BASE_URL}&action=get_vod_streams`);
        const peliculasRaw = await resPeliculas.json();
        const peliculasFiltradas = [];

        // Procesamos las películas (puedes ajustar el límite para pruebas si quieres)
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

            // Pequeña pausa para no saturar al proveedor
            await delay(100);
            if (i % 500 === 0) console.log(`Procesadas ${i} películas...`);
        }

        // Guardar el archivo JSON de películas
        fs.writeFileSync('peliculas.json', JSON.stringify(peliculasFiltradas, null, 2));
        console.log(`¡Éxito! Se guardaron ${peliculasFiltradas.length} películas.`);

        // -------------------------------------------------------------
        // AQUÍ INICIA EL PROCESO PARA SERIES
        // (Usualmente en esta API es get_series y get_series_info)
        // -------------------------------------------------------------
        console.log("Iniciando descarga de series...");
        const resSeries = await fetch(`${BASE_URL}&action=get_series`);
        const seriesRaw = await resSeries.json();
        const seriesFiltradas = [];

        // Limitamos a unas cuantas para el ejemplo, o procesas todas
        for (let i = 0; i < seriesRaw.length; i++) {
            const s = seriesRaw[i];
            const resInfo = await fetch(`${BASE_URL}&action=get_series_info&series_id=${s.series_id}`);
            const infoData = await resInfo.json();
            
            // La estructura de las series suele ser un poco distinta, adaptamos la búsqueda
            let tieneServidorValido = false;
            const servidoresSeries = [];
            
            // Buscamos dentro de los episodios de la serie
            if (infoData && infoData.episodes) {
                for (const temp in infoData.episodes) {
                    infoData.episodes[temp].forEach(ep => {
                        const epUrl = ep.url || ep.id || ""; // Depende del proveedor
                        if (typeof epUrl === 'string' && (epUrl.includes('vidhide') || epUrl.includes('streamwish'))) {
                            tieneServidorValido = true;
                        }
                    });
                }
            }

            if (tieneServidorValido) {
                seriesFiltradas.push({
                    id: s.series_id,
                    nombre: s.name,
                    imagen: s.cover
                });
            }
            await delay(100);
        }

        fs.writeFileSync('series.json', JSON.stringify(seriesFiltradas, null, 2));
        console.log(`¡Éxito! Se guardaron ${seriesFiltradas.length} series.`);

    } catch (error) {
        console.error("Error en el proceso:", error);
    }
}

obtenerDatos();