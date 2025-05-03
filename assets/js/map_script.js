    // --- Fungsi Utama ---
    async function initializeMap() {
        if(loadingMessage) loadingMessage.textContent = "Mengambil data...";

        try {
            // Ambil KETIGA data secara paralel
            const [populationResponse, provinceGeoJsonResponse, kabkotGeoJsonResponse] = await Promise.all([
                fetch(populationDataUrl),
                fetch(geoJsonUrl), // provinsi.geojson
                fetch('geojson/kabupaten.geojson') // Fetch kabupaten.geojson juga
            ]);

            // Cek semua response
            if (!populationResponse.ok) throw new Error(`Gagal memuat data penduduk: ${populationResponse.status}`);
            if (!provinceGeoJsonResponse.ok) throw new Error(`Gagal memuat data GeoJSON Provinsi: ${provinceGeoJsonResponse.status}`);
            if (!kabkotGeoJsonResponse.ok) throw new Error(`Gagal memuat data GeoJSON Kabupaten: ${kabkotGeoJsonResponse.status}`);

            const rawData = await populationResponse.json();
            const provinceGeoJsonData = await provinceGeoJsonResponse.json(); // Data GeoJSON Provinsi
            const kabkotGeoJsonData = await kabkotGeoJsonResponse.json(); // Data GeoJSON Kab/Kota

            // Proses data penduduk (filter terbaru, group by province normal - TIDAK BERUBAH)
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
            let minYear = Infinity;
            let maxYear = -Infinity;
            const totalKabkot = latestData.length;

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

            if (minYear === Infinity) minYear = "N/A";
            if (maxYear === -Infinity) maxYear = "N/A";
            const totalProvinces = Object.keys(provincePopulationData).length;

            // Update Header (TIDAK BERUBAH)
            titleLine1Element.textContent = `Peta Sebaran Penduduk Indonesia (${minYear} - ${maxYear})`;
            titleLine2Element.textContent = `TOTAL ${formatNumber(totalPopulation)} orang`;
            summaryCountElement.textContent = `${totalProvinces} Provinsi - ${totalKabkot} Kabupaten/Kota`;

             if(loadingMessage) loadingMessage.style.display = 'none';

            // Inisialisasi Peta Leaflet (TIDAK BERUBAH)
            console.log("Inisialisasi peta...");
            map = L.map(mapElementId).setView([-2.5, 118.0], 5);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 18,
                attribution: '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            }).addTo(map);

            // Tambahkan Layer GeoJSON Provinsi (TIDAK BERUBAH, pastikan property 'PROVINSI' sudah benar)
            console.log("Menambahkan layer GeoJSON Provinsi...");
            geojsonLayer = L.geoJson(provinceGeoJsonData, {
                style: styleFeature,
                onEachFeature: onEachFeature
            }).addTo(map);

            // --- BARU: Tambahkan Layer GeoJSON Kabupaten/Kota ---
            console.log("Menambahkan layer GeoJSON Kabupaten/Kota...");
            const kabkotStyle = { // Gaya minimalis untuk overlay
                weight: 0.5,         // Garis tipis
                color: '#999999',    // Warna garis abu-abu
                dashArray: '3',      // Garis putus-putus (opsional)
                fillOpacity: 0       // Tidak ada warna isian
            };

            const kabkotLayer = L.geoJson(kabkotGeoJsonData, {
                style: kabkotStyle,
                onEachFeature: function (feature, layer) {
                    // Ambil nama dari properti WADMKK
                    const kabkotName = feature.properties.WADMKK || 'Nama Tidak Tersedia';
                    // Tambahkan tooltip sederhana saat hover
                    layer.bindTooltip(kabkotName, {
                        sticky: true, // Tooltip mengikuti kursor
                        direction: 'top', // Arah tooltip
                        opacity: 0.8
                    });
                }
            }).addTo(map);
            console.log("Layer Kabupaten/Kota ditambahkan.");
            // --- AKHIR Penambahan Layer Kab/Kota ---

            // Buat Info Box (TIDAK BERUBAH, pastikan property 'PROVINSI' sudah benar)
            createInfoBox();
            updateInfoBox(); // Panggil update awal untuk state default

            // Buat Legenda (TIDAK BERUBAH)
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

    // --- Fungsi utilitas lainnya tetap sama (getColor, styleFeature, highlightFeature, resetHighlight, zoomToFeature, onEachFeature, createInfoBox, createLegend) ---
    // Pastikan di dalam styleFeature dan infoBox.update, Anda sudah menggunakan feature.properties.PROVINSI

     // Contoh (pastikan sudah benar di kode Anda):
     function styleFeature(feature) {
        const provinceNameFromGeoJson = feature.properties.PROVINSI; // Cek ini
        // ... rest of the function
     }

     function createInfoBox() {
        // ... onAdd ...
        infoBox.update = function (props) {
            const provinceNameFromGeoJson = props ? props.PROVINSI : null; // Cek ini
            // ... rest of the function
        };
        // ... addTo(map) ...
     }


    // Panggil fungsi inisialisasi
    initializeMap();
});
