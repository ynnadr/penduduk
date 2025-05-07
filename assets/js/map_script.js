document.addEventListener('DOMContentLoaded', () => {
    // Elemen Header
    const titleLine1Element = document.getElementById('main-title-line1');
    const titleLine2Element = document.getElementById('main-title-line2');
    const summaryCountElement = document.getElementById('summary-count');
    const loadingMessage = document.querySelector('#map-container .loading-message');

    // Elemen Peta
    const mapContainer = document.getElementById('map-container');
    const mapElementId = 'map';

    // URL Data (Hanya perlu data penduduk dan geojson provinsi)
    const populationDataUrl = 'data/penduduk.json';
    const provinceGeoJsonUrl = 'geojson/provinsi.geojson';
    // const kabkotGeoJsonUrl = 'geojson/kabupaten.geojson'; // <-- Dihapus

    // Variabel Global Peta
    let map;
    let provinceGeojsonLayer; // Hanya layer provinsi
    // let kabkotGeojsonLayer;  // <-- Dihapus
    let infoBox;
    let legend;
    let provincePopulationData = {};

    // --- Fungsi Utilitas (Sama) ---
    function formatNumber(num) { if (typeof num !== 'number' || isNaN(num)) { return '0'; } return num.toLocaleString('id-ID'); }
    function normalizeProvinceName(name) { if (!name) return "PROVINSI TIDAK DIKETAHUI"; let normalized = name.trim().toUpperCase(); if (normalized === 'P A P U A') { normalized = 'PAPUA'; } return normalized; }

    // --- Fungsi Peta (Hanya untuk Provinsi) ---
    function getColor(population) { return population > 30000000 ? '#800026' : population > 15000000 ? '#BD0026' : population > 8000000  ? '#E31A1C' : population > 4000000  ? '#FC4E2A' : population > 2000000  ? '#FD8D3C' : population > 1000000  ? '#FEB24C' : population > 500000   ? '#FED976' : '#FFEDA0'; }
    function styleProvinceFeature(feature) { const provinceNameFromGeoJson = feature.properties.PROVINSI; const provinceNameNormalized = normalizeProvinceName(provinceNameFromGeoJson); const data = provincePopulationData[provinceNameNormalized]; const population = data ? data.totalPenduduk : 0; return { fillColor: getColor(population), weight: 1, opacity: 1, color: '#666', fillOpacity: 0.7 }; }
    function highlightProvinceFeature(e) { const layer = e.target; layer.setStyle({ weight: 3, color: '#333', fillOpacity: 0.85 }); if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) { layer.bringToFront(); } infoBox.update(layer.feature.properties); }
    function resetProvinceHighlight(e) { if (provinceGeojsonLayer) { provinceGeojsonLayer.resetStyle(e.target); } infoBox.update(); }
    function zoomToProvinceFeature(e) { map.fitBounds(e.target.getBounds()); }
    function onEachProvinceFeature(feature, layer) { layer.on({ mouseover: highlightProvinceFeature, mouseout: resetProvinceHighlight, click: zoomToProvinceFeature }); }
    function createInfoBox() { infoBox = L.control({ position: 'topright' }); infoBox.onAdd = function (map) { this._div = L.DomUtil.create('div', 'info-box'); this.update(); return this._div; }; infoBox.update = function (props) { const provinceNameFromGeoJson = props ? props.PROVINSI : null; const normalizedName = normalizeProvinceName(provinceNameFromGeoJson); const data = props && provincePopulationData[normalizedName] ? provincePopulationData[normalizedName] : null; const displayName = props ? provinceNameFromGeoJson : 'Arahkan kursor ke provinsi'; const populationText = data ? `${formatNumber(data.totalPenduduk)} jiwa` : 'Data penduduk tidak tersedia'; const kabkotText = data ? `${data.kabkotCount} Kab/Kota` : ''; this._div.innerHTML = `<h4>Informasi Provinsi</h4><b>${displayName}</b><br/>${data ? `${populationText}<br/>${kabkotText}` : populationText}`; }; infoBox.addTo(map); }
    function createLegend() { legend = L.control({position: 'bottomright'}); legend.onAdd = function (map) { const div = L.DomUtil.create('div', 'info-box legend'); const grades = [0, 500000, 1000000, 2000000, 4000000, 8000000, 15000000, 30000000]; const labels = []; let from, to; div.innerHTML += '<span class="legend-title">Penduduk (Jiwa)</span>'; for (let i = 0; i < grades.length; i++) { from = grades[i]; to = grades[i + 1]; labels.push('<span><i style="background:' + getColor(from + 1) + '"></i> ' + formatNumber(from) + (to ? '–' + formatNumber(to) : '+') + '</span>'); } div.innerHTML += labels.join(''); return div; }; legend.addTo(map); }

    // --- Fungsi Utama Inisialisasi Peta ---
    async function initializeMap() {
        if(loadingMessage) loadingMessage.textContent = "Mengambil data...";
        try {
            // Hanya fetch data penduduk dan geojson provinsi
            const [populationResponse, provinceGeoJsonResponse] = await Promise.all([
                fetch(populationDataUrl),
                fetch(provinceGeoJsonUrl)
                // fetch(kabkotGeoJsonUrl) // <-- Dihapus
            ]);

            if (!populationResponse.ok) throw new Error(`Penduduk: ${populationResponse.status}`);
            if (!provinceGeoJsonResponse.ok) throw new Error(`GeoJSON Provinsi: ${provinceGeoJsonResponse.status}`);
            // Tidak perlu cek response kabkot lagi

            const rawData = await populationResponse.json();
            const provinceGeoJsonData = await provinceGeoJsonResponse.json();
            // const kabkotGeoJsonData = await kabkotGeoJsonResponse.json(); // <-- Dihapus

            // Proses data penduduk (sama seperti sebelumnya)
            console.log("Memproses data penduduk...");
            const latestEntries = {};
            rawData.forEach(item => {
                const kabkot = (item.kabkot || "Unknown").trim();
                const year = parseInt(item.tahun) || 0;
                const provinceKey = normalizeProvinceName(item.prov);
                const uniqueKey = `${provinceKey}_${kabkot}`;
                if (!latestEntries[uniqueKey] || year > latestEntries[uniqueKey].tahun) {
                     latestEntries[uniqueKey] = { ...item, prov: provinceKey, tahun: year };
                }
            });
            const latestData = Object.values(latestEntries);

            provincePopulationData = {};
            let totalPopulation = 0;
            let minYear = Infinity; let maxYear = -Infinity;
            const totalKabkot = latestData.length; // Jumlah kabkot tetap dihitung dari data penduduk
            latestData.forEach(item => {
                const population = parseInt(item.penduduk) || 0;
                totalPopulation += population;
                const year = item.tahun;
                 if (year > 0) { minYear = Math.min(minYear, year); maxYear = Math.max(maxYear, year); }
                const provinceNameNormalized = item.prov;
                if (!provincePopulationData[provinceNameNormalized]) {
                    provincePopulationData[provinceNameNormalized] = { totalPenduduk: 0, kabkotCount: 0 };
                }
                provincePopulationData[provinceNameNormalized].totalPenduduk += population;
                provincePopulationData[provinceNameNormalized].kabkotCount++;
            });
            if (minYear === Infinity) minYear = "N/A"; if (maxYear === -Infinity) maxYear = "N/A";
            const totalProvinces = Object.keys(provincePopulationData).length;

            // Update Header (sama)
            // ... (setelah minYear dan maxYear dihitung) ...

// Langkah 3: Update Judul Halaman
let yearDisplay;
if (minYear === "N/A" || maxYear === "N/A") { // Kasus jika tidak ada tahun valid
    yearDisplay = ""; // Atau "(Tahun Tidak Tersedia)"
} else if (minYear === maxYear) {
    yearDisplay = `(${maxYear})`; // Hanya tampilkan satu tahun
} else {
    yearDisplay = `(${minYear} - ${maxYear})`; // Tampilkan rentang tahun
}

titleLine1Element.textContent = `Data Penduduk Indonesia ${yearDisplay}`.trim(); // trim() untuk menghapus spasi ekstra jika yearDisplay kosong
// ...
            titleLine2Element.textContent = `TOTAL ${formatNumber(totalPopulation)} orang`;
            summaryCountElement.textContent = `${totalProvinces} Provinsi - ${totalKabkot} Kabupaten/Kota`;

            if(loadingMessage) loadingMessage.style.display = 'none';

            // Inisialisasi Peta Leaflet (sama)
            console.log("Inisialisasi peta...");
            map = L.map(mapElementId).setView([-2.5, 118.0], 5);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 18,
                attribution: '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            }).addTo(map);

            // Tambahkan Layer GeoJSON Provinsi (sama)
            console.log("Menambahkan layer GeoJSON Provinsi...");
            provinceGeojsonLayer = L.geoJson(provinceGeoJsonData, {
                style: styleProvinceFeature,
                onEachFeature: onEachProvinceFeature
            }).addTo(map);

            // --- Layer GeoJSON Kabupaten/Kota DIHAPUS ---
            // console.log("Menambahkan layer GeoJSON Kabupaten/Kota...");
            // ... (kode untuk kabkotGeojsonLayer dihapus) ...
            // console.log("Layer Kabupaten/Kota ditambahkan.");
            // --- AKHIR PENGHAPUSAN ---

            // Buat Info Box (untuk Provinsi) (sama)
            createInfoBox();

            // Buat Legenda (untuk Provinsi) (sama)
            createLegend();

            console.log("Peta berhasil dimuat.");

        } catch (error) {
            console.error("Gagal menginisialisasi peta:", error);
             if(loadingMessage) { loadingMessage.textContent = `Gagal memuat peta: ${error.message}`; loadingMessage.style.color = '#d9534f'; } else if (mapContainer) { mapContainer.innerHTML = `<p class="error-message">Gagal memuat peta: ${error.message}</p>`; }
            titleLine1Element.textContent = "Gagal Memuat Peta"; titleLine2Element.textContent = ""; summaryCountElement.textContent = "Gagal memuat ringkasan";
        }
    }

    // Panggil fungsi inisialisasi
    initializeMap();
});
