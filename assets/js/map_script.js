document.addEventListener('DOMContentLoaded', () => {
    // Elemen Header
    const titleLine1Element = document.getElementById('main-title-line1');
    const titleLine2Element = document.getElementById('main-title-line2');
    const summaryCountElement = document.getElementById('summary-count');
    const loadingMessage = document.querySelector('#map-container .loading-message');

    // Elemen Peta
    const mapContainer = document.getElementById('map-container'); // Optional: for error messages
    const mapElementId = 'map'; // ID dari div peta di HTML

    // URL Data
    const populationDataUrl = 'data/penduduk.json';
    const geoJsonUrl = 'geojson/provinsi.geojson';

    // Variabel Global Peta
    let map;
    let geojsonLayer;
    let infoBox;
    let legend;
    let provincePopulationData = {}; // Menyimpan data populasi { NAMA_PROV_NORMAL: { totalPenduduk, kabkotCount } }

    // --- Fungsi Utilitas ---
    function formatNumber(num) {
        if (typeof num !== 'number' || isNaN(num)) { return '0'; }
        return num.toLocaleString('id-ID');
    }

    function normalizeProvinceName(name) {
        if (!name) return "PROVINSI TIDAK DIKETAHUI";
        let normalized = name.trim().toUpperCase(); // Normalisasi ke UPPERCASE
        // Penggantian spesifik (meskipun JSON sumber sudah bersih, ini untuk jaga-jaga)
        if (normalized === 'P A P U A') {
            normalized = 'PAPUA';
        }
        // Tambahkan normalisasi lain di sini jika perlu (misal: 'DKI JAKARTA' -> 'JAKARTA')
        // if (normalized === 'DAERAH ISTIMEWA YOGYAKARTA') normalized = 'DI YOGYAKARTA';
        return normalized;
    }

    // --- Fungsi Peta ---

    // 1. Skala Warna (Sesuaikan rentang angka ini!)
    function getColor(population) {
        return population > 30000000 ? '#800026' : // > 30 Juta (Merah Tua)
               population > 15000000 ? '#BD0026' :
               population > 8000000  ? '#E31A1C' :
               population > 4000000  ? '#FC4E2A' :
               population > 2000000  ? '#FD8D3C' : // Oranye
               population > 1000000  ? '#FEB24C' :
               population > 500000   ? '#FED976' : // Kuning
                                      '#FFEDA0';  // <= 500 Ribu / Tidak ada data (Kuning Pucat)
    }

    // 2. Gaya Fitur Provinsi
    function styleFeature(feature) {
        // --- PASTIKAN NAMA PROPERTI BENAR ---
        const provinceNameFromGeoJson = feature.properties.PROVINSI;
        // ---------------------------------
        const provinceNameNormalized = normalizeProvinceName(provinceNameFromGeoJson);
        const population = provincePopulationData[provinceNameNormalized] ? provincePopulationData[provinceNameNormalized].totalPenduduk : 0;

        return {
            fillColor: getColor(population),
            weight: 1,
            opacity: 1,
            color: '#666', // Warna garis batas
            fillOpacity: 0.7
        };
    }

    // 3. Highlight saat Hover
    function highlightFeature(e) {
        const layer = e.target;
        layer.setStyle({
            weight: 3,
            color: '#333', // Garis batas lebih gelap
            fillOpacity: 0.85
        });
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            layer.bringToFront();
        }
        infoBox.update(layer.feature.properties); // Update info box
    }

    // 4. Reset Highlight saat Mouse Out
    function resetHighlight(e) {
        if (geojsonLayer) { // Pastikan layer sudah ada
           geojsonLayer.resetStyle(e.target);
        }
        infoBox.update(); // Kosongkan info box
    }

    // 5. Zoom saat Diklik
    function zoomToFeature(e) {
        map.fitBounds(e.target.getBounds());
    }

    // 6. Listener untuk Setiap Fitur
    function onEachFeature(feature, layer) {
        layer.on({
            mouseover: highlightFeature,
            mouseout: resetHighlight,
            click: zoomToFeature
        });
    }

     // 7. Membuat Info Box Kustom
     function createInfoBox() {
        infoBox = L.control({ position: 'topright' }); // Posisi info box

        infoBox.onAdd = function (map) {
            this._div = L.DomUtil.create('div', 'info-box');
            this.update();
            return this._div;
        };

        infoBox.update = function (props) {
             // --- PASTIKAN NAMA PROPERTI BENAR ---
            const provinceNameFromGeoJson = props ? props.PROVINSI : null;
            // ---------------------------------
            const normalizedName = normalizeProvinceName(provinceNameFromGeoJson);
            const data = props && provincePopulationData[normalizedName]
                         ? provincePopulationData[normalizedName]
                         : null;

            const displayName = props ? provinceNameFromGeoJson : 'Arahkan kursor ke provinsi'; // Tampilkan nama asli
            const populationText = data ? `${formatNumber(data.totalPenduduk)} jiwa` : 'Data penduduk tidak tersedia';
            const kabkotText = data ? `${data.kabkotCount} Kab/Kota` : '';

            this._div.innerHTML = `<h4>Informasi Provinsi</h4>
                                 <b>${displayName}</b><br/>
                                 ${data ? `${populationText}<br/>${kabkotText}` : populationText}`;
        };
        infoBox.addTo(map);
    }

     // 8. Membuat Legenda
     function createLegend() {
        legend = L.control({position: 'bottomright'}); // Posisi legenda

        legend.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info-box legend');
            // --- SESUAIKAN GRADES DENGAN getColor ---
            const grades = [0, 500000, 1000000, 2000000, 4000000, 8000000, 15000000, 30000000];
            // ---------------------------------------
            const labels = [];
            let from, to;

            div.innerHTML += '<span class="legend-title">Penduduk (Jiwa)</span>';

            for (let i = 0; i < grades.length; i++) {
                from = grades[i];
                to = grades[i + 1];
                labels.push(
                    '<span><i style="background:' + getColor(from + 1) + '"></i> ' +
                    formatNumber(from) + (to ? '–' + formatNumber(to) : '+') + '</span>');
            }
            div.innerHTML += labels.join('');
            return div;
        };
        legend.addTo(map);
     }

    // --- Fungsi Utama ---
    async function initializeMap() {
        if(loadingMessage) loadingMessage.textContent = "Mengambil data...";

        try {
            // Ambil data paralel
            const [populationResponse, geoJsonResponse] = await Promise.all([
                fetch(populationDataUrl),
                fetch(geoJsonUrl)
            ]);
            if (!populationResponse.ok) throw new Error(`Gagal memuat data penduduk: ${populationResponse.status}`);
            if (!geoJsonResponse.ok) throw new Error(`Gagal memuat data GeoJSON: ${geoJsonResponse.status}`);

            const rawData = await populationResponse.json();
            const geoJsonData = await geoJsonResponse.json();

            // Proses data penduduk (filter terbaru, group by province normal)
            console.log("Memproses data penduduk...");
            const latestEntries = {};
            rawData.forEach(item => {
                const kabkot = (item.kabkot || "Unknown").trim();
                const year = parseInt(item.tahun) || 0;
                const provinceKey = normalizeProvinceName(item.prov); // Normalisasi di sini
                const uniqueKey = `${provinceKey}_${kabkot}`;
                if (!latestEntries[uniqueKey] || year > latestEntries[uniqueKey].tahun) {
                     latestEntries[uniqueKey] = { ...item, prov: provinceKey, tahun: year }; // Simpan prov yg sdh normal
                }
            });
            const latestData = Object.values(latestEntries);

            // Grouping data yang sudah difilter
            provincePopulationData = {}; // Reset
            let totalPopulation = 0;
            let minYear = Infinity;
            let maxYear = -Infinity;
            const totalKabkot = latestData.length;

            latestData.forEach(item => {
                const population = parseInt(item.penduduk) || 0;
                totalPopulation += population;
                const year = item.tahun;
                 if (year > 0) { minYear = Math.min(minYear, year); maxYear = Math.max(maxYear, year); }
                const provinceNameNormalized = item.prov; // Ambil yg sudah normal
                if (!provincePopulationData[provinceNameNormalized]) {
                    provincePopulationData[provinceNameNormalized] = { totalPenduduk: 0, kabkotCount: 0 };
                }
                provincePopulationData[provinceNameNormalized].totalPenduduk += population;
                provincePopulationData[provinceNameNormalized].kabkotCount++;
            });

            if (minYear === Infinity) minYear = "N/A";
            if (maxYear === -Infinity) maxYear = "N/A";
            const totalProvinces = Object.keys(provincePopulationData).length;

            // Update Header
            titleLine1Element.textContent = `Peta Sebaran Penduduk Indonesia (${minYear} - ${maxYear})`;
            titleLine2Element.textContent = `TOTAL ${formatNumber(totalPopulation)} orang`;
            summaryCountElement.textContent = `${totalProvinces} Provinsi - ${totalKabkot} Kabupaten/Kota`;

            // Hapus pesan loading
             if(loadingMessage) loadingMessage.style.display = 'none';

            // Inisialisasi Peta Leaflet
            console.log("Inisialisasi peta...");
            map = L.map(mapElementId).setView([-2.5, 118.0], 5); // Sesuaikan center & zoom jika perlu

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 18,
                attribution: '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            }).addTo(map);

            // Tambahkan Layer GeoJSON Provinsi
            console.log("Menambahkan layer GeoJSON...");
            geojsonLayer = L.geoJson(geoJsonData, {
                style: styleFeature,
                onEachFeature: onEachFeature
            }).addTo(map);

            // Buat Info Box
            createInfoBox();

            // Buat Legenda
            createLegend();

            console.log("Peta berhasil dimuat.");

        } catch (error) {
            console.error("Gagal menginisialisasi peta:", error);
            if(loadingMessage) {
                 loadingMessage.textContent = `Gagal memuat peta: ${error.message}`;
                 loadingMessage.style.color = '#d9534f';
            } else if (mapContainer) {
                 mapContainer.innerHTML = `<p class="error-message">Gagal memuat peta: ${error.message}</p>`;
            }
            titleLine1Element.textContent = "Gagal Memuat Peta";
            titleLine2Element.textContent = "";
            summaryCountElement.textContent = "Gagal memuat ringkasan";
        }
    }

    // Panggil fungsi inisialisasi
    initializeMap();
});
