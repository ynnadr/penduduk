document.addEventListener('DOMContentLoaded', () => {
    // Elemen Header
    const titleLine1Element = document.getElementById('main-title-line1');
    const titleLine2Element = document.getElementById('main-title-line2');
    const summaryCountElement = document.getElementById('summary-count');
    const loadingMessage = document.querySelector('#map-container .loading-message');

    // Elemen Peta
    const mapContainer = document.getElementById('map-container');
    const mapElementId = 'map';

    // URL Data
    const populationDataUrl = 'data/penduduk.json';
    const provinceGeoJsonUrl = 'geojson/provinsi.geojson';
    const kabkotGeoJsonUrl = 'geojson/kabupaten.geojson';

    // Variabel Global Peta
    let map;
    let provinceGeojsonLayer; // Layer untuk provinsi
    let kabkotGeojsonLayer;  // Layer untuk kab/kota
    let infoBox;
    let legend;
    let provincePopulationData = {}; // Menyimpan { NAMA_PROV_NORMAL: { totalPenduduk, kabkotCount } }

    // --- Fungsi Utilitas ---
    function formatNumber(num) {
        if (typeof num !== 'number' || isNaN(num)) { return '0'; }
        return num.toLocaleString('id-ID');
    }

    function normalizeProvinceName(name) {
        if (!name) return "PROVINSI TIDAK DIKETAHUI";
        let normalized = name.trim().toUpperCase(); // Normalisasi ke UPPERCASE
        // Penggantian spesifik (jika diperlukan, meskipun sumber JSON sudah bersih)
        if (normalized === 'P A P U A') {
            normalized = 'PAPUA';
        }
        // Tambahkan normalisasi lain jika perlu di masa depan
        // Misal: Menyamakan 'KEP. BANGKA BELITUNG' dengan 'KEPULAUAN BANGKA BELITUNG'
        return normalized;
    }

    // --- Fungsi Peta ---

    // 1. Skala Warna Provinsi (SESUAIKAN RENTANG INI!)
    function getColor(population) {
        return population > 30000000 ? '#800026' :
               population > 15000000 ? '#BD0026' :
               population > 8000000  ? '#E31A1C' :
               population > 4000000  ? '#FC4E2A' :
               population > 2000000  ? '#FD8D3C' :
               population > 1000000  ? '#FEB24C' :
               population > 500000   ? '#FED976' :
                                      '#FFEDA0'; // Warna default/paling terang
    }

    // 2. Gaya Fitur Provinsi
    function styleProvinceFeature(feature) {
        const provinceNameFromGeoJson = feature.properties.PROVINSI; // Gunakan properti PROVINSI
        const provinceNameNormalized = normalizeProvinceName(provinceNameFromGeoJson);
        const data = provincePopulationData[provinceNameNormalized];
        const population = data ? data.totalPenduduk : 0;

        return {
            fillColor: getColor(population),
            weight: 1,
            opacity: 1,
            color: '#666',
            fillOpacity: 0.7
        };
    }

    // 3. Highlight Provinsi saat Hover
    function highlightProvinceFeature(e) {
        const layer = e.target;
        layer.setStyle({
            weight: 3,
            color: '#333',
            fillOpacity: 0.85
        });
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            layer.bringToFront();
        }
        infoBox.update(layer.feature.properties); // Update info box dengan properti provinsi
    }

    // 4. Reset Highlight Provinsi saat Mouse Out
    function resetProvinceHighlight(e) {
        if (provinceGeojsonLayer) {
           provinceGeojsonLayer.resetStyle(e.target);
        }
        infoBox.update(); // Kosongkan info box
    }

    // 5. Zoom ke Provinsi saat Diklik
    function zoomToProvinceFeature(e) {
        map.fitBounds(e.target.getBounds());
    }

    // 6. Listener untuk Setiap Fitur Provinsi
    function onEachProvinceFeature(feature, layer) {
        layer.on({
            mouseover: highlightProvinceFeature,
            mouseout: resetProvinceHighlight,
            click: zoomToProvinceFeature
        });
    }

     // 7. Membuat Info Box Kustom (untuk Provinsi)
     function createInfoBox() {
        infoBox = L.control({ position: 'topright' });

        infoBox.onAdd = function (map) {
            this._div = L.DomUtil.create('div', 'info-box');
            this.update();
            return this._div;
        };

        infoBox.update = function (props) {
            const provinceNameFromGeoJson = props ? props.PROVINSI : null; // Gunakan properti PROVINSI
            const normalizedName = normalizeProvinceName(provinceNameFromGeoJson);
            const data = props && provincePopulationData[normalizedName]
                         ? provincePopulationData[normalizedName]
                         : null;

            const displayName = props ? provinceNameFromGeoJson : 'Arahkan kursor ke provinsi';
            const populationText = data ? `${formatNumber(data.totalPenduduk)} jiwa` : 'Data penduduk tidak tersedia';
            const kabkotText = data ? `${data.kabkotCount} Kab/Kota` : '';

            this._div.innerHTML = `<h4>Informasi Provinsi</h4>
                                 <b>${displayName}</b><br/>
                                 ${data ? `${populationText}<br/>${kabkotText}` : populationText}`;
        };
        infoBox.addTo(map);
    }

     // 8. Membuat Legenda (untuk Skala Warna Provinsi)
     function createLegend() {
        legend = L.control({position: 'bottomright'});

        legend.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info-box legend');
            // --- PASTIKAN GRADES SESUAI getColor ---
            const grades = [0, 500000, 1000000, 2000000, 4000000, 8000000, 15000000, 30000000];
            // ------------------------------------
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

    // --- Fungsi Utama Inisialisasi Peta ---
    async function initializeMap() {
        if(loadingMessage) loadingMessage.textContent = "Mengambil data...";

        try {
            // Ambil semua data secara paralel
            const [populationResponse, provinceGeoJsonResponse, kabkotGeoJsonResponse] = await Promise.all([
                fetch(populationDataUrl),
                fetch(provinceGeoJsonUrl),
                fetch(kabkotGeoJsonUrl) // Muat GeoJSON Kab/Kota
            ]);

            // Cek semua response
            if (!populationResponse.ok) throw new Error(`Gagal memuat data penduduk: ${populationResponse.status}`);
            if (!provinceGeoJsonResponse.ok) throw new Error(`Gagal memuat data GeoJSON Provinsi: ${provinceGeoJsonResponse.status}`);
            if (!kabkotGeoJsonResponse.ok) throw new Error(`Gagal memuat data GeoJSON Kabupaten: ${kabkotGeoJsonResponse.status}`);

            const rawData = await populationResponse.json();
            const provinceGeoJsonData = await provinceGeoJsonResponse.json();
            const kabkotGeoJsonData = await kabkotGeoJsonResponse.json(); // Data GeoJSON Kab/Kota

            // Proses data penduduk (filter terbaru, group by province normal)
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
                const provinceNameNormalized = item.prov; // Sudah dinormalisasi
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

            if(loadingMessage) loadingMessage.style.display = 'none';

            // Inisialisasi Peta Leaflet
            console.log("Inisialisasi peta...");
            map = L.map(mapElementId).setView([-2.5, 118.0], 5); // Center Indonesia
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 18,
                attribution: '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            }).addTo(map);

            // Tambahkan Layer GeoJSON Provinsi
            console.log("Menambahkan layer GeoJSON Provinsi...");
            provinceGeojsonLayer = L.geoJson(provinceGeoJsonData, {
                style: styleProvinceFeature, // Gunakan style provinsi
                onEachFeature: onEachProvinceFeature // Gunakan interaksi provinsi
            }).addTo(map);

            // Tambahkan Layer GeoJSON Kabupaten/Kota sebagai Overlay
            console.log("Menambahkan layer GeoJSON Kabupaten/Kota...");
            const kabkotStyle = {
                weight: 0.5,
                color: '#999999',
                dashArray: '3',
                fillOpacity: 0
            };
            kabkotGeojsonLayer = L.geoJson(kabkotGeoJsonData, {
                style: kabkotStyle,
                onEachFeature: function (feature, layer) {
                    // Ambil nama dari properti WADMKK
                    const kabkotName = feature.properties.WADMKK || 'Nama Tidak Tersedia';
                    layer.bindTooltip(kabkotName, { // Tooltip standar Leaflet
                        sticky: true,
                        direction: 'auto', // Biarkan Leaflet menentukan arah terbaik
                        opacity: 0.8
                    });
                }
            }).addTo(map);
            console.log("Layer Kabupaten/Kota ditambahkan.");

            // Buat Info Box Kustom (untuk Provinsi)
            createInfoBox();

            // Buat Legenda (untuk Provinsi)
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

    // Panggil fungsi inisialisasi saat DOM siap
    initializeMap();
});
