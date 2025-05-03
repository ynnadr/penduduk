document.addEventListener('DOMContentLoaded', () => {
    // Ambil elemen yang diperlukan
    const titleLine1Element = document.getElementById('main-title-line1');
    const titleLine2Element = document.getElementById('main-title-line2');
    const summaryCountElement = document.getElementById('summary-count');
    const chartCanvas = document.getElementById('provinceChartCanvas');
    const loadingMessage = document.querySelector('.chart-container .loading-message');

    // Elemen untuk grafik kab/kota
    const kabkotChartContainer = document.getElementById('kabkotChartContainer');
    const kabkotChartCanvas = document.getElementById('kabkotChartCanvas');
    const kabkotChartTitle = document.getElementById('kabkotChartTitle');
    const kabkotChartSubTitle = document.getElementById('kabkotChartSubTitle'); // Elemen subjudul baru

    const dataUrl = 'data/penduduk.json';

    // Variabel global
    let processedProvinceData = [];
    let provinceLabels = [];
    let kabkotChartInstance = null;
    const POPULATION_THRESHOLD = 200000; // Batas populasi untuk klik label vs bar

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

            // Langkah 2: Proses data terbaru (sama)
            const provincesTemp = {};
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
                    provincesTemp[provinceName] = { totalPenduduk: 0, kabkotCount: 0, cities: [] };
                }
                provincesTemp[provinceName].totalPenduduk += population;
                provincesTemp[provinceName].kabkotCount++;
                provincesTemp[provinceName].cities.push({
                    name: item.kabkot,
                    population: population,
                    year: year
                });
            });

             if (minYear === Infinity) minYear = "N/A";
             if (maxYear === -Infinity) maxYear = "N/A";
             const totalProvinces = Object.keys(provincesTemp).length;

            // Langkah 3: Update Judul dan Ringkasan (sama)
            titleLine1Element.textContent = `Data Penduduk Indonesia (${minYear} - ${maxYear})`;
            titleLine2Element.textContent = `TOTAL ${formatNumber(totalPopulation)} orang`;
            summaryCountElement.textContent = `${totalProvinces} Provinsi - ${totalKabkot} Kabupaten/Kota`;

            // Langkah 4: Siapkan data untuk Chart.js dan simpan global (sama)
            const sortedProvinces = Object.entries(provincesTemp)
                                        .sort((a, b) => a[0].localeCompare(b[0]))
                                        .map(([name, data]) => {
                                            data.cities.sort((a, b) => b.population - a.population);
                                            return { name, ...data };
                                        });

            processedProvinceData = sortedProvinces;
            provinceLabels = sortedProvinces.map(entry => entry.name);
            const populationData = sortedProvinces.map(entry => entry.totalPenduduk);
            const kabkotCounts = sortedProvinces.map(entry => entry.kabkotCount);

            if (loadingMessage) { loadingMessage.style.display = 'none'; }

            // Langkah 5: Buat Grafik Provinsi (kembali ke Skala Linear)
            createProvinceChart(chartCanvas, provinceLabels, populationData, kabkotCounts);

        } catch (error) {
            console.error("Gagal memuat atau membuat grafik:", error);
             if (loadingMessage) { loadingMessage.textContent = 'Gagal memuat data grafik.'; loadingMessage.style.color = '#d9534f'; }
            titleLine1Element.textContent = "Gagal Memuat Grafik";
            titleLine2Element.textContent = "";
            summaryCountElement.textContent = "Gagal memuat ringkasan";
        }
    }

    // Fungsi untuk membuat grafik batang PROVINSI (Skala Linear, onClick Hybrid)
    function createProvinceChart(canvasElement, labels, populationData, kabkotCounts) {
        if (!canvasElement) { console.error("Elemen Canvas Provinsi tidak ditemukan!"); return; }
        const ctx = canvasElement.getContext('2d');

        // Hancurkan chart lama jika ada (misalnya jika data di-refresh)
        const existingChart = Chart.getChart(ctx);
        if (existingChart) {
            existingChart.destroy();
        }

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
                maintainAspectRatio: false,
                scales: {
                    // --- Kembali ke Skala Linear ---
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Jumlah Penduduk (Jiwa)'
                        }
                        // Tidak perlu ticks callback khusus lagi
                    },
                    // --- AKHIR Skala Linear ---
                    x: {
                        title: { display: true, text: 'Provinsi' },
                        ticks: { autoSkip: false, maxRotation: 90, minRotation: 60 }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const labelIndex = context.dataIndex;
                                const populationValue = context.parsed.y; // Kembali pakai parsed.y untuk linear
                                const kabkotCount = context.dataset.kabkotCounts[labelIndex];
                                return [
                                    `Penduduk: ${formatNumber(populationValue)} jiwa`,
                                    `Jumlah Kab/Kota: ${kabkotCount}`
                                ];
                            }
                        }
                    }
                },
                // --- REVISI LOGIKA onClick ---
                onClick: (event, elements, chart) => {
                    let clickedIndex = -1;
                    let triggerDetail = false;

                    if (elements.length > 0) { // Klik mengenai elemen (batang)
                        const index = elements[0].index;
                        const population = chart.data.datasets[0].data[index];
                        if (population >= POPULATION_THRESHOLD) {
                            clickedIndex = index;
                            triggerDetail = true;
                            console.log("Klik terdeteksi pada BAR > threshold:", provinceLabels[clickedIndex]);
                        } else {
                            console.log("Klik pada BAR < threshold, abaikan klik bar, target label.");
                            // Jangan trigger dari klik bar kecil
                        }
                    } else { // Klik tidak mengenai elemen, cek posisi dekat label X
                        const canvasPosition = Chart.helpers.getRelativePosition(event, chart);
                        const chartArea = chart.chartArea;
                        // Cek apakah klik di dalam area chart horizontal, dan di area bawah (dekat label X)
                        if (canvasPosition.x >= chartArea.left && canvasPosition.x <= chartArea.right &&
                            canvasPosition.y >= chartArea.bottom - 30 && canvasPosition.y <= chart.height) { // Cek area bawah (30px dari bottom chart area)

                            const dataX = chart.scales.x.getValueForPixel(canvasPosition.x);
                            if (dataX >= 0 && dataX < chart.data.labels.length) {
                                const index = Math.round(dataX);
                                const population = chart.data.datasets[0].data[index];
                                if (population < POPULATION_THRESHOLD) {
                                    clickedIndex = index;
                                    triggerDetail = true;
                                    console.log("Klik terdeteksi pada LABEL < threshold:", provinceLabels[clickedIndex]);
                                } else {
                                     console.log("Klik pada LABEL >= threshold, abaikan klik label.");
                                }
                            }
                        } else {
                            console.log("Klik di luar area chart atau jauh dari label X.");
                        }
                    }

                    // Jika ada target klik yang valid
                    if (triggerDetail && clickedIndex !== -1) {
                        const clickedProvinceName = provinceLabels[clickedIndex];
                        const provinceDetail = processedProvinceData.find(p => p.name === clickedProvinceName);

                        if (provinceDetail && provinceDetail.cities) {
                            const kabkotLabels = provinceDetail.cities.map(c => c.name);
                            const kabkotPopulations = provinceDetail.cities.map(c => c.population);
                            // --- Kirim kabkotCount ke fungsi detail ---
                            createOrUpdateKabkotChart(clickedProvinceName, provinceDetail.kabkotCount, kabkotLabels, kabkotPopulations);
                        } else {
                            console.warn("Data detail untuk provinsi", clickedProvinceName, "tidak ditemukan.");
                            if (kabkotChartInstance) kabkotChartInstance.destroy();
                            kabkotChartInstance = null;
                            kabkotChartContainer.style.display = 'none';
                        }
                    }
                }
                // --- Akhir revisi onClick ---
            }
        });
    }

    // --- REVISI: Fungsi untuk membuat atau memperbarui grafik KAB/KOTA (tambah kabkotCount) ---
    function createOrUpdateKabkotChart(provinceName, kabkotCount, labels, populationData) {
        if (!kabkotChartCanvas) { console.error("Elemen Canvas Kab/Kota tidak ditemukan!"); return; }
        if (kabkotChartInstance) { kabkotChartInstance.destroy(); }

        // Update judul dan subjudul
        kabkotChartTitle.textContent = `Penduduk Kabupaten/Kota di ${provinceName}`;
        kabkotChartSubTitle.textContent = `(${kabkotCount} Kabupaten/Kota)`; // Tampilkan jumlah

        const ctx = kabkotChartCanvas.getContext('2d');
        kabkotChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Jumlah Penduduk',
                    data: populationData,
                    backgroundColor: 'rgba(22, 160, 133, 0.7)',
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
                         ticks: { autoSkip: false, maxRotation: 90, minRotation: 60 }
                     }
                 },
                 plugins: {
                    legend: { display: false },
                     tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Penduduk: ${formatNumber(context.parsed.y)} jiwa`;
                            }
                        }
                     }
                 }
            }
        });

        kabkotChartContainer.style.display = 'block';
        kabkotChartContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Panggil fungsi utama saat halaman siap
    fetchDataAndCreateChart();
});
