document.addEventListener('DOMContentLoaded', () => {
    // Ambil elemen yang diperlukan
    const titleLine1Element = document.getElementById('main-title-line1');
    const titleLine2Element = document.getElementById('main-title-line2');
    const summaryCountElement = document.getElementById('summary-count');
    const chartCanvas = document.getElementById('provinceChartCanvas');
    const loadingMessage = document.querySelector('.chart-container .loading-message');

    const dataUrl = 'data/penduduk.json';

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

            // Langkah 2: Proses data terbaru untuk grafik & ringkasan
            const provinceDataForChart = {};
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

                if (!provinceDataForChart[provinceName]) {
                    // Simpan nama, total penduduk, dan hitung jumlah kabkot
                    provinceDataForChart[provinceName] = {
                        totalPenduduk: 0,
                        kabkotCount: 0
                    };
                }
                provinceDataForChart[provinceName].totalPenduduk += population;
                provinceDataForChart[provinceName].kabkotCount++; // Tambah hitungan kabkot
            });

             if (minYear === Infinity) minYear = "N/A";
             if (maxYear === -Infinity) maxYear = "N/A";

             const totalProvinces = Object.keys(provinceDataForChart).length;

            // Langkah 3: Update Judul dan Ringkasan (sama)
            titleLine1Element.textContent = `Data Penduduk Indonesia (${minYear} - ${maxYear})`;
            titleLine2Element.textContent = `TOTAL ${formatNumber(totalPopulation)} orang`;
            summaryCountElement.textContent = `${totalProvinces} Provinsi - ${totalKabkot} Kabupaten/Kota`;

            // Langkah 4: Siapkan data untuk Chart.js
            // Sortir provinsi berdasarkan nama untuk tampilan grafik yang urut
            const sortedProvinces = Object.entries(provinceDataForChart)
                                        .sort((a, b) => a[0].localeCompare(b[0]));

            const provinceLabels = sortedProvinces.map(entry => entry[0]); // Nama provinsi
            const populationData = sortedProvinces.map(entry => entry[1].totalPenduduk); // Total penduduk
            const kabkotCounts = sortedProvinces.map(entry => entry[1].kabkotCount); // Jumlah kabkot per provinsi

            // Sembunyikan pesan loading
            if (loadingMessage) {
                loadingMessage.style.display = 'none';
            }

            // Langkah 5: Buat Grafik menggunakan Chart.js
            createBarChart(chartCanvas, provinceLabels, populationData, kabkotCounts);

        } catch (error) {
            console.error("Gagal memuat atau membuat grafik:", error);
             if (loadingMessage) {
                 loadingMessage.textContent = 'Gagal memuat data grafik.';
                 loadingMessage.style.color = '#d9534f'; // Warna error
             }
            titleLine1Element.textContent = "Gagal Memuat Grafik";
            titleLine2Element.textContent = "";
            summaryCountElement.textContent = "Gagal memuat ringkasan";
        }
    }

    // Fungsi untuk membuat grafik batang
    function createBarChart(canvasElement, labels, populationData, kabkotCounts) {
        if (!canvasElement) {
            console.error("Elemen Canvas tidak ditemukan!");
            return;
        }
        const ctx = canvasElement.getContext('2d');

        new Chart(ctx, {
            type: 'bar', // Tipe grafik batang vertikal
            data: {
                labels: labels, // Nama Provinsi di sumbu X
                datasets: [{
                    label: 'Jumlah Penduduk', // Label untuk legenda (jika ditampilkan)
                    data: populationData, // Data populasi untuk tinggi batang
                    backgroundColor: 'rgba(74, 111, 165, 0.7)', // Warna isi batang (biru dengan sedikit transparansi)
                    borderColor: 'rgba(74, 111, 165, 1)', // Warna border batang
                    borderWidth: 1,
                    // Simpan data tambahan (jumlah kabkot) di sini agar bisa diakses tooltip
                    kabkotCounts: kabkotCounts
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // Biarkan chart menyesuaikan tinggi/lebar kontainer
                scales: {
                    y: { // Konfigurasi sumbu Y (Jumlah Penduduk)
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Jumlah Penduduk (Jiwa)'
                        }
                    },
                    x: { // Konfigurasi sumbu X (Provinsi)
                        title: {
                            display: true,
                            text: 'Provinsi'
                        },
                        ticks: {
                             // Jika label terlalu banyak, bisa diatur rotasinya
                             // maxRotation: 90,
                             // minRotation: 45
                             // Atau biarkan otomatis (default Chart.js cukup baik)
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false // Sembunyikan legenda karena hanya 1 dataset
                    },
                    tooltip: {
                        callbacks: {
                            // Fungsi untuk mengkustomisasi teks tooltip
                            label: function(context) {
                                const labelIndex = context.dataIndex;
                                const populationValue = context.parsed.y;
                                // Ambil jumlah kabkot dari data tambahan yang disimpan
                                const kabkotCount = context.dataset.kabkotCounts[labelIndex];

                                const formattedPopulation = formatNumber(populationValue);

                                // Kembalikan array string, setiap elemen jadi baris baru di tooltip
                                return [
                                    `Penduduk: ${formattedPopulation} jiwa`,
                                    `Jumlah Kab/Kota: ${kabkotCount}`
                                ];
                            }
                        }
                    }
                }
            }
        });
    }

    // Panggil fungsi utama saat halaman siap
    fetchDataAndCreateChart();
});
