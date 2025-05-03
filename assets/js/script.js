document.addEventListener('DOMContentLoaded', () => {
    const titleElement = document.getElementById('main-title');
    const provinceListContainer = document.getElementById('province-list');
    const searchInput = document.getElementById('search-input');
    const loadingMessage = document.querySelector('.loading-message');

    const dataUrl = 'data/penduduk.json';
    let allProvincesData = []; // Simpan data provinsi yang sudah diproses untuk filtering

    // Fungsi untuk format angka Indonesia
    function formatNumber(num) {
        // Handle null/undefined/non-numeric inputs gracefully
        if (typeof num !== 'number' || isNaN(num)) {
            return '0'; // Atau 'N/A', atau handle sesuai kebutuhan
        }
        return num.toLocaleString('id-ID');
    }

    // Fungsi untuk mengambil dan memproses data
    async function fetchDataAndRender() {
        try {
            const response = await fetch(dataUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const rawData = await response.json();

            // ---- Langkah 1: Filter untuk mendapatkan data terbaru per kabkot ----
            const latestEntries = {}; // Objek untuk menyimpan data terbaru per kabkot
            rawData.forEach(item => {
                const kabkot = (item.kabkot || "Unknown").trim(); // Pastikan ada nama kabkot
                const year = parseInt(item.tahun) || 0;

                if (!latestEntries[kabkot] || year > latestEntries[kabkot].tahun) {
                    // Jika kabkot belum ada, atau tahun item ini lebih baru, simpan/update
                    latestEntries[kabkot] = { ...item, tahun: year }; // Simpan item lengkap, pastikan tahun adalah number
                }
            });
            // latestData kini berisi array dari objek data terbaru per kabkot
            const latestData = Object.values(latestEntries);

            // ---- Langkah 2: Proses data terbaru (Grouping, Summing, Min/Max Year) ----
            const provinces = {}; // Reset objek provinsi
            let totalPopulation = 0; // Reset total populasi
            let minYear = Infinity;
            let maxYear = -Infinity;

            latestData.forEach(item => {
                // Gunakan data yang sudah difilter (latestData)
                const population = parseInt(item.penduduk) || 0;
                totalPopulation += population; // Hitung total dari data terbaru saja

                const year = item.tahun; // Ambil tahun yang sudah pasti terbaru
                 if (year > 0) { // Cek lagi jika tahun valid
                    minYear = Math.min(minYear, year);
                    maxYear = Math.max(maxYear, year);
                 }

                const provinceName = item.prov || "Provinsi Tidak Diketahui";

                if (!provinces[provinceName]) {
                    provinces[provinceName] = { totalPenduduk: 0, cities: [] };
                }
                // Akumulasi total provinsi dari data terbaru saja
                provinces[provinceName].totalPenduduk += population;
                // Tambahkan kota/kab (yang sudah pasti terbaru) ke daftar
                provinces[provinceName].cities.push({
                    name: item.kabkot, // Nama sudah di-trim sebelumnya
                    population: population,
                    year: year // Tahun terbaru untuk kabkot ini
                });
            });

             // Setelah loop, ganti Infinity jika tidak ada tahun valid
             if (minYear === Infinity) minYear = "N/A";
             if (maxYear === -Infinity) maxYear = "N/A";

            // ---- Langkah 3: Update Judul Halaman (gunakan total & tahun dari data terbaru) ----
            titleElement.textContent = `Data Penduduk Indonesia Terbaru (${minYear} - ${maxYear}) TOTAL ${formatNumber(totalPopulation)} orang`;

            // ---- Langkah 4: Sortir dan Siapkan data untuk dirender (sama seperti sebelumnya) ----
            allProvincesData = Object.entries(provinces)
                .map(([name, data]) => {
                    data.cities.sort((a, b) => a.name.localeCompare(b.name));
                    return { name, ...data };
                })
                .sort((a, b) => a.name.localeCompare(b.name));

            // ---- Langkah 5: Render daftar provinsi awal ----
            renderProvinceList(allProvincesData);

        } catch (error) {
            console.error("Gagal memuat atau memproses data:", error);
            provinceListContainer.innerHTML = '<p class="error-message">Gagal memuat data penduduk. Silakan coba lagi nanti.</p>';
            titleElement.textContent = "Gagal Memuat Data";
        }
    }

    // Fungsi untuk merender daftar provinsi ke HTML (TIDAK ADA PERUBAHAN DI FUNGSI INI)
    function renderProvinceList(provincesToRender) {
        provinceListContainer.innerHTML = '';

        if (provincesToRender.length === 0) {
             provinceListContainer.innerHTML = '<p class="no-results-message">Tidak ada data provinsi yang cocok ditemukan.</p>';
             return;
        }

        provincesToRender.forEach(prov => {
            const provinceItem = document.createElement('div');
            provinceItem.classList.add('province-item');
            provinceItem.dataset.provinceName = prov.name.toLowerCase();

            const provinceHeader = document.createElement('div');
            provinceHeader.classList.add('province-header');
            provinceHeader.innerHTML = `
                <span class="province-name">${prov.name}</span>
                <span class="province-total">Total: ${formatNumber(prov.totalPenduduk)} jiwa</span>
            `;

            const cityList = document.createElement('ul');
            cityList.classList.add('city-list');

            prov.cities.forEach(city => {
                const cityItem = document.createElement('li');
                cityItem.classList.add('city-item');
                cityItem.dataset.cityName = city.name.toLowerCase();
                cityItem.innerHTML = `
                    <span class="city-name">${city.name}</span>
                    <span class="city-population">${formatNumber(city.population)} <span class="city-year">(${city.year || 'N/A'})</span></span>
                `;
                cityList.appendChild(cityItem);
            });

            provinceHeader.addEventListener('click', () => {
                provinceItem.classList.toggle('expanded');
            });

            provinceItem.appendChild(provinceHeader);
            provinceItem.appendChild(cityList);
            provinceListContainer.appendChild(provinceItem);
        });
    }

    // Fungsi untuk handle pencarian (TIDAK ADA PERUBAHAN DI FUNGSI INI)
    function handleSearch() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const allItems = provinceListContainer.querySelectorAll('.province-item');
        let visibleCount = 0;

        allItems.forEach(item => {
            const provinceName = item.dataset.provinceName;
            const cityNames = Array.from(item.querySelectorAll('.city-item'))
                                 .map(li => li.dataset.cityName);

            const isMatch = provinceName.includes(searchTerm) ||
                            cityNames.some(cityName => cityName.includes(searchTerm));

            if (isMatch) {
                item.classList.remove('hidden');
                visibleCount++;
            } else {
                item.classList.add('hidden');
            }
        });

         const noResultsMsg = provinceListContainer.querySelector('.no-results-message');
         if (visibleCount === 0 && searchTerm !== '') {
             if (!noResultsMsg) {
                 const msgElement = document.createElement('p');
                 msgElement.classList.add('no-results-message');
                 msgElement.textContent = 'Tidak ada provinsi atau kabupaten/kota yang cocok ditemukan.';
                 provinceListContainer.insertBefore(msgElement, provinceListContainer.firstChild);
             }
         } else {
             if (noResultsMsg) {
                 noResultsMsg.remove();
             }
         }
    }

    // Tambahkan event listener ke input search
    searchInput.addEventListener('input', handleSearch);

    // Mulai ambil dan render data saat halaman siap
    fetchDataAndRender();
});
