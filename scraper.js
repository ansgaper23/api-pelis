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
    
    const peliculasGuardadas = cargarCatalogoExistente('peliculas.json');
    const idsExistentes = new Set(peliculasGuardadas.map(p => p.id));

    const res = await fetch(`${BASE_URL}&action=get_vod_streams`, opcionesFetch);
    const data = JSON.parse(await res.text());
    const nuevasPeliculas = [];

    console.log(`Encontradas ${data.length} películas en el proveedor.`);
    console.log(`Ya tienes ${idsExistentes.size} guardadas. Buscando novedades...`);

    for (let i = 0; i < data.length; i++) {
        const p = data[i];

        if (idsExistentes.has(p.stream_id)) continue;

        try {
            const urlPelicula = `${BASE_URL}&action=get_vod_links&vod_id=${p.stream_id}`;
            const resLinks = await fetch(urlPelicula, opcionesFetch);
            
            if (!resLinks.ok) {
                console.log(`⚠️ Error HTTP ${resLinks.status} al consultar links del ID: ${p.stream_id}`);
                continue;
            }

            const textoRespuesta = await resLinks.text();
            let links;
            try {
                links = JSON.parse(textoRespuesta);
