document.addEventListener('DOMContentLoaded', () => {
    // Elemen Header
    const titleLine1Element = document.getElementById('main-title-line1');
    const titleLine2Element = document.getElementById('main-title-line2');
    const summaryCountElement = document.getElementById('summary-count');
    const loadingMessage = document.querySelector('#map-container .loading-message');

    // URL Data
    const populationDataUrl = 'data/penduduk.json';
    const geoJsonUrl = 'geojson/provinsi.geojson'; // Pastikan path dan nama file benar

    // Variabel Global Peta
    let map;
    let geojsonLayer;
    let infoBox; // Untuk tooltip/info box kustom
    let legend;
    let provincePopulationData = {}; // Untuk menyimpan data populasi per provinsi

    // --- Fungsi Utilitas ---
    function formatNumber(num) {
        if (typeof num !== 'number' || isNaN(num)) { return '0'; }
        return num.toLocaleString('id-ID');
    }

    function normalizeProvinceName(name) {
        if (!name) return "PROVINSI TIDAK DIKETAHUI";
        let normalized = name.trim().toUpperCase(); // Normalisasi ke UPPERCASE
        // Tambahkan normalisasi spesifik jika perlu (misal: 'DKI JAKARTA' -> 'JAKARTA')
        // if (normalized === 'DAERAH ISTIMEWA YOGYAKARTA') normalized = 'YOGYAKARTA';
        return normalized;
    }

    // --- Fungsi Peta ---

    // 1. Mendefinisikan Skala Warna berdasarkan Populasi
    function getColor(population) {
        // Skala warna sederhana (dari kuning ke merah tua)
        // Sesuaikan rentang angka ini berdasarkan distribusi data Anda
        return population > 30000000 ? '#800026' : // > 30 Juta
               population > 15000000 ? '#BD0026' : // > 15 Juta
               population > 8000000  ? '#E31A1C' : // > 8 Juta
               population > 4000000  ? '#FC4E2A' : // > 4 Juta
               population > 2000000  ? '#FD8D3C' : // > 2 Juta
               population > 1000000  ? '#FEB24C' : // > 1 Juta
               population > 500000   ? '#FED976' : // > 500 Ribu
                                      '#FFEDA0';  // <= 500 Ribu (atau data tidak ada)
    }

    // 2. Mendefinisikan Gaya untuk Setiap Fitur Provinsi
    function styleFeature(feature) {
        const provinceNameNormalized = normalizeProvinceName(feature.properties.provinsi); // GANTI 'provinsi' JIKA property di GeoJSON Anda berbeda
        const population = provincePopulationData[provinceNameNormalized] ? provincePopulationData[provinceNameNormalized].totalPenduduk : 0;

        return {
            fillColor: getColor(population), // Warna isian berdasarkan populasi
            weight: 1,                       // Ketebalan garis batas
            opacity: 1,                      // Opasitas garis batas
            color: '#666',                   // Warna garis batas (abu-abu gelap)
            fillOpacity: 0.7                 // Opasitas warna isian
        };
    }

    // 3. Fungsi Highlight saat Mouse Hover
    function highlightFeature(e) {
        const layer = e.target;
        layer.setStyle({
            weight: 3,             // Garis batas lebih tebal
            color: '#333',        // Warna garis batas lebih gelap
            fillOpacity: 0.85     // Opasitas isian sedikit lebih pekat
        });

        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            layer.bringToFront(); // Bawa ke depan (kecuali di browser lama)
        }
         updateInfoBox(layer.feature.properties); // Update info box
    }

    // 4. Fungsi Reset Highlight saat Mouse Out
    function resetHighlight(e) {
        geojsonLayer.resetStyle(e.target); // Kembalikan ke gaya semula
        updateInfoBox(); // Kosongkan info box
    }

    // 5. Fungsi Zoom ke Fitur saat Diklik (Opsional)
    function zoomToFeature(e) {
        map.fitBounds(e.target.getBounds());
        // Bisa ditambahkan aksi lain di sini, misal tampilkan detail dari index.html
    }

    // 6. Fungsi untuk Menambahkan Listener ke Setiap Fitur
    function onEachFeature(feature, layer) {
        layer.on({
            mouseover: highlightFeature,
            mouseout: resetHighlight,
            click: zoomToFeature // Aktifkan zoom saat klik
            // click: showProvinceDetailFromList // Fungsi alternatif (lebih kompleks)
        });
    }

     // 7. Fungsi untuk Membuat/Memperbarui Info Box
     function createInfoBox() {
        infoBox = L.control(); // Buat kontrol Leaflet baru

        infoBox.onAdd = function (map) {
            this._div = L.DomUtil.create('div', 'info-box'); // Buat div dengan class CSS
            this.update();
            return this._div;
        };

        // Metode untuk update konten info box
        infoBox.update = function (props) {
            const provinceName = props ? props.provinsi : null; // GANTI 'provinsi' jika perlu
            const normalizedName = normalizeProvinceName(provinceName);
            const data = props && provincePopulationData[normalizedName]
                         ? provincePopulationData[normalizedName]
                         : null;

            this._div.innerHTML = '<h4>Sebaran Penduduk</h4>' +
                (props && data ?
                `<b>${provinceName}</b><br/>${formatNumber(data.totalPenduduk)} jiwa<br/>${data.kabkotCount} Kab/Kota`
                : 'Arahkan kursor ke provinsi');
        };

        infoBox.addTo(map);
    }
     // Panggil updateInfoBox dari highlight/reset
     const updateInfoBox = infoBox ? infoBox.update : () => {}; // Pastikan infoBox sudah dibuat

     // 8. Fungsi untuk Membuat Legenda
     function createLegend() {
        legend = L.control({position: 'bottomright'});

        legend.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info-box legend'); // Pakai class info-box juga + legend
            const grades = [0, 500000, 1000000, 2000000, 4000000, 8000000, 15000000, 30000000]; // Batas populasi
            const labels = [];
            let from, to;

            div.innerHTML += '<span class="legend-title">Penduduk (Jiwa)</span>'; // Judul legenda

            for (let i = 0; i < grades.length; i++) {
                from = grades[i];
                to = grades[i + 1];

                labels.push(
                    '<span><i style="background:' + getColor(from + 1) + '"></i> ' + // Tambah 1 agar masuk grade warna
                    formatNumber(from) + (to ? '–' + formatNumber(to) : '+') + '</span>');
            }

            div.innerHTML += labels.join(''); // Gabungkan semua label
            return div;
        };

        legend.addTo(map);
     }


    // --- Fungsi Utama ---
    async function initializeMap() {
         if(loadingMessage) loadingMessage.textContent = "Mengambil data...";

        try {
            // Ambil kedua data secara paralel
            const [populationResponse, geoJsonResponse] = await Promise.all([
                fetch(populationDataUrl),
                fetch(geoJsonUrl)
            ]);

            if (!populationResponse.ok) throw new Error(`Gagal memuat data penduduk: ${populationResponse.status}`);
            if (!geoJsonResponse.ok) throw new Error(`Gagal memuat data GeoJSON: ${geoJsonResponse.status}`);

            const rawData = await populationResponse.json();
            const geoJsonData = await geoJsonResponse.json();

            // Proses data penduduk (filter terbaru, group by province)
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
                const provinceNameNormalized = item.prov; // Sudah dinormalisasi saat filter
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
            map = L.map('map').setView([-2.5, 118.0], 5); // Center di Indonesia, zoom level 5

            // Tambahkan Tile Layer (Basemap)
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 18,
                attribution: '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            }).addTo(map);

            // Tambahkan Layer GeoJSON Provinsi
            console.log("Menambahkan layer GeoJSON...");
            geojsonLayer = L.geoJson(geoJsonData, {
                style: styleFeature,       // Terapkan gaya berdasarkan populasi
                onEachFeature: onEachFeature // Tambahkan interaksi hover/klik
            }).addTo(map);

             // Buat Info Box (panggil setelah map dibuat)
             createInfoBox();
             updateInfoBox(); // Panggil update awal

            // Buat Legenda (panggil setelah map dibuat)
            createLegend();

            console.log("Peta berhasil dimuat.");

        } catch (error) {
            console.error("Gagal menginisialisasi peta:", error);
            if(loadingMessage) {
                 loadingMessage.textContent = `Gagal memuat peta: ${error.message}`;
                 loadingMessage.style.color = '#d9534f';
            }
             titleLine1Element.textContent = "Gagal Memuat Peta";
             titleLine2Element.textContent = "";
             summaryCountElement.textContent = "Gagal memuat ringkasan";
        }
    }

    // Panggil fungsi inisialisasi
    initializeMap();
});
