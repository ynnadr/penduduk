document.addEventListener('DOMContentLoaded', () => {
    // Ambil elemen yang diperlukan
    const titleLine1Element = document.getElementById('main-title-line1');
    const titleLine2Element = document.getElementById('main-title-line2');
    const summaryCountElement = document.getElementById('summary-count');
    const chartCanvas = document.getElementById('provinceChartCanvas'); // Canvas Grafik Provinsi
    const loadingMessage = document.querySelector('.chart-container .loading-message');

    // Elemen untuk grafik kab/kota
    const kabkotChartContainer = document.getElementById('kabkotChartContainer');
    const kabkotChartCanvas = document.getElementById('kabkotChartCanvas'); // Canvas Grafik Kab/Kota
    const kabkotChartTitle = document.getElementById('kabkotChartTitle');

    const dataUrl = 'data/penduduk.json';

    // Variabel global untuk menyimpan data olahan dan instance chart
    let processedProvinceData = []; // Menyimpan { name, totalPenduduk, cities: [...], kabkotCount }
    let provinceLabels = []; // Menyimpan nama provinsi sesuai urutan grafik
    let kabkotChartInstance = null; // Menyimpan instance chart kab/kota

    // Fungsi format angka (sama)
    function formatNumber(num) {
        if (typeof num !== 'number' || isNaN(num)) { return '0'; }
        return num.toLocaleString('id-ID');
    }

    // Fungsi utama untuk ambil data dan buat grafik
    async function fetchDataAndCreateChart() {
        try {
            const response = await fetch(dataUrl);
            if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
            const rawData = await response.json();

            // Langkah 1: Filter data terbaru per kabkot (sama)
            const latestEntries = {};
            rawData.forEach(item => {
                const kabkot = (item.kabkot || "Unknown").trim();
                const year = parseInt(item.tahun) || 0;
                if (!latestEntries[kabkot] || year > latestEntries[kabkot].tahun) {
                    latestEntries[kabkot] = { ...item, tahun: year };
                }
            });
            const latestData = Object.values(latestEntries);

            // Langkah 2: Proses data terbaru untuk grafik & ringkasan (sama)
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

            // Langkah 4: Siapkan data untuk Chart.js dan simpan secara global (sama)
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

            // Langkah 5: Buat Grafik Provinsi dengan Skala Logaritmik
            createProvinceChart(chartCanvas, provinceLabels, populationData, kabkotCounts);

        } catch (error) {
            console.error("Gagal memuat atau membuat grafik:", error);
             if (loadingMessage) { loadingMessage.textContent = 'Gagal memuat data grafik.'; loadingMessage.style.color = '#d9534f'; }
            titleLine1Element.textContent = "Gagal Memuat Grafik";
            titleLine2Element.textContent = "";
            summaryCountElement.textContent = "Gagal memuat ringkasan";
        }
    }

    // Fungsi untuk membuat grafik batang PROVINSI (dengan Skala Logaritmik)
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
                maintainAspectRatio: false, // Penting agar tinggi CSS efektif
                scales: {
                    // --- IMPLEMENTASI SKALA LOGARITMIK ---
                    y: {
                        type: 'logarithmic', // Tipe skala logaritmik
                        min: 10000, // Nilai minimum sumbu Y (sesuaikan jika perlu)
                        title: {
                            display: true,
                            text: 'Jumlah Penduduk (Jiwa) - Skala Logaritmik' // Beri keterangan
                        },
                        ticks: {
                            callback: function(value, index, ticks) {
                                // Format label sumbu Y agar lebih mudah dibaca
                                if (value === 10000 || value === 100000 || value === 1000000 || value === 10000000 || value === 100000000) {
                                    return formatNumber(value);
                                }
                                return ''; // Sembunyikan label minor
                            },
                        }
                    },
                    // --- AKHIR SKALA LOGARITMIK ---
                    x: {
                        title: { display: true, text: 'Provinsi' },
                        ticks: { autoSkip: false, maxRotation: 90, minRotation: 60 } // Rotasi label X
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const labelIndex = context.dataIndex;
                                const populationValue = context.raw; // Gunakan .raw untuk nilai asli pada skala log
                                const kabkotCount = context.dataset.kabkotCounts[labelIndex];
                                return [
                                    `Penduduk: ${formatNumber(populationValue)} jiwa`,
                                    `Jumlah Kab/Kota: ${kabkotCount}`
                                ];
                            }
                        }
                    }
                },
                // Event handler saat bar diklik (tetap sama)
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const clickedElementIndex = elements[0].index;
                        const clickedProvinceName = provinceLabels[clickedElementIndex];
                        const provinceDetail = processedProvinceData.find(p => p.name === clickedProvinceName);
                        if (provinceDetail && provinceDetail.cities) {
                            const kabkotLabels = provinceDetail.cities.map(c => c.name);
                            const kabkotPopulations = provinceDetail.cities.map(c => c.population);
                            createOrUpdateKabkotChart(clickedProvinceName, kabkotLabels, kabkotPopulations);
                        } else {
                            console.warn("Data detail untuk provinsi", clickedProvinceName, "tidak ditemukan.");
                             if (kabkotChartInstance) kabkotChartInstance.destroy();
                             kabkotChartInstance = null;
                             kabkotChartContainer.style.display = 'none';
                        }
                    }
                }
            }
        });
    }

    // Fungsi untuk membuat atau memperbarui grafik KAB/KOTA (tetap sama)
    function createOrUpdateKabkotChart(provinceName, labels, populationData) {
        if (!kabkotChartCanvas) { console.error("Elemen Canvas Kab/Kota tidak ditemukan!"); return; }
        if (kabkotChartInstance) { kabkotChartInstance.destroy(); }

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
                        beginAtZero: true, // Grafik kab/kota tetap linear
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
