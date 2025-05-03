document.addEventListener('DOMContentLoaded', () => {
    // Ambil elemen yang diperlukan
    const titleLine1Element = document.getElementById('main-title-line1');
    const titleLine2Element = document.getElementById('main-title-line2');
    const summaryCountElement = document.getElementById('summary-count');
    const chartCanvas = document.getElementById('provinceChartCanvas');
    const loadingMessage = document.querySelector('.chart-container .loading-message');

    // --- BARU: Elemen untuk grafik kab/kota ---
    const kabkotChartContainer = document.getElementById('kabkotChartContainer');
    const kabkotChartCanvas = document.getElementById('kabkotChartCanvas');
    const kabkotChartTitle = document.getElementById('kabkotChartTitle');

    const dataUrl = 'data/penduduk.json';

    // --- BARU: Variabel global untuk menyimpan data olahan dan instance chart ---
    let processedProvinceData = []; // Menyimpan { name, totalPenduduk, cities: [...], kabkotCount }
    let provinceLabels = []; // Menyimpan nama provinsi sesuai urutan grafik
    let kabkotChartInstance = null; // Menyimpan instance chart kab/kota

    function formatNumber(num) {
        if (typeof num !== 'number' || isNaN(num)) { return '0'; }
        return num.toLocaleString('id-ID');
    }

    async function fetchDataAndCreateChart() {
        try {
            const response = await fetch(dataUrl);
            if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
            const rawData = await response.json();

            // Langkah 1: Filter data terbaru (sama)
            const latestEntries = {};
            rawData.forEach(item => {
                const kabkot = (item.kabkot || "Unknown").trim();
                const year = parseInt(item.tahun) || 0;
                if (!latestEntries[kabkot] || year > latestEntries[kabkot].tahun) {
                    latestEntries[kabkot] = { ...item, tahun: year };
                }
            });
            const latestData = Object.values(latestEntries);

            // Langkah 2: Proses data terbaru untuk grafik & ringkasan
            const provincesTemp = {}; // Gunakan nama sementara
            let totalPopulation = 0;
            let minYear = Infinity;
            let maxYear = -Infinity;
            const totalKabkot = latestData.length;

            latestData.forEach(item => {
                const population = parseInt(item.penduduk) || 0;
                totalPopulation += population;
                const year = item.tahun;
                 if (year > 0) {
                    minYear = Math.min(minYear, year);
                    maxYear = Math.max(maxYear, year);
                 }
                const provinceName = item.prov || "Provinsi Tidak Diketahui";
                if (!provincesTemp[provinceName]) {
                    provincesTemp[provinceName] = { totalPenduduk: 0, kabkotCount: 0, cities: [] }; // Tambahkan array cities di sini
                }
                provincesTemp[provinceName].totalPenduduk += population;
                provincesTemp[provinceName].kabkotCount++;
                // Simpan detail kota/kabupaten untuk grafik sekunder
                provincesTemp[provinceName].cities.push({
                    name: item.kabkot,
                    population: population,
                    year: year // Simpan juga tahunnya jika perlu
                });
            });

             if (minYear === Infinity) minYear = "N/A";
             if (maxYear === -Infinity) maxYear = "N/A";
             const totalProvinces = Object.keys(provincesTemp).length;

            // Langkah 3: Update Judul dan Ringkasan (sama)
            titleLine1Element.textContent = `Data Penduduk Indonesia (${minYear} - ${maxYear})`;
            titleLine2Element.textContent = `TOTAL ${formatNumber(totalPopulation)} orang`;
            summaryCountElement.textContent = `${totalProvinces} Provinsi - ${totalKabkot} Kabupaten/Kota`;

            // Langkah 4: Siapkan data untuk Chart.js dan simpan secara global
            const sortedProvinces = Object.entries(provincesTemp)
                                        .sort((a, b) => a[0].localeCompare(b[0]))
                                        .map(([name, data]) => {
                                            // Sortir kota di dalam provinsi berdasarkan populasi (opsional, bisa juga nama)
                                            data.cities.sort((a, b) => b.population - a.population); // Urutkan dari terbesar
                                            return { name, ...data };
                                        });

            // --- BARU: Simpan data olahan ke variabel global ---
            processedProvinceData = sortedProvinces; // Simpan array objek provinsi lengkap
            provinceLabels = sortedProvinces.map(entry => entry.name); // Simpan label provinsi
            const populationData = sortedProvinces.map(entry => entry.totalPenduduk);
            const kabkotCounts = sortedProvinces.map(entry => entry.kabkotCount);

            if (loadingMessage) { loadingMessage.style.display = 'none'; }

            // Langkah 5: Buat Grafik Provinsi (fungsi createBarChart dimodifikasi sedikit)
            createProvinceChart(chartCanvas, provinceLabels, populationData, kabkotCounts);

        } catch (error) {
            console.error("Gagal memuat atau membuat grafik:", error);
             if (loadingMessage) { loadingMessage.textContent = 'Gagal memuat data grafik.'; loadingMessage.style.color = '#d9534f'; }
            titleLine1Element.textContent = "Gagal Memuat Grafik";
            titleLine2Element.textContent = "";
            summaryCountElement.textContent = "Gagal memuat ringkasan";
        }
    }

    // --- DIMODIFIKASI: Fungsi untuk membuat grafik batang PROVINSI ---
    function createProvinceChart(canvasElement, labels, populationData, kabkotCounts) {
        if (!canvasElement) { console.error("Elemen Canvas Provinsi tidak ditemukan!"); return; }
        const ctx = canvasElement.getContext('2d');

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Jumlah Penduduk',
                    data: populationData,
                    backgroundColor: 'rgba(74, 111, 165, 0.7)',
                    borderColor: 'rgba(74, 111, 165, 1)',
                    borderWidth: 1,
                    kabkotCounts: kabkotCounts // Simpan data tambahan
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // PENTING agar tinggi CSS efektif
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Jumlah Penduduk (Jiwa)' }
                    },
                    x: {
                        title: { display: true, text: 'Provinsi' },
                        ticks: { autoSkip: false, maxRotation: 90, minRotation: 60 } // Rotasi label X agar muat
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const labelIndex = context.dataIndex;
                                const populationValue = context.parsed.y;
                                const kabkotCount = context.dataset.kabkotCounts[labelIndex];
                                return [
                                    `Penduduk: ${formatNumber(populationValue)} jiwa`,
                                    `Jumlah Kab/Kota: ${kabkotCount}`
                                ];
                            }
                        }
                    }
                },
                // --- BARU: Event handler saat bar diklik ---
                onClick: (event, elements) => {
                    if (elements.length > 0) { // Pastikan ada elemen (bar) yang diklik
                        const clickedElementIndex = elements[0].index;
                        const clickedProvinceName = provinceLabels[clickedElementIndex]; // Dapatkan nama provinsi dari label

                        // Cari data detail provinsi yang diklik dari data global
                        const provinceDetail = processedProvinceData.find(p => p.name === clickedProvinceName);

                        if (provinceDetail && provinceDetail.cities) {
                            // Siapkan data untuk grafik kab/kota
                            const kabkotLabels = provinceDetail.cities.map(c => c.name);
                            const kabkotPopulations = provinceDetail.cities.map(c => c.population);

                            // Buat atau update grafik kab/kota
                            createOrUpdateKabkotChart(clickedProvinceName, kabkotLabels, kabkotPopulations);
                        } else {
                            console.warn("Data detail untuk provinsi", clickedProvinceName, "tidak ditemukan.");
                            // Sembunyikan kontainer kab/kota jika data tidak ada
                             if (kabkotChartInstance) kabkotChartInstance.destroy();
                             kabkotChartInstance = null;
                             kabkotChartContainer.style.display = 'none';
                        }
                    }
                }
                 // --- Akhir event handler ---
            }
        });
    }

    // --- BARU: Fungsi untuk membuat atau memperbarui grafik KAB/KOTA ---
    function createOrUpdateKabkotChart(provinceName, labels, populationData) {
        if (!kabkotChartCanvas) { console.error("Elemen Canvas Kab/Kota tidak ditemukan!"); return; }

        // Hancurkan grafik lama jika ada
        if (kabkotChartInstance) {
            kabkotChartInstance.destroy();
        }

        // Update judul grafik kab/kota
        kabkotChartTitle.textContent = `Penduduk Kabupaten/Kota di ${provinceName}`;

        const ctx = kabkotChartCanvas.getContext('2d');
        kabkotChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Jumlah Penduduk',
                    data: populationData,
                    backgroundColor: 'rgba(22, 160, 133, 0.7)', // Warna hijau toska
                    borderColor: 'rgba(22, 160, 133, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                 scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Jumlah Penduduk (Jiwa)' }
                    },
                     x: {
                        title: { display: true, text: 'Kabupaten/Kota' },
                         ticks: { autoSkip: false, maxRotation: 90, minRotation: 60 } // Rotasi label X
                     }
                 },
                 plugins: {
                    legend: { display: false },
                     tooltip: {
                        callbacks: {
                            // Tooltip standar sudah cukup, hanya tampilkan populasi
                            label: function(context) {
                                const populationValue = context.parsed.y;
                                return `Penduduk: ${formatNumber(populationValue)} jiwa`;
                            }
                        }
                     }
                 }
            }
        });

        // Tampilkan kontainer grafik kab/kota
        kabkotChartContainer.style.display = 'block';
        // Scroll ke grafik kab/kota agar terlihat (opsional)
        kabkotChartContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }


    // Panggil fungsi utama saat halaman siap
    fetchDataAndCreateChart();
});
